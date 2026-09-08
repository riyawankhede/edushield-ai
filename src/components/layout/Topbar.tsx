"use client"

import * as React from "react"
import { Bell, Search, User } from "lucide-react"
import { useRole, type Role } from "@/hooks/use-role"
import { useRouter } from "next/navigation"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function Topbar() {
  const { currentRole, setRole } = useRole()
  const router = useRouter()

  const handleRoleChange = (role: Role) => {
    setRole(role)
    router.push(`/${role}`)
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 lg:h-[60px] lg:gap-4">
      <Button variant="ghost" size="icon" className="lg:hidden">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        <span className="sr-only">Toggle navigation menu</span>
      </Button>

      <div className="w-full flex-1 min-w-0">
        <form className="hidden sm:block">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="w-full appearance-none bg-background pl-8 shadow-none md:max-w-xs lg:max-w-sm"
            />
          </div>
        </form>
      </div>

      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md border border-dashed border-warning/50">
          <span className="hidden sm:inline-block text-xs text-warning font-medium ml-2 uppercase">Demo:</span>
          <Select value={currentRole} onValueChange={(v) => handleRoleChange(v as Role)}>
            <SelectTrigger className="h-8 w-[100px] sm:w-[120px] bg-background">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
              <SelectItem value="teacher">Teacher</SelectItem>
              <SelectItem value="counselor">Counselor</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Toggle notifications</span>
        </Button>
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src="/avatars/01.png" alt="@user" />
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
