"use client"

import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { RiskBadge } from "@/components/ui/risk-badge"
import { CalendarCheck, ClipboardList, GraduationCap, Sparkles, Clock, MessageSquare, AlertTriangle, CheckCircle2, AlertCircle, FileText, Users, Activity, Bell, Database, TrendingDown } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface TeacherDashboardData {
  name: string
  role: string
  academicYear: string
  metrics: {
    totalStudents: number
    attendancePending: number
    homeworkPendingReview: number
    studentsRequiringAttention: number
  }
  classesToday: Array<{ id: number; time: string; subject: string; class: string; room: string; status: string }>
  attendanceTasks: Array<{ id: number; class: string; marked: number; total: number; pending: number; status: string }>
  studentsRequiringAttention: Array<{ id: number | string; name: string; class: string; indicator: string; stat: string; weakArea: string; status: string }>
  aiInsights: Array<{ id: number; type: string; message: string; severity: string; count: number; time: string }>
  academicPerformance: {
    classes: Array<{ name: string; average: number; improved: number; stable: number; declined: number }>
    trend: { improving: number; stable: number; declining: number }
  }
  homeworkReview: Array<{ id: number | string; subject: string; assignment: string; submissions: number; pending: number; status: string }>
  upcomingExams: Array<{ id: number; subject: string; date: string; class: string }>
  parentMessages: Array<{ id: number; parent: string; message: string; time: string; unread: boolean }>
  recentActivity: Array<{ id: number; action: string; time: string; icon: string }>
  assignedClasses?: Array<{ id: string; name: string }>
}

interface RiskData {
  students: Array<{
    student: { _id: string; firstName: string; lastName: string; studentCode?: string }
    riskScore: {
      _id: string
      riskScore: number
      riskCategory: "low" | "medium" | "high"
      contributingFactors: Array<{
        factor: string
        weight: number
        value: unknown
        description: string
      }>
    } | null
  }>
  highCount: number
  mediumCount: number
  lowCount: number
}

function generateRiskInsights(riskData: RiskData) {
  const insights = []

  if (riskData.highCount > 0) {
    insights.push({
      id: 1,
      type: "HIGH PRIORITY",
      message: `${riskData.highCount} student${riskData.highCount > 1 ? 's' : ''} require immediate counselor review for high-risk factors.`,
      severity: "high",
      count: riskData.highCount,
      time: "Current"
    })
  }

  if (riskData.mediumCount > 0) {
    insights.push({
      id: 2,
      type: "ATTENTION NEEDED",
      message: `${riskData.mediumCount} student${riskData.mediumCount > 1 ? 's show' : ' shows'} medium-risk indicators across attendance and academic performance.`,
      severity: "medium",
      count: riskData.mediumCount,
      time: "Current"
    })
  }

  // Find most common contributing factor
  const allFactors = riskData.students
    .filter(s => s.riskScore)
    .flatMap(s => s.riskScore!.contributingFactors)
  
  const factorCounts = new Map<string, number>()
  allFactors.forEach(f => {
    const count = factorCounts.get(f.factor) || 0
    factorCounts.set(f.factor, count + 1)
  })

  const topFactor = Array.from(factorCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]

  if (topFactor) {
    const factorName = topFactor[0].charAt(0).toUpperCase() + topFactor[0].slice(1)
    insights.push({
      id: 3,
      type: "TREND ANALYSIS",
      message: `${factorName} is the strongest contributing factor among at-risk students (${topFactor[1]} cases).`,
      severity: "info",
      count: topFactor[1],
      time: "Current"
    })
  }

  return insights
}

