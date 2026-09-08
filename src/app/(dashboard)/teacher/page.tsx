import { currentTeacherMock } from "@/mock/teachers"
import { TeacherService } from "@/services/teacher.service"
import TeacherDashboardClient from "./TeacherDashboardClient"

export default async function TeacherDashboard() {
  let teacher = currentTeacherMock as Parameters<typeof TeacherDashboardClient>[0]["teacher"]
  let isLive = false

  try {
    const liveData = await TeacherService.getTeacherDashboard("me")
    if (liveData) {
      teacher = liveData as typeof teacher
      isLive = true
    }
  } catch (err) {
    console.warn("[Teacher Dashboard] Falling back to mock data:", err)
  }

  return <TeacherDashboardClient teacher={teacher} isLive={isLive} />
}
