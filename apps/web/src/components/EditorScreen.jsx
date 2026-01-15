import { useEffect, useMemo, useRef, useState } from 'react'
import { GameScreen } from './GameScreen'

const TOOL_OPTIONS = ['peg', 'bumper', 'spinner', 'hammer', 'ramp', 'kicker', 'kicker-once', 'slider', 'wind']

const TOOL_DESCRIPTIONS = {
  peg: 'Static circular bumper',
  bumper: 'Large bouncy bumper',
  spinner: 'Rotating rectangular bar',
  hammer: 'Swinging hammer arm',
  ramp: 'Angled surface to launch marbles',
  kicker: 'Reusable boost paddle',
  'kicker-once': 'One-time boost paddle',
  slider: 'Moving platform',
  wind: 'Zone that pushes marbles',
}

const DEFAULT_BLUEPRINT = {
  width: 1400,
  height: 8400,
  wallThickness: 60,
  floor: { y: 1, inset: 0.12 },
  walls: {
    left: [
      { x: 0.02, y: 0.0 },
      { x: 0.02, y: 0.12 },
      { x: 0.10, y: 0.28 },
      { x: 0.02, y: 0.45 },
      { x: 0.10, y: 0.65 },
      { x: 0.02, y: 0.82 },
      { x: 0.20, y: 1.0 }
    ],
    right: [
      { x: 0.98, y: 0.0 },
      { x: 0.98, y: 0.12 },
      { x: 0.90, y: 0.28 },
      { x: 0.98, y: 0.45 },
      { x: 0.90, y: 0.65 },
      { x: 0.98, y: 0.82 },
      { x: 0.80, y: 1.0 }
    ],
    internal: []
  },
  obstacles: []
}

const TOOL_DEFAULTS = {
  peg: { radius: 0.01 },
  bumper: { radius: 0.02 },
  spinner: { length: 0.22, angularVelocity: 0.3 },
  hammer: { length: 0.26, angle: 0, angularVelocity: 0.25 },
  ramp: { length: 0.22, angle: 0.4 },
  kicker: { length: 0.14, angle: 0 },
  'kicker-once': { length: 0.14, angle: 0 },
  slider: { length: 0.22, range: 0.18, speed: 1 },
  wind: { width: 0.28, height: 0.12, minForceX: -0.001, maxForceX: 0.001, minForceY: -0.001, maxForceY: -0.0006, interval: 900 }
}

const MAX_PASSWORD_LENGTH = 6

const OBSTACLE_REQUIREMENTS = {
  peg: ['radius'],
  bumper: ['radius'],
  spinner: ['length'],
  hammer: ['length'],
  ramp: ['length'],
  kicker: ['length'],
  'kicker-once': ['length'],
  slider: ['length', 'range'],
  wind: ['width', 'height'],
}

const isFiniteNumber = (value) => Number.isFinite(value)

const applyObstacleDefaults = (obstacle, nextType) => {
  const defaults = TOOL_DEFAULTS[nextType] || {}
  const next = { ...obstacle, type: nextType }
  Object.entries(defaults).forEach(([key, value]) => {
    if (!isFiniteNumber(next[key])) {
      next[key] = value
    }
  })
  return next
}

const getObstacleValidationError = (obstacle, index) => {
  const requirements = OBSTACLE_REQUIREMENTS[obstacle.type] || []
  for (const field of requirements) {
    if (!isFiniteNumber(obstacle[field])) {
      return `Obstacle #${index + 1} (${obstacle.type}) ${field} is required.`
    }
  }
  return null
}

const getBlueprintValidationError = (blueprint) => {
  if (!blueprint || !Array.isArray(blueprint.obstacles)) {
    return null
  }
  for (let i = 0; i < blueprint.obstacles.length; i += 1) {
    const obstacleError = getObstacleValidationError(blueprint.obstacles[i], i)
    if (obstacleError) {
      return obstacleError
    }
  }
  return null
}

const normalizeAuthorName = (value) => String(value || '').trim()
const normalizePassword = (value) => String(value || '').trim()