export default function TeacherDashboardClient({ teacher, isLive, riskData }: { teacher: TeacherDashboardData; isLive: boolean; riskData: RiskData | null }) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // Use live risk data if available, otherwise fall back to legacy data
  const hasLiveRiskData = riskData && riskData.students.length > 0
  const studentsToDisplay = hasLiveRiskData
    ? riskData.students.slice(0, 7)
    : teacher.studentsRequiringAttention

  const attentionRequiredCount = hasLiveRiskData
    ? riskData.highCount + riskData.mediumCount
    : teacher.metrics.studentsRequiringAttention

  // Generate data-driven insights
  const riskInsights = hasLiveRiskData && riskData ? generateRiskInsights(riskData) : []

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full min-w-0">

      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Good morning, {teacher.name}
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
            Here is your teaching overview for today.
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-medium">{today}</span>
            <span className="text-muted-foreground">•</span>
            <Badge variant="outline" className="font-normal text-xs">{teacher.academicYear}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {teacher.assignedClasses && teacher.assignedClasses.length > 0 && (
            <Select defaultValue="all">
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {teacher.assignedClasses.map((cls) => (
                  <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* 2. KEY METRICS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={teacher.metrics.totalStudents}
          icon={Users}
        />
        <StatCard
          title="Attendance Pending"
          value={`${teacher.metrics.attendancePending} Classes`}
          icon={CalendarCheck}
          description="Needs attention"
        />
        <StatCard
          title="Homework Pending"
          value={teacher.metrics.homeworkPendingReview}
          icon={ClipboardList}
          description="To review"
        />
        <StatCard
          title="Attention Required"
          value={attentionRequiredCount}
          icon={AlertCircle}
          description="Academic/Attendance risk"
          className="border-warning/50 bg-warning/5"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">

        {/* ROW 1 */}
        {/* Today's Classes */}
        <Card className="lg:col-span-7 min-w-0">
          <CardHeader>
            <CardTitle>Today&apos;s Classes</CardTitle>
            <CardDescription>Your schedule for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teacher.classesToday.map((cls) => (
                <div key={cls.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-secondary text-secondary-foreground font-bold text-sm">
                      {cls.time.split(' ')[0]}
                      <span className="text-[10px] font-normal uppercase">{cls.time.split(' ')[1]}</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm sm:text-base">{cls.subject} ({cls.class})</p>
                      <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {cls.room}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={cls.status === 'Completed' ? 'success' : cls.status === 'In Progress' ? 'info' : 'secondary'}
                    className="text-[10px] sm:text-xs"
                  >
                    {cls.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Attendance Tasks */}
        <Card className="lg:col-span-5 min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-5 w-5" /> Attendance Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teacher.attendanceTasks.map((task) => (
                <div key={task.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{task.class}</span>
                    <span className="text-xs text-muted-foreground">
                      {task.marked} / {task.total} marked
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={(task.marked / task.total) * 100} indicatorClassName={task.status === 'completed' ? 'bg-success' : 'bg-primary'} />
                    {task.status === 'pending' ? (
                      <Button size="sm" variant="outline" className="h-7 text-xs shrink-0">Mark</Button>
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ROW 2 */}
        {/* Students Requiring Attention */}
        <Card className="lg:col-span-7 min-w-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Students Requiring Attention</CardTitle>
              <Badge variant="outline" className="border-warning/50 text-warning bg-warning/10 text-[10px] uppercase">
                <Sparkles className="h-3 w-3 mr-1" /> {hasLiveRiskData ? "LIVE RISK DATA" : "DEMO INSIGHT"}
              </Badge>
            </div>
            <CardDescription>
              {hasLiveRiskData 
                ? "AI-powered risk assessment from real student data" 
                : "AI-flagged students needing support"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasLiveRiskData && riskData ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 rounded-t-lg">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg font-medium">Student</th>
                      <th className="px-4 py-3 font-medium">Risk Level</th>
                      <th className="px-4 py-3 font-medium">Score</th>
                      <th className="px-4 py-3 font-medium">Top Factors</th>
                      <th className="px-4 py-3 font-medium text-right rounded-tr-lg">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsToDisplay.map((item) => {
                      if (!('riskScore' in item)) {
                        // Legacy fallback data structure
                        return null
                      }
                      const { student, riskScore } = item
                      if (!riskScore) return null
                      
                      const topFactors = riskScore.contributingFactors
                        .sort((a, b) => b.weight * (typeof b.value === 'number' ? b.value : 0) - a.weight * (typeof a.value === 'number' ? a.value : 0))
                        .slice(0, 3)

                      return (
                        <tr key={student._id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {student.firstName[0]}{student.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-medium whitespace-nowrap">
                                  {student.firstName} {student.lastName}
                                </span>
                                {student.studentCode && (
                                  <span className="text-xs text-muted-foreground">{student.studentCode}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <RiskBadge category={riskScore.riskCategory} showIcon />
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-sm font-medium">
                              {(riskScore.riskScore * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {topFactors.map((factor, idx: number) => (
                                <div key={idx} className="flex items-center gap-1 text-xs text-muted-foreground">
                                  {factor.factor === 'attendance' && <TrendingDown className="h-3 w-3 text-destructive" />}
                                  {factor.factor === 'mood' && <AlertTriangle className="h-3 w-3 text-warning" />}
                                  {factor.factor === 'homework' && <ClipboardList className="h-3 w-3 text-warning" />}
                                  {factor.factor === 'behavior' && <AlertCircle className="h-3 w-3 text-warning" />}
                                  <span className="capitalize">{factor.factor}</span>
                                  {idx < topFactors.length - 1 && <span className="text-muted-foreground/50">•</span>}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="sm" className="h-8 text-xs">View</Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 rounded-t-lg">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg font-medium">Student</th>
                      <th className="px-4 py-3 font-medium hidden sm:table-cell">Class</th>
                      <th className="px-4 py-3 font-medium">Risk Indicator</th>
                      <th className="px-4 py-3 font-medium text-right rounded-tr-lg">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacher.studentsRequiringAttention.map((student) => (
                      <tr key={student.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {student.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-medium whitespace-nowrap">{student.name}</span>
                              <span className="text-xs text-muted-foreground sm:hidden">{student.class}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">{student.class}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs font-medium flex items-center gap-1 ${student.status === 'Critical' ? 'text-destructive' : 'text-warning'}`}>
                              {student.status === 'Critical' && <AlertTriangle className="h-3 w-3" />}
                              {student.indicator}
                            </span>
                            <span className="text-xs text-muted-foreground">{student.stat}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" className="h-8 text-xs">View</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card className="lg:col-span-5 border-info bg-info/5 shadow-none min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-info min-w-0">
                <Sparkles className="h-5 w-5 shrink-0" />
                <span className="truncate">AI Student Insights</span>
              </CardTitle>
              <Badge variant="outline" className="shrink-0 text-[10px] uppercase border-info/20 text-info">
                {hasLiveRiskData ? "Live Risk Data" : "Demo Data"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(hasLiveRiskData && riskInsights.length > 0 ? riskInsights : teacher.aiInsights).map((insight) => (
                <div key={insight.id} className="bg-background rounded-lg p-3 border shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">{insight.type}</span>
                    <span className="text-[10px] text-muted-foreground">{insight.time}</span>
                  </div>
                  <p className="text-sm font-medium">{hasLiveRiskData ? insight.message : insight.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ROW 3 */}
        {/* Academic Performance */}
        <Card className="lg:col-span-7 min-w-0">
          <CardHeader>
            <CardTitle>Academic Performance</CardTitle>
            <CardDescription>Class averages over recent assessments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teacher.academicPerformance.classes} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="average" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t">
              <div className="flex flex-col items-center">
                <span className="text-sm font-semibold text-success">{teacher.academicPerformance.trend.improving}%</span>
                <span className="text-xs text-muted-foreground">Improving</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm font-semibold text-muted-foreground">{teacher.academicPerformance.trend.stable}%</span>
                <span className="text-xs text-muted-foreground">Stable</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm font-semibold text-destructive">{teacher.academicPerformance.trend.declining}%</span>
                <span className="text-xs text-muted-foreground">Declining</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Exams */}
        <Card className="lg:col-span-5 min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Upcoming Exams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teacher.upcomingExams.map(exam => (
                <div key={exam.id} className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center bg-muted rounded-md p-2 w-12 h-12 shrink-0">
                    <span className="text-xs font-medium text-muted-foreground uppercase">{exam.date.split(' ')[1] || ''}</span>
                    <span className="text-sm font-bold leading-none">{exam.date.split(' ')[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{exam.subject}</p>
                    <p className="text-xs text-muted-foreground">Class: {exam.class}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ROW 4 */}
        {/* Homework Review */}
        <Card className="lg:col-span-7 min-w-0">
          <CardHeader>
            <CardTitle>Homework Review</CardTitle>
            <CardDescription>Recent assignments status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teacher.homeworkReview.map((hw) => (
                <div key={hw.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium text-sm">{hw.subject}: {hw.assignment}</p>
                    <p className="text-xs text-muted-foreground">{hw.submissions} submissions total</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {hw.pending > 0 ? (
                      <>
                        <Badge variant="warning" className="text-[10px]">{hw.pending} pending</Badge>
                        <Button size="sm" variant="outline" className="h-7 text-xs">Review</Button>
                      </>
                    ) : (
                      <Badge variant="success" className="text-[10px]">Completed</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Parent Messages */}
        <Card className="lg:col-span-5 min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-5 w-5" /> Recent Parent Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teacher.parentMessages.length > 0 ? teacher.parentMessages.map((msg) => (
                <div key={msg.id} className="space-y-1 border-b pb-3 last:border-0 last:pb-0 relative">
                  {msg.unread && <span className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-primary" />}
                  <div className={`flex items-center justify-between ${msg.unread ? 'pl-4' : ''}`}>
                    <span className="font-medium text-sm">{msg.parent}</span>
                    <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                  </div>
                  <p className={`text-xs line-clamp-2 ${msg.unread ? 'text-foreground pl-4' : 'text-muted-foreground'}`}>
                    &quot;{msg.message}&quot;
                  </p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No messages yet. Parent messaging will be available in Phase 5.</p>
              )}
            </div>
            <Button variant="ghost" size="sm" className="w-full mt-2 text-xs">View all messages</Button>
          </CardContent>
        </Card>
      </div>

      {/* BOTTOM SECTION */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-border">
              {teacher.recentActivity.length > 0 ? teacher.recentActivity.map((activity) => {
                const Icon = activity.icon === 'CalendarCheck' ? CalendarCheck :
                             activity.icon === 'ClipboardList' ? ClipboardList :
                             activity.icon === 'GraduationCap' ? GraduationCap : MessageSquare;

                return (
                  <div key={activity.id} className="relative flex gap-4 pl-8">
                    <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-background border shadow-sm">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col gap-1 w-full min-w-0">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <span className="text-[10px] text-muted-foreground">{activity.time}</span>
                    </div>
                  </div>
                )
              }) : (
                <p className="text-sm text-muted-foreground pl-8">Activity tracking will be available in Phase 5.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 items-center justify-center">
                <CalendarCheck className="h-5 w-5 text-primary" />
                <span className="text-xs">Mark Attendance</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-xs">Add Marks</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 items-center justify-center">
                <ClipboardList className="h-5 w-5 text-primary" />
                <span className="text-xs">Create Homework</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 items-center justify-center">
                <Bell className="h-5 w-5 text-primary" />
                <span className="text-xs">Create Notice</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-xs">View Students</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 items-center justify-center border-info/50 bg-info/5 hover:bg-info/10">
                <Sparkles className="h-5 w-5 text-info" />
                <span className="text-xs text-info font-medium">Review AI Insights</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
