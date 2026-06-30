export function playMemoraChime() {
  if (typeof window === 'undefined') return
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return
  try {
    const ctx = new AudioContext()
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(0.18, now + 0.025)
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.15)
    master.connect(ctx.destination)

    ;[
      [659.25, 0],
      [880.0, 0.12],
      [1174.66, 0.27]
    ].forEach(([frequency, offset]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(frequency, now + offset)
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.5, now + offset + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.62)
      osc.connect(gain)
      gain.connect(master)
      osc.start(now + offset)
      osc.stop(now + offset + 0.72)
    })

    setTimeout(() => ctx.close?.(), 1400)
  } catch {
    // Browsers may block audio outside a user gesture.
  }
}
