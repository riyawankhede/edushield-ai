import { AdminService } from "@/services/admin.service"
import AdminDashboardClient, { AdminDashboardData } from "./AdminDashboardClient"
import {
  adminKPIData,
  academicPerformanceData,
  attendanceTrendData,
  riskDistributionData,
  safetyCategoryData,
  transportData,
  aiInsightsData,
  priorityActionsData,
  recentActivityData,
} from "@/mock/admin"

const fallbackData: AdminDashboardData = {
  name: "Principal Rajesh Mehta",
  schoolName: "Delhi Public Senior Secondary School",
  academicYear: "2026–27",
  kpis: adminKPIData.map((k) => ({
    title: k.title,
    value: k.value,
    trend: k.trend,
    trendDirection: k.trendDirection,
  })),
  attendanceSummary: {
    overallRate: 93.4,
    presentRate: 92.1,
    absentRate: 4.8,
    lateRate: 3.1,
  },
  academicPerformanceData,
  attendanceTrendData,
  riskDistributionData,
  safetyCategoryData,
  transportData,
  fleetSummary: {
    total: 26,
    active: 24,
    onTime: 21,
    delayed: 3,
  },
  aiInsights: aiInsightsData,
  priorityActions: priorityActionsData,
  recentActivity: recentActivityData,
}

export default async function AdminDashboardPage() {
  let data: AdminDashboardData = fallbackData
  let isLive = false
  let riskDistribution: { low: number; medium: number; high: number } | null = null

  try {
    const liveData = await AdminService.getAdminDashboard()
    if (liveData) {
      data = liveData as unknown as AdminDashboardData
      isLive = true
      
      // Fetch live risk distribution
      riskDistribution = await fetchRiskDistribution(liveData as { schoolId?: string; id?: string })
    }
  } catch (err) {
    console.warn("[Admin Dashboard] Falling back to mock data:", err)
  }

  return <AdminDashboardClient data={data} isLive={isLive} riskDistribution={riskDistribution} />
}

async function fetchRiskDistribution(adminData: { schoolId?: string; id?: string }) {
  try {
    const schoolId = adminData.schoolId || adminData.id
    
    // For a complete picture, we need to query all risk scores
    // Import the RiskScore model dynamically
    const { default: RiskScore } = await import('@/models/RiskScore')
    
    const [lowCount, mediumCount, highCount] = await Promise.all([
      RiskScore.countDocuments({ schoolId, riskCategory: 'low', status: 'active' }),
      RiskScore.countDocuments({ schoolId, riskCategory: 'medium', status: 'active' }),
      RiskScore.countDocuments({ schoolId, riskCategory: 'high', status: 'active' })
    ])
    
    return {
      low: lowCount,
      medium: mediumCount,
      high: highCount
    }
  } catch (err) {
    console.warn("[Risk Distribution] Failed:", err)
    return null
  }
}
