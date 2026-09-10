import { connectDB } from '../src/lib/db'
import RiskScore from '../src/models/RiskScore'

// Load env from .env.local manually
import { readFileSync } from 'fs'
import { join } from 'path'

try {
  const envPath = join(process.cwd(), '.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()
      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  })
} catch (e) {
  console.warn('Could not load .env.local:', e)
}

async function checkRiskScores() {
  try {
    console.log('🔗 Connecting to MongoDB...')
    await connectDB()
    console.log('✅ Connected')

    const totalRiskScores = await RiskScore.countDocuments()
    console.log(`\n📊 Total Risk Scores: ${totalRiskScores}`)

    if (totalRiskScores > 0) {
      const highRisk = await RiskScore.countDocuments({ riskCategory: 'high', status: 'active' })
      const mediumRisk = await RiskScore.countDocuments({ riskCategory: 'medium', status: 'active' })
      const lowRisk = await RiskScore.countDocuments({ riskCategory: 'low', status: 'active' })

      console.log(`\n📈 Risk Distribution (Active):`)
      console.log(`   🔴 High:   ${highRisk}`)
      console.log(`   🟡 Medium: ${mediumRisk}`)
      console.log(`   🟢 Low:    ${lowRisk}`)

      // Sample one high-risk student
      const sampleHighRisk = await RiskScore.findOne({ riskCategory: 'high', status: 'active' })
        .populate('studentId', 'firstName lastName studentCode')
        .lean()

      if (sampleHighRisk) {
        console.log(`\n📋 Sample High-Risk Student:`)
        console.log(`   Student: ${(sampleHighRisk.studentId as any)?.firstName} ${(sampleHighRisk.studentId as any)?.lastName}`)
        console.log(`   Code: ${(sampleHighRisk.studentId as any)?.studentCode || 'N/A'}`)
        console.log(`   Risk Score: ${(sampleHighRisk.riskScore * 100).toFixed(1)}%`)
        console.log(`   Contributing Factors: ${sampleHighRisk.contributingFactors.length}`)
      }
    } else {
      console.log('\n⚠️  No risk scores found in database.')
      console.log('   Run: npx tsx scripts/seed.ts')
    }

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

checkRiskScores()
