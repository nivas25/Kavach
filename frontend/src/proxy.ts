// ─────────────────────────────────────────────
// Kavach — Next.js Middleware
// ─────────────────────────────────────────────
// Runs on EVERY matched request to:
// 1. Refresh the Supabase auth session (exchange refresh tokens)
// 2. Protect routes that require authentication
// 3. Redirect logged-in users away from /login and /register
//
// CRITICAL: Without this middleware, server-side auth checks will
// fail after the access token expires (~1 hour) because the
// refresh token won't be exchanged automatically.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/analyze', '/analysis', '/report', '/onboarding']

// Routes that should redirect to /dashboard if already logged in
const AUTH_ROUTES = ['/login', '/register']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do NOT use getSession() here — it reads from cookies
  // without validation. getUser() actually verifies with the Supabase
  // auth server, which is what we want for security.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // ─── Route Protection ──────────────────────
  // If user is NOT logged in and tries to access a protected route → redirect to /login
  if (!user && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // If user IS logged in and tries to access auth routes → redirect to /dashboard
  if (user && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
