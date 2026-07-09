// ─────────────────────────────────────────────
// Kavach — OAuth Callback Route Handler
// ─────────────────────────────────────────────
// Handles the redirect from Supabase after Google OAuth sign-in.
//
// Flow:
// 1. User clicks "Sign in with Google"
// 2. Browser redirects to Google → Supabase Auth
// 3. Supabase redirects back here with a `code` parameter
// 4. We exchange the code for a session
// 5. Redirect to /dashboard (or wherever they wanted to go)

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Successful auth — redirect to the intended destination
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        // In development, don't worry about forwarded host
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        // In production behind a load balancer
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Auth failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
