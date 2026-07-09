// ─────────────────────────────────────────────
// Kavach — Authentication Server Actions
// ─────────────────────────────────────────────
// All auth operations as Server Actions.
// These run on the server and have full cookie access.
//
// Usage from Client Components:
//   import { signInWithEmail, signInWithGoogle, signOut } from '@/app/actions/auth'

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ═══ Email + Password Sign Up ════════════════

export async function signUpWithEmail(formData: FormData) {
  const supabase = await createClient()

  const fullName = formData.get('fullName') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Validate inputs
  if (!email || !password) {
    return redirect('/register?error=Email and password are required')
  }

  if (password.length < 6) {
    return redirect('/register?error=Password must be at least 6 characters')
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || '',
      },
    },
  })

  if (error) {
    return redirect(`/register?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// ═══ Email + Password Sign In ════════════════

export async function signInWithEmail(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return redirect('/login?error=Email and password are required')
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// ═══ Google OAuth Sign In ════════════════════

export async function signInWithGoogle() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : ''}${getBaseUrl()}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  if (data.url) {
    redirect(data.url)
  }
}

// ═══ Sign Out ════════════════════════════════

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// ═══ Helpers ═════════════════════════════════

function getBaseUrl(): string {
  // In production, use your actual domain
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  // In development
  return 'http://localhost:3000'
}
