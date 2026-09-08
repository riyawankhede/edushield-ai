import { currentCounselorMock } from "@/mock/counselors"
import { CounselorService } from "@/services/counselor.service"
import CounselorDashboardClient from "./CounselorDashboardClient"

export default async function CounselorDashboard() {
  let counselor = currentCounselorMock as Parameters<typeof CounselorDashboardClient>[0]["counselor"]
  let isLive = false

  try {
    const liveData = await CounselorService.getCounselorDashboard("me")
    if (liveData) {
      counselor = liveData as typeof counselor
      isLive = true
    }
  } catch (err) {
    console.warn("[Counselor Dashboard] Falling back to mock data:", err)
  }

  return <CounselorDashboardClient counselor={counselor} isLive={isLive} />
}
