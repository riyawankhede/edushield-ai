import { readFileSync } from 'fs'
import { join } from 'path'
import mongoose from 'mongoose'

// Load env from .env.local
try {
  const envPath = join(process.cwd(), '.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  })
} catch (e) {
  console.warn('Could not load .env.local:', e)
}

// Import models and services
import { connectDB } from '../src/lib/db'
import { RiskScore, Student, AttendanceRecord, MoodCheckin, HomeworkSubmission, Assignment } from '../src/models'

async function diagnoseRiskDistribution() {
  try {
    console.log('🔗 Connecting to MongoDB...')
    await connectDB()
    console.log('✅ Connected\n')

    // Get all risk scores
    const riskScores = await RiskScore.find({ status: 'active' }).lean()
    console.log(`📊 Total Risk Scores: ${riskScores.length}`)

    if (riskScores.length === 0) {
      console.log('⚠️  No risk scores found. Run seed first.')
      process.exit(0)
    }

    // Calculate statistics
    const scores = riskScores.map(r => r.riskScore)
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

    console.log(`\n📈 Risk Score Distribution:`)
    console.log(`   Min:     ${(minScore * 100).toFixed(2)}%`)
    console.log(`   Max:     ${(maxScore * 100).toFixed(2)}%`)
    console.log(`   Average: ${(avgScore * 100).toFixed(2)}%`)

    // Count by threshold
    const above35 = scores.filter(s => s > 0.35).length
    const above50 = scores.filter(s => s > 0.50).length
    const above65 = scores.filter(s => s > 0.65).length
    const above75 = scores.filter(s => s > 0.75).length

    console.log(`\n🎯 Threshold Analysis:`)
    console.log(`   > 0.35 (Medium): ${above35} (${((above35 / scores.length) * 100).toFixed(1)}%)`)
    console.log(`   > 0.50:          ${above50} (${((above50 / scores.length) * 100).toFixed(1)}%)`)
    console.log(`   > 0.65 (High):   ${above65} (${((above65 / scores.length) * 100).toFixed(1)}%)`)
    console.log(`   > 0.75:          ${above75} (${((above75 / scores.length) * 100).toFixed(1)}%)`)

    // Count by category
    const lowCount = riskScores.filter(r => r.riskCategory === 'low').length
    const mediumCount = riskScores.filter(r => r.riskCategory === 'medium').length
    const highCount = riskScores.filter(r => r.riskCategory === 'high').length

    console.log(`\n📊 Category Distribution:`)
    console.log(`   🟢 Low:    ${lowCount} (${((lowCount / riskScores.length) * 100).toFixed(1)}%)`)
    console.log(`   🟡 Medium: ${mediumCount} (${((mediumCount / riskScores.length) * 100).toFixed(1)}%)`)
    console.log(`   🔴 High:   ${highCount} (${((highCount / riskScores.length) * 100).toFixed(1)}%)`)

    // Analyze contributing factors for top 10 scores
    console.log(`\n🔍 Top 10 Risk Scores Analysis:`)
    const topScores = riskScores.sort((a, b) => b.riskScore - a.riskScore).slice(0, 10)
    
    for (const score of topScores) {
      const student = await Student.findById(score.studentId).select('firstName lastName studentCode').lean()
      console.log(`\n   Student: ${student?.firstName} ${student?.lastName} (${student?.studentCode})`)
      console.log(`   Risk Score: ${(score.riskScore * 100).toFixed(2)}%`)
      console.log(`   Category: ${score.riskCategory.toUpperCase()}`)
      console.log(`   Factors:`)
      
      for (const factor of score.contributingFactors) {
        const contribution = (factor.weight * (typeof factor.value === 'number' ? factor.value : 0.5)) * 100
        console.log(`      - ${factor.factor}: weight=${factor.weight}, value=${factor.value}, contribution≈${contribution.toFixed(1)}%`)
        console.log(`        Description: ${factor.description}`)
      }
    }

    // Analyze factor distributions across all students
    console.log(`\n\n📊 Factor Analysis (All Students):`)
    
    // Analyze a sample of students to understand typical factor values
    const allStudents = await Student.find({ isActive: true }).select('_id classId').lean()
    const schoolId = riskScores[0].schoolId
    
    console.log(`\n🔍 Analyzing attendance data...`)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const sampleSize = Math.min(50, allStudents.length)
    const sampleStudents = allStudents.slice(0, sampleSize)
    
    const attendanceRates = []
    const moodAverages = []
    const homeworkRates = []
    
    for (const student of sampleStudents) {
      // Check attendance
      const attRecords = await AttendanceRecord.find({
        studentId: student._id,
        schoolId,
        date: { $gte: thirtyDaysAgo }
      }).lean()
      
      if (attRecords.length > 0) {
        const presentCount = attRecords.filter(r => r.status === 'present').length
        const rate = presentCount / attRecords.length
        attendanceRates.push(rate)
      }
      
      // Check mood
      const moods = await MoodCheckin.find({
        studentId: student._id,
        schoolId,
        date: { $gte: thirtyDaysAgo }
      }).lean()
      
      if (moods.length > 0) {
        const avgMood = moods.reduce((sum, m) => sum + m.moodScore, 0) / moods.length
        moodAverages.push(avgMood)
      }
      
      // Check homework
      if (student.classId) {
        const assignments = await Assignment.find({
          classId: student.classId,
          schoolId,
          createdAt: { $gte: thirtyDaysAgo }
        }).select('_id').lean()
        
        if (assignments.length > 0) {
          const submissions = await HomeworkSubmission.find({
            studentId: student._id,
            schoolId,
            assignmentId: { $in: assignments.map(a => a._id) }
          }).lean()
          
          const submittedCount = submissions.filter(s => s.status === 'submitted' || s.status === 'graded').length
          const rate = submittedCount / assignments.length
          homeworkRates.push(rate)
        }
      }
    }
    
    console.log(`\n📊 Sample Factor Statistics (${sampleSize} students):`)
    
    if (attendanceRates.length > 0) {
      const avgAttRate = attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length
      const minAttRate = Math.min(...attendanceRates)
      const maxAttRate = Math.max(...attendanceRates)
      console.log(`\n   Attendance Rates:`)
      console.log(`      Min: ${(minAttRate * 100).toFixed(1)}%`)
      console.log(`      Avg: ${(avgAttRate * 100).toFixed(1)}%`)
      console.log(`      Max: ${(maxAttRate * 100).toFixed(1)}%`)
      console.log(`      Target for low risk: 92%+`)
    }
    
    if (moodAverages.length > 0) {
      const avgMood = moodAverages.reduce((a, b) => a + b, 0) / moodAverages.length
      const minMood = Math.min(...moodAverages)
      const maxMood = Math.max(...moodAverages)
      console.log(`\n   Mood Scores (1-5 scale):`)
      console.log(`      Min: ${minMood.toFixed(2)}`)
      console.log(`      Avg: ${avgMood.toFixed(2)}`)
      console.log(`      Max: ${maxMood.toFixed(2)}`)
      console.log(`      Target for low risk: 4.2+`)
    }
    
    if (homeworkRates.length > 0) {
      const avgHwRate = homeworkRates.reduce((a, b) => a + b, 0) / homeworkRates.length
      const minHwRate = Math.min(...homeworkRates)
      const maxHwRate = Math.max(...homeworkRates)
      console.log(`\n   Homework Completion Rates:`)
      console.log(`      Min: ${(minHwRate * 100).toFixed(1)}%`)
      console.log(`      Avg: ${(avgHwRate * 100).toFixed(1)}%`)
      console.log(`      Max: ${(maxHwRate * 100).toFixed(1)}%`)
      console.log(`      Target for low risk: 92%+`)
    }
    
    // Check for behavior observations
    const { default: BehaviorObservation } = await import('../src/models/BehaviorObservation').catch(() => ({ default: null }))
    
    if (BehaviorObservation) {
      const behaviorCount = await BehaviorObservation.countDocuments({ schoolId })
      console.log(`\n   Behavior Observations: ${behaviorCount} records`)
    } else {
      console.log(`\n   Behavior Observations: ⚠️  Collection does not exist`)
    }

    console.log(`\n\n✅ Diagnosis complete`)
    process.exit(0)
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

diagnoseRiskDistribution()
