import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'

const CLOUD_COLUMN_WIDTH = 160
const CLOUD_TOP_OFFSET_MAX = 96
const CLOUD_BAND_MAX = 240
const CLOUD_PADDING_MIN = 32
const CLOUD_PADDING_MAX = 72
const CLOUD_BOB_X = 10
const CLOUD_BOB_Y = 6
const CLOUD_DROP_OFFSET = 32
const CLOUD_DROP_JITTER = 18
const CLOUD_DROP_MIN_Y = 48

const OBSTACLE_TTL = {
  bomb: 2000,
  normal: 3000,
  spinner: 3000,
  fan: 3000
}




const BOMB_BLAST_RADIUS = 160
const BOMB_BLAST_FORCE = 0.0011

const clamp = (value, min, max) => Math.max(min, Math.min(value, max))
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

export function GameScreen({
  candidates = [],
  assignments = {},
  lastSpawnEvent,
  onBack
}) {
  const sceneRef = useRef(null)
  const engineRef = useRef(null)
  const renderRef = useRef(null)
  const runnerRef = useRef(null)
  const spawnedRef = useRef(0)
  const leaderRef = useRef(null)
  const leaderPositionRef = useRef(null)
  const cloudsRef = useRef(new Map())
  const obstacleTimersRef = useRef(new Set())
  const windFieldsRef = useRef([])
  const spawnObstacleRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })


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
    if (!renderRef.current) return

    const bounds = renderRef.current.bounds
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
        roamSpeed: randomBetween(10.0, 14.0),
        color: assignment.color,
        nickname: assignment.nickname,
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
    const spawnX = clamp(
      (cloud?.x ?? fallbackX) + (cloud?.spawnJitter ?? randomBetween(-CLOUD_DROP_JITTER, CLOUD_DROP_JITTER)),
      bounds.min.x + 40,
      bounds.max.x - 40
    )
    const spawnY = clamp(
      (cloud?.y ?? fallbackY) + CLOUD_DROP_OFFSET,
      bounds.min.y + CLOUD_DROP_MIN_Y,
      bounds.min.y + Math.min(220, viewHeight * 0.35)
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

    const { width, height: viewHeight } = dimensions
    const worldHeight = Math.max(viewHeight * 6, 2400)

    const engine = Engine.create()
    engineRef.current = engine
    engine.world.gravity.y = 0.6

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

    const camera = { currentY: viewHeight / 2, deltaY: 0 }
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

      leaderRef.current = leader

      if (!leader) {
        camera.deltaY = 0
        return
      }

      const minY = viewHeight / 2
      const maxY = Math.max(minY, worldHeight - viewHeight / 2)
      const targetY = clamp(leader.position.y + cameraOffset, minY, maxY)

      const prevY = camera.currentY
      camera.currentY += (targetY - camera.currentY) * 0.08
      camera.deltaY = camera.currentY - prevY

      render.bounds.min.y = camera.currentY - viewHeight / 2
      render.bounds.max.y = camera.currentY + viewHeight / 2
      render.bounds.min.x = 0
      render.bounds.max.x = width
    }

    const updateClouds = () => {
      if (!renderRef.current) {
        return
      }
      const bounds = renderRef.current.bounds

      const leader = leaderRef.current
      let deltaY = camera.deltaY || 0
      if (leader) {
        const prevY = leaderPositionRef.current
        deltaY = typeof prevY === 'number' ? leader.position.y - prevY : 0
        leaderPositionRef.current = leader.position.y
      } else {
        leaderPositionRef.current = null
      }

      const clouds = cloudsRef.current
      if (!clouds.size) {
        return
      }

      const now = Date.now()
      const viewHeight = bounds.max.y - bounds.min.y
      const CLOUD_RADIUS = 30
      const safePadX = CLOUD_RADIUS + CLOUD_BOB_X
      const safePadY = CLOUD_RADIUS + CLOUD_BOB_Y

      const targetPad = 60

      const skyCenterY = leader ? leader.position.y : (bounds.min.y + bounds.max.y) / 2
      const bandHeight = Math.min(320, viewHeight * 0.5)
      const halfBand = bandHeight / 2

      const bandMinY = skyCenterY - halfBand
      const bandMaxY = skyCenterY + halfBand

      const skyMinX = bounds.min.x + targetPad
      const skyMaxX = bounds.max.x - targetPad
      const worldMinY = targetPad
      const worldMaxY = worldHeight - targetPad
      const skyMinY = clamp(bandMinY, worldMinY, worldMaxY)
      const skyMaxY = clamp(bandMaxY, worldMinY, worldMaxY)

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
            cloud.roamSpeed = randomBetween(6.5, 9.0)
        }

        cloud.roamY += deltaY
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
        const hardMinY = safePadY - bobY
        const hardMaxY = worldHeight - safePadY - bobY

        cloud.roamX = clamp(cloud.roamX, hardMinX, hardMaxX)
        
        let nextY = clamp(cloud.roamY, bandMinY, bandMaxY)
        cloud.roamY = clamp(nextY, hardMinY, hardMaxY)
        
        cloud.x = cloud.roamX + bobX
        cloud.y = cloud.roamY + bobY
      }
    }

    const applyWindForces = () => {
      const windFields = windFieldsRef.current
      if (!windFields.length) {
        return
      }
      const now = Date.now()

      for (let i = windFields.length - 1; i >= 0; i -= 1) {
        if (windFields[i].expiresAt <= now) {
          windFields.splice(i, 1)
        }
      }

      if (!windFields.length) {
        return
      }

      const bodies = Composite.allBodies(engine.world)

      windFields.forEach((field) => {
        const minX = field.x - field.width / 2
        const maxX = field.x + field.width / 2
        const minY = field.y - field.height / 2
        const maxY = field.y + field.height / 2

        bodies.forEach((body) => {
          if (!body.label || !body.label.startsWith('marble-')) {
            return
          }
          const { x, y } = body.position
          if (x < minX || x > maxX || y < minY || y > maxY) {
            return
          }
          Matter.Body.applyForce(body, body.position, { x: field.strength, y: 0 })
        })
      })
    }

    const updateWorld = (event) => {
      updateCamera()
      updateClouds()
      applyWindForces()
    }

    Events.on(engine, 'afterUpdate', updateWorld)

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
          const fill = 'rgba(255,255,255,0.85)'
          context.fillStyle = fill
          context.strokeStyle = cloud.color || theme.secondary
          context.lineWidth = 2

          context.beginPath()
          context.arc(baseX - 14, baseY, 12, 0, Math.PI * 2)
          context.arc(baseX, baseY - 8, 16, 0, Math.PI * 2)
          context.arc(baseX + 16, baseY, 12, 0, Math.PI * 2)
          context.closePath()
          context.fill()
          context.stroke()

          if (cloud.nickname) {
            context.fillStyle = theme.text
            context.fillText(cloud.nickname, baseX, baseY + 18)
          }
        })
        context.restore()
      }

      if (render.options.hasBounds) {
        Matter.Render.endViewTransform(render)
      }
    })
    const wallThickness = 56
    const wallOptions = { 
      isStatic: true, 
      render: { 
        fillStyle: theme.text, 
        strokeStyle: theme.white,
        lineWidth: 3
      },
      chamfer: { radius: 12 },
      friction: 0.4
    }

    const topY = 0
    const goalWidth = Math.max(90, width * 0.12)
    const goalY = worldHeight - 80
    const goalLeftX = width * 0.5 - goalWidth * 0.5
    const goalRightX = width * 0.5 + goalWidth * 0.5

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

    const leftWall = buildWall({ x: 0, y: topY }, { x: goalLeftX, y: goalY })
    const rightWall = buildWall({ x: width, y: topY }, { x: goalRightX, y: goalY })

    const floorY = goalY + wallThickness / 2
    const leftFloorWidth = Math.max(0, goalLeftX)
    const rightFloorWidth = Math.max(0, width - goalRightX)
    const floorLeft = Bodies.rectangle(leftFloorWidth / 2, floorY, leftFloorWidth, wallThickness, wallOptions)
    const floorRight = Bodies.rectangle(goalRightX + rightFloorWidth / 2, floorY, rightFloorWidth, wallThickness, wallOptions)

    const obstacles = []
    const terrain = []
    const constraints = []
    let obstacleIndex = 0
    const obstacleRestitution = 0.8

    const registerObstacle = (body) => {
      body.customId = obstacleIndex
      body.isObstacle = true
      body.obstacleSlot = obstacleIndex
      obstacleIndex += 1
      obstacles.push(body)
    }

    const leftEdgeAt = (y) => {
      const t = clamp((y - topY) / (goalY - topY), 0, 1)
      return goalLeftX * t
    }

    const rightEdgeAt = (y) => {
      const t = clamp((y - topY) / (goalY - topY), 0, 1)
      return width + (goalRightX - width) * t
    }

    const gridCols = 5
    const gridRows = 8
    const gridTop = Math.max(viewHeight * 0.25, 140)
    const gridBottom = Math.max(gridTop + 200, goalY - 180)
    const rowHeight = (gridBottom - gridTop) / gridRows
    const jitterRange = 16
    const angleJitter = (Math.PI / 180) * 12

    for (let row = 0; row < gridRows; row++) {
      const cellY = gridTop + rowHeight * (row + 0.5)
      const leftEdge = leftEdgeAt(cellY) + 36
      const rightEdge = rightEdgeAt(cellY) - 36
      const usableWidth = rightEdge - leftEdge
      if (usableWidth <= 140) {
        continue
      }
      const cellWidth = usableWidth / gridCols

      for (let col = 0; col < gridCols; col++) {
        const baseX = leftEdge + cellWidth * (col + 0.5)
        const jitterX = (Math.random() * 2 - 1) * jitterRange
        const jitterY = (Math.random() * 2 - 1) * jitterRange
        const x = clamp(baseX + jitterX, leftEdge + 12, rightEdge - 12)
        const y = cellY + jitterY
        const roll = Math.random()

        if (roll < 0.34) {
          const slopeLength = clamp(cellWidth * 0.9, 70, 140)
          const slopeHeight = 12
          const baseAngle = Math.random() < 0.5 ? Math.PI / 4 : -Math.PI / 4
          const slopeAngle = baseAngle + (Math.random() * 2 - 1) * angleJitter
          const slope = Bodies.rectangle(x, y, slopeLength, slopeHeight, {
            isStatic: true,
            restitution: obstacleRestitution,
            friction: 0.02,
            frictionStatic: 0,
            chamfer: { radius: 4 },
            render: {
              fillStyle: theme.text,
              strokeStyle: 'transparent'
            },
            angle: slopeAngle
          })
          registerObstacle(slope)
        } else if (roll < 0.67) {
          const pegCount = Math.random() < 0.5 ? 1 : 2
          for (let i = 0; i < pegCount; i++) {
            const pegX = clamp(x + (Math.random() * 2 - 1) * 10, leftEdge + 10, rightEdge - 10)
            const pegY = y + (Math.random() * 2 - 1) * 10
            const peg = Bodies.circle(pegX, pegY, 6, {
              isStatic: true,
              restitution: obstacleRestitution,
              friction: 0.02,
              frictionStatic: 0,
              render: {
                fillStyle: theme.text,
                strokeStyle: 'transparent'
              }
            })
            registerObstacle(peg)
          }
        } else {
          const spinnerLength = clamp(cellWidth * 0.85, 80, 150)
          const spinner = Bodies.rectangle(x, y, spinnerLength, 12, {
            restitution: obstacleRestitution,
            friction: 0.01,
            frictionAir: 0.002,
            density: 0.002,
            render: {
              fillStyle: theme.secondary,
              strokeStyle: 'transparent'
            }
          })
          spinner.angularVelocity = (Math.random() * 2 - 1) * 0.4
          registerObstacle(spinner)
          constraints.push(Constraint.create({
            pointA: { x, y },
            bodyB: spinner,
            pointB: { x: 0, y: 0 },
            length: 0,
            stiffness: 1
          }))
        }
      }
    }

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
            fillStyle: theme.warning,
            strokeStyle: theme.text,
            lineWidth: 3
          }
        })
      } else if (type === 'spinner') {
        const spinnerLength = randomBetween(110, 140)
        body = Bodies.rectangle(x, y, spinnerLength, 14, {
          friction: 0.02,
          frictionAir: 0.006,
          density: 0.004,
          render: {
            fillStyle: theme.secondary,
            strokeStyle: theme.text,
            lineWidth: 3
          }
        })
        body.angularVelocity = (Math.random() * 2 - 1) * 0.8
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
            fillStyle: theme.success,
            strokeStyle: theme.text,
            lineWidth: 3
          }
        })
        const bounds = renderRef.current?.bounds
        const centerX = bounds ? (bounds.min.x + bounds.max.x) / 2 : x
        const direction = x < centerX ? -1 : 1
        windFieldsRef.current.push({
          x,
          y,
          width: 260,
          height: 180,
          strength: 0.003 * direction,
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
            fillStyle: theme.text,
            strokeStyle: theme.white,
            lineWidth: 2
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
            Matter.Body.applyForce(target, target.position, {
              x: (dx / distance) * strength,
              y: (dy / distance) * strength
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
        leftWall, 
        rightWall, 
        floorLeft,
        floorRight,
        ...terrain,
        ...obstacles,
        ...constraints
    ])
 
    Render.run(render)
    const runner = Runner.create()
    runnerRef.current = runner
    Runner.run(runner, engine)
 
    return () => {
      Events.off(engine, 'afterUpdate', updateWorld)
      clearObstacleTimers()
      windFieldsRef.current = []
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
    </div>
  )
}
