import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'

self.skipWaiting()
clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)

const SHARE_CACHE = 'memora-share-target'
const SHARE_URL = '/memora/shared-data.json'

const fileToPayload = async (file) => {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    dataUrl: `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.pathname !== '/memora/share' || event.request.method !== 'POST') return

  event.respondWith((async () => {
    const form = await event.request.formData()
    const files = form.getAll('media').filter((item) => item && typeof item.arrayBuffer === 'function')
    const payload = {
      title: form.get('title') || '',
      text: form.get('text') || '',
      url: form.get('url') || '',
      files: await Promise.all(files.map(fileToPayload)),
      receivedAt: new Date().toISOString()
    }
    const cache = await caches.open(SHARE_CACHE)
    await cache.put(SHARE_URL, new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    }))
    return Response.redirect('/memora/capture?shared=1', 303)
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const actionPath = {
    task: '/memora/capture?intent=task',
    note: '/memora/capture?intent=note',
    voice: '/memora/capture?intent=voice'
  }[event.action] || '/memora/capture'

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = allClients.find((client) => client.url.includes('/memora/'))
    if (existing) {
      await existing.focus()
      return existing.navigate(actionPath)
    }
    return self.clients.openWindow(actionPath)
  })())
})
