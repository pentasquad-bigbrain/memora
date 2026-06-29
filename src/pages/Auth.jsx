import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('sign-in') // 'sign-in' | 'sign-up'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/memora/` }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fn = mode === 'sign-in' ? 'signInWithPassword' : 'signUp'
    const { error } = await supabase.auth[fn]({ email, password })
    setLoading(false)
    if (error) setError(error.message)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '32px 24px',
      maxWidth: 430,
      margin: '0 auto'
    }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          width: 64, height: 64,
          background: 'var(--accent)',
          borderRadius: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px'
        }}>
          <i className="ti ti-brain" style={{ fontSize: 32, color: '#fff' }}></i>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 500, color: 'var(--text)' }}>Memora</h1>
        <p style={{ color: 'var(--muted)', marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>
          Your calm, intelligent<br />second brain
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 320 }}>
        <form onSubmit={handleEmailAuth}>
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', marginBottom: 10 }}
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ width: '100%', marginBottom: 10 }}
          />
          {error && (
            <p style={{ color: 'var(--red-dark)', fontSize: 13, marginBottom: 10 }}>{error}</p>
          )}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', fontSize: 15, padding: '14px' }}
          >
            {loading ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 14 }}>
          {mode === 'sign-in' ? (
            <>No account? <a onClick={() => setMode('sign-up')} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Sign up</a></>
          ) : (
            <>Already have an account? <a onClick={() => setMode('sign-in')} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Sign in</a></>
          )}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <button className="btn btn-ghost" style={{ width: '100%', fontSize: 15, padding: '14px' }} onClick={handleGoogle} disabled={loading}>
          <i className="ti ti-brand-google" style={{ fontSize: 18 }}></i>
          Continue with Google
        </button>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
          Your data is private and encrypted.<br />Memora never shares your information.
        </p>
      </div>
    </div>
  )
}
