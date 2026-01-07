import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { HostScreen } from './components/HostScreen'
import { GameScreen } from './components/GameScreen'
import { JoinScreen } from './components/JoinScreen'
import { WaitingScreen } from './components/WaitingScreen'
import { RulesScreen } from './components/RulesScreen'
import { FeedbackModal } from './components/FeedbackModal'
import { normalizeRoomCode, sanitizeDisplayName } from '@repo/internal-utils'

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

function getWsBase(apiBase) {
  if (apiBase.startsWith('https://')) {
    return apiBase.replace(/^https:\/\//, 'wss://')
  }
  if (apiBase.startsWith('http://')) {
    return apiBase.replace(/^http:\/\//, 'ws://')
  }
  return apiBase
}

function safeParseJson(payload) {
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function App() {
  const [view, setView] = useState('home')
  const [userName, setUserName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [roomId, setRoomId] = useState('')
  const [hostKey, setHostKey] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [displayToken, setDisplayToken] = useState('')
  const [participantCount, setParticipantCount] = useState(0)
  const [readyCount, setReadyCount] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [joinUrl, setJoinUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')

  const apiBase = useMemo(() => DEFAULT_API_BASE, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      setRoomCode(normalizeRoomCode(code))
      setView('join')
    }
  }, [])

  useEffect(() => {
    if (!roomId || (!hostKey && !displayToken)) {
      return
    }

    const wsBase = getWsBase(apiBase)
    const ws = new WebSocket(`${wsBase}/ws`)

    ws.addEventListener('open', () => {
      const role = hostKey ? 'host' : 'participant'
      const token = hostKey || displayToken
      ws.send(JSON.stringify({ type: 'join', roomId, role, token }))
    })

    ws.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'room_state') {
          setParticipantCount(message.participantCount || 0)
          setReadyCount(message.readyCount || 0)
        }
      } catch {
        return
      }
    })

    return () => ws.close()
  }, [apiBase, displayToken, hostKey, roomId])

  const handleStartHost = async () => {
    setIsBusy(true)
    setJoinError('')
    try {
      const response = await fetch(`${apiBase}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Unable to create a room. Please try again.')
      }

      const data = await response.json()
      setRoomId(data.roomId)
      setRoomCode(data.roomCode)
      setHostKey(data.hostKey)
      setJoinUrl(data.joinUrl || '')
      setQrDataUrl(data.qrDataUrl || '')
      setParticipantCount(data.participantCount || 0)
      setView('host')
    } catch (error) {
      setJoinError(error.message || 'Unable to create a room.')
    } finally {
      setIsBusy(false)
    }
  }

  const handleStartJoin = () => {
    setView('join')
  }

  const handleJoinRoom = async (name, code) => {
    setIsBusy(true)
    setJoinError('')

    try {
      const displayName = sanitizeDisplayName(name)
      const normalizedCode = normalizeRoomCode(code)
      const response = await fetch(`${apiBase}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: normalizedCode, displayName }),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(errorPayload.error || 'Unable to join the room.')
      }

      const data = await response.json()
      setUserName(displayName)
      setRoomCode(data.roomCode)
      setRoomId(data.roomId)
      setParticipantId(data.participantId)
      setDisplayToken(data.displayToken)
      setView('rules')
    } catch (error) {
      setJoinError(error.message || 'Unable to join the room.')
    } finally {
      setIsBusy(false)
    }
  }

  const handleRulesReady = async () => {
    if (!roomId || !participantId || !displayToken) {
      setView('waiting')
      return
    }

    setIsBusy(true)
    setJoinError('')
    try {
      await fetch(`${apiBase}/api/rooms/${roomId}/participants/${participantId}/ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${displayToken}`,
        },
        body: JSON.stringify({ isReady: true }),
      })
      setView('waiting')
    } catch {
      setJoinError('Unable to mark ready. Please try again.')
      setView('waiting')
    } finally {
      setIsBusy(false)
    }
  }

  const handleLeave = () => {
    if (roomId && participantId && displayToken) {
      fetch(`${apiBase}/api/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${displayToken}`,
        },
      }).catch(() => {})
    }

    setView('home')
    setUserName('')
    setRoomCode('')
    setRoomId('')
    setHostKey('')
    setParticipantId('')
    setDisplayToken('')
    setParticipantCount(0)
    setReadyCount(0)
    setJoinUrl('')
    setQrDataUrl('')
    setJoinError('')
  }

  return (
    <div className="app-container">
      {view === 'home' && (
        <div className="screen-container justify-center">
          <div className="logo-container animate-enter">
            <h1 className="marble-logo">
              MARBLE<br />PARTY
            </h1>
            <div className="logo-subtitle">THE RACE IS ON</div>
          </div>

          <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex-col gap-16">
              <button className="btn btn-primary" onClick={handleStartJoin} disabled={isBusy}>
                JOIN PARTY
              </button>
              <button className="btn btn-secondary" onClick={handleStartHost} disabled={isBusy}>
                HOST PARTY
              </button>
            </div>
            {joinError && (
              <p className="text-caption text-center" style={{ marginTop: 'var(--space-16)', color: 'var(--color-error)' }}>
                {joinError}
              </p>
            )}
            {!joinError && (
              <p className="text-caption text-center" style={{ marginTop: 'var(--space-16)' }}>
                No login required. Just play.
              </p>
            )}
          </div>
        </div>
      )}

      {view === 'host' && (
        <HostScreen
          roomCode={roomCode}
          participantCount={participantCount}
          readyCount={readyCount}
          joinUrl={joinUrl}
          qrDataUrl={qrDataUrl}
          onStart={() => setView('game')}
        />
      )}

      {view === 'game' && (
        <GameScreen
          participantCount={participantCount}
          onBack={() => setView('host')}
        />
      )}

      {view === 'join' && (
        <JoinScreen
          initialCode={roomCode}
          onJoin={handleJoinRoom}
          isBusy={isBusy}
          error={joinError}
        />
      )}

      {view === 'rules' && (
        <RulesScreen onReady={handleRulesReady} isBusy={isBusy} />
      )}

      {view === 'waiting' && (
        <WaitingScreen
          playerName={userName}
          participantCount={participantCount}
          onLeave={handleLeave}
          onFeedback={() => setShowFeedback(true)}
        />
      )}

      {showFeedback && (
        <FeedbackModal onClose={() => setShowFeedback(false)} />
      )}
    </div>
  )
}

export default App
