import { useState } from 'react'
import {
  isValidRoomCode,
  normalizeRoomCode,
  MAX_DISPLAY_NAME_LENGTH,
  ROOM_CODE_LENGTH,
} from '@repo/internal-utils'

export function JoinScreen({ initialCode, onJoin, isBusy, error }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(normalizeRoomCode(initialCode || ''))

  const handleJoin = () => {
    const trimmedName = name.trim()
    if (trimmedName && isValidRoomCode(code)) {
      onJoin(trimmedName, code)
      return
    }
    alert('Please enter a nickname and a 4-digit room code.')
  }

  return (
    <div className="screen-container justify-center">
      <header className="text-center mb-32 animate-enter">
        <h1 className="text-display mb-8">JOIN PARTY</h1>
        <p className="text-h2" style={{ color: 'var(--color-text-muted)' }}>Enter your details to jump in!</p>
      </header>

      <div className="card flex-col gap-24 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div>
          <label className="input-label">NICKNAME</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Lucky Star"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
          />
        </div>

        <div>
          <label className="input-label">ROOM CODE</label>
          <input
            type="tel"
            className="input-field"
            placeholder="0000"
            maxLength={ROOM_CODE_LENGTH}
            value={code}
            onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
            style={{ letterSpacing: '4px', fontFamily: 'Impact, sans-serif' }}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handleJoin}
          disabled={isBusy || !name || !isValidRoomCode(code)}
          style={{ marginTop: 'var(--space-8)' }}
        >
          ENTER ROOM
        </button>
        {error && (
          <p className="text-caption text-center" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
