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

  try {
    const liveData = await AdminService.getAdminDashboard()
    if (liveData) {
      data = liveData as unknown as AdminDashboardData
      isLive = true
    }
  } catch (err) {
    console.warn("[Admin Dashboard] Falling back to mock data:", err)
  }

  return <AdminDashboardClient data={data} isLive={isLive} />
}
