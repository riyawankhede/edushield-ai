"use client"

import React from "react"
import {
  Users,
  GraduationCap,
  CalendarCheck,
  AlertCircle,
  ShieldAlert,
  Bus,
  ArrowUpRight,
  ChevronRight,
  Activity,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Database
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/ui/stat-card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area
} from "recharts"

const KPI_ICONS = [Users, GraduationCap, CalendarCheck, AlertCircle, ShieldAlert, Bus]

export interface AdminDashboardData {
  name: string
  schoolName: string
  academicYear: string
  kpis: Array<{
    title: string
    value: string
    trend?: string
    trendDirection?: "up" | "down" | "neutral"
  }>
  attendanceSummary: {
    overallRate: number
    presentRate: number
    absentRate: number
    lateRate: number
  }
  academicPerformanceData: Array<{ month: string; score: number }>
  attendanceTrendData: Array<{ week: string; rate: number }>
  riskDistributionData: Array<{ name: string; value: number; fill: string }>
  safetyCategoryData: Array<{ name: string; value: number; fill: string }>
  transportData: Array<{ id: string; status: string; color: string }>
  fleetSummary: {
    total: number
    active: number
    onTime: number
    delayed: number
  }
  aiInsights: Array<{ id: number; type: string; insight: string }>
  priorityActions: Array<{ id: number; priority: string; title: string; timestamp: string; actionText: string }>
  recentActivity: Array<{ id: number; title: string; time: string }>
}

