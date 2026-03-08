"use client";

import { SessionProvider } from "next-auth/react";

/**
 * AuthProvider Component
 * A component that wraps its children with the NextAuth.js SessionProvider.
 * This allows child components to use hooks like `useSession` to access authentication state.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
