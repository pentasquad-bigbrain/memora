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
import Auth from './pages/Auth'

export default function App() {
  const { user, setUser, fetchSpaces, fetchAll } = useStore()

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
        <Route path="*"        element={<Navigate to="/" />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  )
}
