// ─────────────────────────────────────────────
// Kavach — Supabase Server Client
// ─────────────────────────────────────────────
// Use this in Server Components, Server Actions, and Route Handlers.
// It reads/writes auth cookies via Next.js `cookies()` helper.
//
// Usage:
//   import { createClient } from '@/lib/supabase/server'
//   const supabase = await createClient()

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // the user session (which we do — see middleware.ts).
          }
        },
      },
    }
  )
}
