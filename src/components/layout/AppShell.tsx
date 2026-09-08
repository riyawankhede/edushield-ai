"use client"

import * as React from "react"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/20">
      <Sidebar />
      <div className="flex flex-col w-full lg:pl-64 min-w-0">
        <Topbar />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 w-full min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
