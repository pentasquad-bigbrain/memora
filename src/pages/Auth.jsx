import { supabase } from '../lib/supabase'

export default function Auth() {
  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/memora/` }
    })
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
        <button className="btn btn-primary" style={{ width: '100%', fontSize: 15, padding: '14px' }} onClick={handleGoogle}>
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
