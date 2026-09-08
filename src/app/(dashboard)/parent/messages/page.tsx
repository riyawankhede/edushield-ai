import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, CheckCircle2, Clock, MessageSquare, Sparkles } from "lucide-react"

export default function ParentMessagesPage() {
  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/parent">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2">
              <MessageSquare className="h-7 w-7 text-primary" />
              Teacher Messaging
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            Direct and secure communication channel with your childs teachers.
          </p>
        </div>
        <div className="flex items-center gap-2 ml-10 sm:ml-0">
          <Badge variant="outline" className="border-primary/20 text-primary capitalize">
            parent Portal
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Phase Active
          </Badge>
        </div>
      </div>

      {/* Overview Card */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Teacher Messaging Overview
            </CardTitle>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Seed Data Connected
            </Badge>
          </div>
          <CardDescription>
            Direct messages and consultation requests.
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
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-base">Teacher Messaging Console</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This module operates in synchronization with EduShield AIs 354,000+ synthetic dataset records.
            </p>
            <div className="pt-2">
              <Link href="/parent">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Return to Parent Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
