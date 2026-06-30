import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
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
import { isLocalAdminSession } from './lib/adminAccess'

export default function App() {
  const { user, setUser, fetchSpaces, fetchAll } = useStore()
  const localAdmin = isLocalAdminSession()

  useEffect(() => {
    const saved = localStorage.getItem('memora-theme') || 'light'
    document.documentElement.setAttribute('data-theme', saved)
    if (localStorage.getItem('memora-notifications') === 'on') {
      showCaptureNotification()
    }
    const timer = setTimeout(() => hideSplash(), 700)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [setUser])

  useEffect(() => { if (user) fetchSpaces().then(() => fetchAll()) }, [user, fetchSpaces, fetchAll])

  if (!user && !localAdmin) return <Auth />

  return (
    <BrowserRouter basename="/memora">
      <DeepLinkHandler />
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
      <AppChrome />
    </BrowserRouter>
  )
}

function AppChrome() {
  const location = useLocation()
  if (location.pathname.startsWith('/admin')) return null
  return <BottomNav />
}

function hideSplash() {
  const splash = document.getElementById('splash-screen')
  if (!splash) return
  splash.classList.add('fade-out')
  setTimeout(() => { splash.style.display = 'none' }, 500)
}

function DeepLinkHandler() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const restoredRoute = params.get('route')
    if (restoredRoute) {
      params.delete('route')
      const route = restoredRoute.startsWith('/') ? restoredRoute : `/${restoredRoute}`
      navigate(route, { replace: true })
      return
    }
    if (params.get('open') !== 'capture') return
    params.delete('open')
    const nextSearch = params.toString()
    navigate(`/capture${nextSearch ? `?${nextSearch}` : ''}`, { replace: true })
  }, [location.search, navigate])

  return null
}
