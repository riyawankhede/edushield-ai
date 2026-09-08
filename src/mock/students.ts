export const currentStudentMock = {
  id: "STU-2026-001",
  name: "Rahul Sharma",
  grade: "10-A",
  attendance: {
    percentage: 92,
    status: "good",
    trend: "+2.1",
  },
  academics: {
    overallGPA: 3.8,
    pendingHomework: 3,
    completedHomework: 12,
    overdueHomework: 1,
    upcomingExams: 2,
    subjects: [
      { name: "Mathematics", score: 95 },
      { name: "Physics", score: 88 },
      { name: "Chemistry", score: 92 },
      { name: "English", score: 85 },
      { name: "History", score: 78 }
    ]
  },
  classesToday: [
    { id: 1, subject: "Mathematics", time: "09:00 AM", room: "Room 101", teacher: "Mr. Gupta" },
    { id: 2, subject: "Physics", time: "10:00 AM", room: "Lab 3", teacher: "Ms. Desai" },
    { id: 3, subject: "History", time: "11:30 AM", room: "Room 204", teacher: "Mr. Patel" },
    { id: 4, subject: "English", time: "01:00 PM", room: "Room 102", teacher: "Mrs. Iyer" },
  ],
  notices: [
    { id: 1, title: "Science Fair Registration", date: "Today", isNew: true },
    { id: 2, title: "Library Due Dates", date: "Yesterday", isNew: false },
  ],
  aiInsights: {
    recommendation: "Focus on Algebra practice before tomorrow's quiz.",
    topic: "Mathematics",
    confidence: "High",
    isDemo: true,
  }
}

export const parentDashboardMock = {
  student: currentStudentMock,
  parentName: "Mr. Sharma",
  overallStatus: "Rahul is doing great this week! Keep an eye on History.",
  aiWeeklySummary: "Rahul showed excellent participation in Mathematics this week. Physics scores are stable. However, there's a slight dip in History homework completion. Consider reviewing the recent World War II chapter with him.",
  busStatus: {
    status: "On Route",
    message: "Arriving at stop in 5 mins",
    location: "Sector 14 Road",
    isDelayed: false
  },
  upcomingExamsList: [
    { id: 1, subject: "Physics", type: "Mid-Term", date: "Friday, 24 Aug", daysLeft: 2 },
    { id: 2, subject: "Mathematics", type: "Unit Test", date: "Monday, 27 Aug", daysLeft: 5 }
  ]
}
