"use client"

import { useState } from "react"
import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { RiskBadge } from "@/components/ui/risk-badge"
import { Lock, HeartPulse, AlertTriangle, ShieldAlert, CalendarClock, Activity, Eye, Sparkles, PhoneCall, CheckSquare, Database, TrendingDown, AlertCircle, ClipboardList } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"

const COLORS = ['var(--primary)', 'var(--info)', 'var(--warning)', 'var(--destructive)', 'hsl(var(--muted-foreground))']

interface HighRiskStudent {
  _id: string
  studentId: {
    _id: string
    firstName: string
    lastName: string
    studentCode?: string
    grade?: string
    section?: string
  }
  riskScore: number
  riskCategory: "high"
  contributingFactors: Array<{
    factor: string
    weight: number
    value: unknown
    description: string
  }>
  requiresCounselorReview: boolean
  assessmentDate: Date
}

export interface CounselorDashboardData {
  id: string
  staffCode: string
  name: string
  role: string
  metrics: {
    openCases: number
    highPriority: number
    safetyReports: number
    followUpsDue: number
  }
  priorityCases: Array<{ id: string; student: string; studentName?: string; category: string; priority: string; status: string; updated: string }>
  wellbeingTrends: Array<{ day: string; reports: number; checkIns: number; interactions: number }>
  caseCategories: Array<{ name: string; value: number }>
  activeInterventions: Array<{ id: number; student: string; intervention: string; status: string; nextReview: string }>
  followUpsDue: Array<{ id: number; time: string; caseId: string; student: string; category: string }>
  safetyReports: Array<{ id: number; category: string; location: string; priority: string; reported: string; status?: string; isAnonymous?: boolean }>
  riskInsights: Array<{ id: number; message: string; severity: string }>
  recentActivity: Array<{ id: number; message: string; time: string }>
}

