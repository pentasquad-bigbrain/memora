import { playMemoraChime } from './notificationSound'

const SW_PATH = '/memora/sw.js'

export async function ensureCaptureWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register(SW_PATH, { scope: '/memora/' })
  } catch (error) {
    console.warn('Memora capture worker registration failed', error)
    return null
  }
}

export async function showCaptureNotification() {
  if (!('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false
  const registration = await ensureCaptureWorker()
  if (!registration?.showNotification) return false
  playMemoraChime()
  await registration.showNotification('Memora', {
    body: 'Capture it before you forget.',
    tag: 'memora-capture',
    renotify: false,
    requireInteraction: true,
    icon: '/memora/icon-192.png',
    badge: '/memora/icon-192.png',
    actions: [
      { action: 'task', title: '+ Task' },
      { action: 'capture', title: 'Capture' },
      { action: 'voice', title: 'Voice' }
    ],
    data: { url: '/memora/capture' }
  })
  return true
}
