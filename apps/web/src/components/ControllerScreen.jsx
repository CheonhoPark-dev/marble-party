import { useEffect, useState } from 'react'

const COOLDOWN_DURATION_MS = 4000

export function ControllerScreen({ assignment, cooldownUntil = 0, onAction }) {
  const [isPressed, setIsPressed] = useState(false)
  const [cooldownMs, setCooldownMs] = useState(0)

  useEffect(() => {
    const updateCooldown = () => {
      const remaining = Math.max(0, Number(cooldownUntil || 0) - Date.now())
      setCooldownMs(remaining)
    }

    updateCooldown()
    const timerId = setInterval(updateCooldown, 200)
    return () => clearInterval(timerId)
  }, [cooldownUntil])

  const isDisabled = !assignment || cooldownMs > 0
  const showCooldown = Boolean(assignment && cooldownMs > 0)
  const cooldownProgress = Math.min(1, Math.max(0, 1 - cooldownMs / COOLDOWN_DURATION_MS))
  const cooldownLabel = Math.max(0, cooldownMs / 1000).toFixed(1)

  const handlePress = () => {
    if (isDisabled) return
    setIsPressed(true)
    onAction?.()
    setTimeout(() => setIsPressed(false), 200)
  }

  return (
    <div className="screen-container justify-center" style={{ background: 'var(--color-surface)' }}>
      <header className="text-center mb-32 animate-enter">
        <h1 className="text-display mb-8">CONTROLLER</h1>
        <p className="text-h2" style={{ color: 'var(--color-text-muted)' }}>DROP THE OBSTACLE!</p>
      </header>

      <div className="flex-center animate-slide-up" style={{ width: '100%', flex: 1, paddingBottom: '40px' }}>
        <div
          style={{
            padding: '10px',
            borderRadius: '50%',
            background: showCooldown
              ? `conic-gradient(var(--color-secondary) ${cooldownProgress * 360}deg, rgba(255,255,255,0.15) 0deg)`
              : 'transparent',
            transition: 'background 0.2s ease-out'
          }}
        >
          <button
            className="btn"
            onMouseDown={handlePress}
            onTouchStart={handlePress}
            disabled={isDisabled}
            style={{
              width: '260px',
              height: '260px',
              borderRadius: '50%',
              backgroundColor: isDisabled
                ? 'var(--color-surface-2)'
                : isPressed ? 'var(--color-primary-dark)' : 'var(--color-primary)',
              color: 'var(--color-white)',
              fontSize: '32px',
              border: '8px solid var(--color-text)',
              boxShadow: isPressed || isDisabled
                ? 'none'
                : '0px 12px 0px var(--color-text)',
              transform: isPressed || isDisabled ? 'translateY(12px)' : 'translateY(0)',
              transition: 'all 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {assignment ? (
              <>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: assignment.color,
                  border: '3px solid rgba(255,255,255,0.9)',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                }} />
                <span style={{
                  fontSize: '28px',
                  fontWeight: '800',
                  maxWidth: '220px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.1
                }}>
                  {assignment.nickname}
                </span>
                <span style={{ fontSize: '18px', fontWeight: '600', opacity: 0.9 }}>
                  {showCooldown ? 'RECHARGING' : 'GO!'}
                </span>
              </>
            ) : (
              <span style={{ fontSize: '24px', color: 'var(--color-text-muted)' }}>Waiting...</span>
            )}
          </button>
        </div>
      </div>

      {showCooldown && (
        <div className="text-caption" style={{ fontWeight: 700, letterSpacing: '0.08em' }}>
          READY IN {cooldownLabel}s
        </div>
      )}
    </div>
  )
}
