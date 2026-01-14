import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { HostScreen } from './components/HostScreen'
import { GameScreen } from './components/GameScreen'
import { ControllerScreen } from './components/ControllerScreen'
import { JoinScreen } from './components/JoinScreen'
import { WaitingScreen } from './components/WaitingScreen'
import { RulesScreen } from './components/RulesScreen'
import { FeedbackModal } from './components/FeedbackModal'
import { normalizeRoomCode, sanitizeDisplayName } from '@repo/internal-utils'

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'
const CANDIDATE_SPLIT_REGEX = /[\n,]+/g
const CANDIDATE_COUNT_REGEX = /\*(\d+)$/

function parseCandidateEntries(raw) {
  return String(raw ?? '')
    .split(CANDIDATE_SPLIT_REGEX)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(CANDIDATE_COUNT_REGEX)
      if (!match) {
        return { name: entry, count: 1 }
      }
      const count = Math.max(1, Number(match[1] || 1))
      const name = entry.slice(0, match.index).trim()
      if (!name) {
        return null
      }
      return { name, count }
    })
    .filter(Boolean)
}

function normalizeCandidateText(raw) {
  const entries = parseCandidateEntries(raw)
  const counts = new Map()
  const order = []

  entries.forEach(({ name, count }) => {
    if (!counts.has(name)) {
      order.push(name)
      counts.set(name, 0)
    }
    counts.set(name, (counts.get(name) || 0) + count)
  })

  return order
    .map((name) => {
      const count = counts.get(name) || 0
      return count > 1 ? `${name}*${count}` : name
    })
    .join(', ')
}

function expandCandidateList(raw) {
  const entries = parseCandidateEntries(raw)
  const expanded = []

  entries.forEach(({ name, count }) => {
    for (let i = 0; i < count; i += 1) {
      expanded.push(name)
    }
  })

  return expanded
}

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
  const [candidateText, setCandidateText] = useState('')
  const [gameData, setGameData] = useState(null)
  const [assignment, setAssignment] = useState(null)
  const [lastSpawnEvent, setLastSpawnEvent] = useState(null)
  const [spawnCooldownUntil, setSpawnCooldownUntil] = useState(0)
  const [wsReady, setWsReady] = useState(false)



  const wsRef = useRef(null)

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

    setWsReady(false)
    const wsBase = getWsBase(apiBase)
    const ws = new WebSocket(`${wsBase}/ws`)
    wsRef.current = ws

    ws.addEventListener('open', () => {
      setWsReady(true)
      setJoinError('')
      const role = hostKey ? 'host' : 'participant'
      const token = hostKey || displayToken
      ws.send(JSON.stringify({ type: 'join', roomId, role, token }))
    })

    ws.addEventListener('message', (event) => {
      const message = safeParseJson(event.data)
      if (!message || !message.type) {
        return
      }

      if (message.type === 'room_state') {
        setParticipantCount(message.participantCount || 0)
        setReadyCount(message.readyCount || 0)
        return
      }

      if (message.type === 'game_started') {
        const candidates = Array.isArray(message.candidates) ? message.candidates : []
        const assignments = message.assignments || {}
        setGameData({ candidates, assignments })
        setLastSpawnEvent(null)
        setSpawnCooldownUntil(0)
        if (!hostKey) {
          setAssignment(assignments[participantId] || null)
        }
        setView('game')
        return
      }

      if (message.type === 'spawned_obstacle') {
        setLastSpawnEvent({
          participantId: message.participantId,
          obstacleType: message.obstacleType,
          receivedAt: Date.now(),
        })
        if (message.participantId === participantId && typeof message.cooldownUntil === 'number') {
          setSpawnCooldownUntil(message.cooldownUntil)
        }
        return
      }

      if (message.type === 'spawn_cooldown') {
        if (message.participantId === participantId && typeof message.cooldownUntil === 'number') {
          setSpawnCooldownUntil(message.cooldownUntil)
        }
        return
      }
    })

    ws.addEventListener('close', () => {
      setWsReady(false)
      if (wsRef.current === ws) {
        wsRef.current = null
      }
    })

    ws.addEventListener('error', () => {
      setWsReady(false)
    })

    return () => {
      ws.close()
    }
  }, [apiBase, displayToken, hostKey, participantId, roomId])

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
    setGameData(null)
    setAssignment(null)
    setLastSpawnEvent(null)
    setSpawnCooldownUntil(0)
    setWsReady(false)
  }


  const handleCandidateBlur = () => {
    setCandidateText((current) => normalizeCandidateText(current))
  }

  const handleStartGame = () => {
    const candidates = expandCandidateList(candidateText)
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setJoinError('Connection not ready yet. Please try again.')
      return
    }
    wsRef.current.send(
      JSON.stringify({
        type: 'start_game',
        candidates,
      })
    )
  }

  const handleControllerAction = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }
    wsRef.current.send(
      JSON.stringify({
        type: 'obstacle_action',
        action: 'tap',
      })
    )
  }

  return (
    <div className={`app-container${view === 'game' && hostKey ? ' app-container--game' : ''}`}>
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

          <section className="card seo-section animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <h2>마블 파티란?</h2>
            <p>
              Marble Party는 실시간 마블 레이스 파티 게임입니다. 방을 만들고 친구들이 모바일로
              참가하면 큰 화면에서 함께 레이스를 즐길 수 있어요.
            </p>
            <div className="seo-grid">
              <div>
                <h3>플레이 방법</h3>
                <p className="text-caption">방 만들기 -> 코드 공유 -> 모바일 참가 -> 레이스 시작</p>
              </div>
              <div>
                <h3>파티에 최적화</h3>
                <p className="text-caption">
                  모바일은 컨트롤러, 큰 화면은 경기장. 모임이나 스트리밍에도 잘 어울립니다.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {view === 'host' && (
        <HostScreen
          roomCode={roomCode}
          participantCount={participantCount}
          readyCount={readyCount}
          joinUrl={joinUrl}
          qrDataUrl={qrDataUrl}
          candidateText={candidateText}
          onCandidateChange={setCandidateText}
          onCandidateBlur={handleCandidateBlur}
          onStart={handleStartGame}
          isWsReady={wsReady}
          error={joinError}
        />
      )}

      {view === 'game' && hostKey && (
        <div className="game-stage">
          <GameScreen
            candidates={gameData?.candidates || []}
            assignments={gameData?.assignments || {}}
            lastSpawnEvent={lastSpawnEvent}
            onBack={() => setView('host')}
          />
        </div>
      )}

      {view === 'game' && !hostKey && (
        <ControllerScreen
          assignment={assignment}
          cooldownUntil={spawnCooldownUntil}
          onAction={handleControllerAction}
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
