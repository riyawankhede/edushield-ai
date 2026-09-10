import { Badge } from "@/components/ui/badge"
import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react"

interface RiskBadgeProps {
  category: "low" | "medium" | "high"
  score?: number
  showIcon?: boolean
  className?: string
}

export function RiskBadge({ category, score, showIcon = false, className = "" }: RiskBadgeProps) {
  const variants = {
    low: {
      className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
      icon: CheckCircle2,
      label: "LOW RISK"
    },
    medium: {
      className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
      icon: AlertCircle,
      label: "MEDIUM RISK"
    },
    high: {
      className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
      icon: AlertTriangle,
      label: "HIGH RISK"
    }
  }

  const config = variants[category]
  const Icon = config.icon

  return (
    <Badge variant="outline" className={`text-[10px] font-semibold uppercase ${config.className} ${className}`}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {config.label}
      {score !== undefined && ` (${(score * 100).toFixed(0)}%)`}
    </Badge>
  )
}