export default function AdminDashboardClient({
  data,
  isLive,
}: {
  data: AdminDashboardData
  isLive: boolean
}) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-full">
      {/* 2. Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Good morning, {data.name}
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
          <p className="text-slate-500 mt-1">
            Executive overview: academic performance, attendance, safety, transportation, and school operations.
          </p>
        </div>
        <div className="flex flex-col items-end">
          <Badge variant="outline" className="bg-white">
            Academic Year: {data.academicYear}
          </Badge>
          <span className="text-xs text-slate-400 mt-2">Delhi Public Senior Secondary School</span>
        </div>
      </div>

      {/* 3. Executive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {data.kpis.map((kpi, index) => {
          const Icon = KPI_ICONS[index % KPI_ICONS.length]
          return (
            <StatCard
              key={index}
              title={kpi.title}
              value={kpi.value}
              icon={Icon}
              description={kpi.trend}
              trend={
                kpi.trendDirection === "up"
                  ? { value: 1.2, label: "up", positive: true }
                  : kpi.trendDirection === "down"
                  ? { value: 6, label: "down", positive: false }
                  : undefined
              }
            />
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">

        {/* 4. School Performance Overview */}
        <Card className="lg:col-span-8 min-w-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>School Academic Performance</CardTitle>
              <CardDescription>Average student performance across assessments</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs">
              View detailed analytics <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 mb-6">
              <div>
                <p className="text-sm text-slate-500 font-medium">Current Average</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">78.4%</span>
                  <span className="text-sm text-emerald-500 font-medium flex items-center">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    +1.6%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Previous Period</p>
                <p className="text-xl font-semibold text-slate-700">76.8%</p>
              </div>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.academicPerformanceData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#1e2d5a"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#1e2d5a", strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "#3b82f6" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 5. Attendance Overview */}
        <Card className="lg:col-span-4 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle>Attendance Overview</CardTitle>
            <CardDescription>School-wide attendance distribution (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-4xl font-bold text-slate-900">{data.attendanceSummary.overallRate}%</p>
                <p className="text-sm text-slate-500 font-medium">Overall Rate</p>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                {isLive ? "Live Sync" : "Stable"}
              </Badge>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Present</span>
                  <span className="font-medium">{data.attendanceSummary.presentRate}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${data.attendanceSummary.presentRate}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Absent</span>
                  <span className="font-medium">{data.attendanceSummary.absentRate}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${data.attendanceSummary.absentRate}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Late</span>
                  <span className="font-medium">{data.attendanceSummary.lateRate}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${data.attendanceSummary.lateRate}%` }}></div>
                </div>
              </div>
            </div>

            <div className="h-[80px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.attendanceTrendData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <RechartsTooltip contentStyle={{ fontSize: "12px" }} />
                  <Area type="monotone" dataKey="rate" stroke="#10b981" fillOpacity={1} fill="url(#colorRate)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-center text-slate-500 mt-2">
              Attendance records calculated across 108,000 seeded event entries.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">

        {/* 6. Student Risk Distribution */}
        <Card className="lg:col-span-6 min-w-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Student Support Overview</CardTitle>
              <CardDescription>Risk distribution across the student body</CardDescription>
            </div>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 uppercase text-[10px] font-bold">
              {isLive ? "DB BASELINE" : "DEMO DATA"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              <div className="h-[200px] w-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.riskDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {data.riskDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-3 w-full md:w-auto">
                {data.riskDistributionData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }}></div>
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-700">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 p-4 bg-slate-50 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Students requiring additional support:</p>
                <p className="text-2xl font-bold text-amber-600">38</p>
              </div>
              <Button variant="outline" size="sm">
                Review with Counselor
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 10. AI Analytics */}
        <Card className="lg:col-span-6 min-w-0 border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-md">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-indigo-900">AI School Insights</CardTitle>
                <CardDescription>Decision-support baseline signals</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-none uppercase text-[10px] font-bold">
              {isLive ? "Live Baseline" : "Demo Data"}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.aiInsights.map((insight) => (
              <div key={insight.id} className="flex gap-3 p-3 rounded-lg bg-white border border-indigo-50 shadow-sm">
                <div className={`mt-0.5 flex-shrink-0 ${insight.type === "positive" ? "text-emerald-500" : insight.type === "alert" ? "text-rose-500" : "text-amber-500"}`}>
                  {insight.type === "positive" ? <CheckCircle2 className="h-4 w-4" /> : insight.type === "alert" ? <AlertTriangle className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                </div>
                <p className="text-sm text-slate-700 leading-snug">{insight.insight}</p>
              </div>
            ))}
            <div className="text-xs text-slate-500 mt-2 text-center italic">
              These are operational baseline signals and require human review. (Full ML in Phase 6)
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">

        {/* 7. Safety Analytics */}
        <Card className="lg:col-span-6 min-w-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Safety Analytics</CardTitle>
              <CardDescription>School-wide incident category distribution</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-800">
              View safety center <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 mb-6">
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-slate-900">120</p>
                <p className="text-xs text-slate-500 font-medium uppercase mt-1">Total</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-rose-600">76</p>
                <p className="text-xs text-rose-600 font-medium uppercase mt-1">Open</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-amber-600">18</p>
                <p className="text-xs text-amber-600 font-medium uppercase mt-1">Review</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-emerald-600">26</p>
                <p className="text-xs text-emerald-600 font-medium uppercase mt-1">Resolved</p>
              </div>
            </div>

            <div className="h-[150px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.safetyCategoryData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} width={100} />
                  <RechartsTooltip cursor={{ fill: "transparent" }} contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                    {data.safetyCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 8. Safety Hotspot Preview */}
        <Card className="lg:col-span-6 min-w-0 bg-slate-900 text-slate-50 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none" style={{ backgroundImage: "radial-gradient(#475569 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>
          <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <CardTitle className="text-slate-100 flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-rose-400" />
                Campus Safety Hotspots
              </CardTitle>
              <CardDescription className="text-slate-400">Incident concentration (Seeded database baseline)</CardDescription>
            </div>
            <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">
              {isLive ? "DB BASELINE" : "SYNTHETIC DATA"}
            </Badge>
          </CardHeader>
          <CardContent className="relative z-10 pt-6 h-[250px] flex items-center justify-center">

            <div className="relative w-full max-w-[400px] h-full flex flex-col items-center justify-center">

              {/* Library Hotspot */}
              <div className="absolute top-4 left-10 flex flex-col items-center group">
                <div className="w-4 h-4 bg-amber-500 rounded-full animate-pulse opacity-80"></div>
                <div className="w-3 h-3 bg-amber-500 rounded-full absolute top-0.5 left-0.5"></div>
                <div className="mt-2 bg-slate-800 px-2 py-1 rounded text-[10px] font-medium border border-slate-700 flex flex-col items-center opacity-80 group-hover:opacity-100 transition-opacity">
                  <span className="text-slate-200">Library</span>
                  <span className="text-amber-400">Low density</span>
                </div>
              </div>

              {/* Playground Hotspot */}
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 flex flex-col items-center group">
                <div className="w-6 h-6 bg-rose-500 rounded-full animate-pulse opacity-80"></div>
                <div className="w-4 h-4 bg-rose-500 rounded-full absolute top-1 left-1"></div>
                <div className="mt-2 bg-slate-800 px-2 py-1 rounded text-[10px] font-medium border border-slate-700 flex flex-col items-center opacity-80 group-hover:opacity-100 transition-opacity">
                  <span className="text-slate-200">Playground</span>
                  <span className="text-rose-400">High density</span>
                </div>
              </div>

              {/* Bus Area Hotspot */}
              <div className="absolute bottom-8 right-12 flex flex-col items-center group">
                <div className="w-5 h-5 bg-orange-500 rounded-full animate-pulse opacity-80"></div>
                <div className="w-3 h-3 bg-orange-500 rounded-full absolute top-1 left-1"></div>
                <div className="mt-2 bg-slate-800 px-2 py-1 rounded text-[10px] font-medium border border-slate-700 flex flex-col items-center opacity-80 group-hover:opacity-100 transition-opacity">
                  <span className="text-slate-200">Bus Terminal</span>
                  <span className="text-orange-400">Medium density</span>
                </div>
              </div>

              {/* Decorative map elements */}
              <div className="w-full h-1 bg-slate-800 absolute bottom-1/3 opacity-50 rounded"></div>
              <div className="w-1 h-3/4 bg-slate-800 absolute left-1/3 opacity-50 rounded"></div>

              <div className="absolute bottom-0 text-[10px] text-slate-500 italic">
                * DBSCAN spatial clustering will be activated in Phase 8.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">

        {/* 9. Transportation Overview */}
        <Card className="lg:col-span-6 min-w-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Transportation & Fleet</CardTitle>
              <CardDescription>Live telemetry and route status</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs">
              Open management <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
              <div className="flex-1 border-r border-slate-200">
                <p className="text-xs text-slate-500 font-medium uppercase mb-1">Active Buses</p>
                <p className="text-xl font-bold text-slate-900">{data.fleetSummary.active} <span className="text-sm font-normal text-slate-500">/ {data.fleetSummary.total}</span></p>
              </div>
              <div className="flex-1 border-r border-slate-200 pl-2">
                <p className="text-xs text-slate-500 font-medium uppercase mb-1">On Time</p>
                <p className="text-xl font-bold text-emerald-600">{data.fleetSummary.onTime}</p>
              </div>
              <div className="flex-1 border-r border-slate-200 pl-2">
                <p className="text-xs text-slate-500 font-medium uppercase mb-1">Delayed</p>
                <p className="text-xl font-bold text-amber-600">{data.fleetSummary.delayed}</p>
              </div>
              <div className="flex-1 pl-2">
                <p className="text-xs text-slate-500 font-medium uppercase mb-1">Anomalies</p>
                <p className="text-xl font-bold text-emerald-600">0</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Priority Routes</p>
              {data.transportData.map((route) => (
                <div key={route.id} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${route.color}`}></div>
                    <span className="font-medium text-sm text-slate-800">{route.id}</span>
                  </div>
                  <Badge variant="outline" className="text-xs bg-slate-50">
                    {route.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 11. Priority Actions & Activity */}
        <Card className="lg:col-span-6 min-w-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Priority Actions</CardTitle>
              <CardDescription>Operational items requiring administrative review</CardDescription>
            </div>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              {data.priorityActions.length} Pending
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-6">
              {data.priorityActions.map((action) => (
                <div key={action.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 w-2 h-2 rounded-full ${action.priority === "high" ? "bg-rose-500" : "bg-amber-500"}`}></div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{action.title}</p>
                      <span className="text-xs text-slate-400">{action.timestamp}</span>
                    </div>
                  </div>
                  <Button size="sm" variant={action.priority === "high" ? "default" : "outline"} className="text-xs h-8">
                    {action.actionText}
                  </Button>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent School Activity</p>
              <div className="space-y-2">
                {data.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex justify-between items-center text-xs">
                    <span className="text-slate-700">{activity.title}</span>
                    <span className="text-slate-400">{activity.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
