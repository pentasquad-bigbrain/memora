const configuredEmails = (import.meta.env.VITE_SUPER_USER_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

const configuredIds = (import.meta.env.VITE_SUPER_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

export function isLocalAdminSession() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem('memora-local-admin') === 'on'
}

export function setLocalAdminSession(enabled) {
  if (typeof window === 'undefined') return
  if (enabled) window.localStorage.setItem('memora-local-admin', 'on')
  else window.localStorage.removeItem('memora-local-admin')
}

export function isSuperUser(user) {
  if (isLocalAdminSession()) return true
  if (!user) return false
  const email = user.email?.toLowerCase()
  return configuredEmails.includes(email) || configuredIds.includes(user.id)
}