export default function CounselorDashboardClient({ counselor, isLive, highRiskStudents }: { counselor: CounselorDashboardData; isLive: boolean; highRiskStudents: HighRiskStudent[] }) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  type Case = { id: string; student: string; studentName?: string; category: string; priority: string; status: string; updated: string }
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [selectedRiskStudent, setSelectedRiskStudent] = useState<HighRiskStudent | null>(null)

  const hasLiveRiskData = highRiskStudents && highRiskStudents.length > 0
  const highRiskCount = hasLiveRiskData ? highRiskStudents.length : counselor.metrics.highPriority

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full min-w-0">

      {/* 1. PAGE HEADER */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-muted-foreground bg-muted/30 w-fit px-2 py-1 rounded-md mb-2 border border-border/50">
          <Lock className="h-3 w-3" />
          <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider">Confidential Counselor Workspace</span>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Good morning, {counselor.name}
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
              Review student well-being, safety cases, and active interventions.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-medium">{today}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KEY METRICS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title="Open Cases"
          value={counselor.metrics.openCases}
          icon={HeartPulse}
          description="Well-being cases"
        />
        <StatCard
          title="High Priority"
          value={highRiskCount}
          icon={AlertTriangle}
          description="Requires immediate review"
          className="border-destructive/30 bg-destructive/5 text-destructive"
        />
        <StatCard
          title="Safety Reports"
          value={counselor.metrics.safetyReports}
          icon={ShieldAlert}
          description="Total reports logged"
        />
        <StatCard
          title="Follow-ups Due"
          value={counselor.metrics.followUpsDue}
          icon={CalendarClock}
          description="Action required"
          className="border-warning/50 bg-warning/5"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">

        {/* ROW 1 */}
        {/* Priority Cases */}
        <Card className="lg:col-span-8 min-w-0">
          <CardHeader>
            <CardTitle>Priority Cases</CardTitle>
            <CardDescription>Cases requiring your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 rounded-t-lg">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg font-medium">Case ID</th>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Category</th>
                    <th className="px-4 py-3 font-medium">Status / Priority</th>
                    <th className="px-4 py-3 font-medium text-right rounded-tr-lg">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {counselor.priorityCases.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-xs whitespace-nowrap">{c.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                              {c.student}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{c.student}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground sm:hidden block mt-1">{c.category}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{c.category}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {c.status}
                          </Badge>
                          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider">
                            <span className={`w-2 h-2 rounded-full ${c.priority === 'High' ? 'bg-destructive' : c.priority === 'Medium' ? 'bg-warning' : 'bg-info'}`} />
                            <span className={c.priority === 'High' ? 'text-destructive' : c.priority === 'Medium' ? 'text-warning' : 'text-info'}>{c.priority}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedCase(c)}>Review Case</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Students Requiring Counselor Review - HIGH RISK */}
        {hasLiveRiskData && (
          <Card className="lg:col-span-12 border-destructive/30 bg-destructive/5 min-w-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Students Requiring Counselor Review
                </CardTitle>
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                  Live Risk Assessment
                </Badge>
              </div>
              <CardDescription>
                High-risk students identified by AI-powered risk assessment (requires human review)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left bg-background rounded-lg">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg font-medium">Student</th>
                      <th className="px-4 py-3 font-medium">Grade</th>
                      <th className="px-4 py-3 font-medium">Risk Score</th>
                      <th className="px-4 py-3 font-medium">Contributing Factors</th>
                      <th className="px-4 py-3 font-medium">Assessment Date</th>
                      <th className="px-4 py-3 font-medium text-right rounded-tr-lg">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highRiskStudents.slice(0, 10).map((student) => {
                      const topFactors = student.contributingFactors
                        .sort((a, b) => {
                          const aValue = typeof a.value === 'number' ? a.value : 0
                          const bValue = typeof b.value === 'number' ? b.value : 0
                          return b.weight * bValue - a.weight * aValue
                        })
                        .slice(0, 4)
                      
                      return (
                        <tr key={student._id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-destructive/10 text-destructive text-xs font-medium">
                                  {student.studentId.firstName[0]}{student.studentId.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {student.studentId.firstName} {student.studentId.lastName}
                                </span>
                                {student.studentId.studentCode && (
                                  <span className="text-xs text-muted-foreground">{student.studentId.studentCode}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm">
                              {student.studentId.grade || '–'} {student.studentId.section || ''}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <RiskBadge category={student.riskCategory} showIcon />
                              <span className="text-xs font-mono text-muted-foreground">
                                Score: {(student.riskScore * 100).toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {topFactors.map((factor, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-xs">
                                  {factor.factor === 'attendance' && <TrendingDown className="h-3 w-3 text-destructive" />}
                                  {factor.factor === 'mood' && <AlertCircle className="h-3 w-3 text-warning" />}
                                  {factor.factor === 'homework' && <ClipboardList className="h-3 w-3 text-warning" />}
                                  {factor.factor === 'behavior' && <AlertTriangle className="h-3 w-3 text-warning" />}
                                  <span className="capitalize font-medium">{factor.factor}:</span>
                                  <span className="text-muted-foreground">{factor.description}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-muted-foreground">
                              {new Date(student.assessmentDate).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-xs border-destructive/30 hover:bg-destructive/10"
                              onClick={() => setSelectedRiskStudent(student)}
                            >
                              Review Details
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {highRiskStudents.length > 10 && (
                <div className="mt-4 text-center">
                  <Button variant="outline" size="sm" className="text-xs">
                    View All {highRiskStudents.length} High-Risk Students
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Follow-ups Due */}
        <Card className="lg:col-span-4 min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-5 w-5" /> Follow-ups Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {counselor.followUpsDue.map((task) => (
                <div key={task.id} className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-primary">{task.time}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{task.caseId}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-medium text-sm">Student {task.student}</span>
                    <Badge variant="secondary" className="text-[10px] font-normal">{task.category}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ROW 2 */}
        {/* Well-being Overview */}
        <Card className="lg:col-span-8 min-w-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Well-being Overview</CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground font-normal">{isLive ? "Live Baseline" : "Demo / Synthetic Data"}</Badge>
            </div>
            <CardDescription>Activity volume over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={counselor.wellbeingTrends} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCheckIns" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="checkIns" stroke="var(--primary)" fillOpacity={1} fill="url(#colorCheckIns)" name="Check-ins" />
                  <Area type="monotone" dataKey="reports" stroke="var(--destructive)" fillOpacity={1} fill="url(#colorReports)" name="Reports" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Case Category Distribution */}
        <Card className="lg:col-span-4 min-w-0">
          <CardHeader>
            <CardTitle>Case Categories</CardTitle>
            <CardDescription>Distribution of active cases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={counselor.caseCategories} margin={{ top: 0, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} width={90} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {counselor.caseCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Academic Stress is currently the most common reported category.
            </p>
          </CardContent>
        </Card>

        {/* ROW 3 */}
        {/* Active Interventions */}
        <Card className="lg:col-span-8 min-w-0">
          <CardHeader>
            <CardTitle>Active Interventions</CardTitle>
            <CardDescription>Ongoing support plans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {counselor.activeInterventions.map((intervention) => (
                <div key={intervention.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {intervention.student}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <p className="font-medium text-sm truncate">{intervention.intervention}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Student: {intervention.student}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                    <div className="flex flex-col items-start sm:items-end">
                      <Badge variant={intervention.status === 'Active' ? 'success' : 'secondary'} className="text-[10px]">
                        {intervention.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground mt-1">Review: {intervention.nextReview}</span>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs shrink-0">View</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Safety Reports */}
        <Card className="lg:col-span-4 min-w-0 border-destructive/20 bg-destructive/5 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <ShieldAlert className="h-5 w-5" /> Recent Safety Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {counselor.safetyReports.map((report) => (
                <div key={report.id} className="bg-background rounded-lg p-3 border shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{report.category}</span>
                    <span className="text-[10px] text-muted-foreground">{report.reported}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">Loc: {report.location}</span>
                    <Badge variant="outline" className={`text-[9px] uppercase ${report.priority === 'High' ? 'border-destructive text-destructive' : 'border-warning text-warning'}`}>
                      {report.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full mt-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
              View All Safety Reports
            </Button>
          </CardContent>
        </Card>

        {/* ROW 4 */}
        {/* Risk Insights */}
        <Card className="lg:col-span-8 border-info bg-info/5 shadow-none min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-info min-w-0">
                <Sparkles className="h-5 w-5 shrink-0" />
                <span className="truncate">Student Support Insights</span>
              </CardTitle>
              <Badge variant="outline" className="shrink-0 text-[10px] uppercase border-info/20 text-info">{isLive ? "Database Baseline" : "Demo Data"}</Badge>
            </div>
            <CardDescription className="text-info/80">AI decision support signals (Not a clinical diagnosis)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {counselor.riskInsights.map((insight) => (
                <div key={insight.id} className="bg-background rounded-lg p-3 border shadow-sm flex items-start gap-3">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${insight.severity === 'high' ? 'bg-destructive' : 'bg-warning'}`} />
                  <p className="text-sm font-medium">{insight.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-4 min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-border">
              {counselor.recentActivity.map((activity) => {
                return (
                  <div key={activity.id} className="relative flex gap-4 pl-8">
                    <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-background border shadow-sm">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                    </div>
                    <div className="flex flex-col gap-1 w-full min-w-0">
                      <p className="text-sm font-medium leading-tight">{activity.message}</p>
                      <span className="text-[10px] text-muted-foreground">{activity.time}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BOTTOM SECTION */}
      {/* Quick Actions */}
      <Card className="min-w-0 bg-muted/20 border-dashed">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 items-center justify-center bg-background">
              <Eye className="h-5 w-5 text-primary" />
              <span className="text-xs text-center">Priority Cases</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 items-center justify-center bg-background">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <span className="text-xs text-center">Safety Reports</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 items-center justify-center bg-background">
              <HeartPulse className="h-5 w-5 text-primary" />
              <span className="text-xs text-center">Well-being</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 items-center justify-center bg-background">
              <CheckSquare className="h-5 w-5 text-primary" />
              <span className="text-xs text-center">Interventions</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 items-center justify-center bg-background sm:col-span-1 col-span-2">
              <PhoneCall className="h-5 w-5 text-primary" />
              <span className="text-xs text-center">Follow-up</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Case Detail Modal */}
      <Dialog open={!!selectedCase} onOpenChange={(open) => !open && setSelectedCase(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className="font-mono text-xs">{selectedCase?.id}</Badge>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
                <span className={`w-2 h-2 rounded-full ${selectedCase?.priority === 'High' ? 'bg-destructive' : selectedCase?.priority === 'Medium' ? 'bg-warning' : 'bg-info'}`} />
                <span className={selectedCase?.priority === 'High' ? 'text-destructive' : selectedCase?.priority === 'Medium' ? 'text-warning' : 'text-info'}>{selectedCase?.priority} Priority</span>
              </div>
            </div>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">{selectedCase?.student}</AvatarFallback>
              </Avatar>
              Student {selectedCase?.student}
            </DialogTitle>
            <DialogDescription>
              {selectedCase?.category} • Status: <span className="font-medium text-foreground">{selectedCase?.status}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">Last Updated</span>
                <p className="font-medium">{selectedCase?.updated}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">Assigned Counselor</span>
                <p className="font-medium">{counselor.name}</p>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Case Timeline</h4>
              <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-2 before:w-px before:bg-border">
                <div className="relative flex gap-3 pl-6">
                  <div className="absolute left-0 top-1 h-4 w-4 rounded-full bg-background border border-primary flex items-center justify-center" />
                  <div>
                    <p className="text-xs font-medium">Case updated to {selectedCase?.status}</p>
                    <span className="text-[10px] text-muted-foreground">{selectedCase?.updated}</span>
                  </div>
                </div>
                <div className="relative flex gap-3 pl-6">
                  <div className="absolute left-0 top-1 h-4 w-4 rounded-full bg-muted flex items-center justify-center" />
                  <div>
                    <p className="text-xs font-medium">Initial case assessment logged</p>
                    <span className="text-[10px] text-muted-foreground">3 days ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between border-t pt-4">
            <Button variant="outline" onClick={() => setSelectedCase(null)}>Close Viewer</Button>
            <div className="flex gap-2">
              <Button variant="outline" className="w-full sm:w-auto">Update Status</Button>
              <Button className="w-full sm:w-auto">Schedule Follow-up</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Risk Student Detail Modal */}
      <Dialog open={!!selectedRiskStudent} onOpenChange={(open) => !open && setSelectedRiskStudent(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <div className="flex items-center justify-between mb-2">
              <RiskBadge category={selectedRiskStudent?.riskCategory || 'high'} score={selectedRiskStudent?.riskScore} showIcon />
              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                {selectedRiskStudent?.requiresCounselorReview ? 'REQUIRES REVIEW' : 'ASSESSED'}
              </Badge>
            </div>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-destructive/10 text-destructive text-xs">
                  {selectedRiskStudent?.studentId.firstName[0]}{selectedRiskStudent?.studentId.lastName[0]}
                </AvatarFallback>
              </Avatar>
              {selectedRiskStudent?.studentId.firstName} {selectedRiskStudent?.studentId.lastName}
            </DialogTitle>
            <DialogDescription>
              {selectedRiskStudent?.studentId.studentCode} • Grade {selectedRiskStudent?.studentId.grade} {selectedRiskStudent?.studentId.section}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">Risk Score</span>
                <p className="font-bold text-lg text-destructive font-mono">
                  {selectedRiskStudent ? (selectedRiskStudent.riskScore * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">Assessment Date</span>
                <p className="font-medium">
                  {selectedRiskStudent ? new Date(selectedRiskStudent.assessmentDate).toLocaleDateString() : ''}
                </p>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Contributing Risk Factors
              </h4>
              <div className="space-y-3">
                {selectedRiskStudent?.contributingFactors
                  .sort((a, b) => {
                    const aValue = typeof a.value === 'number' ? a.value : 0
                    const bValue = typeof b.value === 'number' ? b.value : 0
                    return b.weight * bValue - a.weight * aValue
                  })
                  .map((factor, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border">
                      <div className="shrink-0 mt-0.5">
                        {factor.factor === 'attendance' && <TrendingDown className="h-4 w-4 text-destructive" />}
                        {factor.factor === 'mood' && <AlertCircle className="h-4 w-4 text-warning" />}
                        {factor.factor === 'homework' && <ClipboardList className="h-4 w-4 text-warning" />}
                        {factor.factor === 'behavior' && <AlertTriangle className="h-4 w-4 text-warning" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold capitalize">{factor.factor}</span>
                          <span className="text-xs text-muted-foreground">Weight: {(factor.weight * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{factor.description}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="border-t pt-4">
              <div className="bg-info/10 border border-info/20 rounded-lg p-3">
                <p className="text-xs text-info/90 flex items-start gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    This is an AI-generated risk assessment, not a clinical diagnosis. 
                    Counselor review and professional judgment are required before taking action.
                  </span>
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setSelectedRiskStudent(null)}>Close</Button>
            <div className="flex gap-2">
              <Button variant="outline" className="w-full sm:w-auto">Create Case</Button>
              <Button className="w-full sm:w-auto bg-destructive hover:bg-destructive/90">Schedule Intervention</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
