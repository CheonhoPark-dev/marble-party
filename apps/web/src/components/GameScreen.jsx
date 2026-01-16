import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'

const CLOUD_COLUMN_WIDTH = 160
const CLOUD_TOP_OFFSET_MAX = 96
const CLOUD_BAND_MAX = 240
const CLOUD_PADDING_MIN = 32
const CLOUD_PADDING_MAX = 72
const CLOUD_BOB_X = 10
const CLOUD_BOB_Y = 6
const CLOUD_POSITION_SMOOTHING = 0.18
const CLOUD_DROP_OFFSET = 32
const CLOUD_DROP_JITTER = 18
const CLOUD_DROP_MIN_Y = 48
const ZOOM_FACTOR = 0.78
const FINISH_LINE_LABEL = 'finish-line'

const AVATAR_TYPES = ['airplane', 'cloud', 'bird', 'ufo', 'butterfly']

const OBSTACLE_TTL = {
  bomb: 1200,
  normal: 3000,
  spinner: 3000,
  fan: 3000
}

// Map layout uses normalized values (0..1) relative to map width/height.
// Values greater than 1 are treated as base units and scaled with width.
const MAP_BLUEPRINT = {
  width: 1400,
  height: 8400,
  wallThickness: 60,
  floor: { y: 1, inset: 0.12 },
  walls: {
    left: [
      { x: 0.02, y: 0.0 },
      { x: 0.02, y: 0.10 },
      { x: 0.15, y: 0.20 },
      { x: 0.05, y: 0.35 },
      { x: 0.15, y: 0.50 },
      { x: 0.05, y: 0.65 },
      { x: 0.20, y: 0.85 },
      { x: 0.40, y: 1.0 }
    ],
    right: [
      { x: 0.98, y: 0.0 },
      { x: 0.98, y: 0.10 },
      { x: 0.85, y: 0.20 },
      { x: 0.95, y: 0.35 },
      { x: 0.85, y: 0.50 },
      { x: 0.95, y: 0.65 },
      { x: 0.80, y: 0.85 },
      { x: 0.60, y: 1.0 }
    ],
    internal: []
  },
  obstacles: [
    { type: 'peg', x: 0.25, y: 0.05, radius: 0.01 },
    { type: 'peg', x: 0.50, y: 0.05, radius: 0.01 },
    { type: 'peg', x: 0.75, y: 0.05, radius: 0.01 },
    { type: 'peg', x: 0.37, y: 0.09, radius: 0.01 },
    { type: 'peg', x: 0.63, y: 0.09, radius: 0.01 },

    { type: 'spinner', x: 0.30, y: 0.16, length: 0.22, angularVelocity: 0.3 },
    { type: 'spinner', x: 0.70, y: 0.16, length: 0.22, angularVelocity: -0.3 },

    { type: 'ramp', x: 0.15, y: 0.24, length: 0.28, angle: 0.55 },
    { type: 'ramp', x: 0.85, y: 0.28, length: 0.28, angle: -0.55 },
    { type: 'ramp', x: 0.20, y: 0.34, length: 0.30, angle: 0.50 },

    { type: 'kicker-once', x: 0.50, y: 0.42, length: 0.16, angle: 0 },
    { type: 'kicker-once', x: 0.30, y: 0.44, length: 0.14, angle: 0.3 },
    { type: 'kicker-once', x: 0.70, y: 0.44, length: 0.14, angle: -0.3 },

    { type: 'wind', x: 0.30, y: 0.55, width: 0.30, height: 0.14, minForceX: 0.0015, maxForceX: 0.0025, minForceY: -0.001, maxForceY: 0.001, interval: 500 },
    { type: 'wind', x: 0.70, y: 0.55, width: 0.30, height: 0.14, minForceX: -0.0025, maxForceX: -0.0015, minForceY: -0.001, maxForceY: 0.001, interval: 500 },
    { type: 'peg', x: 0.50, y: 0.55, radius: 0.015 },

    { type: 'slider', x: 0.50, y: 0.65, length: 0.25, thickness: 16, range: 0.20, speed: 1.1 },
    { type: 'peg', x: 0.20, y: 0.68, radius: 0.012 },
    { type: 'peg', x: 0.80, y: 0.68, radius: 0.012 },

    { type: 'wind', x: 0.50, y: 0.76, width: 0.40, height: 0.15, minForceX: -0.0005, maxForceX: 0.0005, minForceY: -0.0022, maxForceY: -0.0012, interval: 800 },

    { type: 'ramp', x: 0.15, y: 0.84, length: 0.20, angle: 0.7 },
    { type: 'ramp', x: 0.85, y: 0.84, length: 0.20, angle: -0.7 },

    { type: 'kicker-once', x: 0.40, y: 0.90, length: 0.14, angle: -0.6 },
    { type: 'kicker-once', x: 0.60, y: 0.90, length: 0.14, angle: 0.6 },

    { type: 'spinner', x: 0.50, y: 0.96, length: 0.18, angularVelocity: 0.8 }
  ]
}



const BOMB_BLAST_RADIUS = 220
const BOMB_BLAST_FORCE = 0.0048
const STUCK_SPEED = 0.08
const STUCK_DURATION = 1000
const STUCK_FORCE = 0.0012
const STUCK_LIFT = 0.0016
const KICKER_FORCE_X = 0.008
const KICKER_FORCE_Y = 0.02
const KICKER_COOLDOWN = 180
const KICKER_ACTIVE_FORCE_X = 0.003
const KICKER_ACTIVE_FORCE_Y = 0.009
const KICKER_ACTIVE_INTERVAL = 60
const BUMPER_FORCE = 0.012
const BUMPER_COOLDOWN = 140

const clamp = (value, min, max) => Math.max(min, Math.min(value, max))
const resolveMapValue = (value, size, scale) => {
  if (typeof value !== 'number') {
    return 0
  }
  if (Math.abs(value) <= 1) {
    return value * size
  }
  return value * scale
}
const randomBetween = (min, max) => min + Math.random() * (max - min)
const pickRandom = (items) => items[Math.floor(Math.random() * items.length)]

const getCloudLayout = (bounds, count) => {
  if (!bounds || count <= 0) {
    return null
  }
  const viewWidth = bounds.max.x - bounds.min.x
  const viewHeight = bounds.max.y - bounds.min.y
  const maxColumns = Math.max(1, Math.floor(viewWidth / CLOUD_COLUMN_WIDTH))
  const columns = Math.min(count, maxColumns)
  const rows = Math.max(1, Math.ceil(count / columns))
  const padding = clamp(viewWidth * 0.08, CLOUD_PADDING_MIN, CLOUD_PADDING_MAX)
  const topOffset = clamp(viewHeight * 0.16, 56, CLOUD_TOP_OFFSET_MAX)
  const bandHeight = Math.min(CLOUD_BAND_MAX, viewHeight * 0.32)
  const rowSpacing = rows > 1 ? bandHeight / (rows - 1) : 0
  const usableWidth = Math.max(0, viewWidth - padding * 2)
  return {
    viewWidth,
    viewHeight,
    columns,
    rows,
    padding,
    topOffset,
    bandHeight,
    rowSpacing,
    usableWidth
  }
}

const getCloudBasePosition = (layout, bounds, index) => {
  if (!layout || !bounds) {
    return { x: 0, y: 0 }
  }
  const col = layout.columns === 1 ? 0 : index % layout.columns
  const row = Math.floor(index / layout.columns)
  const ratio = layout.columns === 1 ? 0.5 : (col + 0.5) / layout.columns
  const baseX = bounds.min.x + layout.padding + layout.usableWidth * ratio
  const baseY = bounds.min.y + layout.topOffset + row * layout.rowSpacing
  return { x: baseX, y: baseY }
}

