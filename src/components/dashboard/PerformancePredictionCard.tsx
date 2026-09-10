"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, TrendingUp, Target, Activity } from "lucide-react"
import { useEffect, useState } from "react"

interface PredictionData {
  predictedScore: number
  predictedGradeBand: string
  confidence: number
  inputFeatures: {
    attendanceRate30d: number
    homeworkCompletionRate: number
    avgScoreCurrentTerm: number
    scoreTrend: number
  }
  modelName: string
  modelVersion: string
}

interface PerformancePredictionCardProps {
  studentId: string
  className?: string
}

export function PerformancePredictionCard({ studentId, className }: PerformancePredictionCardProps) {
  const [prediction, setPrediction] = useState<PredictionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPrediction() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/v1/predictions/performance?studentId=${studentId}`)
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error?.message || "Failed to fetch prediction")
        }

        setPrediction(result.data)
      } catch (err) {
        console.error("[Performance Prediction] Error:", err)
        setError(err instanceof Error ? err.message : "Failed to load prediction")
      } finally {
        setLoading(false)
      }
    }

    if (studentId) {
      fetchPrediction()
    }
  }, [studentId])

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>AI Performance Prediction</CardTitle>
          </div>
          <CardDescription>Analyzing your academic data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse text-sm text-muted-foreground">Loading prediction...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !prediction) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>AI Performance Prediction</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {error || "Unable to generate prediction"}
          </div>
        </CardContent>
      </Card>
    )
  }

  const confidencePercent = Math.round(prediction.confidence * 100)
  const isHighConfidence = prediction.confidence >= 0.8

  // Determine score color
  let scoreColor = "text-emerald-600"
  if (prediction.predictedScore < 60) scoreColor = "text-red-600"
  else if (prediction.predictedScore < 80) scoreColor = "text-amber-600"

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>AI Performance Prediction</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            AI-Powered
          </Badge>
        </div>
        <CardDescription>
          Prediction based on attendance, recent exam performance, and assignment completion
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Prediction */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Predicted Score (Next Term)</p>
            <div className="flex items-baseline gap-2">
              <p className={`text-3xl font-bold ${scoreColor}`}>
                {prediction.predictedScore}%
              </p>
              <Badge variant="secondary" className="text-sm">
                Grade {prediction.predictedGradeBand}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <div className="flex items-center gap-1">
              <p className={`text-lg font-semibold ${isHighConfidence ? 'text-emerald-600' : 'text-amber-600'}`}>
                {confidencePercent}%
              </p>
            </div>
          </div>
        </div>

        {/* Key Factors */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Key Factors</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 p-2 bg-muted/30 rounded">
              <Activity className="h-3 w-3 text-primary" />
              <div>
                <p className="font-medium">Attendance</p>
                <p className="text-muted-foreground">
                  {Math.round(prediction.inputFeatures.attendanceRate30d * 100)}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 p-2 bg-muted/30 rounded">
              <Target className="h-3 w-3 text-primary" />
              <div>
                <p className="font-medium">Homework</p>
                <p className="text-muted-foreground">
                  {Math.round(prediction.inputFeatures.homeworkCompletionRate * 100)}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 p-2 bg-muted/30 rounded">
              <TrendingUp className="h-3 w-3 text-primary" />
              <div>
                <p className="font-medium">Current Avg</p>
                <p className="text-muted-foreground">
                  {Math.round(prediction.inputFeatures.avgScoreCurrentTerm)}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 p-2 bg-muted/30 rounded">
              <TrendingUp className={`h-3 w-3 ${prediction.inputFeatures.scoreTrend >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
              <div>
                <p className="font-medium">Trend</p>
                <p className={prediction.inputFeatures.scoreTrend >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {prediction.inputFeatures.scoreTrend >= 0 ? '+' : ''}{Math.round(prediction.inputFeatures.scoreTrend * 100)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border-l-2 border-primary/30">
          <p className="font-medium mb-1">AI-Generated Assessment</p>
          <p>
            This prediction uses a deterministic model analyzing your recent academic activity.
            Actual performance may vary based on effort and external factors.
          </p>
        </div>

        {/* Model Info (collapsed) */}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">Model Information</summary>
          <div className="mt-2 space-y-1 pl-2">
            <p>Model: {prediction.modelName}</p>
            <p>Version: {prediction.modelVersion}</p>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
