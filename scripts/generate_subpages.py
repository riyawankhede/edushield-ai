import os

routes = {
    'student': [
        ('homework', 'Homework & Assignments', 'Track pending, submitted, and graded assignments across your subjects.', 'ClipboardList', 'View pending assignments and teacher feedback below.'),
        ('study-material', 'Study Materials', 'Access curriculum resources, textbooks, lecture notes, and practice worksheets.', 'FileText', 'Browse categorized study materials for your enrolled subjects.'),
        ('study-assistant', 'AI Study Assistant', 'Ask questions and receive explanations grounded in your curriculum materials.', 'Sparkles', 'Interactive study companion with syllabus-grounded retrieval.'),
        ('study-planner', 'Study Planner', 'Organize your revision schedule and prepare for upcoming exams.', 'CalendarCheck', 'Personalized weekly schedule and revision milestones.'),
        ('wellbeing', 'Well-being & Daily Check-in', 'Log your daily mood check-in and access student support resources.', 'HeartPulse', 'Confidential mood tracking and wellness support tools.'),
        ('safety', 'Safety & Incident Reporting', 'Submit anonymous safety concerns or access emergency student assistance.', 'ShieldAlert', 'Safe, anonymous reporting platform for school safety.'),
        ('bus', 'School Bus Tracking', 'View assigned bus route, pickup/drop-off schedules, and vehicle status.', 'Bus', 'Live bus schedule and route monitoring information.')
    ],
    'parent': [
        ('attendance', 'Attendance Overview', 'Monitor monthly attendance rates, absence logs, and leave requests for your child.', 'CalendarCheck', 'Monthly attendance breakdown and absence records.'),
        ('academics', 'Academic Performance', 'Review subject-wise exam scores, GPA trends, and term evaluations.', 'GraduationCap', 'Subject performance curves and term exam marks.'),
        ('homework', 'Homework Tracker', 'Keep track of upcoming homework deadlines and teacher feedback.', 'ClipboardList', 'Submissions status and homework feedback logs.'),
        ('exams', 'Exam Schedule & Results', 'View official examination timetables and published report cards.', 'FileText', 'Timetable, exam rules, and published grade cards.'),
        ('notices', 'School Notices & Circulars', 'Stay updated on institutional announcements, holiday schedules, and events.', 'Bell', 'Official school announcements and calendar alerts.'),
        ('ai-summary', 'AI Weekly Student Summary', 'Automated weekly academic and well-being synthesis for your child.', 'Sparkles', 'Synthesized progress report with actionable parenting tips.'),
        ('bus', 'Live Bus Tracking', 'Real-time transport tracking and estimated arrival times for your childs bus.', 'Bus', 'Real-time vehicle location and route progress.'),
        ('messages', 'Teacher Messaging', 'Direct and secure communication channel with your childs teachers.', 'MessageSquare', 'Direct messages and consultation requests.')
    ],
    'teacher': [
        ('students', 'Student Roster', 'View and manage enrolled students across your assigned classes and sections.', 'Users', 'Enrolled student roster with academic profiles.'),
        ('attendance', 'Attendance Marking', 'Daily period and class attendance recording with one-click bulk status.', 'CalendarCheck', 'Period-wise attendance registers and absence flags.'),
        ('academics', 'Marks & Assessments', 'Enter examination marks, evaluate quiz scores, and track class grade distributions.', 'GraduationCap', 'Grade book and marks entry interface.'),
        ('homework', 'Homework Management', 'Create new assignments, set deadlines, and review student submissions.', 'ClipboardList', 'Assignment creation and submission grading panel.'),
        ('ai-insights', 'AI Academic Insights', 'Early academic risk indicators and performance trajectory forecasts for your classes.', 'Sparkles', 'Predictive academic models and intervention recommendations.'),
        ('reports', 'Progress Reports', 'Generate formal student academic evaluation reports and commentary.', 'FileText', 'Automated draft reports and comment generators.'),
        ('notices', 'Announcements & Notices', 'Publish notices to students and parents regarding class activities.', 'Bell', 'Classwide broadcasts and announcement dispatch.'),
        ('messages', 'Parent Communication', 'Send messages and schedule conferences with parents.', 'MessageSquare', 'Direct communications and meeting logs.')
    ],
    'counselor': [
        ('wellbeing', 'Well-being Case Management', 'Monitor daily mood trends, qualitative student check-ins, and distress signals.', 'HeartPulse', 'Case timeline, mood degradation flags, and notes.'),
        ('safety', 'Safety Reports Triage', 'Review, investigate, and resolve confidential and anonymous safety reports.', 'ShieldAlert', 'Anonymous report queue and investigation workflows.'),
        ('risk', 'Multi-Factor Risk Insights', 'Explainable AI risk scoring and early warning alerts across attendance, mood, and grades.', 'AlertTriangle', 'SHAP-attributed risk score breakdowns.'),
        ('interventions', 'Student Interventions', 'Create, track, and document counseling sessions and support plans.', 'Users', 'Scheduled counseling interventions and progress tracking.')
    ],
    'admin': [
        ('students', 'Student Management', 'Comprehensive student directory, enrollment records, and demographic data.', 'Users', 'Student enrollment directory and profile management.'),
        ('teachers', 'Faculty & Staff Directory', 'Teacher profiles, departmental assignments, and class allocations.', 'GraduationCap', 'Staff database and teaching schedule allocations.'),
        ('academics', 'Curriculum & Academic Structure', 'Manage classes, academic terms, grading scales, and course offerings.', 'FileText', 'Classes, subjects, and academic year configuration.'),
        ('attendance', 'School-wide Attendance', 'Institutional attendance analytics, chronic absenteeism tracking, and compliance logs.', 'CalendarCheck', 'School-wide analytics and section attendance comparisons.'),
        ('safety', 'Campus Safety Center', 'Incident oversight, emergency drill logs, and geospatial safety hotspot clustering.', 'ShieldAlert', 'Geospatial hotspot clusters and safety incident oversight.'),
        ('transport', 'Fleet & Transport Management', 'School bus fleet tracking, route optimization, and driver assignments.', 'Bus', 'Bus fleet monitoring and route anomaly logs.'),
        ('ai-analytics', 'AI Predictive Analytics', 'Institutional analytics on academic trends, well-being indices, and retention forecasts.', 'Sparkles', 'Executive predictive intelligence dashboards.'),
        ('emergency', 'Emergency Response Hub', 'Broadcast campus-wide alerts, initiate lockdowns, and coordinate first responder protocols.', 'AlertTriangle', 'Instant emergency broadcast controls and safety logs.'),
        ('users', 'User Access & Roles', 'RBAC management, account provisioning, and security permissions.', 'Users', 'Role-based access controls and user credentials.'),
        ('settings', 'System Configuration', 'School institutional profiles, academic calendars, and API integrations.', 'Settings', 'Platform preferences and institutional parameters.')
    ]
}

