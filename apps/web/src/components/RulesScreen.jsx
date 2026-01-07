export function RulesScreen({ onReady }) {
  return (
    <div className="screen-container">
      <div className="mb-24 animate-enter">
        <h2 className="text-h1 mb-16">HOW TO PLAY</h2>
        <p className="text-body" style={{ color: 'var(--color-text-muted)' }}>
          Everyone plays at the same time. Fairness is guaranteed.
        </p>
      </div>

      <div className="flex-col gap-16 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="step-card">
          <div className="step-number">1</div>
          <div>
            <h3 className="text-h2 mb-8" style={{ marginBottom: '4px' }}>JOIN</h3>
            <p className="text-body">Scan the QR code to enter the room.</p>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">2</div>
          <div>
            <h3 className="text-h2 mb-8" style={{ marginBottom: '4px' }}>WAIT</h3>
            <p className="text-body">Wait for the host to start the race.</p>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">3</div>
          <div>
            <h3 className="text-h2 mb-8" style={{ marginBottom: '4px' }}>WIN</h3>
            <p className="text-body">Watch your marble race to the finish line!</p>
          </div>
        </div>
      </div>

      <div className="mt-auto animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <button className="btn btn-primary" onClick={onReady}>
          I'M READY!
        </button>
      </div>
    </div>
  )
}
