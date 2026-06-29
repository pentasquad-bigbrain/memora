const configuredEmails = (import.meta.env.VITE_SUPER_USER_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

const configuredIds = (import.meta.env.VITE_SUPER_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

export function isSuperUser(user) {
  if (!user) return false
  const email = user.email?.toLowerCase()
  return configuredEmails.includes(email) || configuredIds.includes(user.id)
}
