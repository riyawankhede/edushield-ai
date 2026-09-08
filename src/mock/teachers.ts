export const currentTeacherMock = {
  id: "TCH-2026-042",
  name: "Mr. Patel",
  role: "Mathematics Teacher",
  academicYear: "2026–27",
  metrics: {
    totalStudents: 124,
    attendancePending: 2,
    homeworkPendingReview: 18,
    studentsRequiringAttention: 7
  },
  classesToday: [
    { id: 1, time: "09:00 AM", subject: "Mathematics", class: "10-A", room: "Room 204", status: "Completed" },
    { id: 2, time: "10:00 AM", subject: "Mathematics", class: "10-B", room: "Room 301", status: "In Progress" },
    { id: 3, time: "11:30 AM", subject: "Mathematics", class: "9-A", room: "Room 102", status: "Upcoming" },
    { id: 4, time: "02:00 PM", subject: "Remedial Session", class: "10-A", room: "Room 204", status: "Upcoming" }
  ],
  attendanceTasks: [
    { id: 1, class: "10-A", marked: 38, total: 40, pending: 2, status: "pending" },
    { id: 2, class: "10-B", marked: 40, total: 40, pending: 0, status: "completed" },
    { id: 3, class: "9-A", marked: 35, total: 38, pending: 3, status: "pending" }
  ],
  studentsRequiringAttention: [
    { id: 1, name: "Rahul Sharma", class: "10-A", indicator: "Academic Risk: High", stat: "Attendance: 74%", weakArea: "Mathematics", status: "Critical" },
    { id: 2, name: "Priya Deshmukh", class: "10-B", indicator: "Attendance Risk: Medium", stat: "Attendance: 81%", weakArea: "", status: "Warning" },
    { id: 3, name: "Aarav Patil", class: "9-A", indicator: "Performance Trend: Declining", stat: "Current Average: 62%", weakArea: "", status: "Warning" }
  ],
  aiInsights: [
    { id: 1, type: "Performance Trend", message: "3 students show declining mathematics performance.", severity: "high", count: 3, time: "2 hours ago" },
    { id: 2, type: "Attendance Alert", message: "5 students have attendance below the configured threshold.", severity: "medium", count: 5, time: "4 hours ago" },
    { id: 3, type: "Intervention Suggestion", message: "Rahul Sharma may require additional academic support in Algebra.", severity: "high", count: 1, time: "Yesterday" }
  ],
  academicPerformance: {
    classes: [
      { name: "10-A", average: 78, improved: 60, stable: 30, declined: 10 },
      { name: "10-B", average: 74, improved: 45, stable: 40, declined: 15 },
      { name: "9-A", average: 81, improved: 70, stable: 25, declined: 5 }
    ],
    trend: {
      improving: 62,
      stable: 25,
      declining: 13
    }
  },
  homeworkReview: [
    { id: 1, subject: "Mathematics", assignment: "Algebra Worksheet", submissions: 18, pending: 5, status: "pending" },
    { id: 2, subject: "Physics", assignment: "Motion Assignment", submissions: 32, pending: 8, status: "pending" },
    { id: 3, subject: "Science", assignment: "Lab Report", submissions: 40, pending: 0, status: "completed" }
  ],
  upcomingExams: [
    { id: 1, subject: "Mathematics", date: "22 Aug", class: "10-A" },
    { id: 2, subject: "Physics", date: "25 Aug", class: "10-B" },
    { id: 3, subject: "Science", date: "28 Aug", class: "9-A" }
  ],
  parentMessages: [
    { id: 1, parent: "Mrs. Sharma", message: "Could you please suggest some additional Mathematics practice?", time: "2 hours ago", unread: true },
    { id: 2, parent: "Mr. Deshmukh", message: "Can we schedule a meeting regarding attendance?", time: "Yesterday", unread: false }
  ],
  recentActivity: [
    { id: 1, action: "Attendance submitted for 10-B", time: "1 hour ago", icon: "CalendarCheck" },
    { id: 2, action: "Homework feedback added", time: "3 hours ago", icon: "ClipboardList" },
    { id: 3, action: "Exam marks updated", time: "Yesterday", icon: "GraduationCap" },
    { id: 4, action: "Parent message received", time: "Yesterday", icon: "MessageSquare" }
  ]
}
