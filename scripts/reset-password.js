#!/usr/bin/env node
'use strict'

// Reset a Supabase user's password by email using the service_role key.
// Requirements: Node.js 18+ (built-in fetch), SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.

const { env, argv, exit } = process

function usage() {
  console.error('Usage: node scripts/reset-password.js <email> <newPassword>')
  console.error('Env:   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY [optional: ADMIN_ID to log to public.password_resets]')
}

async function main() {
  const email = argv[2]
  const newPassword = argv[3]

  if (!email || !newPassword) {
    usage()
    exit(1)
  }

  const SUPABASE_URL = env.SUPABASE_URL
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY
  const ADMIN_ID = env.ADMIN_ID // optional, used to log into public.password_resets

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.')
    usage()
    exit(1)
  }

  const baseHeaders = {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
  }

  // 1) Find user by email
  const findRes = await fetch(
    `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers: baseHeaders }
  )
  if (!findRes.ok) {
    const t = await findRes.text().catch(() => '')
    throw new Error(`Failed to fetch user by email (${findRes.status}): ${t}`)
  }
  const payload = await findRes.json().catch(() => null)

  // Handle possible response shapes (array, object with users, or single object)
  const users = Array.isArray(payload)
    ? payload
    : (payload && Array.isArray(payload.users))
      ? payload.users
      : payload
        ? [payload]
        : []

  if (!users.length) {
    throw new Error(`User not found for email: ${email}`)
  }
  const user = users[0]
  if (!user.id) {
    throw new Error('User payload missing id field.')
  }

  // 2) Update password
  const updRes = await fetch(
    `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(user.id)}`,
    {
      method: 'PUT',
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    }
  )
  if (!updRes.ok) {
    const t = await updRes.text().catch(() => '')
    throw new Error(`Failed to update password (${updRes.status}): ${t}`)
  }

  // 3) Optional audit log into public.password_resets
  if (ADMIN_ID) {
    try {
      const logRes = await fetch(
        `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/password_resets`,
        {
          method: 'POST',
          headers: {
            ...baseHeaders,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ user_id: user.id, reset_by: ADMIN_ID, reason: 'Admin password reset' }),
        }
      )
      if (!logRes.ok) {
        const t = await logRes.text().catch(() => '')
        console.warn(`Warning: failed to insert password_resets audit (${logRes.status}): ${t}`)
      }
    } catch (e) {
      console.warn(`Warning: failed to log password reset: ${e?.message || e}`)
    }
  }

  console.log(`Password updated for user ${user.id} (${email}).`)
}

main().catch((err) => {
  console.error(err?.message || err)
  exit(1)
})
