export function RulesScreen({ onReady, t }) {
  return (
    <div className="screen-container">
      <div className="mb-24 animate-enter">
        <h2 className="text-h1 mb-16">{t.rules.title}</h2>
        <p className="text-body" style={{ color: 'var(--color-text-muted)' }}>
          {t.rules.subtitle}
        </p>
      </div>

      <div className="flex-col gap-16 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="step-card">
          <div className="step-number">1</div>
          <div>
            <h3 className="text-h2 mb-8" style={{ marginBottom: '4px' }}>{t.rules.steps[0].title}</h3>
            <p className="text-body">{t.rules.steps[0].body}</p>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">2</div>
          <div>
            <h3 className="text-h2 mb-8" style={{ marginBottom: '4px' }}>{t.rules.steps[1].title}</h3>
            <p className="text-body">{t.rules.steps[1].body}</p>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">3</div>
          <div>
            <h3 className="text-h2 mb-8" style={{ marginBottom: '4px' }}>{t.rules.steps[2].title}</h3>
            <p className="text-body">{t.rules.steps[2].body}</p>
          </div>
        </div>
      </div>

      <div className="mt-auto animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <button className="btn btn-primary" onClick={onReady}>
          {t.rules.ready}
        </button>
      </div>
    </div>
  )
}