const WinnerOverlay = ({ winner, onBack, onClose, t }) => {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!winner || !canvasRef.current) {
      return
    }

    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    let animationFrameId
    let particles = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resize()
    window.addEventListener('resize', resize)

    const createExplosion = (x, y) => {
      const colors = [
        winner.color || '#F6B500',
        '#E23D2F',
        '#FFFFFF',
        '#F6B500'
      ]

      for (let i = 0; i < 40; i += 1) {
        const angle = Math.random() * Math.PI * 2
        const speed = Math.random() * 6 + 2
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: Math.random() * 0.015 + 0.01
        })
      }
    }

    const loop = () => {
      context.globalCompositeOperation = 'destination-out'
      context.fillStyle = 'rgba(0, 0, 0, 0.1)'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.globalCompositeOperation = 'source-over'

      if (Math.random() < 0.05) {
        createExplosion(
          Math.random() * canvas.width,
          Math.random() * canvas.height * 0.6 + canvas.height * 0.1
        )
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i]
        particle.x += particle.vx
        particle.y += particle.vy
        particle.vy += 0.15
        particle.alpha -= particle.decay

        if (particle.alpha <= 0) {
          particles.splice(i, 1)
        } else {
          context.beginPath()
          context.arc(particle.x, particle.y, 2.5, 0, Math.PI * 2)
          context.fillStyle = particle.color
          context.globalAlpha = particle.alpha
          context.fill()
        }
      }

      context.globalAlpha = 1
      animationFrameId = requestAnimationFrame(loop)
    }

    loop()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationFrameId)
      particles = []
    }
  }, [winner])

  if (!winner) {
    return null
  }

  return (
    <div className="modal-overlay">
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      />
      <div className="modal-content winner-card" style={{ zIndex: 1, position: 'relative' }}>
        <button className="modal-close-btn" onClick={onClose} aria-label={t.game.closeWinner}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="winner-label">{t.game.winnerRank}</div>
        <div className="winner-chip" style={{ backgroundColor: winner.color || 'var(--color-secondary)' }} />
        <div className="winner-name">{winner.name || t.game.winnerDefault}</div>
        <div className="winner-actions">
          <button className="btn btn-primary" onClick={onBack} style={{ minWidth: '200px' }}>
            {t.game.stopParty}
          </button>
        </div>
        <div style={{ marginTop: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{
            position: 'relative',
            backgroundColor: 'var(--color-surface)',
            border: '2px solid var(--color-text)',
            borderRadius: '12px',
            padding: '10px 14px',
            fontSize: '13px',
            fontWeight: 'bold',
            textAlign: 'center',
            maxWidth: '280px',
            lineHeight: '1.4',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {t.game.customBallCta}
            <div style={{
              position: 'absolute',
              bottom: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid var(--color-text)'
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-5px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid var(--color-surface)'
            }} />
          </div>
          <a
            href="https://buymeacoffee.com/undecimber"
            target="_blank"
            rel="noopener noreferrer"
            style={{ transition: 'transform 0.2s' }}
          >
            <img
              src="/buymeacoffee.png"
              alt="Buy Me A Coffee"
              style={{ height: '60px', width: 'auto', display: 'block' }}
            />
          </a>
        </div>
      </div>
    </div>
  )
}

export function GameScreen({
  candidates = [],
  assignments = {},
  lastSpawnEvent,
  onBack,
  onGameComplete,
  mapBlueprint: mapOverride,
  t
}) {
  const sceneRef = useRef(null)
  const engineRef = useRef(null)
  const renderRef = useRef(null)
  const runnerRef = useRef(null)
  const mapBlueprint = mapOverride || MAP_BLUEPRINT
  const spawnedRef = useRef(0)
  const leaderRef = useRef(null)
  const leaderPositionRef = useRef(null)
  const leaderIdRef = useRef(null)
  const mapScaleRef = useRef(null)
  const worldSizeRef = useRef(null)
  const viewSizeRef = useRef(null)
  const cloudsRef = useRef(new Map())
  const obstacleTimersRef = useRef(new Set())
  const windFieldsRef = useRef([])
  const spawnObstacleRef = useRef(null)
  const avatarImagesRef = useRef({})
  const stuckTrackerRef = useRef(new Map())
  const kickerCooldownRef = useRef(new Map())
  const kickerActiveRef = useRef(new Map())
  const bumperCooldownRef = useRef(new Map())
  const effectsRef = useRef([])
  const slidersRef = useRef([])
  const mapSignatureRef = useRef('')
  const winnerRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [rankings, setRankings] = useState([])
  const [winner, setWinner] = useState(null)
  const [showWinnerOverlay, setShowWinnerOverlay] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      if (!engineRef.current) return

      const marbles = Matter.Composite.allBodies(engineRef.current.world)
        .filter(b => b.label && b.label.startsWith('marble-'))

      const sorted = marbles
        .sort((a, b) => b.position.y - a.position.y)
        .slice(0, 10)

      setRankings(sorted.map((b, i) => ({
        id: b.id,
        rank: i + 1,
        name: b.customName || t.game.winnerDefault,
        color: b.render?.fillStyle
      })))
    }, 500)

    return () => clearInterval(interval)
  }, [t])

  useEffect(() => {
    winnerRef.current = null
    setWinner(null)
    setShowWinnerOverlay(true)
  }, [candidates])

  useEffect(() => {
    AVATAR_TYPES.forEach(type => {
      const img = new Image()
      img.src = `/images/avatars/${type}.png`
      img.onload = () => {
        avatarImagesRef.current[type] = img
      }
    })
  }, [])


  const registerTimer = (timerId) => {
    obstacleTimersRef.current.add(timerId)
  }

  const clearObstacleTimers = () => {
    obstacleTimersRef.current.forEach((timerId) => clearTimeout(timerId))
    obstacleTimersRef.current.clear()
  }







  useEffect(() => {
    if (!engineRef.current) return

    const theme = {
      text: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim()
    }

    const bodies = Matter.Composite.allBodies(engineRef.current.world)

    bodies.forEach((body) => {
      if (!body.isSpawnedObstacle) {
        return
      }

      const assignment = assignments?.[body.obstacleOwnerId]

      if (assignment) {
        body.obstacleLabel = assignment.nickname
        body.obstacleOwnerColor = assignment.color
        if (body.render) {
          body.render.strokeStyle = assignment.color
        }
      } else {
        body.obstacleLabel = null
        body.obstacleOwnerColor = null
        if (body.render) {
          body.render.strokeStyle = theme.text
        }
      }
    })
  }, [assignments, dimensions])

  useEffect(() => {
    if (!renderRef.current && (dimensions.width === 0 || dimensions.height === 0)) return

    const bounds = renderRef.current?.bounds ?? {
      min: { x: 0, y: 0 },
      max: { x: dimensions.width, y: dimensions.height }
    }
    const clouds = cloudsRef.current
    const entries = Object.entries(assignments || {})
    const nextIds = new Set(entries.map(([participantId]) => participantId))

    for (const [participantId] of clouds) {
      if (!nextIds.has(participantId)) {
        clouds.delete(participantId)
      }
    }

    const ordered = entries.sort(([, a], [, b]) => (a?.obstacleId ?? 0) - (b?.obstacleId ?? 0))
    const layout = getCloudLayout(bounds, ordered.length)

    ordered.forEach(([participantId, assignment], index) => {
      const existing = clouds.get(participantId)
      const basePosition = layout
        ? getCloudBasePosition(layout, bounds, index)
        : { x: (bounds.min.x + bounds.max.x) / 2, y: (bounds.min.y + bounds.max.y) / 2 }

      if (existing) {
        existing.color = assignment.color
        existing.nickname = assignment.nickname
        existing.orderIndex = index
        if (existing.bobPhase == null) {
          existing.bobPhase = Math.random() * Math.PI * 2
        }
        if (existing.bobSpeed == null) {
          existing.bobSpeed = randomBetween(0.85, 1.2)
        }
        if (existing.spawnJitter == null) {
          existing.spawnJitter = randomBetween(-CLOUD_DROP_JITTER, CLOUD_DROP_JITTER)
        }
        return
      }

        clouds.set(participantId, {
          id: participantId,
          x: basePosition.x,
          y: basePosition.y,
          roamX: basePosition.x,
          roamY: basePosition.y,
          roamTargetX: null,
          roamTargetY: null,
          roamSpeed: randomBetween(2.25, 4.2),
          color: assignment.color,
          nickname: assignment.nickname,
          avatarType: pickRandom(AVATAR_TYPES),
          orderIndex: index,
          bobPhase: Math.random() * Math.PI * 2,
          bobSpeed: randomBetween(0.85, 1.2),
          spawnJitter: randomBetween(-CLOUD_DROP_JITTER, CLOUD_DROP_JITTER)
        })
    })
  }, [assignments, dimensions])

  useEffect(() => {
    if (!lastSpawnEvent || !spawnObstacleRef.current || !renderRef.current) {
      return
    }

    const { participantId, obstacleType } = lastSpawnEvent
    const cloud = cloudsRef.current.get(participantId)
    const bounds = renderRef.current.bounds
    const viewHeight = bounds.max.y - bounds.min.y
    const fallbackX = (bounds.min.x + bounds.max.x) / 2
    const fallbackY = bounds.min.y + Math.min(140, viewHeight * 0.2)
    const baseX = cloud?.x ?? fallbackX
    const baseY = cloud?.y ?? fallbackY
    const spawnX = clamp(
      baseX,
      bounds.min.x + 40,
      bounds.max.x - 40
    )
    const spawnY = clamp(
      baseY,
      bounds.min.y + CLOUD_DROP_MIN_Y,
      bounds.max.y - 40
    )

    spawnObstacleRef.current({
      x: spawnX,
      y: spawnY,
      participantId,
      obstacleType: obstacleType || pickRandom(Object.keys(OBSTACLE_TTL))
    })
  }, [lastSpawnEvent])


  useEffect(() => {
    const handleResize = () => {
      if (sceneRef.current) {
        setDimensions({
          width: sceneRef.current.clientWidth,
          height: sceneRef.current.clientHeight
        })
      }
    }

    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!sceneRef.current || dimensions.width === 0 || dimensions.height === 0) return
    if (engineRef.current) return

    const styles = getComputedStyle(document.documentElement)
    const theme = {
      primary: styles.getPropertyValue('--color-primary').trim(),
      secondary: styles.getPropertyValue('--color-secondary').trim(),
      text: styles.getPropertyValue('--color-text').trim(),
      surface: styles.getPropertyValue('--color-surface').trim(),
      success: styles.getPropertyValue('--color-success').trim(),
      warning: styles.getPropertyValue('--color-warning').trim(),
      white: styles.getPropertyValue('--color-white').trim(),
      muted: styles.getPropertyValue('--color-text-muted').trim(),
    }

    const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Constraint = Matter.Constraint,
      Events = Matter.Events

    const { width: canvasWidth, height: canvasHeight } = dimensions
    const mapScale = mapScaleRef.current ?? canvasWidth / mapBlueprint.width
    const worldWidth = mapBlueprint.width * mapScale
    const worldHeight = mapBlueprint.height * mapScale
    if (!mapScaleRef.current) {
      mapScaleRef.current = mapScale
      worldSizeRef.current = { width: worldWidth, height: worldHeight }
      viewSizeRef.current = { width: canvasWidth, height: canvasHeight }
    }
    const toWidth = (value, fallback) => resolveMapValue(value ?? fallback, worldWidth, mapScale)
    const toHeight = (value, fallback) => resolveMapValue(value ?? fallback, worldHeight, mapScale)

    const getViewSize = () => viewSizeRef.current || { width: canvasWidth, height: canvasHeight }
    const initialView = getViewSize()

    const engine = Engine.create()
    engineRef.current = engine
    engine.world.gravity.y = 0.6
    engine.positionIterations = 12
    engine.velocityIterations = 10
    engine.constraintIterations = 6

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: canvasWidth,
        height: canvasHeight,
        background: 'transparent',
        wireframes: false,
        pixelRatio: window.devicePixelRatio
      }
    })
    renderRef.current = render
    render.options.hasBounds = true
    render.bounds.min.x = 0
    render.bounds.max.x = initialView.width
    render.bounds.min.y = 0
    render.bounds.max.y = initialView.height

    const camera = {
      currentX: initialView.width / 2,
      currentY: initialView.height / 2,
      deltaX: 0,
      deltaY: 0
    }

    const updateCamera = () => {
      const rawView = getViewSize()
      const viewWidth = rawView.width * ZOOM_FACTOR
      const viewHeight = rawView.height * ZOOM_FACTOR
      const bodies = Composite.allBodies(engine.world)
      let leader = null

      for (const body of bodies) {
        if (!body.label || !body.label.startsWith('marble-')) {
          continue
        }
        if (!leader || body.position.y > leader.position.y) {
          leader = body
        }
      }

      leaderRef.current = leader

      const minX = viewWidth / 2
      const maxX = Math.max(minX, worldWidth - viewWidth / 2)
      const minY = viewHeight / 2
      const maxY = Math.max(minY, worldHeight - viewHeight / 2)

      const lookaheadX = leader
        ? clamp(leader.velocity.x * 36, -viewWidth * 0.12, viewWidth * 0.12)
        : 0
      const targetX = leader
        ? clamp(leader.position.x + lookaheadX, minX, maxX)
        : clamp(camera.currentX, minX, maxX)
      const targetY = leader
        ? clamp(leader.position.y, minY, maxY)
        : clamp(camera.currentY, minY, maxY)

      const prevX = camera.currentX
      const prevY = camera.currentY
      const smoothing = 0.12
      camera.currentX = prevX + (targetX - prevX) * smoothing
      camera.currentY = prevY + (targetY - prevY) * smoothing
      camera.deltaX = camera.currentX - prevX
      camera.deltaY = camera.currentY - prevY

      render.bounds.min.x = camera.currentX - viewWidth / 2
      render.bounds.max.x = camera.currentX + viewWidth / 2
      render.bounds.min.y = camera.currentY - viewHeight / 2
      render.bounds.max.y = camera.currentY + viewHeight / 2
    }

    const updateClouds = () => {
      if (!renderRef.current) {
        return
      }
      const bounds = renderRef.current.bounds

      const leader = leaderRef.current
      let deltaX = 0
      let deltaY = camera.deltaY || 0
      if (leader) {
        if (leaderIdRef.current !== leader.id || !leaderPositionRef.current) {
          leaderIdRef.current = leader.id
          leaderPositionRef.current = {
            x: leader.position.x,
            y: leader.position.y
          }
        } else {
          const prev = leaderPositionRef.current
          deltaX = leader.position.x - prev.x
          deltaY = leader.position.y - prev.y
          leaderPositionRef.current = {
            x: leader.position.x,
            y: leader.position.y
          }
        }
      } else {
        leaderIdRef.current = null
        leaderPositionRef.current = null
      }

      const clouds = cloudsRef.current
      if (!clouds.size) {
        return
      }

      const now = Date.now()
      const viewWidth = bounds.max.x - bounds.min.x
      const viewHeight = bounds.max.y - bounds.min.y
      const CLOUD_RADIUS = 45
      const safePadX = CLOUD_RADIUS + CLOUD_BOB_X
      const safePadY = CLOUD_RADIUS + CLOUD_BOB_Y

      const targetPad = 60

      const focusX = leader ? leader.position.x : (bounds.min.x + bounds.max.x) / 2
      const focusY = leader ? leader.position.y : (bounds.min.y + bounds.max.y) / 2

        const maxRadiusX = Math.max(180, viewWidth * 0.98)
        const maxRadiusY = Math.max(140, viewHeight * 0.9)
        const radiusX = clamp(360 + clouds.size * 30, 360, maxRadiusX)
        const radiusY = clamp(280 + clouds.size * 22, 280, maxRadiusY)

      const worldMinX = Math.min(bounds.min.x + targetPad, bounds.max.x - targetPad)
      const worldMaxX = Math.max(bounds.min.x + targetPad, bounds.max.x - targetPad)
      const viewMinY = bounds.min.y + targetPad
      const viewMaxY = bounds.max.y - targetPad
      const worldMinY = targetPad
      const worldMaxY = worldHeight - targetPad
      const clampMinY = Math.max(worldMinY, viewMinY)
      const clampMaxY = Math.min(worldMaxY, viewMaxY)
      const skyMinX = clamp(focusX - radiusX, worldMinX, worldMaxX)
      const skyMaxX = clamp(focusX + radiusX, worldMinX, worldMaxX)
      const skyMinY = clamp(focusY - radiusY, clampMinY, clampMaxY)
      const skyMaxY = clamp(focusY + radiusY, clampMinY, clampMaxY)

      const safeMinX = Math.min(skyMinX, skyMaxX)
      const safeMaxX = Math.max(skyMinX, skyMaxX)
      let safeMinY = Math.min(skyMinY, skyMaxY)
      let safeMaxY = Math.max(skyMinY, skyMaxY)
      if (safeMinY > safeMaxY) {
        const centerY = (bounds.min.y + bounds.max.y) / 2
        safeMinY = centerY
        safeMaxY = centerY
      }

      for (const cloud of clouds.values()) {
        if (cloud.roamX == null) {
          cloud.roamX = cloud.x
          cloud.roamY = cloud.y
          cloud.roamSpeed = randomBetween(1.8, 3.6)
        }

        cloud.roamX += deltaX
        cloud.roamY += deltaY
        if (cloud.roamTargetX != null) {
          cloud.roamTargetX += deltaX
        }
        if (cloud.roamTargetY != null) {
          cloud.roamTargetY += deltaY
        }

        const targetInvalid = cloud.roamTargetX == null ||
          cloud.roamTargetX < skyMinX || cloud.roamTargetX > skyMaxX ||
          cloud.roamTargetY < skyMinY || cloud.roamTargetY > skyMaxY

        if (targetInvalid) {
          cloud.roamTargetX = randomBetween(skyMinX, skyMaxX)
          cloud.roamTargetY = randomBetween(skyMinY, skyMaxY)
        }

        const dx = cloud.roamTargetX - cloud.roamX
        const dy = cloud.roamTargetY - cloud.roamY
        const dist = Math.hypot(dx, dy)

        if (dist < 24) {
          cloud.roamTargetX = randomBetween(skyMinX, skyMaxX)
          cloud.roamTargetY = randomBetween(skyMinY, skyMaxY)
        } else {
          cloud.roamX += (dx / dist) * cloud.roamSpeed
          cloud.roamY += (dy / dist) * cloud.roamSpeed
        }

        const bobSpeed = cloud.bobSpeed ?? 1
        const bobX = Math.sin((now / 900) * bobSpeed + cloud.bobPhase) * CLOUD_BOB_X
        const bobY = Math.cos((now / 760) * bobSpeed + cloud.bobPhase) * CLOUD_BOB_Y

        const hardMinX = bounds.min.x + safePadX - bobX
        const hardMaxX = bounds.max.x - safePadX - bobX
        const hardMinY = bounds.min.y + safePadY - bobY
        const hardMaxY = bounds.max.y - safePadY - bobY

        cloud.roamX = clamp(cloud.roamX, hardMinX, hardMaxX)

        let nextY = clamp(cloud.roamY, skyMinY, skyMaxY)
        cloud.roamY = clamp(nextY, hardMinY, hardMaxY)

        const targetX = cloud.roamX + bobX
        const targetY = cloud.roamY + bobY
        if (cloud.x == null || cloud.y == null) {
          cloud.x = targetX
          cloud.y = targetY
        } else {
          cloud.x += (targetX - cloud.x) * CLOUD_POSITION_SMOOTHING
          cloud.y += (targetY - cloud.y) * CLOUD_POSITION_SMOOTHING
        }
      }
    }

    const applyWindForces = () => {
      const windFields = windFieldsRef.current
      if (!windFields.length) {
        return
      }
      const now = Date.now()

      for (let i = windFields.length - 1; i >= 0; i -= 1) {
        if (windFields[i].expiresAt && windFields[i].expiresAt <= now) {
          windFields.splice(i, 1)
        }
      }

      if (!windFields.length) {
        return
      }

      const bodies = Composite.allBodies(engine.world)

      windFields.forEach((field) => {
        if (field.randomizeAt && field.randomizeAt <= now) {
          field.forceX = randomBetween(field.minForceX ?? 0, field.maxForceX ?? 0)
          field.forceY = randomBetween(field.minForceY ?? 0, field.maxForceY ?? 0)
          const interval = field.interval ?? 900
          field.randomizeAt = now + interval
        }

        const minX = field.x - field.width / 2
        const maxX = field.x + field.width / 2
        const minY = field.y - field.height / 2
        const maxY = field.y + field.height / 2
        const forceX = field.forceX ?? 0
        const forceY = field.forceY ?? (field.strength != null ? -field.strength : 0)

        bodies.forEach((body) => {
          if (!body.label || !body.label.startsWith('marble-')) {
            return
          }
          const { x, y } = body.position
          if (x < minX || x > maxX || y < minY || y > maxY) {
            return
          }
          Matter.Sleeping.set(body, false)
          Matter.Body.applyForce(body, body.position, { x: forceX, y: forceY })
        })
      })
    }

    const nudgeStuckMarbles = () => {
      const bodies = Composite.allBodies(engine.world)
      const now = Date.now()
      const tracker = stuckTrackerRef.current

      bodies.forEach((body) => {
        if (!body.label || !body.label.startsWith('marble-') || body.isStatic) {
          return
        }

        const speed = body.speed ?? Math.hypot(body.velocity.x, body.velocity.y)
        if (speed > STUCK_SPEED) {
          tracker.set(body.id, now)
          return
        }

        const lastActive = tracker.get(body.id) ?? now
        if (now - lastActive < STUCK_DURATION) {
          tracker.set(body.id, lastActive)
          return
        }

        Matter.Sleeping.set(body, false)
        Matter.Body.applyForce(body, body.position, {
          x: randomBetween(-STUCK_FORCE, STUCK_FORCE),
          y: -STUCK_LIFT
        })
        tracker.set(body.id, now)
      })
    }

    const updateKickerVisuals = () => {
      const now = Date.now()
      const bodies = Composite.allBodies(engine.world)
      bodies.forEach(body => {
        if (body.isKicker && body.flashEndTime && now > body.flashEndTime) {
          body.render.fillStyle = body.originalFillStyle
          body.flashEndTime = null
        }
      })
    }

    const updateSpawnedObstacles = () => {
      const bodies = Composite.allBodies(engine.world)
      bodies.forEach((body) => {
        if (!body.isSpawnedObstacle) {
          return
        }
        if (body.obstacleType === 'spinner') {
          const target = body.spinnerVelocity ?? 0.7
          Matter.Sleeping.set(body, false)
          if (Math.abs(body.angularVelocity - target) > 0.02) {
            Matter.Body.setAngularVelocity(body, target)
          }
        }
      })
    }

    const updateSliders = () => {
      const sliders = slidersRef.current
      if (!sliders.length) {
        return
      }
      sliders.forEach((slider) => {
        if (!slider || slider.isRemoved) {
          return
        }
        const originX = slider.sliderOriginX ?? slider.position.x
        const range = slider.sliderRange ?? 0
        if (!range) {
          return
        }
        const minX = originX - range
        const maxX = originX + range
        const speed = slider.sliderSpeed ?? 0.9
        let nextX = slider.position.x + speed * slider.sliderDirection
        if (nextX < minX || nextX > maxX) {
          slider.sliderDirection *= -1
          nextX = clamp(nextX, minX, maxX)
        }
        Matter.Body.setPosition(slider, { x: nextX, y: slider.position.y })
      })
    }

    const limitMarbleSpeed = () => {
      const bodies = Composite.allBodies(engine.world)
      const scale = mapScaleRef.current || 1
      const baseWallThickness = mapBlueprint.wallThickness ?? 56
      const wallThickness = baseWallThickness * scale
      const maxSpeed = Math.max(14 * scale, wallThickness * 0.85)

      bodies.forEach((body) => {
        if (!body.label || !body.label.startsWith('marble-') || body.isStatic) {
          return
        }
        const speed = body.speed ?? Math.hypot(body.velocity.x, body.velocity.y)
        if (speed <= maxSpeed) {
          return
        }
        const scaleFactor = maxSpeed / speed
        Matter.Body.setVelocity(body, {
          x: body.velocity.x * scaleFactor,
          y: body.velocity.y * scaleFactor
        })
      })
    }

    const updateWorld = (event) => {
      updateCamera()
      updateClouds()
      nudgeStuckMarbles()
      applyWindForces()
      updateKickerVisuals()
      updateSpawnedObstacles()
      updateSliders()
      limitMarbleSpeed()
    }

    const recordWinner = (marble) => {
      if (!marble || winnerRef.current) {
        return
      }
      const winnerData = {
        id: marble.id,
        name: marble.customName || t.game.winnerDefault,
        color: marble.render?.fillStyle
      }
      winnerRef.current = winnerData
      setWinner(winnerData)
      setShowWinnerOverlay(true)
      if (typeof onGameComplete === 'function') {
        onGameComplete(winnerData)
      }
    }

    Events.on(engine, 'collisionStart', (event) => {
      const now = Date.now()
      const cooldowns = kickerCooldownRef.current

      event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA
        const bodyB = pair.bodyB
        const finishBody = bodyA.label === FINISH_LINE_LABEL
          ? bodyA
          : bodyB.label === FINISH_LINE_LABEL
            ? bodyB
            : null

        if (finishBody && !winnerRef.current) {
          const marble = finishBody === bodyA ? bodyB : bodyA
          if (marble.label && marble.label.startsWith('marble-')) {
            recordWinner(marble)
          }
        }

        const bumper = bodyA.isBumper ? bodyA : bodyB.isBumper ? bodyB : null
        if (bumper) {
          const marble = bumper === bodyA ? bodyB : bodyA
          if (marble.label && marble.label.startsWith('marble-')) {
            const bumpers = bumperCooldownRef.current
            const lastBump = bumpers.get(marble.id) ?? 0
            if (now - lastBump >= BUMPER_COOLDOWN) {
              const dx = marble.position.x - bumper.position.x
              const dy = marble.position.y - bumper.position.y
              const distance = Math.hypot(dx, dy) || 1
              const impulse = BUMPER_FORCE * 1600
              Matter.Sleeping.set(marble, false)
              Matter.Body.setVelocity(marble, {
                x: marble.velocity.x + (dx / distance) * impulse,
                y: marble.velocity.y + (dy / distance) * impulse
              })
              bumpers.set(marble.id, now)
            }
          }
        }

        const kicker = bodyA.isKicker ? bodyA : bodyB.isKicker ? bodyB : null
        if (!kicker) {
          return
        }
        if (kicker.oneTime && kicker.used) {
          return
        }
        const marble = kicker === bodyA ? bodyB : bodyA
        if (!marble.label || !marble.label.startsWith('marble-')) {
          return
        }
        const lastKick = cooldowns.get(marble.id) ?? 0
        if (now - lastKick < KICKER_COOLDOWN) {
          return
        }

        if (!kicker.originalFillStyle) {
          kicker.originalFillStyle = kicker.render.fillStyle
        }
        kicker.render.fillStyle = theme.white
        kicker.flashEndTime = now + 200

        const kickAngle = kicker.angle ?? 0
        const kickDirX = Math.sin(kickAngle)
        const kickDirY = -Math.cos(kickAngle)
        Matter.Sleeping.set(marble, false)
        Matter.Body.setVelocity(marble, {
          x: marble.velocity.x + kickDirX * KICKER_FORCE_X * 1800 + randomBetween(-KICKER_FORCE_X * 600, KICKER_FORCE_X * 600),
          y: Math.min(marble.velocity.y, 0) + kickDirY * KICKER_FORCE_Y * 1800
        })
        cooldowns.set(marble.id, now)

        if (kicker.oneTime) {
          kicker.used = true
          const removeTimer = setTimeout(() => {
            Composite.remove(engine.world, kicker)
          }, 200)
          registerTimer(removeTimer)
        }
      })
    })

    Events.on(engine, 'collisionActive', (event) => {
      const now = Date.now()
      const activeCooldowns = kickerActiveRef.current

      event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA
        const bodyB = pair.bodyB
        const kicker = bodyA.isKicker ? bodyA : bodyB.isKicker ? bodyB : null
        if (!kicker) {
          return
        }
        const marble = kicker === bodyA ? bodyB : bodyA
        if (!marble.label || !marble.label.startsWith('marble-')) {
          return
        }
        const lastActive = activeCooldowns.get(marble.id) ?? 0
        if (now - lastActive < KICKER_ACTIVE_INTERVAL) {
          return
        }
        const kickAngle = kicker.angle ?? 0
        const kickDirX = Math.sin(kickAngle)
        const kickDirY = -Math.cos(kickAngle)
        Matter.Sleeping.set(marble, false)
        Matter.Body.setVelocity(marble, {
          x: marble.velocity.x + kickDirX * KICKER_ACTIVE_FORCE_X * 1400 + randomBetween(-KICKER_ACTIVE_FORCE_X * 500, KICKER_ACTIVE_FORCE_X * 500),
          y: Math.min(marble.velocity.y, 0) + kickDirY * KICKER_ACTIVE_FORCE_Y * 1200
        })
        activeCooldowns.set(marble.id, now)
      })
    })

    Events.on(engine, 'afterUpdate', updateWorld)

    Events.on(render, 'afterRender', () => {
      const context = render.context
      const bodies = Composite.allBodies(engine.world)

      if (render.options.hasBounds) {
        Matter.Render.startViewTransform(render)
      }

      const now = Date.now()

      const windFields = windFieldsRef.current
      if (windFields.length) {
        context.save()
        windFields.forEach((field) => {
          const { x, y, width, height } = field
          const halfWidth = width / 2
          const halfHeight = height / 2

          context.fillStyle = 'rgba(52, 152, 219, 0.06)'
          context.strokeStyle = 'rgba(52, 152, 219, 0.15)'
          context.lineWidth = 1
          context.beginPath()
          if (context.roundRect) {
            context.roundRect(x - halfWidth, y - halfHeight, width, height, 16)
          } else {
            context.rect(x - halfWidth, y - halfHeight, width, height)
          }
          context.fill()
          context.stroke()

          context.save()
          context.beginPath()
          context.rect(x - halfWidth, y - halfHeight, width, height)
          context.clip()

          const forceX = field.forceX ?? (field.minForceX + field.maxForceX) / 2
          const forceY = field.forceY ?? (field.minForceY + field.maxForceY) / 2
          const angle = Math.atan2(forceY, forceX)
          const magnitude = Math.hypot(forceX, forceY)
          const visualSpeed = Math.max(0.5, magnitude * 2500)

          context.translate(x, y)
          context.rotate(angle)

          const diagonal = Math.hypot(width, height)
          const halfDiagonal = diagonal / 2
          const spacingX = 40
          const spacingY = 24
          const offset = (now * 0.12 * visualSpeed) % spacingX

          context.strokeStyle = 'rgba(255, 255, 255, 0.4)'
          context.lineWidth = 2
          context.lineCap = 'round'

          for (let lineY = -halfDiagonal; lineY < halfDiagonal; lineY += spacingY) {
            const stagger = Math.abs(lineY) % (spacingY * 2) === 0 ? 0 : spacingX / 2
            for (let lineX = -halfDiagonal; lineX < halfDiagonal; lineX += spacingX) {
              const drawX = lineX + offset + stagger
              if (drawX > halfDiagonal) {
                continue
              }
              context.beginPath()
              context.moveTo(drawX, lineY)
              context.lineTo(drawX + 12, lineY)
              context.stroke()
            }
          }

          context.restore()
          context.restore()
        })
        context.restore()
      }
      
      const effects = effectsRef.current
      for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i]
        const age = now - effect.startedAt
        if (age > 600) {
          effects.splice(i, 1)
          continue
        }
        const progress = age / 600
        const ease = 1 - Math.pow(1 - progress, 3)
        const alpha = 1 - progress

        context.beginPath()
        context.arc(effect.x, effect.y, 20 + ease * 120, 0, Math.PI * 2)
        context.strokeStyle = `rgba(231, 76, 60, ${alpha})`
        context.lineWidth = 4 * alpha
        context.stroke()
      }

      bodies.forEach(body => {
        if (!body.isSpawnedObstacle) return

        const { x, y } = body.position
        context.save()
        context.translate(x, y)
        context.rotate(body.angle)

        if (body.obstacleType === 'bomb') {
          context.beginPath()
          context.arc(0, 0, 17, 0, Math.PI * 2)
          context.fillStyle = '#2c3e50'
          context.fill()

          context.beginPath()
          context.arc(-6, -6, 6, 0, Math.PI * 2)
          context.fillStyle = 'rgba(255, 255, 255, 0.25)'
          context.fill()

          context.lineWidth = 2.5
          context.strokeStyle = theme.text
          context.stroke()

          context.fillStyle = '#7f8c8d'
          context.fillRect(-5, -22, 10, 6)
          context.strokeRect(-5, -22, 10, 6)

          context.beginPath()
          context.moveTo(0, -22)
          context.bezierCurveTo(0, -32, 10, -28, 14, -34)
          context.lineWidth = 2
          context.strokeStyle = '#d35400'
          context.stroke()

          const pulse = (Math.sin(now * 0.03) + 1) * 0.5
          const cx = 14, cy = -34
          context.translate(cx, cy)
          context.rotate(now * 0.02)
          context.beginPath()
          const spikes = 6
          const outer = 6 + pulse * 3
          const inner = 3
          for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outer : inner
            const a = (Math.PI * i) / spikes
            context.lineTo(Math.cos(a) * r, Math.sin(a) * r)
          }
          context.closePath()
          context.fillStyle = '#f1c40f'
          context.fill()
          context.strokeStyle = '#e74c3c'
          context.lineWidth = 1
          context.stroke()
          context.rotate(-now * 0.02)
          context.translate(-cx, -cy)

        } else if (body.obstacleType === 'spinner') {
          const width = body.renderWidth || 120
          const h = 14
          const w = width

          context.fillStyle = theme.secondary
          context.strokeStyle = theme.text
          context.lineWidth = 2
          context.beginPath()
          if (context.roundRect) {
            context.roundRect(-w / 2, -h / 2, w, h, 6)
          } else {
            context.rect(-w / 2, -h / 2, w, h)
          }
          context.fill()
          context.stroke()

          context.fillStyle = 'rgba(255,255,255,0.4)'
          context.beginPath()
          for (let i = -w / 2 + 10; i < w / 2; i += 20) {
            context.rect(i, -h / 2, 8, h)
          }
          context.fill()

          context.beginPath()
          context.arc(0, 0, 6, 0, Math.PI * 2)
          context.fillStyle = theme.text
          context.fill()
        } else if (body.obstacleType === 'fan') {
          const w = 94
          const h = 24

          context.fillStyle = theme.surface
          context.strokeStyle = theme.text
          context.lineWidth = 2
          if (context.roundRect) {
            context.beginPath()
            context.roundRect(-w / 2, -h / 2, w, h, 4)
            context.fill()
            context.stroke()
          } else {
            context.fillRect(-w / 2, -h / 2, w, h)
            context.strokeRect(-w / 2, -h / 2, w, h)
          }

          context.save()
          context.beginPath()
          context.rect(-w / 2, -h / 2, w, h)
          context.clip()

          const spacing = 16
          const speed = now * 0.08
          const offset = speed % spacing

          context.beginPath()
          context.strokeStyle = theme.muted
          context.lineWidth = 2
          for (let x = -w / 2 - spacing; x < w / 2 + spacing; x += spacing) {
            const drawX = x + offset
            context.moveTo(drawX - 4, -h / 2 - 4)
            context.lineTo(drawX + 4, h / 2 + 4)
          }
          context.stroke()
          context.restore()

          context.beginPath()
          for (let i = 1; i < 4; i++) {
            const x = -w / 2 + (w * i / 4)
            context.moveTo(x, -h / 2)
            context.lineTo(x, h / 2)
          }
          context.lineWidth = 1.5
          context.strokeStyle = 'rgba(0,0,0,0.15)'
          context.stroke()

          const windSpeed = 0.15
          const windOffset = (now * windSpeed) % 25
          context.beginPath()
          context.strokeStyle = theme.success
          context.lineWidth = 2

          for (let i = 0; i < 4; i++) {
            const xOff = (i - 1.5) * 20
            const localOff = (windOffset + i * 7) % 25
            const y = -h / 2 - 6 - localOff
            const len = 10 + Math.sin(now * 0.01 + i) * 4

            context.globalAlpha = Math.max(0, 1 - localOff / 25)
            context.moveTo(xOff, y)
            context.lineTo(xOff, y - len)
          }
          context.stroke()
          context.globalAlpha = 1
        } else {
          const w = 100
          const h = 18
          context.fillStyle = '#95a5a6'
          context.beginPath()
          if (context.roundRect) {
            context.roundRect(-w / 2, -h / 2, w, h, 4)
          } else {
            context.rect(-w / 2, -h / 2, w, h)
          }
          context.fill()

          context.lineWidth = 2
          context.strokeStyle = theme.text
          context.stroke()

          context.beginPath()
          context.moveTo(-w / 2 + 10, -h / 2)
          context.lineTo(-w / 2 + 10, h / 2)
          context.moveTo(w / 2 - 10, -h / 2)
          context.lineTo(w / 2 - 10, h / 2)
          context.strokeStyle = 'rgba(0,0,0,0.1)'
          context.stroke()
        }

        context.restore()
      })

      context.font = "bold 14px sans-serif"
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.lineWidth = 3
      context.strokeStyle = theme.surface

      bodies.forEach(body => {
        if (body.label && body.label.startsWith('marble-')) {
          const { x, y } = body.position
          const text = body.customName || ''

          if (text === '천호') {
            const crownBaseY = y - 32
            context.save()
            context.fillStyle = '#F6B500'
            context.strokeStyle = theme.surface
            context.lineWidth = 2
            context.beginPath()
            context.moveTo(x - 7, crownBaseY)
            context.lineTo(x - 10, crownBaseY - 10)
            context.lineTo(x - 3.5, crownBaseY - 5)
            context.lineTo(x, crownBaseY - 13)
            context.lineTo(x + 3.5, crownBaseY - 5)
            context.lineTo(x + 10, crownBaseY - 10)
            context.lineTo(x + 7, crownBaseY)
            context.closePath()
            context.stroke()
            context.fill()
            context.restore()
          }

          context.strokeText(text, x, y - 22)
          context.fillStyle = theme.text
          context.fillText(text, x, y - 22)
        } else if (body.obstacleLabel) {
          const { x, y } = body.position
          const text = body.obstacleLabel

          context.save()
          context.font = "bold 10px sans-serif"
          context.strokeStyle = body.obstacleOwnerColor || theme.surface
          context.strokeText(text, x, y - 14)
          context.fillStyle = theme.white
          context.fillText(text, x, y - 14)
          context.restore()
        }
      })

      const clouds = cloudsRef.current
      if (clouds.size) {
        context.save()
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.font = '700 11px sans-serif'
        clouds.forEach((cloud) => {
          const baseX = cloud.x
          const baseY = cloud.y

          const img = avatarImagesRef.current[cloud.avatarType]

          if (img) {
            const size = 90
            context.drawImage(img, baseX - size / 2, baseY - size / 2, size, size)
          } else {
            // Fallback drawing if image not loaded yet
            const fill = 'rgba(255,255,255,0.85)'
            context.fillStyle = fill
            context.strokeStyle = cloud.color || theme.secondary
            context.lineWidth = 2

            context.beginPath()
            context.arc(baseX - 21, baseY, 18, 0, Math.PI * 2)
            context.arc(baseX, baseY - 12, 24, 0, Math.PI * 2)
            context.arc(baseX + 24, baseY, 18, 0, Math.PI * 2)
            context.closePath()
            context.fill()
            context.stroke()
          }

          if (cloud.nickname) {
            context.fillStyle = theme.text
            context.font = 'bold 12px sans-serif'
            // Name above the image
            context.fillText(cloud.nickname, baseX, baseY - 60)
          }
        })
        context.restore()
      }

      if (hasFloor) {
        const finishY = toHeight(floorSpec.y ?? 1)
        const finishInset = toWidth(floorSpec.inset ?? 0, 0)
        const finishHeight = Math.max(10, wallThickness * 0.55)
        const finishWidth = Math.max(0, worldWidth - finishInset * 2)
        const finishTop = finishY - wallThickness / 2 - finishHeight
        const tileSize = Math.max(12, finishHeight / 2)
        const tileCount = Math.ceil(finishWidth / tileSize)

        context.save()
        for (let i = 0; i < tileCount; i += 1) {
          const x = finishInset + i * tileSize
          context.fillStyle = i % 2 === 0 ? theme.text : theme.white
          context.fillRect(x, finishTop, tileSize, finishHeight / 2)
          context.fillStyle = i % 2 === 0 ? theme.white : theme.text
          context.fillRect(x, finishTop + finishHeight / 2, tileSize, finishHeight / 2)
        }
        context.restore()
      }

      if (render.options.hasBounds) {
        Matter.Render.endViewTransform(render)
      }

      const viewWidth = render.options.width
      const viewHeight = render.options.height
      const mapAspect = worldHeight / worldWidth

      const isCompactScreen = viewWidth < 640 || viewHeight < 520
      const maxMiniWidth = Math.min(viewWidth * (isCompactScreen ? 0.18 : 0.25), isCompactScreen ? 150 : 220)
      let miniHeight = Math.min(viewHeight * (isCompactScreen ? 0.22 : 0.7), isCompactScreen ? 150 : 380)

      let miniWidth = miniHeight / mapAspect
      if (miniWidth > maxMiniWidth) {
        miniWidth = maxMiniWidth
        miniHeight = miniWidth * mapAspect
      }

      const miniPadding = isCompactScreen ? 10 : 16
      const miniX = miniPadding
      const miniY = miniPadding
      const scaleX = miniWidth / worldWidth
      const scaleY = miniHeight / worldHeight
      const mapToMini = (x, y) => ({
        x: miniX + x * scaleX,
        y: miniY + y * scaleY
      })

      context.save()
      context.globalAlpha = 0.92
      context.fillStyle = theme.surface
      context.strokeStyle = theme.text
      context.lineWidth = 2
      context.fillRect(miniX - 8, miniY - 8, miniWidth + 16, miniHeight + 16)
      context.strokeRect(miniX - 8, miniY - 8, miniWidth + 16, miniHeight + 16)

      context.beginPath()
      context.rect(miniX, miniY, miniWidth, miniHeight)
      context.clip()

      const drawBodyPolygon = (body, fill, stroke) => {
        const vertices = body.vertices
        if (!vertices || vertices.length === 0) {
          return
        }
        context.beginPath()
        vertices.forEach((vertex, index) => {
          const pos = mapToMini(vertex.x, vertex.y)
          if (index === 0) {
            context.moveTo(pos.x, pos.y)
          } else {
            context.lineTo(pos.x, pos.y)
          }
        })
        context.closePath()
        if (fill) {
          context.fillStyle = fill
          context.fill()
        }
        if (stroke) {
          context.strokeStyle = stroke
          context.stroke()
        }
      }

      context.globalAlpha = 0.7
      walls.forEach((wall) => {
        drawBodyPolygon(wall, theme.text, null)
      })

      context.globalAlpha = 0.8
      obstacles.forEach((obstacle) => {
        if (obstacle.circleRadius) {
          const pos = mapToMini(obstacle.position.x, obstacle.position.y)
          const radius = obstacle.circleRadius * scaleX
          context.beginPath()
          context.arc(pos.x, pos.y, Math.max(1.5, radius), 0, Math.PI * 2)
          context.fillStyle = obstacle.render?.fillStyle || theme.secondary
          context.fill()
        } else {
          drawBodyPolygon(obstacle, obstacle.render?.fillStyle || theme.secondary, null)
        }
      })

      const marbleRadius = Math.max(2, miniWidth * 0.03)
      bodies.forEach((body) => {
        if (!body.label || !body.label.startsWith('marble-')) {
          return
        }
        const pos = mapToMini(body.position.x, body.position.y)
        context.beginPath()
        context.arc(pos.x, pos.y, marbleRadius, 0, Math.PI * 2)
        context.fillStyle = body.render?.fillStyle || theme.primary
        context.fill()
      })

      const cameraMin = mapToMini(render.bounds.min.x, render.bounds.min.y)
      const cameraMax = mapToMini(render.bounds.max.x, render.bounds.max.y)
      context.globalAlpha = 0.95
      context.strokeStyle = theme.secondary
      context.lineWidth = 2
      context.strokeRect(
        cameraMin.x,
        cameraMin.y,
        cameraMax.x - cameraMin.x,
        cameraMax.y - cameraMin.y
      )

      context.restore()
    })
    const wallThickness = toWidth(mapBlueprint.wallThickness ?? 56, 56)
    const floorSpec = mapBlueprint.floor || {}
    const hasFloor = mapBlueprint.floor !== false && mapBlueprint.floor !== null
    const wallOptions = {
      isStatic: true,
      render: {
        fillStyle: theme.text,
        strokeStyle: theme.white,
        lineWidth: 3
      },
      chamfer: { radius: Math.max(6, wallThickness * 0.2) },
      friction: 0.4
    }

    const buildWall = (from, to) => {
      const dx = to.x - from.x
      const dy = to.y - from.y
      const length = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx)
      return Bodies.rectangle((from.x + to.x) / 2, (from.y + to.y) / 2, length, wallThickness, {
        ...wallOptions,
        angle
      })
    }

    const obstacles = []
    const walls = []
    const constraints = []
    slidersRef.current = []
    let obstacleIndex = 0
    const obstacleRestitution = 0.8

    const registerObstacle = (body) => {
      body.customId = obstacleIndex
      body.isObstacle = true
      body.obstacleSlot = obstacleIndex
      obstacleIndex += 1
      obstacles.push(body)
    }

    const toPoint = (point) => {
      if (!point) {
        return null
      }
      return {
        x: toWidth(point.x),
        y: toHeight(point.y)
      }
    }

    const addWallSegment = (from, to) => {
      if (!from || !to) {
        return
      }
      walls.push(buildWall(from, to))
    }

    const addPolyline = (points) => {
      if (!Array.isArray(points) || points.length < 2) {
        return
      }
      for (let i = 0; i < points.length - 1; i += 1) {
        const from = toPoint(points[i])
        const to = toPoint(points[i + 1])
        addWallSegment(from, to)
      }
    }

    const mapWalls = mapBlueprint.walls || {}
    addPolyline(mapWalls.left)
    addPolyline(mapWalls.right)
    if (Array.isArray(mapWalls.internal)) {
      mapWalls.internal.forEach(addPolyline)
    }

    if (hasFloor) {
      const floorY = toHeight(floorSpec.y ?? 1)
      const inset = toWidth(floorSpec.inset ?? 0, 0)
      const floorLeft = { x: inset, y: floorY }
      const floorRight = { x: worldWidth - inset, y: floorY }
      addWallSegment(floorLeft, floorRight)

      const finishHeight = Math.max(10, wallThickness * 0.55)
      const finishWidth = Math.max(0, worldWidth - inset * 2)
      const finishLine = Bodies.rectangle(
        inset + finishWidth / 2,
        floorY - wallThickness / 2 - finishHeight / 2,
        finishWidth,
        finishHeight,
        {
          isStatic: true,
          isSensor: true,
          label: FINISH_LINE_LABEL,
          render: {
            fillStyle: 'transparent',
            strokeStyle: 'transparent',
            lineWidth: 0
          }
        }
      )
      walls.push(finishLine)
    }

    mapBlueprint.obstacles.forEach((item) => {
      if (!item || !item.type) {
        return
      }

      const x = toWidth(item.x)
      const y = toHeight(item.y)
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return
      }

      if (item.type === 'peg' || item.type === 'bumper') {
        const radius = toWidth(item.radius, item.type === 'bumper' ? 16 : 6)
        const peg = Bodies.circle(x, y, radius, {
          isStatic: true,
          restitution: item.type === 'bumper' ? 1.25 : obstacleRestitution,
          friction: 0.02,
          frictionStatic: 0,
          render: {
            fillStyle: item.type === 'bumper' ? theme.secondary : theme.text,
            strokeStyle: 'transparent'
          }
        })
        peg.isBumper = item.type === 'bumper'
        registerObstacle(peg)
        return
      }

      if (item.type === 'spinner') {
        const length = toWidth(item.length, 0.22)
        const thickness = toWidth(item.thickness, 12)
        const spinner = Bodies.rectangle(x, y, length, thickness, {
          restitution: obstacleRestitution,
          friction: 0.01,
          frictionAir: 0.002,
          density: 0.002,
          render: {
            fillStyle: theme.secondary,
            strokeStyle: 'transparent'
          }
        })
        spinner.angularVelocity = item.angularVelocity ?? 0.45
        registerObstacle(spinner)
        constraints.push(Constraint.create({
          pointA: { x, y },
          bodyB: spinner,
          pointB: { x: 0, y: 0 },
          length: 0,
          stiffness: 1
        }))
        return
      }

      if (item.type === 'hammer') {
        const length = toWidth(item.length, 0.26)
        const thickness = toWidth(item.thickness, 14)
        const angle = item.angle ?? 0
        const hammer = Bodies.rectangle(x, y, length, thickness, {
          restitution: obstacleRestitution,
          friction: 0.01,
          frictionAir: 0.002,
          density: 0.003,
          render: {
            fillStyle: theme.warning,
            strokeStyle: 'transparent'
          },
          angle
        })
        hammer.angularVelocity = item.angularVelocity ?? 0.25
        registerObstacle(hammer)

        const pivotOffset = length / 2
        const pivotX = x - Math.cos(angle) * pivotOffset
        const pivotY = y - Math.sin(angle) * pivotOffset
        constraints.push(Constraint.create({
          pointA: { x: pivotX, y: pivotY },
          bodyB: hammer,
          pointB: { x: -pivotOffset, y: 0 },
          length: 0,
          stiffness: 1
        }))
        return
      }

      if (item.type === 'slider') {
        const length = toWidth(item.length, 0.22)
        const thickness = toWidth(item.thickness, 14)
        const slider = Bodies.rectangle(x, y, length, thickness, {
          isStatic: true,
          friction: 0.02,
          render: {
            fillStyle: theme.secondary,
            strokeStyle: theme.text,
            lineWidth: 3
          }
        })
        slider.sliderRange = toWidth(item.range, 0.18)
        slider.sliderSpeed = item.speed ?? 0.9
        slider.sliderDirection = Math.random() < 0.5 ? -1 : 1
        slider.sliderOriginX = x
        slidersRef.current.push(slider)
        registerObstacle(slider)
        return
      }

      if (item.type === 'wind') {
        const width = toWidth(item.width, 0.24)
        const height = toHeight(item.height, 0.12)
        windFieldsRef.current.push({
          x,
          y,
          width,
          height,
          minForceX: item.minForceX ?? -0.0012,
          maxForceX: item.maxForceX ?? 0.0012,
          minForceY: item.minForceY ?? -0.0012,
          maxForceY: item.maxForceY ?? -0.0006,
          interval: item.interval ?? 900,
          randomizeAt: Date.now()
        })
        return
      }

      if (item.type === 'ramp' || item.type === 'kicker' || item.type === 'kicker-once') {
        const isOneTime = item.type === 'kicker-once'
        const isKicker = item.type === 'kicker' || isOneTime
        const length = toWidth(item.length, isKicker ? 0.18 : 0.58)
        const thickness = toWidth(item.thickness, isKicker ? 12 : 14)
        const angle = item.angle ?? 0

        const render = isKicker ? {
          fillStyle: '#9B59B6',
          strokeStyle: theme.text,
          lineWidth: 3
        } : {
          fillStyle: theme.text,
          strokeStyle: 'transparent',
          lineWidth: 0
        }

        const chamfer = { radius: isKicker ? 10 : 4 }

        const ramp = Bodies.rectangle(x, y, length, thickness, {
          isStatic: true,
          restitution: isKicker ? 1.15 : obstacleRestitution,
          friction: 0.02,
          frictionStatic: 0,
          chamfer,
          render,
          angle
        })
        ramp.isKicker = isKicker
        ramp.oneTime = isOneTime
        registerObstacle(ramp)
      }
    })

    const spawnObstacle = ({ x, y, participantId, obstacleType }) => {
      if (!engineRef.current) {
        return
      }

      const type = obstacleType || 'normal'
      const world = engineRef.current.world
      let body = null
      let constraint = null
      const ttl = OBSTACLE_TTL[type] || 3000

      if (type === 'bomb') {
        body = Bodies.circle(x, y, 18, {
          isStatic: true,
          restitution: 0.4,
          render: {
            fillStyle: 'transparent',
            strokeStyle: 'transparent',
            lineWidth: 0
          }
        })
      } else if (type === 'spinner') {
        const spinnerLength = randomBetween(110, 140)
        body = Bodies.rectangle(x, y, spinnerLength, 14, {
          friction: 0.02,
          frictionAir: 0.006,
          density: 0.004,
          render: {
            fillStyle: 'transparent',
            strokeStyle: 'transparent',
            lineWidth: 0
          }
        })
        body.renderWidth = spinnerLength
        body.spinnerVelocity = (Math.random() < 0.5 ? -1 : 1) * randomBetween(0.6, 1.0)
        body.angularVelocity = body.spinnerVelocity
        constraint = Constraint.create({
          pointA: { x, y },
          bodyB: body,
          pointB: { x: 0, y: 0 },
          length: 0,
          stiffness: 1
        })
      } else if (type === 'fan') {
        body = Bodies.rectangle(x, y, 94, 24, {
          isStatic: true,
          render: {
            fillStyle: 'transparent',
            strokeStyle: 'transparent',
            lineWidth: 0
          }
        })
        windFieldsRef.current.push({
          x,
          y,
          width: 200,
          height: 320,
          strength: 0.009,
          expiresAt: Date.now() + ttl
        })
      } else {
        const angle = randomBetween(-0.35, 0.35)
        body = Bodies.rectangle(x, y, 100, 18, {
          isStatic: true,
          restitution: 0.9,
          friction: 0.02,
          chamfer: { radius: 6 },
          render: {
            fillStyle: 'transparent',
            strokeStyle: 'transparent',
            lineWidth: 0
          },
          angle
        })
      }

      if (!body) {
        return
      }

      body.isSpawnedObstacle = true
      body.obstacleOwnerId = participantId
      body.obstacleType = type
      Composite.add(world, body)
      if (constraint) {
        Composite.add(world, constraint)
      }

      const timerId = setTimeout(() => {
        if (type === 'bomb') {
          effectsRef.current.push({ x, y, startedAt: Date.now() })
          const bodies = Composite.allBodies(world)
          const radius = BOMB_BLAST_RADIUS
          bodies.forEach((target) => {
            if (!target.label || !target.label.startsWith('marble-')) {
              return
            }
            const dx = target.position.x - x
            const dy = target.position.y - y
            const distance = Math.max(1, Math.hypot(dx, dy))
            if (distance > radius) {
              return
            }
            const strength = BOMB_BLAST_FORCE * (1 - distance / radius)
            const impulse = strength * 1800
            Matter.Sleeping.set(target, false)
            Matter.Body.setVelocity(target, {
              x: target.velocity.x + (dx / distance) * impulse,
              y: target.velocity.y + (dy / distance) * impulse - strength * 900
            })
          })
        }
        Composite.remove(world, body)
        if (constraint) {
          Composite.remove(world, constraint)
        }
      }, ttl)

      registerTimer(timerId)
    }

    spawnObstacleRef.current = spawnObstacle

    Composite.add(engine.world, [
      ...walls,
      ...obstacles,
      ...constraints
    ])

    Render.run(render)
    const runner = Runner.create({ delta: 1000 / 120 })
    runnerRef.current = runner
    Runner.run(runner, engine)
  }, [dimensions.width, dimensions.height, mapBlueprint])

  useEffect(() => {
    if (!renderRef.current || dimensions.width === 0 || dimensions.height === 0) {
      return
    }
    const render = renderRef.current
    viewSizeRef.current = { width: dimensions.width, height: dimensions.height }
    render.options.width = dimensions.width
    render.options.height = dimensions.height
    Matter.Render.setPixelRatio(render, window.devicePixelRatio)
  }, [dimensions.width, dimensions.height])

  const shutdownEngine = () => {
    if (!engineRef.current) {
      return
    }
    const engine = engineRef.current
    const render = renderRef.current
    const runner = runnerRef.current

    Matter.Events.off(engine)
    if (render) {
      Matter.Events.off(render)
    }
    clearObstacleTimers()
    windFieldsRef.current = []
    slidersRef.current = []
    if (render) {
      Matter.Render.stop(render)
      if (render.canvas) render.canvas.remove()
      render.canvas = null
      render.context = null
      render.textures = {}
    }
    if (runner) {
      Matter.Runner.stop(runner)
    }
    Matter.World.clear(engine.world)
    Matter.Engine.clear(engine)
    engineRef.current = null
    renderRef.current = null
    runnerRef.current = null
    mapScaleRef.current = null
    worldSizeRef.current = null
    viewSizeRef.current = null
  }

  useEffect(() => {
    return () => {
      shutdownEngine()
    }
  }, [])

  useEffect(() => {
    const signature = JSON.stringify(mapBlueprint)
    if (mapSignatureRef.current && mapSignatureRef.current !== signature) {
      shutdownEngine()
    }
    mapSignatureRef.current = signature
  }, [mapBlueprint])

  useEffect(() => {
    if (!engineRef.current) return
    const worldWidth = worldSizeRef.current?.width ?? dimensions.width
    if (!worldWidth) return

    const currentCount = candidates.length
    if (currentCount < spawnedRef.current) {
      spawnedRef.current = 0
    }

    const needed = currentCount - spawnedRef.current

    if (needed > 0) {
      const styles = getComputedStyle(document.documentElement)
      const theme = {
        primary: styles.getPropertyValue('--color-primary').trim(),
        secondary: styles.getPropertyValue('--color-secondary').trim(),
        success: styles.getPropertyValue('--color-success').trim(),
        warning: styles.getPropertyValue('--color-warning').trim(),
        text: styles.getPropertyValue('--color-text').trim()
      }

      const Bodies = Matter.Bodies
      const Composite = Matter.Composite
      const Common = Matter.Common

      const newMarbles = []
      const colors = [theme.primary, theme.secondary, theme.success, theme.warning, '#9B59B6', '#E67E22', '#1ABC9C', '#34495E']
      const isCompactScreen = dimensions.width < 640 || dimensions.height < 520
      const responsiveScale = isCompactScreen ? 0.9 : 1

      for (let i = 0; i < needed; i += 1) {
        const currentScale = mapScaleRef.current || 1
        const x = Common.random(worldWidth * 0.25, worldWidth * 0.75)
        const spawnBase = -40 * currentScale
        const spawnSpread = 220 * currentScale
        const y = spawnBase - Common.random(0, spawnSpread)
        const baseSize = Common.random(14, 18) * currentScale
        const size = Math.max(baseSize * responsiveScale, 12 * currentScale)

        const candidateIndex = spawnedRef.current + i
        const candidate = candidates[candidateIndex]
        if (!candidate) {
          continue
        }

        const isObject = typeof candidate === 'object' && candidate !== null
        const assignedColor = isObject && candidate.color ? candidate.color : colors[candidateIndex % colors.length]
        const nickname = isObject ? candidate.nickname : candidate
        const labelId = isObject && candidate.id ? candidate.id : candidateIndex

        const marble = Bodies.circle(x, y, size, {
          label: `marble-${labelId}`,
          restitution: 0.5,
          friction: 0.005,
          frictionAir: 0.015,
          density: 0.035,
          render: {
            fillStyle: assignedColor,
            strokeStyle: theme.text,
            lineWidth: 3
          }
        })
        marble.customName = nickname || `P${candidateIndex + 1}`
        newMarbles.push(marble)
      }

      Composite.add(engineRef.current.world, newMarbles)
      spawnedRef.current = currentCount
    }
  }, [candidates, dimensions])

  const isCompactScreen = dimensions.width < 640 || dimensions.height < 560

  return (
    <div className="card animate-enter" style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: 0,
      overflow: 'hidden',
      position: 'relative',
      height: '100%',
      backgroundColor: 'var(--color-surface)',
      border: 'none',
      boxShadow: 'none',
      borderRadius: 0
    }}>
      <div style={{
        position: 'absolute',
        bottom: 24,
        left: 24,
        zIndex: 10,
        display: 'flex',
        gap: '12px'
      }}>
        <div className="badge" style={{
          background: 'var(--color-white)',
          fontSize: '18px',
          padding: '8px 16px',
          borderWidth: 'var(--border-width-thick)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          MARBLES: {candidates.length}
        </div>
      </div>

      <div
        ref={sceneRef}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          minHeight: 0,
          backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(242,230,216,0.95) 100%),
              repeating-linear-gradient(0deg, rgba(28,26,26,0.06) 0px, rgba(28,26,26,0.06) 1px, transparent 1px, transparent 28px)`
        }}
      />

      <div style={{
        position: 'absolute',
        top: 24,
        right: 24,
        zIndex: 10,
        pointerEvents: 'none'
      }}>
        <button
          className="btn btn-secondary"
          style={{
            pointerEvents: 'auto',
            width: 'auto',
            minWidth: '120px',
            height: '40px',
            padding: '0 14px',
            borderWidth: 'var(--border-width)',
            boxShadow: 'var(--shadow-sm)',
            fontWeight: 800,
            fontSize: '12px',
            letterSpacing: '0.5px'
          }}
          onClick={onBack}
        >
          STOP PARTY
        </button>
      </div>

      <div style={{
        position: 'absolute',
        top: isCompactScreen ? 56 : 80,
        right: isCompactScreen ? 8 : 24,
        width: isCompactScreen ? 120 : 200,
        maxHeight: isCompactScreen ? '45%' : 'unset',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: isCompactScreen ? '6px' : '8px'
      }}>
        {rankings.map((r) => (
          <div key={r.id} className="animate-enter" style={{
            background: 'var(--color-surface)',
            border: 'var(--border-width) solid var(--color-text)',
            padding: isCompactScreen ? '4px 6px' : '8px 12px',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: isCompactScreen ? '6px' : '12px'
          }}>
            <span style={{
              fontWeight: 800,
              color: 'var(--color-secondary)',
              minWidth: isCompactScreen ? '16px' : '24px',
              fontSize: isCompactScreen ? '11px' : '14px'
            }}>#{r.rank}</span>
            <div style={{
              width: isCompactScreen ? '10px' : '12px',
              height: isCompactScreen ? '10px' : '12px',
              borderRadius: '50%',
              backgroundColor: r.color || 'var(--color-text)',
              border: '1px solid var(--color-text)'
            }} />
            <span style={{
              fontWeight: 600,
              fontSize: isCompactScreen ? '10px' : '14px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--color-text)'
            }}>
              {r.name}
            </span>
          </div>
        ))}
      </div>
      {showWinnerOverlay && (
        <WinnerOverlay
          winner={winner}
          onBack={onBack}
          onClose={() => setShowWinnerOverlay(false)}
          t={t}
        />
      )}
    </div>
  )
}
