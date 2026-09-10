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

import { connectDB } from '../src/lib/db'
import { Student, AttendanceRecord, MoodCheckin, HomeworkSubmission, Assignment } from '../src/models'

async function diagnoseSeedData() {
  try {
    console.log('🔗 Connecting to MongoDB...')
    await connectDB()
    console.log('✅ Connected\n')

    const students = await Student.find({ isActive: true }).select('_id classId').lean()
    const schoolId = students[0]?.schoolId || 'unknown'
    
    console.log(`📊 Total Students: ${students.length}`)
    console.log(`🏫 School ID: ${schoolId}\n`)

    // Check date ranges for seeded data
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    console.log(`📅 Date Window for Risk Calculation:`)
    console.log(`   From: ${thirtyDaysAgo.toISOString().split('T')[0]}`)
    console.log(`   To:   ${new Date().toISOString().split('T')[0]}\n`)

    // Check attendance records
    const totalAttendance = await AttendanceRecord.countDocuments({})
    const recentAttendance = await AttendanceRecord.countDocuments({
      date: { $gte: thirtyDaysAgo }
    })
    
    // Get date range of attendance records
    const oldestAtt = await AttendanceRecord.findOne({}).sort({ date: 1 }).select('date').lean()
    const newestAtt = await AttendanceRecord.findOne({}).sort({ date: -1 }).select('date').lean()
    
    console.log(`📊 Attendance Records:`)
    console.log(`   Total: ${totalAttendance}`)
    console.log(`   In last 30 days: ${recentAttendance}`)
    if (oldestAtt && newestAtt) {
      console.log(`   Date range: ${new Date(oldestAtt.date).toISOString().split('T')[0]} to ${new Date(newestAtt.date).toISOString().split('T')[0]}`)
    }
    
    // Sample a few students to see their attendance
    const sampleStudent = students[0]
    if (sampleStudent) {
      const studentAtt = await AttendanceRecord.find({
        studentId: sampleStudent._id,
        date: { $gte: thirtyDaysAgo }
      }).lean()
      console.log(`   Sample student (${sampleStudent._id}) recent attendance: ${studentAtt.length} records`)
    }

    // Check mood checkins
    const totalMood = await MoodCheckin.countDocuments({})
    const recentMood = await MoodCheckin.countDocuments({
      date: { $gte: thirtyDaysAgo }
    })
    
    const oldestMood = await MoodCheckin.findOne({}).sort({ date: 1 }).select('date').lean()
    const newestMood = await MoodCheckin.findOne({}).sort({ date: -1 }).select('date').lean()
    
    console.log(`\n📊 Mood Check-ins:`)
    console.log(`   Total: ${totalMood}`)
    console.log(`   In last 30 days: ${recentMood}`)
    if (oldestMood && newestMood) {
      console.log(`   Date range: ${new Date(oldestMood.date).toISOString().split('T')[0]} to ${new Date(newestMood.date).toISOString().split('T')[0]}`)
    }
    
    if (sampleStudent) {
      const studentMood = await MoodCheckin.find({
        studentId: sampleStudent._id,
        date: { $gte: thirtyDaysAgo }
      }).lean()
      console.log(`   Sample student (${sampleStudent._id}) recent mood: ${studentMood.length} records`)
      if (studentMood.length > 0) {
        const avgMood = studentMood.reduce((sum, m) => sum + m.moodScore, 0) / studentMood.length
        console.log(`   Sample student avg mood: ${avgMood.toFixed(2)}`)
      }
    }

    // Check homework
    const totalAssignments = await Assignment.countDocuments({})
    const recentAssignments = await Assignment.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    })
    
    const oldestAssignment = await Assignment.findOne({}).sort({ createdAt: 1 }).select('createdAt').lean()
    const newestAssignment = await Assignment.findOne({}).sort({ createdAt: -1 }).select('createdAt').lean()
    
    console.log(`\n📊 Assignments:`)
    console.log(`   Total: ${totalAssignments}`)
    console.log(`   Created in last 30 days: ${recentAssignments}`)
    if (oldestAssignment && newestAssignment) {
      console.log(`   Date range: ${oldestAssignment.createdAt ? new Date(oldestAssignment.createdAt).toISOString().split('T')[0] : 'unknown'} to ${newestAssignment.createdAt ? new Date(newestAssignment.createdAt).toISOString().split('T')[0] : 'unknown'}`)
    }
    
    const totalSubmissions = await HomeworkSubmission.countDocuments({})
    console.log(`\n📊 Homework Submissions:`)
    console.log(`   Total: ${totalSubmissions}`)
    
    if (sampleStudent && sampleStudent.classId) {
      const classAssignments = await Assignment.find({
        classId: sampleStudent.classId,
        createdAt: { $gte: thirtyDaysAgo }
      }).select('_id').lean()
      
      const studentSubmissions = await HomeworkSubmission.find({
        studentId: sampleStudent._id,
        assignmentId: { $in: classAssignments.map(a => a._id) }
      }).lean()
      
      console.log(`   Sample student (${sampleStudent._id}) recent assignments: ${classAssignments.length}`)
      console.log(`   Sample student submissions: ${studentSubmissions.length}`)
      if (studentSubmissions.length > 0) {
        const submitted = studentSubmissions.filter(s => s.status === 'submitted' || s.status === 'graded').length
        console.log(`   Sample student completion rate: ${((submitted / classAssignments.length) * 100).toFixed(1)}%`)
      }
    }

    // Analyze the issue
    console.log(`\n\n🔍 ROOT CAUSE ANALYSIS:`)
    
    const daysDiff = (new Date().getTime() - new Date(newestAtt?.date || 0).getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysDiff > 30) {
      console.log(`\n⚠️  ISSUE FOUND: Attendance records are too old!`)
      console.log(`   Newest attendance record: ${newestAtt ? new Date(newestAtt.date).toISOString().split('T')[0] : 'none'}`)
      console.log(`   Days ago: ${Math.round(daysDiff)}`)
      console.log(`   Risk calculation window: last 30 days from TODAY`)
      console.log(`   Result: NO attendance records fall within the risk calculation window`)
      console.log(`   Impact: All students get default attendance risk (0.4) instead of calculated risk`)
    }
    
    const moodDaysDiff = (new Date().getTime() - new Date(newestMood?.date || 0).getTime()) / (1000 * 60 * 60 * 24)
    
    if (moodDaysDiff > 30) {
      console.log(`\n⚠️  ISSUE FOUND: Mood check-ins are too old!`)
      console.log(`   Newest mood check-in: ${newestMood ? new Date(newestMood.date).toISOString().split('T')[0] : 'none'}`)
      console.log(`   Days ago: ${Math.round(moodDaysDiff)}`)
      console.log(`   Result: All students get default mood risk (0.3) instead of calculated risk`)
    }
    
    const assignmentDaysDiff = (new Date().getTime() - new Date(newestAssignment?.createdAt || 0).getTime()) / (1000 * 60 * 60 * 24)
    
    if (assignmentDaysDiff > 30) {
      console.log(`\n⚠️  ISSUE FOUND: Assignments are too old!`)
      console.log(`   Newest assignment: ${newestAssignment?.createdAt ? new Date(newestAssignment.createdAt).toISOString().split('T')[0] : 'none'}`)
      console.log(`   Days ago: ${Math.round(assignmentDaysDiff)}`)
      console.log(`   Result: Students may get default homework risk instead of calculated risk`)
    }

    console.log(`\n\n✅ Diagnosis complete`)
    process.exit(0)
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

diagnoseSeedData()
