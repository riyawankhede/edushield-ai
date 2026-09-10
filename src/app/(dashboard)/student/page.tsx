import { currentStudentMock } from "@/mock/students"
import { StudentService } from "@/services/student.service"
import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarCheck, ClipboardList, GraduationCap, Sparkles, Clock, Bell, ChevronRight, Database } from "lucide-react"
import { PerformancePredictionCard } from "@/components/dashboard/PerformancePredictionCard"
import { StudyPlanCard } from "@/components/dashboard/StudyPlanCard"

export default async function StudentDashboard() {
  let student = currentStudentMock
  let isLive = false
  let studentId: string | undefined

  try {
    const liveData = await StudentService.getStudentSummary("me")
    if (liveData) {
      student = liveData as typeof currentStudentMock
      isLive = true
      studentId = liveData._id // Use MongoDB ObjectId
    }
  } catch (err) {
    console.warn("[Student Dashboard] Falling back to mock data:", err)
  }

  const attendanceTrendVal = parseFloat(student.attendance.trend) || 0

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full min-w-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Good morning, {student.name.split(' ')[0]}
            </h1>
            {isLive ? (
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10 flex items-center gap-1">
                <Database className="h-3 w-3" /> Live DB
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted-foreground/30">
                Mock Fallback
              </Badge>
            )}
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            Here is your academic overview for today • Grade {student.grade}
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title="Attendance"
          value={`${student.attendance.percentage}%`}
          icon={CalendarCheck}
          trend={{ value: Math.abs(attendanceTrendVal), label: "vs last month", positive: attendanceTrendVal >= 0 }}
        />
        <StatCard
          title="Pending Homework"
          value={student.academics.pendingHomework}
          icon={ClipboardList}
          description={`${student.academics.completedHomework || 0} completed`}
        />
        <StatCard
          title="Upcoming Exams"
          value={student.academics.upcomingExams}
          icon={GraduationCap}
          description="Next exam cycle"
        />
        <StatCard
          title="Overall GPA"
          value={student.academics.overallGPA}
          icon={Sparkles}
          description="Cumulative score"
        />
      </div>

      {/* AI Performance Prediction - NEW FEATURE */}
      {studentId && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PerformancePredictionCard studentId={studentId} />
          <StudyPlanCard studentId={studentId} />
        </div>
      )}

      {/* Schedule + Side Cards */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Today's Schedule */}
        <Card className="lg:col-span-7 min-w-0">
          <CardHeader>
            <CardTitle>Today&apos;s Schedule</CardTitle>
            <CardDescription>You have {student.classesToday.length} classes today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {student.classesToday.map((cls) => (
                <div key={cls.id} className="flex items-center gap-3 sm:gap-4 rounded-lg border p-2.5 sm:p-3">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground text-sm sm:text-base font-bold">
                    {cls.time.split(':')[0]}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm sm:text-base font-medium leading-none truncate">{cls.subject}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {cls.teacher} • {cls.room}
                    </p>
                  </div>
                  <div className="hidden sm:flex text-sm text-muted-foreground shrink-0 items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {cls.time}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Side Column: AI Recommendation + Notices */}
        <div className="flex flex-col gap-4 lg:col-span-5 min-w-0">
          {/* AI Study Recommendation */}
          <Card className="border-info bg-info/5 shadow-none min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-info min-w-0">
                  <Sparkles className="h-5 w-5 shrink-0" />
                  <span className="truncate">AI Study Recommendation</span>
                </CardTitle>
                <Badge variant="outline" className="shrink-0 text-[10px] uppercase border-info/20 text-info">AI Signal</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium mb-3">
                {student.aiInsights?.recommendation || "Focus on key topics ahead of upcoming assessments."}
              </p>
              <Button variant="secondary" className="w-full text-xs h-8 bg-info text-info-foreground hover:bg-info/90">
                View Full Study Plan <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          {/* Recent Notices */}
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 shrink-0" />
                Recent Notices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {student.notices.map((notice) => (
                  <div key={notice.id} className="flex items-start justify-between gap-2 border-b pb-3 last:border-0 last:pb-0">
                    <div className="space-y-1 min-w-0">
                      <div className="text-sm font-medium leading-none flex items-center gap-2">
                        <span className="truncate">{notice.title}</span>
                        {notice.isNew && <Badge variant="destructive" className="shrink-0 h-4 px-1 text-[8px] uppercase">New</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{notice.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
