import { parentDashboardMock } from "@/mock/students"
import { ParentService } from "@/services/parent.service"
import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CalendarCheck, ClipboardList, GraduationCap, Sparkles, Bell, Bus, BookOpen, CheckCircle2, AlertCircle, Database } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default async function ParentDashboard() {
  let data = parentDashboardMock
  let isLive = false

  try {
    const liveData = await ParentService.getParentDashboard("me")
    if (liveData) {
      data = liveData as typeof parentDashboardMock
      isLive = true
    }
  } catch (err) {
    console.warn("[Parent Dashboard] Falling back to mock data:", err)
  }

  const student = data.student
  const attendanceTrendVal = parseFloat(student.attendance.trend) || 0

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full min-w-0">
      {/* Page Header (Child Overview) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary/10">
            <AvatarImage src="/avatars/02.png" alt={student.name} />
            <AvatarFallback className="text-xl bg-primary/5 text-primary">
              {student.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {student.name}
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
            <div className="flex items-center gap-2 text-sm sm:text-base text-muted-foreground">
              <Badge variant="outline" className="font-normal">{student.grade}</Badge>
              <span className="text-success flex items-center gap-1 text-xs sm:text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {data.overallStatus}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.parentName && (
            <span className="text-xs text-muted-foreground hidden md:inline">
              Parent: <strong className="text-foreground">{data.parentName}</strong>
            </span>
          )}
          <Button variant="outline" className="shrink-0">
            Switch Child
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title="Attendance"
          value={`${student.attendance.percentage}%`}
          icon={CalendarCheck}
          trend={{ value: Math.abs(attendanceTrendVal), label: "vs last month", positive: attendanceTrendVal >= 0 }}
        />
        <StatCard
          title="Avg Performance"
          value={`${(student.academics.overallGPA / 4 * 100).toFixed(0)}%`}
          icon={BookOpen}
          description="Cumulative Score"
        />
        <StatCard
          title="Pending Homework"
          value={student.academics.pendingHomework}
          icon={ClipboardList}
          description={`${student.academics.overdueHomework} overdue`}
        />
        <StatCard
          title="Upcoming Exams"
          value={student.academics.upcomingExams}
          icon={GraduationCap}
          description={`Next: ${data.upcomingExamsList[0]?.subject || 'None'}`}
        />
      </div>

      {/* Main Content Area */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Column */}
        <div className="flex flex-col gap-4 lg:col-span-7 min-w-0">

          {/* Academic Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Academic Performance</CardTitle>
              <CardDescription>Recent scores across subjects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {student.academics.subjects.map((subject, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{subject.name}</span>
                      <span className="text-muted-foreground">{subject.score}%</span>
                    </div>
                    <Progress
                      value={subject.score}
                      indicatorClassName={
                        subject.score >= 90 ? "bg-success" :
                        subject.score >= 75 ? "bg-primary" :
                        "bg-warning"
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bus Status & Homework Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Bus Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bus className="h-4 w-4" />
                  Bus Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={data.busStatus.isDelayed ? "destructive" : "success"}>
                      {data.busStatus.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Location</span>
                    <span className="text-sm font-medium">{data.busStatus.location}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{data.busStatus.message}</p>
                </div>
              </CardContent>
            </Card>

            {/* Homework Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4" />
                  Homework
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Pending</span>
                    <span className="font-medium">{student.academics.pendingHomework}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Completed</span>
                    <span className="font-medium text-success">{student.academics.completedHomework}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Overdue</span>
                    <span className="font-medium text-destructive flex items-center gap-1">
                      {student.academics.overdueHomework > 0 && <AlertCircle className="h-3 w-3" />}
                      {student.academics.overdueHomework}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-4 lg:col-span-5 min-w-0">

          {/* AI Weekly Summary */}
          <Card className="border-info bg-info/5 shadow-none min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-info min-w-0">
                  <Sparkles className="h-5 w-5 shrink-0" />
                  <span className="truncate">AI Weekly Summary</span>
                </CardTitle>
                <Badge variant="outline" className="shrink-0 text-[10px] uppercase border-info/20 text-info">Live Insights</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium leading-relaxed">
                {data.aiWeeklySummary}
              </p>
            </CardContent>
          </Card>

          {/* Upcoming Exams */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming Exams</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.upcomingExamsList.map(exam => (
                  <div key={exam.id} className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">{exam.subject}</p>
                      <p className="text-xs text-muted-foreground">{exam.type} • {exam.date}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      In {exam.daysLeft} days
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* School Notices */}
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-5 w-5 shrink-0" />
                School Notices
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
