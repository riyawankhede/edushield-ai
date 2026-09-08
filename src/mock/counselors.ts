export const currentCounselorMock = {
  id: "CNS-2026-012",
  name: "Dr. Mehta",
  role: "Lead Counselor",
  metrics: {
    openCases: 12,
    highPriority: 3,
    safetyReports: 8,
    followUpsDue: 5
  },
  priorityCases: [
    { id: "WB-1042", student: "R.S.", category: "Academic Stress", priority: "High", status: "Follow-up Required", updated: "25 min ago" },
    { id: "SF-2031", student: "A.P.", category: "Safety Concern", priority: "High", status: "Under Review", updated: "1 hr ago" },
    { id: "WB-1038", student: "P.D.", category: "Attendance/Well-being", priority: "Medium", status: "Intervention Active", updated: "Yesterday" },
    { id: "WB-1035", student: "K.M.", category: "Peer Conflict", priority: "Low", status: "New", updated: "2 days ago" }
  ],
  wellbeingTrends: [
    { day: "Mon", reports: 4, checkIns: 45, interactions: 6 },
    { day: "Tue", reports: 3, checkIns: 52, interactions: 8 },
    { day: "Wed", reports: 7, checkIns: 48, interactions: 12 },
    { day: "Thu", reports: 5, checkIns: 50, interactions: 9 },
    { day: "Fri", reports: 2, checkIns: 42, interactions: 5 }
  ],
  caseCategories: [
    { name: "Academic Stress", value: 35 },
    { name: "Attendance", value: 25 },
    { name: "Peer Conflict", value: 20 },
    { name: "Safety Concern", value: 10 },
    { name: "Other", value: 10 }
  ],
  activeInterventions: [
    { id: 1, student: "R.S.", intervention: "Weekly counselor check-in", status: "Active", nextReview: "Friday" },
    { id: 2, student: "A.P.", intervention: "Parent + counselor meeting", status: "Scheduled", nextReview: "Monday" }
  ],
  followUpsDue: [
    { id: 1, time: "Today", caseId: "WB-1042", student: "R.S.", category: "Academic Stress" },
    { id: 2, time: "Tomorrow", caseId: "SF-2031", student: "A.P.", category: "Safety Concern" },
    { id: 3, time: "Friday", caseId: "WB-1038", student: "P.D.", category: "Well-being" }
  ],
  safetyReports: [
    { id: 1, category: "Safety Concern", location: "Playground", priority: "High", reported: "1 hour ago" },
    { id: 2, category: "Peer Conflict", location: "Classroom 204", priority: "Medium", reported: "Yesterday" },
    { id: 3, category: "Bullying Concern", location: "School Bus", priority: "High", reported: "2 days ago" }
  ],
  riskInsights: [
    { id: 1, message: "4 students show a combination of attendance and academic signals that may warrant additional support.", severity: "medium" },
    { id: 2, message: "2 students have repeated well-being check-ins requiring follow-up.", severity: "high" }
  ],
  recentActivity: [
    { id: 1, message: "Case WB-1042 status changed to Follow-up Required", time: "2 hours ago" },
    { id: 2, message: "Intervention scheduled for A.P.", time: "3 hours ago" },
    { id: 3, message: "Safety report SF-2031 assigned", time: "Yesterday" },
    { id: 4, message: "Well-being check-in reviewed", time: "Yesterday" }
  ]
}
