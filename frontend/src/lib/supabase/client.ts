// ─────────────────────────────────────────────
// Kavach — Supabase Browser Client
// ─────────────────────────────────────────────
// Use this in Client Components ("use client").
// It reads/writes auth cookies via the browser's cookie jar.
//
// Usage:
//   import { createClient } from '@/lib/supabase/client'
//   const supabase = createClient()

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
