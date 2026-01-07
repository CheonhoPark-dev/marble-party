export function WaitingScreen({ playerName, participantCount, onLeave, onFeedback }) {
  return (
    <div className="screen-container justify-center">
      
      <div className="mb-32 text-center animate-enter">
        <div 
          className="animate-pulse"
          style={{ 
            width: '80px', 
            height: '80px', 
            background: 'var(--color-success)', 
            borderRadius: '50%', 
            margin: '0 auto var(--space-24)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '40px',
            border: '4px solid var(--color-text)',
            boxShadow: '4px 4px 0 var(--color-text)'
          }}
        >
          ✓
        </div>
        <h1 className="text-display mb-8">YOU'RE IN!</h1>
        <p className="text-h1" style={{ color: 'var(--color-primary)' }}>
          {playerName || "Guest"}
        </p>
      </div>

      <div className="card mb-24 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex-row justify-between items-center mb-16">
          <div className="badge badge-waiting">
            STATUS: READY
          </div>
          <div className="text-caption font-bold">
            {participantCount} JOINED
          </div>
        </div>
        <p className="text-body text-center">
          Wait for the host to start the game.
          <br/>
          <strong style={{ color: 'var(--color-secondary-dark)' }}>Watch the big screen!</strong>
        </p>
      </div>
      
      <div className="mb-24 text-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
         <button className="btn-ghost" onClick={onFeedback}>
           Is this game fair? Give feedback
         </button>
      </div>

      <div className="mt-auto animate-slide-up" style={{ animationDelay: '0.3s' }}>
        <button className="btn btn-outline" onClick={onLeave}>
          LEAVE ROOM
        </button>
      </div>
    </div>
  )
}
