import { redirect } from "next/navigation";

/**
 * Root page for HACKATHON DEMO MODE
 * 
 * Redirects directly to /student dashboard where the demo role selector
 * is available in the topbar. This bypasses login for the demo experience.
 * 
 * The user can switch roles using the "Demo: [Role]" dropdown in the topbar.
 * 
 * Note: /login is still accessible directly if needed for development/testing.
 */
export default function Home() {
  // For hackathon demo: redirect directly to student dashboard
  // The topbar contains a role selector to switch between all roles
  redirect("/student");
}
