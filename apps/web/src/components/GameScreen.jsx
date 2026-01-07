import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'

export function GameScreen({ candidates = [], assignments = {}, lastObstacleAction, onBack }) {
  const sceneRef = useRef(null)
  const engineRef = useRef(null)
  const renderRef = useRef(null)
  const runnerRef = useRef(null)
  const spawnedRef = useRef(0)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!engineRef.current) return

    const theme = {
      text: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim()
    }

    const bodies = Matter.Composite.allBodies(engineRef.current.world)
    const assignedList = Object.values(assignments)

    bodies.forEach((body) => {
      if (!body.isObstacle) {
        return
      }

      const assignment = assignedList[body.obstacleSlot]

      if (assignment) {
        body.render.fillStyle = assignment.color
        body.obstacleLabel = assignment.nickname
        body.obstacleId = assignment.obstacleId
        body.isAssigned = true
      } else {
        body.render.fillStyle = theme.text
        body.obstacleLabel = null
        body.obstacleId = null
        body.isAssigned = false
      }
    })
  }, [assignments, dimensions])

  useEffect(() => {
    if (!engineRef.current || !lastObstacleAction) return
    
    const { obstacleId } = lastObstacleAction
    const bodies = Matter.Composite.allBodies(engineRef.current.world)
    const targetBody = bodies.find(b => b.customId === obstacleId)
    
    if (targetBody) {
       Matter.Body.translate(targetBody, { x: 0, y: -5 })
       setTimeout(() => {
         if (targetBody && targetBody.parent) { 
            Matter.Body.translate(targetBody, { x: 0, y: 5 })
         }
       }, 50)
    }
  }, [lastObstacleAction])

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
      Common = Matter.Common,
      Events = Matter.Events

    const { width, height: viewHeight } = dimensions
    const worldHeight = Math.max(viewHeight * 6, 2400)

    const engine = Engine.create()
    engineRef.current = engine
    engine.world.gravity.y = 1.2

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width,
        height: viewHeight,
        background: 'transparent',
        wireframes: false,
        pixelRatio: window.devicePixelRatio
      }
    })
    renderRef.current = render
    render.options.hasBounds = true
    render.bounds.min.x = 0
    render.bounds.max.x = width
    render.bounds.min.y = 0
    render.bounds.max.y = viewHeight

    const clamp = (value, min, max) => Math.max(min, Math.min(value, max))
    const camera = { currentY: viewHeight / 2 }
    const cameraOffset = viewHeight * 0.25

    const updateCamera = () => {
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

      if (!leader) {
        return
      }

      const minY = viewHeight / 2
      const maxY = Math.max(minY, worldHeight - viewHeight / 2)
      const targetY = clamp(leader.position.y + cameraOffset, minY, maxY)

      camera.currentY += (targetY - camera.currentY) * 0.08
      render.bounds.min.y = camera.currentY - viewHeight / 2
      render.bounds.max.y = camera.currentY + viewHeight / 2
      render.bounds.min.x = 0
      render.bounds.max.x = width
    }

    Events.on(render, 'afterRender', () => {
      const context = render.context
      const bodies = Composite.allBodies(engine.world)

      if (render.options.hasBounds) {
        Matter.Render.startViewTransform(render)
      }

      context.font = "bold 14px sans-serif"
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.lineWidth = 3
      context.strokeStyle = theme.surface
      
      bodies.forEach(body => {
        if (body.label && body.label.startsWith('marble-')) {
          const { x, y } = body.position
          const text = body.customName || ''
          
          context.strokeText(text, x, y - 22)
          context.fillStyle = theme.text
          context.fillText(text, x, y - 22)
        } else if (body.obstacleLabel) {
          const { x, y } = body.position
          const text = body.obstacleLabel
          
          context.save()
          context.font = "bold 10px sans-serif"
          context.strokeText(text, x, y - 14)
          context.fillStyle = theme.white
          context.fillText(text, x, y - 14)
          context.restore()
        }
      })

      if (render.options.hasBounds) {
        Matter.Render.endViewTransform(render)
      }
    })
    const wallThickness = 60
    const wallHeight = worldHeight + viewHeight
    
    const wallOptions = { 
      isStatic: true, 
      render: { 
        fillStyle: theme.text, 
        strokeStyle: 'transparent',
        lineWidth: 0
      },
      chamfer: { radius: 10 },
      friction: 0.5
    }

    const ground = Bodies.rectangle(width / 2, worldHeight + 100, width * 1.2, 200, wallOptions)
    const leftWall = Bodies.rectangle(0 - wallThickness/2, worldHeight / 2, wallThickness, wallHeight, wallOptions)
    const rightWall = Bodies.rectangle(width + wallThickness/2, worldHeight / 2, wallThickness, wallHeight, wallOptions)

    const obstacles = []
    const terrain = []
    let obstacleIndex = 0

    const pegStyle = {
      isStatic: true,
      render: {
        fillStyle: theme.text,
        strokeStyle: 'transparent',
      },
      friction: 0.02,
      frictionStatic: 0
    }

    const addPegAt = (x, y) => {
      const body = Bodies.circle(x, y, 6, pegStyle)
      body.customId = obstacleIndex
      body.isObstacle = true
      body.obstacleSlot = obstacleIndex
      obstacleIndex += 1
      obstacles.push(body)
    }

    const startY = Math.max(viewHeight * 0.32, 160)
    const endY = worldHeight - viewHeight * 0.4
    const pathSpan = endY - startY
    const maxHalfWidth = Math.max(0, width / 2 - 24)
    const corridorHalfWidth = Math.min(maxHalfWidth, Math.max(width * 0.28, 110))
    const maxAmplitude = Math.max(0, width / 2 - corridorHalfWidth - 24)
    const wiggleAmplitude = Math.min(width * 0.2, maxAmplitude)
    const wiggleCycles = 2.6

    const pathXAt = (t) => {
      const wave = Math.sin(t * Math.PI * 2 * wiggleCycles)
      const wobble = Math.sin(t * Math.PI * 2 * (wiggleCycles * 2) + Math.PI / 3)
      return width * 0.5 + wiggleAmplitude * (wave * 0.9 + wobble * 0.35)
    }

    const railStyle = {
      isStatic: true,
      render: {
        fillStyle: theme.muted,
        strokeStyle: 'transparent',
        lineWidth: 0
      },
      chamfer: { radius: 5 },
      friction: 0.02,
      frictionStatic: 0
    }
    const railThickness = 20
    const pointCount = Math.max(22, Math.floor(pathSpan / 180))
    const pathPoints = []

    for (let i = 0; i <= pointCount; i++) {
      const t = i / pointCount
      const y = startY + t * pathSpan
      pathPoints.push({ x: pathXAt(t), y })
    }

    const segmentNormals = []
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const p1 = pathPoints[i]
      const p2 = pathPoints[i + 1]
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const length = Math.hypot(dx, dy) || 1
      segmentNormals.push({ x: -dy / length, y: dx / length })
    }

    const pointNormals = pathPoints.map((_, index) => {
      const prev = segmentNormals[index - 1]
      const next = segmentNormals[index]
      let nx = 0
      let ny = 0
      if (prev) {
        nx += prev.x
        ny += prev.y
      }
      if (next) {
        nx += next.x
        ny += next.y
      }
      if (!prev && next) {
        nx = next.x
        ny = next.y
      }
      if (prev && !next) {
        nx = prev.x
        ny = prev.y
      }
      const length = Math.hypot(nx, ny) || 1
      return { x: nx / length, y: ny / length }
    })

    const addRailSegment = (p1, p2, normal, side) => {
      const offset = corridorHalfWidth * side
      const startX = p1.x + normal.x * offset
      const startY = p1.y + normal.y * offset
      const endX = p2.x + normal.x * offset
      const endY = p2.y + normal.y * offset
      const length = Math.hypot(endX - startX, endY - startY)
      if (length === 0) {
        return
      }
      const midX = (startX + endX) / 2
      const midY = (startY + endY) / 2
      terrain.push(Bodies.rectangle(midX, midY, length + railThickness * 1.5, railThickness, {
        ...railStyle,
        angle: Math.atan2(endY - startY, endX - startX)
      }))
    }

    const addRailCap = (point, normal, side) => {
      const offset = corridorHalfWidth * side
      const cx = point.x + normal.x * offset
      const cy = point.y + normal.y * offset
      terrain.push(Bodies.circle(cx, cy, railThickness * 0.6, railStyle))
    }

    for (let i = 0; i < pathPoints.length - 1; i++) {
      const p1 = pathPoints[i]
      const p2 = pathPoints[i + 1]
      const normal = segmentNormals[i]
      addRailSegment(p1, p2, normal, 1)
      addRailSegment(p1, p2, normal, -1)
    }

    for (let i = 0; i < pathPoints.length; i++) {
      const normal = pointNormals[i]
      addRailCap(pathPoints[i], normal, 1)
      addRailCap(pathPoints[i], normal, -1)
    }

    const rowSpacing = 140
    const rows = Math.max(16, Math.floor(pathSpan / rowSpacing))
    const pegOffset = corridorHalfWidth * 0.32

    for (let i = 0; i <= rows; i++) {
      const y = startY + i * rowSpacing
      const t = Math.min(1, Math.max(0, (y - startY) / pathSpan))
      const centerX = pathXAt(t)
      const jitter = Common.random(-5, 5)
      addPegAt(centerX - pegOffset + jitter, y)
      addPegAt(centerX + pegOffset + jitter, y)

      if (i % 3 === 0 && y + rowSpacing * 0.3 < endY) {
        const centerJitter = Common.random(-10, 10)
        addPegAt(centerX + centerJitter, y + rowSpacing * 0.3)
      }
    }
    
    const funnelOptions = {
        isStatic: true,
        render: {
            fillStyle: theme.text,
            strokeStyle: 'transparent',
            lineWidth: 0
        },
        chamfer: { radius: 10 },
        angle: Math.PI / 7,
        friction: 0.1
    }
    
    const funnelY = Math.max(viewHeight * 0.18, 120)
    const funnelLeft = Bodies.rectangle(width * 0.1, funnelY, width * 0.5, 20, funnelOptions)
    const funnelRight = Bodies.rectangle(width * 0.9, funnelY, width * 0.5, 20, {
        ...funnelOptions,
        angle: -Math.PI / 7
    })

    Composite.add(engine.world, [
        ground, 
        leftWall, 
        rightWall, 
        funnelLeft, 
        funnelRight, 
        ...terrain,
        ...obstacles
    ])

    Events.on(engine, 'afterUpdate', updateCamera)

    Render.run(render)
    const runner = Runner.create()
    runnerRef.current = runner
    Runner.run(runner, engine)

    return () => {
      Events.off(engine, 'afterUpdate', updateCamera)
      Render.stop(render)
      Runner.stop(runner)
      if (render.canvas) render.canvas.remove()
      render.canvas = null
      render.context = null
      render.textures = {}
      if (engineRef.current) {
        Matter.World.clear(engineRef.current.world)
        Matter.Engine.clear(engineRef.current)
      }
    }
  }, [dimensions])

  useEffect(() => {
    if (!engineRef.current || dimensions.width === 0) return
    
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

      for (let i = 0; i < needed; i += 1) {
        const x = Common.random(dimensions.width * 0.4, dimensions.width * 0.6)
        const y = -40 - (i * 50)
        const size = Common.random(14, 18)

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
          restitution: 0.6,
          friction: 0.005,
          frictionAir: 0.001,
          density: 0.05,
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
      border: 'var(--border-width-thick) solid var(--color-text)',
      boxShadow: 'var(--shadow-lg)',
      borderRadius: 'var(--radius-lg)'
    }}>
        <div style={{ 
          position: 'absolute', 
          top: 24, 
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

        <div ref={sceneRef} style={{ flex: 1, width: '100%', height: '100%', minHeight: 0 }} />
        
        <div style={{ 
          position: 'absolute', 
          bottom: 32, 
          left: 0, 
          width: '100%', 
          display: 'flex', 
          justifyContent: 'center',
          pointerEvents: 'none'
        }}>
            <button 
              className="btn btn-secondary" 
              style={{ 
                pointerEvents: 'auto', 
                minWidth: '200px',
                borderWidth: 'var(--border-width-thick)',
                boxShadow: 'var(--shadow-lg)',
                fontWeight: 900,
                fontSize: '20px',
                letterSpacing: '-0.5px'
              }} 
              onClick={onBack}
            >
                STOP PARTY
            </button>
        </div>
    </div>
  )
}
