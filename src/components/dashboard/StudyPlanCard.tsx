"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Clock, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react"
import { useEffect, useState } from "react"

type Priority = "high" | "medium" | "low"

interface StudyPlanItem {
  subjectName: string
  priority: Priority
  recommendedDuration: number
  focusArea: string
  reason: string
  weakTopics: string[]
}

interface StudyPlanData {
  items: StudyPlanItem[]
  totalRecommendedTime: number
  generatedAt: string
  disclaimer: string
}

interface StudyPlanCardProps {
  studentId: string
  className?: string
}

export function StudyPlanCard({ studentId, className }: StudyPlanCardProps) {
  const [studyPlan, setStudyPlan] = useState<StudyPlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStudyPlan() {
      // Guard: don't fetch if no valid studentId
      if (!studentId || studentId.length === 0) {
        setLoading(false)
        setError("No student ID available")
        return
      }

      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/v1/study-plan?studentId=${studentId}`)
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error?.message || "Failed to fetch study plan")
        }

        setStudyPlan(result.data)
      } catch (err) {
        console.error("[Study Plan] Error:", err)
        setError(err instanceof Error ? err.message : "Failed to load study plan")
      } finally {
        setLoading(false)
      }
    }

    fetchStudyPlan()
  }, [studentId])

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle>AI Study Planner</CardTitle>
          </div>
          <CardDescription>Analyzing your academic performance...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse text-sm text-muted-foreground">Generating personalized study plan...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !studyPlan || studyPlan.items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle>AI Study Planner</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {error || "No study recommendations available yet. Complete some assignments and exams to get personalized recommendations."}
          </div>
        </CardContent>
      </Card>
    )
  }

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case "high":
        return "text-red-600 bg-red-50 border-red-200"
      case "medium":
        return "text-amber-600 bg-amber-50 border-amber-200"
      case "low":
        return "text-emerald-600 bg-emerald-50 border-emerald-200"
    }
  }

  const getPriorityIcon = (priority: Priority) => {
    switch (priority) {
      case "high":
        return <AlertCircle className="h-4 w-4" />
      case "medium":
        return <TrendingUp className="h-4 w-4" />
      case "low":
        return <CheckCircle2 className="h-4 w-4" />
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle>AI Study Planner</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            AI-Powered
          </Badge>
        </div>
        <CardDescription>
          Personalized recommendations based on your recent academic performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Study Time */}
        <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Recommended Daily Study Time</p>
            <p className="text-2xl font-bold text-primary">{studyPlan.totalRecommendedTime} min</p>
          </div>
        </div>

        {/* Study Plan Items */}
        <div className="space-y-3">
          {studyPlan.items.map((item, index) => (
            <div key={index} className="border rounded-lg p-3 space-y-2">
              {/* Subject Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-base truncate">{item.subjectName}</h4>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase shrink-0 ${getPriorityColor(item.priority)}`}
                    >
                      <span className="mr-1">{getPriorityIcon(item.priority)}</span>
                      {item.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.recommendedDuration} minutes
                  </p>
                </div>
              </div>

              {/* Focus Area */}
              <div className="bg-muted/50 p-2 rounded text-sm">
                <p className="font-medium text-xs text-muted-foreground mb-1">Focus Area:</p>
                <p>{item.focusArea}</p>
              </div>

              {/* Expandable Reason */}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                  Why this recommendation?
                </summary>
                <div className="mt-2 pl-2 border-l-2 border-primary/30 space-y-1">
                  <p className="text-muted-foreground">{item.reason}</p>
                  {item.weakTopics.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium text-foreground mb-1">Suggested Topics:</p>
                      <div className="flex flex-wrap gap-1">
                        {item.weakTopics.map((topic, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border-l-2 border-primary/30">
          <p className="font-medium mb-1">Educational Guidance</p>
          <p>{studyPlan.disclaimer}</p>
        </div>
      </CardContent>
    </Card>
  )
}