const getCredentialsValidationError = (authorName, password) => {
  if (!normalizeAuthorName(authorName)) {
    return 'Author name is required.'
  }
  const normalizedPassword = normalizePassword(password)
  if (!normalizedPassword) {
    return 'Password is required.'
  }
  if (normalizedPassword.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MAX_PASSWORD_LENGTH} characters or less.`
  }
  return null
}

const TOOL_ICONS = {
  peg: (
    <svg className="tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="6" />
    </svg>
  ),
  bumper: (
    <svg className="tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  ),
  spinner: (
    <svg className="tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="10" width="18" height="4" rx="2" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  hammer: (
    <svg className="tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="10" width="12" height="4" rx="2" />
      <circle cx="6" cy="12" r="2" />
    </svg>
  ),
  ramp: (
    <svg className="tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 18 L20 18 L8 6 Z" />
    </svg>
  ),
  kicker: (
    <svg className="tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12 H20" />
    </svg>
  ),
  'kicker-once': (
    <svg className="tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12 H20" />
      <path d="M16 6 L20 12 L16 18" />
    </svg>
  ),
  slider: (
    <svg className="tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="10" width="16" height="4" rx="2" />
      <path d="M6 6 V18" />
      <path d="M18 6 V18" />
    </svg>
  ),
  wind: (
    <svg className="tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 9 H15" />
      <path d="M9 13 H21" />
      <path d="M3 17 H12" />
    </svg>
  ),
}

const CollapsibleSection = ({ title, isOpen, onToggle, children }) => (
  <div style={{ marginBottom: '24px' }}>
    <div 
      className="panel-section-title" 
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      onKeyDown={(e) => e.key === 'Enter' && onToggle()}
    >
      {title}
      <span className="toggle-icon" style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
    </div>
    {isOpen && <div className="panel-section-body" style={{ animation: 'fadeIn 0.2s' }}>{children}</div>}
  </div>
)

function cloneBlueprint(blueprint) {
  return JSON.parse(JSON.stringify(blueprint))
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) {
    return ''
  }
  return Number(value.toFixed(digits))
}

function snapValue(value, enabled, step) {
  if (!enabled) {
    return value
  }
  const safeStep = Math.max(0.001, Math.min(0.1, step || 0.01))
  return Math.round(value / safeStep) * safeStep
}

export function EditorScreen({ apiBase, maps, onRefreshMaps, onBack }) {
  const canvasRef = useRef(null)
  const viewRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 })
  const dragRef = useRef({ index: null, offsetX: 0, offsetY: 0 })
  const wallDragRef = useRef({ side: null, wallIndex: null, pointIndex: null, moved: false })
  const wallDrawRef = useRef({ active: false, start: null })

  const [activeMapId, setActiveMapId] = useState('')
  const [mapName, setMapName] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [password, setPassword] = useState('')
  const [blueprint, setBlueprint] = useState(cloneBlueprint(DEFAULT_BLUEPRINT))
  const [selectedTool, setSelectedTool] = useState('peg')
  const [selectedObstacleIndex, setSelectedObstacleIndex] = useState(null)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapSize, setSnapSize] = useState(0.02)
  const [wallMode, setWallMode] = useState('OFF')
  const [wallPreview, setWallPreview] = useState(null)
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const [collapsed, setCollapsed] = useState({
    SNAP: false,
    TOOLS: false,
    'MAP SETTINGS': false,
    FLOOR: true,
    WALLS: true,
    OBSTACLES: false,
  })

  const historyRef = useRef([])
  const historyIndexRef = useRef(0)
  const [historyIndex, setHistoryIndex] = useState(0)
  const [historySize, setHistorySize] = useState(0)
  const blueprintRef = useRef(blueprint)

  useEffect(() => {
    blueprintRef.current = blueprint
  }, [blueprint])

  const resetHistory = (snapshot) => {
    const initial = cloneBlueprint(snapshot)
    historyRef.current = [initial]
    historyIndexRef.current = 0
    setHistoryIndex(0)
    setHistorySize(1)
  }

  useEffect(() => {
    resetHistory(DEFAULT_BLUEPRINT)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isModifier = event.metaKey || event.ctrlKey
      if (!isModifier) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      }
      if (key === 'y') {
        event.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const pushHistory = (newBlueprint) => {
    const base = historyRef.current.slice(0, historyIndexRef.current + 1)
    base.push(cloneBlueprint(newBlueprint))
    const maxEntries = 30
    if (base.length > maxEntries) {
      base.shift()
    }
    historyRef.current = base
    historyIndexRef.current = base.length - 1
    setHistoryIndex(historyIndexRef.current)
    setHistorySize(base.length)
  }

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      const prevIndex = historyIndexRef.current - 1
      historyIndexRef.current = prevIndex
      setHistoryIndex(prevIndex)
      setBlueprint(cloneBlueprint(historyRef.current[prevIndex]))
    }
  }

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const nextIndex = historyIndexRef.current + 1
      historyIndexRef.current = nextIndex
      setHistoryIndex(nextIndex)
      setBlueprint(cloneBlueprint(historyRef.current[nextIndex]))
    }
  }

  const toggleSection = (section) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const updateBlueprint = (updater) => {
    setBlueprint(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      pushHistory(next)
      return next
    })
  }

  useEffect(() => {
    onRefreshMaps()
  }, [onRefreshMaps])

  useEffect(() => {
    if (!activeMapId) {
      const fresh = cloneBlueprint(DEFAULT_BLUEPRINT)
      setBlueprint(fresh)
      resetHistory(fresh)
      setMapName('')
      setPassword('')
      setSelectedObstacleIndex(null)
      return
    }

    fetch(`${apiBase}/api/maps/${activeMapId}`)
      .then((response) => response.json())
      .then((data) => {
        if (data?.blueprint) {
          setBlueprint(data.blueprint)
          resetHistory(data.blueprint)
          setMapName(data.name || '')
          setAuthorName(data.authorName || '')
          setPassword('')
          setSelectedObstacleIndex(null)
        }
      })
      .catch(() => {
        setError('Unable to load map.')
      })
  }, [activeMapId, apiBase])

  const mapList = useMemo(() => maps || [], [maps])
  const testCandidates = useMemo(
    () => Array.from({ length: 12 }, (_, index) => `Test ${index + 1}`),
    []
  )

  const getWallPoints = () => {
    const points = []
    const mapWidth = blueprint.width
    const mapHeight = blueprint.height

    blueprint.walls.left.forEach((point, index) => {
      points.push({
        side: 'left',
        wallIndex: null,
        pointIndex: index,
        x: point.x * mapWidth,
        y: point.y * mapHeight,
      })
    })
    blueprint.walls.right.forEach((point, index) => {
      points.push({
        side: 'right',
        wallIndex: null,
        pointIndex: index,
        x: point.x * mapWidth,
        y: point.y * mapHeight,
      })
    })
    blueprint.walls.internal.forEach((wall, wallIndex) => {
      wall.forEach((point, pointIndex) => {
        points.push({
          side: 'internal',
          wallIndex,
          pointIndex,
          x: point.x * mapWidth,
          y: point.y * mapHeight,
        })
      })
    })

    return points
  }

  const findWallPointAt = (mapX, mapY) => {
    const scale = viewRef.current.scale || 1
    const hitRadius = 32 / scale
    const points = getWallPoints()
    for (let i = 0; i < points.length; i += 1) {
      const point = points[i]
      if (Math.hypot(point.x - mapX, point.y - mapY) <= hitRadius) {
        return point
      }
    }
    return null
  }

  const findObstacleAt = (mapX, mapY) => {
    const padding = 28
    for (let i = blueprint.obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = blueprint.obstacles[i]
      const obstacleX = obstacle.x * blueprint.width
      const obstacleY = obstacle.y * blueprint.height

      if (obstacle.type === 'peg' || obstacle.type === 'bumper') {
        const radius = (obstacle.radius || 0) * blueprint.width
        const distance = Math.hypot(mapX - obstacleX, mapY - obstacleY)
        if (distance <= radius + padding) {
          return i
        }
        continue
      }

      if (obstacle.type === 'wind') {
        const width = (obstacle.width || 0) * blueprint.width
        const height = (obstacle.height || 0) * blueprint.height
        if (Math.abs(mapX - obstacleX) <= width / 2 + padding && Math.abs(mapY - obstacleY) <= height / 2 + padding) {
          return i
        }
        continue
      }

      const length = (obstacle.length || 0) * blueprint.width
      const thickness = obstacle.thickness || 14
      if (Math.abs(mapX - obstacleX) <= length / 2 + padding && Math.abs(mapY - obstacleY) <= thickness / 2 + padding) {
        return i
      }
    }
    return null
  }

  const handleCloneMap = async (mapId) => {
    const source = mapList.find((map) => map.id === mapId)
    if (!source) {
      return
    }
    const credentialsError = getCredentialsValidationError(authorName, password)
    if (credentialsError) {
      setError(credentialsError)
      return
    }
    try {
      const response = await fetch(`${apiBase}/api/maps/${mapId}`)
      if (!response.ok) {
        throw new Error('Unable to clone map.')
      }
      const data = await response.json()
      const cloned = await fetch(`${apiBase}/api/maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${data.name || 'Untitled'} Copy`,
          authorName: normalizeAuthorName(authorName),
          password: normalizePassword(password),
          blueprint: data.blueprint,
        })
      })
      if (!cloned.ok) {
        throw new Error('Unable to clone map.')
      }
      const result = await cloned.json()
      await onRefreshMaps()
      setActiveMapId(result.id)
      setMapName(result.name)
    } catch (cloneError) {
      setError(cloneError.message || 'Unable to clone map.')
    }
  }

  const handleDeleteMap = async (mapId) => {
    if (!mapId) {
      return
    }
    const credentialsError = getCredentialsValidationError(authorName, password)
    if (credentialsError) {
      setError(credentialsError)
      return
    }
    try {
      const response = await fetch(`${apiBase}/api/maps/${mapId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: normalizePassword(password) }),
      })
      if (!response.ok) {
        throw new Error('Unable to delete map.')
      }
      if (mapId === activeMapId) {
        setActiveMapId('')
      }
      await onRefreshMaps()
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete map.')
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const canvasWidth = canvas.width
    const canvasHeight = canvas.height
    const scale = Math.min(canvasWidth / blueprint.width, canvasHeight / blueprint.height)
    const drawWidth = blueprint.width * scale
    const drawHeight = blueprint.height * scale
    const offsetX = (canvasWidth - drawWidth) / 2
    const offsetY = (canvasHeight - drawHeight) / 2

    viewRef.current = { scale, offsetX, offsetY }

    context.clearRect(0, 0, canvasWidth, canvasHeight)

    context.save()
    context.translate(offsetX, offsetY)
    context.scale(scale, scale)

    context.fillStyle = '#f7f7f7'
    context.fillRect(0, 0, blueprint.width, blueprint.height)

    context.strokeStyle = '#1f1f1f'
    context.lineWidth = blueprint.wallThickness || 60
    context.lineCap = 'round'

    const drawPolyline = (points) => {
      if (!points || points.length < 2) {
        return
      }
      context.beginPath()
      context.moveTo(points[0].x * blueprint.width, points[0].y * blueprint.height)
      for (let i = 1; i < points.length; i += 1) {
        context.lineTo(points[i].x * blueprint.width, points[i].y * blueprint.height)
      }
      context.stroke()
    }

    drawPolyline(blueprint.walls.left)
    drawPolyline(blueprint.walls.right)
    blueprint.walls.internal.forEach(drawPolyline)

    blueprint.obstacles.forEach((obstacle, index) => {
      const x = obstacle.x * blueprint.width
      const y = obstacle.y * blueprint.height
      context.save()
      context.translate(x, y)
      if (obstacle.angle) {
        context.rotate(obstacle.angle)
      }

      const isSelected = index === selectedObstacleIndex
      context.strokeStyle = isSelected ? '#ff6b6b' : '#111111'
      context.fillStyle = isSelected ? 'rgba(255, 107, 107, 0.3)' : 'rgba(17, 17, 17, 0.12)'
      context.lineWidth = 4 / scale

      if (obstacle.type === 'peg' || obstacle.type === 'bumper') {
        const radius = obstacle.radius * blueprint.width
        if (obstacle.type === 'bumper') {
          context.fillStyle = isSelected ? 'rgba(241, 196, 15, 0.4)' : 'rgba(241, 196, 15, 0.22)'
          context.strokeStyle = isSelected ? '#f1c40f' : '#a67c00'
        }
        context.beginPath()
        context.arc(0, 0, radius, 0, Math.PI * 2)
        context.fill()
        context.stroke()
      } else if (obstacle.type === 'wind') {
        const width = obstacle.width * blueprint.width
        const height = obstacle.height * blueprint.height
        context.fillStyle = 'rgba(52, 152, 219, 0.15)'
        context.strokeStyle = 'rgba(52, 152, 219, 0.5)'
        context.lineWidth = 2 / scale
        context.fillRect(-width / 2, -height / 2, width, height)
        context.strokeRect(-width / 2, -height / 2, width, height)
      } else {
        const length = obstacle.length * blueprint.width
        const thickness = (obstacle.thickness || 14) * scale
        context.fillRect(-length / 2, -thickness / 2, length, thickness)
        context.strokeRect(-length / 2, -thickness / 2, length, thickness)
      }

      context.restore()
    })

    if (wallMode !== 'OFF') {
      const points = getWallPoints()
      context.save()
      context.fillStyle = wallMode === 'EDIT' ? '#ff6b6b' : '#222'
      context.strokeStyle = '#ffffff'
      context.lineWidth = 2 / scale
      points.forEach((point) => {
        context.beginPath()
        context.arc(point.x, point.y, 6 / scale, 0, Math.PI * 2)
        context.fill()
        context.stroke()
      })
      context.restore()
    }

    if (wallPreview) {
      context.save()
      context.strokeStyle = '#ff6b6b'
      context.setLineDash([10 / scale, 6 / scale])
      context.lineWidth = 3 / scale
      context.beginPath()
      context.moveTo(wallPreview.start.x * blueprint.width, wallPreview.start.y * blueprint.height)
      context.lineTo(wallPreview.end.x * blueprint.width, wallPreview.end.y * blueprint.height)
      context.stroke()
      context.restore()
    }

    context.restore()
  }, [blueprint, selectedObstacleIndex, wallMode, wallPreview])

  const handleCanvasPointerDown = (event) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const rect = canvas.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top
    const { scale, offsetX, offsetY } = viewRef.current

    const mapX = (clickX - offsetX) / scale
    const mapY = (clickY - offsetY) / scale

    if (wallMode === 'EDIT') {
      const point = findWallPointAt(mapX, mapY)
      if (point) {
        wallDragRef.current = { ...point, moved: false }
        setSelectedObstacleIndex(null)
        return
      }
      return
    }

    if (wallMode === 'DRAW') {
      const normX = clamp(mapX / blueprint.width, 0, 1)
      const normY = clamp(mapY / blueprint.height, 0, 1)
      wallDrawRef.current = {
        active: true,
        start: {
          x: snapValue(normX, snapEnabled, snapSize),
          y: snapValue(normY, snapEnabled, snapSize),
        }
      }
      setWallPreview({
        start: wallDrawRef.current.start,
        end: wallDrawRef.current.start,
      })
      setSelectedObstacleIndex(null)
      return
    }

    const hitIndex = findObstacleAt(mapX, mapY)
    if (hitIndex != null) {
      const obstacle = blueprint.obstacles[hitIndex]
      const obstacleX = obstacle.x * blueprint.width
      const obstacleY = obstacle.y * blueprint.height
      dragRef.current = {
        index: hitIndex,
        offsetX: mapX - obstacleX,
        offsetY: mapY - obstacleY,
        moved: false,
      }
      setSelectedObstacleIndex(hitIndex)
      return
    }

    const normX = clamp(mapX / blueprint.width, 0, 1)
    const normY = clamp(mapY / blueprint.height, 0, 1)
    const snappedX = snapValue(normX, snapEnabled, snapSize)
    const snappedY = snapValue(normY, snapEnabled, snapSize)

    const defaults = TOOL_DEFAULTS[selectedTool] || {}
    const next = {
      type: selectedTool,
      x: formatNumber(snappedX, 4),
      y: formatNumber(snappedY, 4),
      ...defaults,
    }

    updateBlueprint((prev) => ({
      ...prev,
      obstacles: [...prev.obstacles, next]
    }))
    setSelectedObstacleIndex(blueprint.obstacles.length)
  }

  const handleCanvasPointerMove = (event) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const rect = canvas.getBoundingClientRect()
    const moveX = event.clientX - rect.left
    const moveY = event.clientY - rect.top
    const { scale, offsetX, offsetY } = viewRef.current

    const mapX = (moveX - offsetX) / scale
    const mapY = (moveY - offsetY) / scale

    if (wallMode === 'DRAW' && wallDrawRef.current.active) {
      const normX = clamp(mapX / blueprint.width, 0, 1)
      const normY = clamp(mapY / blueprint.height, 0, 1)
      const end = {
        x: snapValue(normX, snapEnabled, snapSize),
        y: snapValue(normY, snapEnabled, snapSize),
      }
      setWallPreview({
        start: wallDrawRef.current.start,
        end,
      })
      return
    }

    if (wallMode === 'EDIT' && wallDragRef.current.pointIndex != null) {
      const normX = clamp(mapX / blueprint.width, 0, 1)
      const normY = clamp(mapY / blueprint.height, 0, 1)
      const snappedX = snapValue(normX, snapEnabled, snapSize)
      const snappedY = snapValue(normY, snapEnabled, snapSize)

      wallDragRef.current.moved = true
      if (wallDragRef.current.side === 'internal') {
        updateInternalPointRaw(wallDragRef.current.wallIndex, wallDragRef.current.pointIndex, {
          x: formatNumber(snappedX, 4),
          y: formatNumber(snappedY, 4),
        })
      } else {
        updateWallPointRaw(wallDragRef.current.side, wallDragRef.current.pointIndex, {
          x: formatNumber(snappedX, 4),
          y: formatNumber(snappedY, 4),
        })
      }
      return
    }

    const draggingIndex = dragRef.current.index
    if (draggingIndex == null) {
      return
    }

    const newMapX = mapX - dragRef.current.offsetX
    const newMapY = mapY - dragRef.current.offsetY
    const normX = clamp(newMapX / blueprint.width, 0, 1)
    const normY = clamp(newMapY / blueprint.height, 0, 1)
    const snappedX = snapValue(normX, snapEnabled, snapSize)
    const snappedY = snapValue(normY, snapEnabled, snapSize)

    dragRef.current.moved = true
    updateObstacle(draggingIndex, {
      x: formatNumber(snappedX, 4),
      y: formatNumber(snappedY, 4),
    })
  }

  const handleCanvasPointerUp = () => {
    if (wallMode === 'DRAW' && wallDrawRef.current.active && wallPreview) {
      const start = wallPreview.start
      const end = wallPreview.end
      const distance = Math.hypot(start.x - end.x, start.y - end.y)
      if (distance > 0.01) {
        updateBlueprint((prev) => ({
          ...prev,
          walls: {
            ...prev.walls,
            internal: [...prev.walls.internal, [start, end]]
          }
        }))
      }
      wallDrawRef.current = { active: false, start: null }
      setWallPreview(null)
    }

    if (wallMode === 'EDIT' && wallDragRef.current.pointIndex != null && wallDragRef.current.moved) {
      pushHistory(blueprintRef.current)
    }
    wallDragRef.current = { side: null, wallIndex: null, pointIndex: null, moved: false }

    if (dragRef.current.index !== null && dragRef.current.moved) {
      pushHistory(blueprintRef.current)
    }
    dragRef.current = { index: null, offsetX: 0, offsetY: 0, moved: false }
  }

  const handleSave = async () => {
    setError('')
    setIsSaving(true)
    const credentialsError = getCredentialsValidationError(authorName, password)
    if (credentialsError) {
      setError(credentialsError)
      setIsSaving(false)
      return
    }
    const validationError = getBlueprintValidationError(blueprint)
    if (validationError) {
      setError(validationError)
      setIsSaving(false)
      return
    }
    try {
      const payload = {
        name: mapName || 'Untitled Map',
        authorName: normalizeAuthorName(authorName),
        password: normalizePassword(password),
        blueprint,
      }
      const response = await fetch(
        activeMapId ? `${apiBase}/api/maps/${activeMapId}` : `${apiBase}/api/maps`,
        {
          method: activeMapId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Unable to save map.')
      }
      const data = await response.json()
      setActiveMapId(data.id)
      setMapName(data.name)
      onRefreshMaps()
    } catch (saveError) {
      setError(saveError.message || 'Unable to save map.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateObstacle = (index, patch) => {
    setBlueprint((prev) => {
      if (!prev.obstacles[index]) {
        return prev
      }
      const next = [...prev.obstacles]
      next[index] = { ...next[index], ...patch }
      return { ...prev, obstacles: next }
    })
  }

  const updateObstacleWithHistory = (index, patch) => {
    updateBlueprint((prev) => {
      if (!prev.obstacles[index]) {
        return prev
      }
      const next = [...prev.obstacles]
      const current = next[index]
      next[index] = typeof patch === 'function' ? patch(current) : { ...current, ...patch }
      return { ...prev, obstacles: next }
    })
  }

  const cloneObstacle = (index) => {
    if (index == null || !blueprint.obstacles[index]) {
      return
    }
    const source = blueprint.obstacles[index]
    const offset = 0.015
    const cloned = {
      ...source,
      x: formatNumber(clamp(source.x + offset, 0, 1), 4),
      y: formatNumber(clamp(source.y + offset, 0, 1), 4),
    }
    updateBlueprint((prev) => ({
      ...prev,
      obstacles: [...prev.obstacles, cloned]
    }))
    setSelectedObstacleIndex(blueprint.obstacles.length)
  }

  const removeObstacle = (index) => {
    updateBlueprint((prev) => {
      const next = prev.obstacles.filter((_, i) => i !== index)
      return { ...prev, obstacles: next }
    })
    setSelectedObstacleIndex(null)
  }

  const updateWallPoint = (side, index, patch) => {
    updateBlueprint((prev) => {
      const walls = { ...prev.walls }
      const points = [...walls[side]]
      points[index] = { ...points[index], ...patch }
      walls[side] = points
      return { ...prev, walls }
    })
  }

  const updateWallPointRaw = (side, index, patch) => {
    setBlueprint((prev) => {
      const walls = { ...prev.walls }
      const points = [...walls[side]]
      points[index] = { ...points[index], ...patch }
      walls[side] = points
      return { ...prev, walls }
    })
  }

  const addWallPoint = (side) => {
    updateBlueprint((prev) => {
      const walls = { ...prev.walls }
      const points = [...walls[side], { x: 0.1, y: 0.1 }]
      walls[side] = points
      return { ...prev, walls }
    })
  }

  const removeWallPoint = (side, index) => {
    updateBlueprint((prev) => {
      const walls = { ...prev.walls }
      const points = walls[side].filter((_, i) => i !== index)
      walls[side] = points
      return { ...prev, walls }
    })
  }

  const addInternalWall = () => {
    updateBlueprint((prev) => ({
      ...prev,
      walls: {
        ...prev.walls,
        internal: [...prev.walls.internal, [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }]]
      }
    }))
  }

  const updateInternalPoint = (wallIndex, pointIndex, patch) => {
    updateBlueprint((prev) => {
      const internal = prev.walls.internal.map((wall, index) => {
        if (index !== wallIndex) {
          return wall
        }
        const next = [...wall]
        next[pointIndex] = { ...next[pointIndex], ...patch }
        return next
      })
      return { ...prev, walls: { ...prev.walls, internal } }
    })
  }

  const updateInternalPointRaw = (wallIndex, pointIndex, patch) => {
    setBlueprint((prev) => {
      const internal = prev.walls.internal.map((wall, index) => {
        if (index !== wallIndex) {
          return wall
        }
        const next = [...wall]
        next[pointIndex] = { ...next[pointIndex], ...patch }
        return next
      })
      return { ...prev, walls: { ...prev.walls, internal } }
    })
  }

  const addInternalPoint = (wallIndex) => {
    updateBlueprint((prev) => {
      const internal = prev.walls.internal.map((wall, index) => {
        if (index !== wallIndex) {
          return wall
        }
        return [...wall, { x: 0.5, y: 0.5 }]
      })
      return { ...prev, walls: { ...prev.walls, internal } }
    })
  }

  const removeInternalPoint = (wallIndex, pointIndex) => {
    updateBlueprint((prev) => {
      const internal = prev.walls.internal.map((wall, index) => {
        if (index !== wallIndex) {
          return wall
        }
        return wall.filter((_, i) => i !== pointIndex)
      })
      return { ...prev, walls: { ...prev.walls, internal } }
    })
  }

  const removeInternalWall = (wallIndex) => {
    updateBlueprint((prev) => ({
      ...prev,
      walls: { ...prev.walls, internal: prev.walls.internal.filter((_, i) => i !== wallIndex) }
    }))
  }

  const selectedObstacle = selectedObstacleIndex != null ? blueprint.obstacles[selectedObstacleIndex] : null

  return (
    <div className="editor-container">
      <header className="editor-header">
        <div className="flex-row items-center gap-12">
          <button className="btn btn-outline" onClick={onBack} style={{ height: '40px' }}>
            BACK
          </button>
          <h2 style={{ margin: 0 }}>MAP EDITOR</h2>
          <div className="flex-row gap-8" style={{ marginLeft: '24px' }}>
             <button className="btn btn-outline" onClick={handleUndo} disabled={historyIndex <= 0} style={{ width: '40px', height: '40px', padding: 0 }} title="Undo">
               <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
             </button>
              <button className="btn btn-outline" onClick={handleRedo} disabled={historyIndex >= historySize - 1} style={{ width: '40px', height: '40px', padding: 0 }} title="Redo">
               <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18.4 10.6C16.55 9 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
             </button>
          </div>
        </div>
        <div className="flex-row items-center gap-12">
          <button className="btn btn-secondary" onClick={() => setActiveMapId('')}>
            NEW MAP
          </button>
          <button className="btn btn-outline" onClick={() => setIsTesting(true)}>
            TEST MAP
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'SAVING...' : 'SAVE MAP'}
          </button>
        </div>
      </header>

      <div className="editor-body">
        <aside className="editor-sidebar">
          <div className="panel-section-title">MAPS</div>
          <div className="flex-col gap-8">
            {mapList.map((map) => (
              <div
                key={map.id}
                className={`map-list-item${map.id === activeMapId ? ' active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setActiveMapId(map.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') setActiveMapId(map.id)
                }}
              >
                <span>{map.name}</span>
                <div className="flex-row gap-6">
                  <button
                    className="btn btn-outline"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleCloneMap(map.id)
                    }}
                    style={{ height: '28px', padding: '0 8px' }}
                  >
                    CLONE
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleDeleteMap(map.id)
                    }}
                    style={{ height: '28px', padding: '0 8px' }}
                  >
                    DELETE
                  </button>
                </div>
              </div>
            ))}
          </div>
          <label className="text-caption" style={{ marginTop: 'var(--space-16)' }}>MAP NAME</label>
          <input
            className="input-field"
            value={mapName}
            onChange={(event) => setMapName(event.target.value)}
            placeholder="Map name"
          />
          <label className="text-caption" style={{ marginTop: 'var(--space-16)' }}>AUTHOR NICKNAME</label>
          <input
            className="input-field"
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="Nickname"
          />
          <label className="text-caption" style={{ marginTop: 'var(--space-16)' }}>PASSWORD</label>
          <input
            className="input-field"
            type="password"
            maxLength={MAX_PASSWORD_LENGTH}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
          />
          {error && (
            <p className="text-caption" style={{ color: 'var(--color-error)' }}>{error}</p>
          )}
        </aside>

        <main className="editor-canvas-area">
          <div className="canvas-frame">
            <canvas
              ref={canvasRef}
              width={600}
              height={900}
              onMouseDown={handleCanvasPointerDown}
              onMouseMove={handleCanvasPointerMove}
              onMouseUp={handleCanvasPointerUp}
              onMouseLeave={handleCanvasPointerUp}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                cursor: wallMode === 'EDIT' ? 'pointer' : wallMode === 'DRAW' ? 'crosshair' : 'default'
              }}
            />
          </div>
          <div className="card" style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', padding: '8px 12px' }}>
            <span className="text-caption">Click to place · Drag to move · Grid snap optional</span>
          </div>
        </main>

        <aside className="editor-panel">
          <CollapsibleSection title="SNAP" isOpen={!collapsed['SNAP']} onToggle={() => toggleSection('SNAP')}>
            <label className="text-caption" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={snapEnabled}
                onChange={(event) => setSnapEnabled(event.target.checked)}
              />
              Snap to Grid
            </label>
            <label className="text-caption" style={{ marginTop: '8px' }}>Grid Size (0.01 = 1%)</label>
            <input
              type="number"
              className="input-field"
              value={snapSize}
              step={0.01}
              min={0.005}
              max={0.1}
              onChange={(event) => setSnapSize(Number(event.target.value))}
            />
          </CollapsibleSection>
          <CollapsibleSection title="TOOLS" isOpen={!collapsed['TOOLS']} onToggle={() => toggleSection('TOOLS')}>
            <div className="tool-grid">
              {TOOL_OPTIONS.map((tool) => (
                <button
                  key={tool}
                  className={`tool-btn${tool === selectedTool ? ' active' : ''}`}
                  onClick={() => setSelectedTool(tool)}
                  title={TOOL_DESCRIPTIONS[tool]}
                >
                  {TOOL_ICONS[tool]}
                  <span>{tool}</span>
                </button>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="MAP SETTINGS" isOpen={!collapsed['MAP SETTINGS']} onToggle={() => toggleSection('MAP SETTINGS')}>
            <div className="flex-col gap-8">
              <label className="text-caption">Width (px)</label>
              <input
                type="number"
                className="input-field"
                value={blueprint.width}
                onChange={(event) => updateBlueprint((prev) => ({ ...prev, width: Number(event.target.value) }))}
              />
              <label className="text-caption">Height (px)</label>
              <input
                type="number"
                className="input-field"
                value={blueprint.height}
                onChange={(event) => updateBlueprint((prev) => ({ ...prev, height: Number(event.target.value) }))}
              />
              <label className="text-caption">Wall Thickness (px)</label>
              <input
                type="number"
                className="input-field"
                value={blueprint.wallThickness}
                onChange={(event) => updateBlueprint((prev) => ({ ...prev, wallThickness: Number(event.target.value) }))}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="FLOOR" isOpen={!collapsed['FLOOR']} onToggle={() => toggleSection('FLOOR')}>
            <div className="flex-col gap-8">
              <label className="text-caption">Floor Y</label>
              <input
                type="number"
                className="input-field"
                value={blueprint.floor?.y ?? 1}
                onChange={(event) => updateBlueprint((prev) => ({
                  ...prev,
                  floor: { ...prev.floor, y: Number(event.target.value) }
                }))}
              />
              <label className="text-caption">Floor Inset</label>
              <input
                type="number"
                className="input-field"
                value={blueprint.floor?.inset ?? 0}
                onChange={(event) => updateBlueprint((prev) => ({
                  ...prev,
                  floor: { ...prev.floor, inset: Number(event.target.value) }
                }))}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="WALLS" isOpen={!collapsed['WALLS']} onToggle={() => toggleSection('WALLS')}>
            <p className="text-caption" style={{ marginTop: '-8px', marginBottom: '12px', opacity: 0.7, fontStyle: 'italic' }}>
              Normalized coordinates (0.0 - 1.0)
            </p>
            <div className="btn-group-toggle" role="group" aria-label="Wall mode">
              {['OFF', 'DRAW', 'EDIT'].map((mode) => (
                <button
                  key={mode}
                  className={`btn btn-outline${wallMode === mode ? ' btn-toggle-active' : ''}`}
                  onClick={() => setWallMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="flex-col gap-12" style={{ marginTop: '12px' }}>
              {['left', 'right'].map((side) => (
                <div key={side}>
                  <div className="flex-row justify-between items-center">
                    <span className="text-caption">{side.toUpperCase()}</span>
                    <button className="btn btn-outline" onClick={() => addWallPoint(side)} style={{ height: '28px', padding: '0 8px' }}>
                      ADD
                    </button>
                  </div>
                  {blueprint.walls[side].map((point, index) => (
                    <div key={`${side}-${index}`} className="flex-row gap-8 items-center" style={{ marginTop: '6px' }}>
                      <input
                        type="number"
                        className="input-field"
                        value={point.x}
                        onChange={(event) => updateWallPoint(side, index, { x: Number(event.target.value) })}
                      />
                      <input
                        type="number"
                        className="input-field"
                        value={point.y}
                        onChange={(event) => updateWallPoint(side, index, { y: Number(event.target.value) })}
                      />
                      <button className="btn btn-outline" onClick={() => removeWallPoint(side, index)} style={{ height: '28px', padding: '0 8px' }}>
                        DEL
                      </button>
                    </div>
                  ))}
                </div>
              ))}

              <div>
                <div className="flex-row justify-between items-center">
                  <span className="text-caption">INTERNAL</span>
                  <button className="btn btn-outline" onClick={addInternalWall} style={{ height: '28px', padding: '0 8px' }}>
                    ADD LINE
                  </button>
                </div>
                {blueprint.walls.internal.map((wall, wallIndex) => (
                  <div key={`internal-${wallIndex}`} className="card" style={{ padding: '8px', marginTop: '8px' }}>
                    <div className="flex-row justify-between items-center">
                      <span className="text-caption">LINE {wallIndex + 1}</span>
                      <button className="btn btn-outline" onClick={() => removeInternalWall(wallIndex)} style={{ height: '28px', padding: '0 8px' }}>
                        REMOVE
                      </button>
                    </div>
                    {wall.map((point, pointIndex) => (
                      <div key={`internal-${wallIndex}-${pointIndex}`} className="flex-row gap-8 items-center" style={{ marginTop: '6px' }}>
                        <input
                          type="number"
                          className="input-field"
                          value={point.x}
                          onChange={(event) => updateInternalPoint(wallIndex, pointIndex, { x: Number(event.target.value) })}
                        />
                        <input
                          type="number"
                          className="input-field"
                          value={point.y}
                          onChange={(event) => updateInternalPoint(wallIndex, pointIndex, { y: Number(event.target.value) })}
                        />
                        <button className="btn btn-outline" onClick={() => removeInternalPoint(wallIndex, pointIndex)} style={{ height: '28px', padding: '0 8px' }}>
                          DEL
                        </button>
                      </div>
                    ))}
                    <button className="btn btn-outline" onClick={() => addInternalPoint(wallIndex)} style={{ height: '28px', padding: '0 8px', marginTop: '6px' }}>
                      ADD POINT
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="OBSTACLES" isOpen={!collapsed['OBSTACLES']} onToggle={() => toggleSection('OBSTACLES')}>
            <div className="flex-col gap-8">
              {blueprint.obstacles.map((obstacle, index) => (
                <button
                  key={`obstacle-${index}`}
                  className={`map-list-item${index === selectedObstacleIndex ? ' active' : ''}`}
                  onClick={() => setSelectedObstacleIndex(index)}
                >
                  <div className="flex-row items-center gap-8">
                    <div style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center' }}>
                      {TOOL_ICONS[obstacle.type]}
                    </div>
                    <span>{obstacle.type}</span>
                  </div>
                  <span className="text-caption">#{index + 1}</span>
                </button>
              ))}
            </div>
            {selectedObstacle && (
              <div className="card" style={{ padding: '8px', marginTop: '12px' }}>
                <div className="flex-row justify-between items-center" style={{ marginBottom: '6px' }}>
                  <span className="text-caption">PROPERTIES</span>
                  <div className="flex-row gap-6">
                    <button
                      className="btn btn-outline"
                      onClick={() => cloneObstacle(selectedObstacleIndex)}
                      style={{ height: '28px', padding: '0 8px' }}
                    >
                      CLONE
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => removeObstacle(selectedObstacleIndex)}
                      style={{ height: '28px', padding: '0 8px' }}
                    >
                      DELETE
                    </button>
                  </div>
                </div>
                <label className="text-caption">Type</label>
                <select
                  className="input-field"
                  value={selectedObstacle.type}
                  onChange={(event) => {
                    const nextType = event.target.value
                    updateObstacleWithHistory(selectedObstacleIndex, (current) => applyObstacleDefaults(current, nextType))
                  }}
                >
                  {TOOL_OPTIONS.map((tool) => (
                    <option key={tool} value={tool}>{tool}</option>
                  ))}
                </select>
                <label className="text-caption">X</label>
                <input
                  type="number"
                  className="input-field"
                  value={selectedObstacle.x}
                  onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { x: Number(event.target.value) })}
                />
                <label className="text-caption">Y</label>
                <input
                  type="number"
                  className="input-field"
                  value={selectedObstacle.y}
                  onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { y: Number(event.target.value) })}
                />

                {(selectedObstacle.type === 'peg' || selectedObstacle.type === 'bumper') && (
                  <>
                    <label className="text-caption">Radius</label>
                    <input
                      type="number"
                      className="input-field"
                      value={selectedObstacle.radius}
                      onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { radius: Number(event.target.value) })}
                    />
                  </>
                )}

                {selectedObstacle.type !== 'peg' && selectedObstacle.type !== 'bumper' && selectedObstacle.type !== 'wind' && (
                  <>
                    <label className="text-caption">Length (px)</label>
                    <input
                      type="number"
                      className="input-field"
                      value={selectedObstacle.length}
                      onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { length: Number(event.target.value) })}
                    />
                    <label className="text-caption">Angle (rad)</label>
                    <input
                      type="number"
                      className="input-field"
                      value={selectedObstacle.angle ?? 0}
                      onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { angle: Number(event.target.value) })}
                    />
                  </>
                )}

                {(selectedObstacle.type === 'spinner' || selectedObstacle.type === 'hammer') && (
                  <>
                    <label className="text-caption">Angular Velocity</label>
                    <input
                      type="number"
                      className="input-field"
                      value={selectedObstacle.angularVelocity ?? 0.25}
                      onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { angularVelocity: Number(event.target.value) })}
                    />
                  </>
                )}

                {selectedObstacle.type === 'slider' && (
                  <>
                    <label className="text-caption">Range (px)</label>
                    <input
                      type="number"
                      className="input-field"
                      value={selectedObstacle.range}
                      onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { range: Number(event.target.value) })}
                    />
                    <label className="text-caption">Speed</label>
                    <input
                      type="number"
                      className="input-field"
                      value={selectedObstacle.speed}
                      onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { speed: Number(event.target.value) })}
                    />
                  </>
                )}

                {selectedObstacle.type === 'wind' && (
                  <>
                    <label className="text-caption">Width (px)</label>
                    <input
                      type="number"
                      className="input-field"
                      value={selectedObstacle.width}
                      onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { width: Number(event.target.value) })}
                    />
                    <label className="text-caption">Height (px)</label>
                    <input
                      type="number"
                      className="input-field"
                      value={selectedObstacle.height}
                      onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { height: Number(event.target.value) })}
                    />
                    <label className="text-caption">Min Force X</label>
                    <input
                      type="number"
                      className="input-field"
                      value={selectedObstacle.minForceX}
                      onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { minForceX: Number(event.target.value) })}
                    />
                    <label className="text-caption">Max Force X</label>
                    <input
                      type="number"
                      className="input-field"
                      value={selectedObstacle.maxForceX}
                      onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { maxForceX: Number(event.target.value) })}
                    />
                    <label className="text-caption">Min Force Y</label>
                    <input
                      type="number"
                      className="input-field"
                      value={selectedObstacle.minForceY}
                      onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { minForceY: Number(event.target.value) })}
                    />
                    <label className="text-caption">Max Force Y</label>
                    <input
                      type="number"
                      className="input-field"
                      value={selectedObstacle.maxForceY}
                      onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { maxForceY: Number(event.target.value) })}
                    />
                    <label className="text-caption">Interval (ms)</label>
                    <input
                      type="number"
                      className="input-field"
                      value={selectedObstacle.interval}
                      onChange={(event) => updateObstacleWithHistory(selectedObstacleIndex, { interval: Number(event.target.value) })}
                    />
                  </>
                )}
              </div>
            )}
          </CollapsibleSection>
        </aside>
      </div>

      {isTesting && (
        <div className="editor-test-overlay">
          <div className="test-hud-overlay">
            <div className="test-controls-card card">
              <span className="status-dot" />
              <span className="text-caption">Testing Mode</span>
              <button className="btn btn-outline" onClick={() => setIsTesting(false)}>
                STOP & EDIT
              </button>
            </div>
          </div>
          <div className="editor-test-stage">
            <GameScreen
              candidates={testCandidates}
              assignments={{}}
              lastSpawnEvent={null}
              onBack={() => setIsTesting(false)}
              mapBlueprint={blueprint}
            />
          </div>
        </div>
      )}
    </div>
  )
}
