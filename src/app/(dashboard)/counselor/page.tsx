import { currentCounselorMock } from "@/mock/counselors"
import { CounselorService } from "@/services/counselor.service"
import { RiskScoreService } from "@/services/risk-score.service"
import CounselorDashboardClient from "./CounselorDashboardClient"

export default async function CounselorDashboard() {
  let counselor = currentCounselorMock as Parameters<typeof CounselorDashboardClient>[0]["counselor"]
  let isLive = false
  // Cast to any to handle MongoDB ObjectId vs string type mismatch (demo mode)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let highRiskStudents: any[] = []

  try {
    const liveData = await CounselorService.getCounselorDashboard("me")
    if (liveData) {
      counselor = liveData as typeof counselor
      isLive = true
      
      // Fetch high-risk students for counselor review
      highRiskStudents = await fetchHighRiskStudents(counselor)
    }
  } catch (err) {
    console.warn("[Counselor Dashboard] Falling back to mock data:", err)
  }

  return <CounselorDashboardClient counselor={counselor} isLive={isLive} highRiskStudents={highRiskStudents} />
}

async function fetchHighRiskStudents(counselor: { schoolId?: string; id?: string }) {
  try {
    // Use the schoolId from counselor data or a default
    const schoolId = counselor.schoolId || counselor.id
    const highRisk = await RiskScoreService.getHighRiskStudents(schoolId || 'default')
    return highRisk.slice(0, 15) // Top 15 high-risk students
  } catch (err) {
    console.warn("[High Risk Students] Failed:", err)
    return []
  }
}
