import { create } from "zustand"

export type Role = "student" | "parent" | "teacher" | "counselor" | "admin"

interface RoleState {
  currentRole: Role
  setRole: (role: Role) => void
}

export const useRole = create<RoleState>((set) => ({
  currentRole: "student", // default for demo
  setRole: (role) => set({ currentRole: role }),
}))
