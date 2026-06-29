import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useStore } from './lib/store'
import './styles/global.css'

import BottomNav from './components/shared/BottomNav'
import Home from './pages/Home'
import Capture from './pages/Capture'
import Tasks from './pages/Tasks'
import People from './pages/People'
import Vault from './pages/Vault'
import Journal from './pages/Journal'
import IdeaLab from './pages/IdeaLab'
import Menu from './pages/Menu'
import Auth from './pages/Auth'
import Admin from './pages/Admin'
import Calendar from './pages/Calendar'
import { showCaptureNotification } from './lib/captureNotification'

export default function App() {
  const { user, setUser, fetchSpaces, fetchAll } = useStore()

  useEffect(() => {
    const saved = localStorage.getItem('memora-theme') || 'light'
    document.documentElement.setAttribute('data-theme', saved)
    if (localStorage.getItem('memora-notifications') === 'on') {
      showCaptureNotification()
    }
  }, [])

  useEffect(() => {
    // Restore session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      fetchSpaces().then(() => fetchAll())
    }
  }, [user])

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        const splash = document.getElementById('splash-screen')
        if (splash) {
          splash.classList.add('fade-out')
          setTimeout(() => {
            splash.style.display = 'none'
          }, 500)
        }
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [user])

  if (!user) return <Auth />

  return (
    <BrowserRouter basename="/memora">
      <Routes>
        <Route path="/"        element={<Home />} />
        <Route path="/capture" element={<Capture />} />
        <Route path="/tasks"   element={<Tasks />} />
        <Route path="/people"  element={<People />} />
        <Route path="/vault"   element={<Vault />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/idealab" element={<IdeaLab />} />
        <Route path="/menu"    element={<Menu />} />
        <Route path="/admin"   element={<Admin />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="*"        element={<Navigate to="/" />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  )
}
