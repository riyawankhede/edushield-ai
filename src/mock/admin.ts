import { Users, GraduationCap, CalendarCheck, AlertCircle, ShieldAlert, Bus } from 'lucide-react';

export const adminKPIData = [
  {
    title: 'Total Students',
    value: '1,248',
    icon: Users,
    trend: 'Stable',
    trendDirection: 'neutral' as const,
  },
  {
    title: 'Teachers',
    value: '86',
    icon: GraduationCap,
    trend: 'Stable',
    trendDirection: 'neutral' as const,
  },
  {
    title: 'Attendance Rate',
    value: '93.4%',
    icon: CalendarCheck,
    trend: '↑ 1.2% this month',
    trendDirection: 'up' as const,
  },
  {
    title: 'Requires Attention',
    value: '42',
    icon: AlertCircle,
    trend: '↓ 6 from last week',
    trendDirection: 'down' as const,
  },
  {
    title: 'Safety Reports',
    value: '18',
    icon: ShieldAlert,
    trend: 'Open: 5',
    trendDirection: 'neutral' as const,
  },
  {
    title: 'Active Buses',
    value: '24 / 26',
    icon: Bus,
    trend: '2 delayed',
    trendDirection: 'down' as const,
  }
];

export const academicPerformanceData = [
  { month: 'April', score: 74.2 },
  { month: 'May', score: 75.1 },
  { month: 'June', score: 76.8 },
  { month: 'July', score: 77.5 },
  { month: 'August', score: 78.4 },
];

export const attendanceTrendData = [
  { week: 'W1', rate: 92.1 },
  { week: 'W2', rate: 92.5 },
  { week: 'W3', rate: 93.0 },
  { week: 'W4', rate: 92.8 },
  { week: 'W5', rate: 93.1 },
  { week: 'W6', rate: 93.5 },
  { week: 'W7', rate: 93.2 },
  { week: 'W8', rate: 93.4 },
];

export const riskDistributionData = [
  { name: 'Low', value: 72, fill: '#10b981' }, // emerald-500
  { name: 'Moderate', value: 20, fill: '#f59e0b' }, // amber-500
  { name: 'High', value: 6, fill: '#f97316' }, // orange-500
  { name: 'Critical', value: 2, fill: '#ef4444' }, // red-500
];

export const safetyCategoryData = [
  { name: 'Bullying Concern', value: 5, fill: '#6366f1' }, // indigo-500
  { name: 'Peer Conflict', value: 4, fill: '#8b5cf6' }, // violet-500
  { name: 'Safety Concern', value: 6, fill: '#ec4899' }, // pink-500
  { name: 'Medical', value: 2, fill: '#14b8a6' }, // teal-500
  { name: 'Other', value: 1, fill: '#94a3b8' }, // slate-400
];

export const transportData = [
  { id: 'Route 01', status: 'On Route', color: 'bg-blue-500' },
  { id: 'Route 02', status: 'On Time', color: 'bg-emerald-500' },
  { id: 'Route 03', status: 'Delayed', color: 'bg-amber-500' },
  { id: 'Route 04', status: 'On Route', color: 'bg-blue-500' },
];

export const aiInsightsData = [
  {
    id: 1,
    type: 'positive',
    insight: 'Attendance has improved by 1.2% over the last month.'
  },
  {
    id: 2,
    type: 'attention',
    insight: '42 students currently have signals that may warrant additional academic or attendance support.'
  },
  {
    id: 3,
    type: 'alert',
    insight: 'Mathematics is the lowest-performing subject across Grade 10.'
  },
  {
    id: 4,
    type: 'alert',
    insight: 'Three transport routes show repeated delay patterns.'
  }
];

export const priorityActionsData = [
  {
    id: 1,
    priority: 'high',
    title: 'Review 5 unresolved safety cases',
    timestamp: '2 hours ago',
    actionText: 'Review'
  },
  {
    id: 2,
    priority: 'medium',
    title: 'Review 42 student support signals',
    timestamp: '5 hours ago',
    actionText: 'Open'
  },
  {
    id: 3,
    priority: 'high',
    title: '3 bus routes require attention',
    timestamp: '1 hour ago',
    actionText: 'Investigate'
  },
  {
    id: 4,
    priority: 'medium',
    title: 'Attendance below threshold in Grade 9',
    timestamp: '1 day ago',
    actionText: 'Review'
  }
];

export const recentActivityData = [
  { id: 1, title: 'New teacher added', time: '1 hour ago' },
  { id: 2, title: 'Grade 10 results published', time: '3 hours ago' },
  { id: 3, title: 'Safety report reviewed', time: '5 hours ago' },
  { id: 4, title: 'Bus Route 12 updated', time: '1 day ago' },
  { id: 5, title: 'Emergency drill completed', time: '2 days ago' },
  { id: 6, title: 'New school notice published', time: '3 days ago' },
];