base_dir = os.path.join('src', 'app', '(dashboard)')
created_count = 0

for role, subpages in routes.items():
    for subpath, title, desc, icon, detail in subpages:
        target_dir = os.path.join(base_dir, role, subpath)
        os.makedirs(target_dir, exist_ok=True)
        file_path = os.path.join(target_dir, 'page.tsx')

        icons_set = {"ArrowLeft", "CheckCircle2", "Clock", "Sparkles", icon}
        icons_import_str = ", ".join(sorted(icons_set))

        content = f'''import Link from "next/link"
import {{ Card, CardContent, CardDescription, CardHeader, CardTitle }} from "@/components/ui/card"
import {{ Badge }} from "@/components/ui/badge"
import {{ Button }} from "@/components/ui/button"
import {{ {icons_import_str} }} from "lucide-react"

export default function {role.capitalize()}{subpath.replace("-", "").capitalize()}Page() {{
  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      {{/* Header */}}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/{role}">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2">
              <{icon} className="h-7 w-7 text-primary" />
              {title}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            {desc}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-10 sm:ml-0">
          <Badge variant="outline" className="border-primary/20 text-primary capitalize">
            {role} Portal
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Phase Active
          </Badge>
        </div>
      </div>

      {{/* Overview Card */}}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {title} Overview
            </CardTitle>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Seed Data Connected
            </Badge>
          </div>
          <CardDescription>
            {detail}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="rounded-lg border p-3.5 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <p className="text-lg font-bold text-emerald-600 flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="h-4 w-4" /> Operational
              </p>
            </div>
            <div className="rounded-lg border p-3.5 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">Records Linked</p>
              <p className="text-lg font-bold text-foreground mt-0.5">
                Synthetic Dataset Connected
              </p>
            </div>
            <div className="rounded-lg border p-3.5 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">Last Synchronized</p>
              <p className="text-lg font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                <Clock className="h-4 w-4 text-muted-foreground" /> Today, 09:00 AM
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-dashed p-6 text-center space-y-3 bg-muted/10">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-1">
              <{icon} className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-base">{title} Console</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This module operates in synchronization with EduShield AIs 354,000+ synthetic dataset records.
            </p>
            <div className="pt-2">
              <Link href="/{role}">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Return to {role.capitalize()} Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}}
'''
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        created_count += 1

print(f'Successfully created {created_count} subpage routes!')
