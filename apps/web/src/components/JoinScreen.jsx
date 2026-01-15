import { useState } from 'react'
import {
  isValidRoomCode,
  normalizeRoomCode,
  MAX_DISPLAY_NAME_LENGTH,
  ROOM_CODE_LENGTH,
} from '@repo/internal-utils'

export function JoinScreen({ initialCode, onJoin, isBusy, error, t }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(normalizeRoomCode(initialCode || ''))

  const handleJoin = () => {
    const trimmedName = name.trim()
    if (trimmedName && isValidRoomCode(code)) {
      onJoin(trimmedName, code)
      return
    }
    alert(t.errors.joinValidation)
  }

  return (
    <div className="screen-container justify-center">
      <header className="text-center mb-32 animate-enter">
        <h1 className="text-display mb-8">{t.join.title}</h1>
        <p className="text-h2" style={{ color: 'var(--color-text-muted)' }}>{t.join.subtitle}</p>
      </header>

      <div className="card flex-col gap-24 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div>
          <label className="input-label">{t.join.nicknameLabel}</label>
          <input
            type="text"
            className="input-field"
            placeholder={t.join.nicknamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
          />
        </div>

        <div>
          <label className="input-label">{t.join.roomCodeLabel}</label>
          <input
            type="tel"
            className="input-field"
            placeholder={t.join.roomCodePlaceholder}
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
          {t.join.enterRoom}
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
