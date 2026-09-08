"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRole, type Role } from "@/hooks/use-role"
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  GraduationCap,
  ClipboardList,
  Sparkles,
  ShieldAlert,
  Bus,
  MessageSquare,
  Settings,
  Bell,
  HeartPulse,
  AlertTriangle,
  FileText
} from "lucide-react"

import { cn } from "@/lib/utils"

type NavItem = {
  title: string
  href: string
  icon: React.ElementType
}

const navConfigs: Record<Role, NavItem[]> = {
  student: [
    { title: "Dashboard", href: "/student", icon: LayoutDashboard },
    { title: "Homework", href: "/student/homework", icon: ClipboardList },
    { title: "Study Material", href: "/student/study-material", icon: FileText },
    { title: "AI Study Assistant", href: "/student/study-assistant", icon: Sparkles },
    { title: "Study Planner", href: "/student/study-planner", icon: CalendarCheck },
    { title: "Well-being", href: "/student/wellbeing", icon: HeartPulse },
    { title: "Safety", href: "/student/safety", icon: ShieldAlert },
    { title: "Bus", href: "/student/bus", icon: Bus },
  ],
  parent: [
    { title: "Dashboard", href: "/parent", icon: LayoutDashboard },
    { title: "Attendance", href: "/parent/attendance", icon: CalendarCheck },
    { title: "Academics", href: "/parent/academics", icon: GraduationCap },
    { title: "Homework", href: "/parent/homework", icon: ClipboardList },
    { title: "Exams", href: "/parent/exams", icon: FileText },
    { title: "Notices", href: "/parent/notices", icon: Bell },
    { title: "AI Summary", href: "/parent/ai-summary", icon: Sparkles },
    { title: "Bus", href: "/parent/bus", icon: Bus },
    { title: "Messages", href: "/parent/messages", icon: MessageSquare },
  ],
  teacher: [
    { title: "Dashboard", href: "/teacher", icon: LayoutDashboard },
    { title: "Students", href: "/teacher/students", icon: Users },
    { title: "Attendance", href: "/teacher/attendance", icon: CalendarCheck },
    { title: "Academics", href: "/teacher/academics", icon: GraduationCap },
    { title: "Homework", href: "/teacher/homework", icon: ClipboardList },
    { title: "AI Insights", href: "/teacher/ai-insights", icon: Sparkles },
    { title: "Reports", href: "/teacher/reports", icon: FileText },
    { title: "Notices", href: "/teacher/notices", icon: Bell },
    { title: "Messages", href: "/teacher/messages", icon: MessageSquare },
  ],
  counselor: [
    { title: "Dashboard", href: "/counselor", icon: LayoutDashboard },
    { title: "Well-being Cases", href: "/counselor/wellbeing", icon: HeartPulse },
    { title: "Safety Reports", href: "/counselor/safety", icon: ShieldAlert },
    { title: "Risk Insights", href: "/counselor/risk", icon: AlertTriangle },
    { title: "Interventions", href: "/counselor/interventions", icon: Users },
  ],
  admin: [
    { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { title: "Students", href: "/admin/students", icon: Users },
    { title: "Teachers", href: "/admin/teachers", icon: GraduationCap },
    { title: "Academics", href: "/admin/academics", icon: FileText },
    { title: "Attendance", href: "/admin/attendance", icon: CalendarCheck },
    { title: "Safety", href: "/admin/safety", icon: ShieldAlert },
    { title: "Transportation", href: "/admin/transport", icon: Bus },
    { title: "AI Analytics", href: "/admin/ai-analytics", icon: Sparkles },
    { title: "Emergency Center", href: "/admin/emergency", icon: AlertTriangle },
    { title: "Users", href: "/admin/users", icon: Users },
    { title: "Settings", href: "/admin/settings", icon: Settings },
  ]
}

export function Sidebar() {
  const pathname = usePathname()
  const { currentRole } = useRole()
  const links = navConfigs[currentRole]

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-64 flex-col border-r bg-card text-card-foreground shadow-sm">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px]">
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
          <ShieldAlert className="h-6 w-6" />
          <span className="text-lg">EduShield AI</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-2">
        <nav className="grid items-start px-2 text-sm font-medium">
          {links.map((item, index) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={index}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                  isActive ? "bg-muted text-primary font-semibold" : ""
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
