import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'

export function GameScreen({ participantCount, onBack }) {
  const sceneRef = useRef(null)
  const engineRef = useRef(null)
  const renderRef = useRef(null)
  const runnerRef = useRef(null)
  const spawnedRef = useRef(0)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

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
    }

    const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Common = Matter.Common

    const engine = Engine.create()
    engineRef.current = engine
    engine.world.gravity.y = 1.2

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: dimensions.width,
        height: dimensions.height,
        background: 'transparent',
        wireframes: false,
        pixelRatio: window.devicePixelRatio
      }
    })
    renderRef.current = render

    const { width, height } = dimensions
    const wallThickness = 60
    
    const wallOptions = { 
      isStatic: true, 
      render: { 
        fillStyle: theme.text, 
        strokeStyle: theme.text,
        lineWidth: 0
      },
      friction: 0.5
    }

    const ground = Bodies.rectangle(width / 2, height + 60, width, 160, wallOptions)
    const leftWall = Bodies.rectangle(0 - wallThickness/2, height / 2, wallThickness, height * 4, wallOptions)
    const rightWall = Bodies.rectangle(width + wallThickness/2, height / 2, wallThickness, height * 4, wallOptions)

    const obstacles = []
    
    const startY = height * 0.25
    const endY = height * 0.85
    const rows = 8
    const rowSpacing = (endY - startY) / rows
    
    for (let i = 0; i < rows; i++) {
        const y = startY + i * rowSpacing
        const isOffset = i % 2 !== 0
        const cols = isOffset ? 4 : 5
        const rowWidth = width * 0.8
        const spacingX = rowWidth / (cols - 1 || 1)
        const startX = (width - rowWidth) / 2
        
        for (let j = 0; j < cols; j++) {
            const x = startX + j * spacingX
            
            const isCircle = i % 3 === 0
            
            const obstacleStyle = {
                isStatic: true,
                render: {
                    fillStyle: theme.text,
                    strokeStyle: 'transparent',
                },
                angle: isCircle ? 0 : Math.PI / 4 
            }

            let obstacle
            if (isCircle) {
                obstacle = Bodies.circle(x, y, 6, obstacleStyle)
            } else {
                obstacle = Bodies.rectangle(x, y, 14, 14, {
                    ...obstacleStyle,
                    chamfer: { radius: 2 }
                })
            }
            
            obstacles.push(obstacle)
        }
    }
    
    const funnelOptions = {
        isStatic: true,
        render: {
            fillStyle: theme.text,
            strokeStyle: theme.text,
            lineWidth: 2
        },
        angle: Math.PI / 7,
        friction: 0.1
    }
    
    const funnelLeft = Bodies.rectangle(width * 0.1, height * 0.15, width * 0.5, 20, funnelOptions)
    const funnelRight = Bodies.rectangle(width * 0.9, height * 0.15, width * 0.5, 20, {
        ...funnelOptions,
        angle: -Math.PI / 7
    })

    Composite.add(engine.world, [
        ground, 
        leftWall, 
        rightWall, 
        funnelLeft, 
        funnelRight, 
        ...obstacles
    ])

    Render.run(render)
    const runner = Runner.create()
    runnerRef.current = runner
    Runner.run(runner, engine)

    return () => {
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
    
    const currentCount = participantCount || 0
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
      const colors = [theme.primary, theme.secondary, theme.success, theme.warning]
      
      for (let i = 0; i < needed; i++) {
        const x = Common.random(dimensions.width * 0.4, dimensions.width * 0.6)
        const y = -40 - (i * 50)
        const size = Common.random(14, 18) 
        
        const randomColor = Common.choose(colors)
        
        const marble = Bodies.circle(x, y, size, {
          restitution: 0.6, 
          friction: 0.005,
          frictionAir: 0.001, 
          density: 0.05, 
          render: {
            fillStyle: randomColor,
            strokeStyle: theme.text,
            lineWidth: 3
          }
        })
        newMarbles.push(marble)
      }

      Composite.add(engineRef.current.world, newMarbles)
      spawnedRef.current = currentCount
    }
  }, [participantCount, dimensions])

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
             MARBLES: {participantCount}
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
