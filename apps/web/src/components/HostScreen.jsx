import { useEffect, useRef } from 'react'

export function HostScreen({
  roomCode,
  participantCount,
  readyCount,
  joinUrl,
  qrDataUrl,
  candidateText,
  onCandidateChange,
  onCandidateBlur,
  onStart,
  isWsReady,
  error,
  maps,
  selectedMapId,
  selectedMapBlueprint,
  onMapChange,
  onOpenEditor
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const width = canvas.width
    const height = canvas.height
    context.clearRect(0, 0, width, height)

    if (!selectedMapBlueprint) {
      context.fillStyle = 'rgba(0,0,0,0.05)'
      context.fillRect(0, 0, width, height)
      return
    }

    const bp = selectedMapBlueprint
    const padding = 16
    const drawW = width - padding * 2
    const drawH = height - padding * 2

    const scale = Math.min(drawW / bp.width, drawH / bp.height)
    const offsetX = (width - bp.width * scale) / 2
    const offsetY = (height - bp.height * scale) / 2

    context.save()
    context.translate(offsetX, offsetY)
    context.scale(scale, scale)

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, bp.width, bp.height)

    context.strokeStyle = '#222'
    context.lineWidth = bp.wallThickness || 60
    context.lineCap = 'round'
    context.lineJoin = 'round'

    const drawPolyline = (points) => {
      if (!points || points.length < 2) return
      context.beginPath()
      context.moveTo(points[0].x * bp.width, points[0].y * bp.height)
      for (let i = 1; i < points.length; i++) {
        context.lineTo(points[i].x * bp.width, points[i].y * bp.height)
      }
      context.stroke()
    }

    if (bp.walls) {
      if (bp.walls.left) drawPolyline(bp.walls.left)
      if (bp.walls.right) drawPolyline(bp.walls.right)
      if (bp.walls.internal) bp.walls.internal.forEach(drawPolyline)
    }

    if (bp.obstacles) {
      bp.obstacles.forEach((obstacle) => {
        const x = obstacle.x * bp.width
        const y = obstacle.y * bp.height
        context.save()
        context.translate(x, y)
        if (obstacle.angle) context.rotate(obstacle.angle)

        context.fillStyle = '#666'
        
        if (obstacle.type === 'peg' || obstacle.type === 'bumper') {
          const radius = (obstacle.radius || 0.01) * bp.width
          context.beginPath()
          context.arc(0, 0, radius, 0, Math.PI * 2)
          context.fill()
        } else if (obstacle.type === 'wind') {
           const w = (obstacle.width || 0.1) * bp.width
           const h = (obstacle.height || 0.1) * bp.height
           context.fillStyle = 'rgba(100, 200, 255, 0.3)'
           context.fillRect(-w/2, -h/2, w, h)
        } else {
          const len = (obstacle.length || 0.1) * bp.width
          const thickness = Math.max(30, (obstacle.thickness || 14)) 
          context.fillRect(-len / 2, -thickness / 2, len, thickness)
        }
        context.restore()
      })
    }

    context.restore()
  }, [selectedMapBlueprint])

  return (
    <div className="screen-container">
      <header className="text-center mb-24 animate-enter">
        <h1 className="text-h1 mb-8">MARBLE PARTY</h1>
        <div className="badge badge-waiting">LOBBY OPEN</div>
      </header>

      <div className="card text-center mb-24 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <h3 className="text-h2 mb-16">JOIN ROOM</h3>

        <div className="room-code-display">
          {roomCode}
        </div>

        <div className="qr-container">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR Code for room ${roomCode}`} width="200" height="200" style={{ display: 'block' }} />
          ) : (
            <div className="flex-center" style={{ width: '200px', height: '200px', color: 'var(--color-text-muted)' }}>
              Generating...
            </div>
          )}
        </div>

        <p className="text-caption">
          {joinUrl ? joinUrl : 'Scan to join instantly'}
        </p>
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '0.2s', flex: 1 }}>
        <div className="flex-row justify-between items-center mb-16">
          <h3 className="text-h2" style={{ margin: 0 }}>RACERS</h3>
          <span className="badge badge-ready">
            {participantCount} JOINED · {readyCount} READY
          </span>
        </div>

        <div className="player-list">
          {Array.from({ length: participantCount }).map((_, index) => (
            <div key={index} className="player-chip">
              Racer #{index + 1}
            </div>
          ))}
          <div className="player-chip" style={{ borderStyle: 'dashed', color: 'var(--color-text-muted)', background: 'transparent', borderColor: 'var(--color-text-muted)' }}>
            Waiting...
          </div>
        </div>
      </div>

      <div className="card mb-16 animate-slide-up" style={{ animationDelay: '0.25s', padding: 'var(--space-16)' }}>
        <div className="flex-row justify-between items-center mb-8">
          <h3 className="text-h3" style={{ margin: 0 }}>MAP SELECTION</h3>
          <button
            className="btn btn-outline"
            onClick={onOpenEditor}
            style={{ height: '36px', fontSize: '14px', padding: '0 12px' }}
          >
            EDIT MAPS
          </button>
        </div>
        <select
          className="input-field"
          value={selectedMapId}
          onChange={(event) => onMapChange(event.target.value)}
          style={{ height: '48px', cursor: 'pointer' }}
        >
          {(maps || []).map((map) => (
            <option key={map.id} value={map.id}>{map.name}</option>
          ))}
        </select>
        
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ 
              width: '200px', 
              height: '300px', 
              background: '#f7f7f7', 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px', 
              overflow: 'hidden',
              position: 'relative',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <canvas 
                ref={canvasRef} 
                width={200} 
                height={300} 
                style={{ display: 'block', width: '100%', height: '100%' }} 
              />
            {!selectedMapBlueprint && (
              <div style={{ 
                position: 'absolute', 
                inset: 0, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: 'var(--color-text-muted)', 
                fontSize: '13px',
                fontWeight: 500
              }}>
                Select a map to preview
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto animate-slide-up flex-row gap-16 items-end" style={{ paddingTop: 'var(--space-24)', animationDelay: '0.3s' }}>
        <textarea
          className="input-field"
          value={candidateText}
          onChange={(e) => onCandidateChange(e.target.value)}
          onBlur={onCandidateBlur}
          placeholder="추첨 대상 (쉼표/줄바꿈, *숫자 가능)"
          style={{
            height: '80px',
            resize: 'none',
            fontSize: '16px',
            flex: 1,
            padding: '12px',
            lineHeight: '1.2'
          }}
        />
        <button
          className="btn btn-primary"
          onClick={onStart}
          disabled={!isWsReady}
          style={{ width: 'auto', minWidth: '180px', height: '80px' }}
        >
          START RACE
        </button>
      </div>
      {error && (
        <p className="text-caption text-center" style={{ marginTop: 'var(--space-12)', color: 'var(--color-error)' }}>
          {error}
        </p>
      )}
      {!error && !isWsReady && (
        <p className="text-caption text-center" style={{ marginTop: 'var(--space-12)', color: 'var(--color-text-muted)' }}>
          Connecting to the race server...
        </p>
      )}
    </div>
  )
}
