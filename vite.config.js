import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/memora/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Memora',
        short_name: 'Memora',
        description: 'Your calm, intelligent second brain',
        theme_color: '#3B82F6',
        background_color: '#F7F7F5',
        display: 'standalone',
        orientation: 'portrait',
        id: '/memora/',
        start_url: '/memora/',
        scope: '/memora/',
        share_target: {
          action: '/memora/share',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [
              {
                name: 'media',
                accept: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/plain']
              }
            ]
          }
        },
        shortcuts: [
          { name: 'New task', short_name: 'Task', description: 'Capture a task', url: '/memora/capture?intent=task', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Capture', short_name: 'Capture', description: 'Open capture page', url: '/memora/capture', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Voice capture', short_name: 'Voice', description: 'Capture by voice', url: '/memora/capture?intent=voice', icons: [{ src: 'icon-192.png', sizes: '192x192' }] }
        ],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
})
