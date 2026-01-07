export function HostScreen({ roomCode, participantCount, readyCount, joinUrl, qrDataUrl, onStart }) {
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

      <div className="mt-auto animate-slide-up" style={{ paddingTop: 'var(--space-24)', animationDelay: '0.3s' }}>
        <button className="btn btn-primary" onClick={onStart}>
          START RACE
        </button>
      </div>
    </div>
  )
}
