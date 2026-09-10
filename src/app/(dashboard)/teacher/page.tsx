import { currentTeacherMock } from "@/mock/teachers"
import { TeacherService } from "@/services/teacher.service"
import { RiskScoreService } from "@/services/risk-score.service"
import TeacherDashboardClient from "./TeacherDashboardClient"

export default async function TeacherDashboard() {
  let teacher = currentTeacherMock as Parameters<typeof TeacherDashboardClient>[0]["teacher"]
  let isLive = false
  let riskData: Awaited<ReturnType<typeof fetchRiskDataForTeacher>> | null = null

  try {
    const liveData = await TeacherService.getTeacherDashboard("me")
    if (liveData) {
      teacher = liveData as typeof teacher
      isLive = true
      
      // Fetch risk scores for the teacher's assigned classes
      riskData = await fetchRiskDataForTeacher(teacher)
    }
  } catch (err) {
    console.warn("[Teacher Dashboard] Falling back to mock data:", err)
  }

  return <TeacherDashboardClient teacher={teacher} isLive={isLive} riskData={riskData} />
}

async function fetchRiskDataForTeacher(teacher: { assignedClasses?: Array<{ id: string }>; schoolId?: string }) {
  try {
    // Get all students from teacher's assigned classes
    const assignedClasses = teacher.assignedClasses || []
    if (assignedClasses.length === 0) {
      return { students: [], highCount: 0, mediumCount: 0, lowCount: 0 }
    }

    // Get risk scores for all classes
    const allRiskScores = await Promise.all(
      assignedClasses.map((cls) =>
        RiskScoreService.getRiskScoresForClass(cls.id, teacher.schoolId || cls.id).catch(() => [])
      )
    )

    // Flatten and filter
    // Cast to any to handle MongoDB ObjectId vs string type mismatch (demo mode)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const students = (allRiskScores.flat() as any[])
      .filter((item) => item.riskScore && item.riskScore.riskCategory !== "low")
      .sort((a, b) => (b.riskScore?.riskScore || 0) - (a.riskScore?.riskScore || 0))
      .slice(0, 10) // Top 10 most at-risk students

    // Count by category
    const highCount = students.filter((s) => s.riskScore?.riskCategory === "high").length
    const mediumCount = students.filter((s) => s.riskScore?.riskCategory === "medium").length
    const lowCount = students.filter((s) => s.riskScore?.riskCategory === "low").length

    return { students, highCount, mediumCount, lowCount }
  } catch (err) {
    console.warn("[Risk Data Fetch] Failed:", err)
    return { students: [], highCount: 0, mediumCount: 0, lowCount: 0 }
  }
}
