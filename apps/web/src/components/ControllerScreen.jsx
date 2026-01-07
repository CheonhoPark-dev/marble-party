import { useState } from 'react'

export function ControllerScreen({ assignment, onAction }) {
  const [isPressed, setIsPressed] = useState(false)

  const handlePress = () => {
    if (!assignment) return
    setIsPressed(true)
    onAction?.()
    setTimeout(() => setIsPressed(false), 200)
  }

  return (
    <div className="screen-container justify-center" style={{ background: 'var(--color-surface)' }}>
      <header className="text-center mb-32 animate-enter">
        <h1 className="text-display mb-8">CONTROLLER</h1>
        <p className="text-h2" style={{ color: 'var(--color-text-muted)' }}>MASH THE BUTTON!</p>
      </header>

      <div className="flex-center animate-slide-up" style={{ width: '100%', flex: 1, paddingBottom: '40px' }}>
        <button
          className="btn"
          onMouseDown={handlePress}
          onTouchStart={handlePress}
          disabled={!assignment}
          style={{
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            backgroundColor: !assignment 
              ? 'var(--color-surface-2)' 
              : isPressed ? 'var(--color-primary-dark)' : 'var(--color-primary)',
            color: 'var(--color-white)',
            fontSize: '32px',
            border: '8px solid var(--color-text)',
            boxShadow: isPressed || !assignment
              ? 'none' 
              : '0px 12px 0px var(--color-text)',
            transform: isPressed || !assignment ? 'translateY(12px)' : 'translateY(0)',
            transition: 'all 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            cursor: assignment ? 'pointer' : 'not-allowed',
            opacity: assignment ? 1 : 0.6,
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
              <span style={{ fontSize: '18px', fontWeight: '600', opacity: 0.9 }}>GO!</span>
            </>
          ) : (
            <span style={{ fontSize: '24px', color: 'var(--color-text-muted)' }}>Waiting...</span>
          )}
        </button>
      </div>
    </div>
  )
}
