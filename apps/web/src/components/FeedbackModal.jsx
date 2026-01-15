import { useState } from 'react'

export function FeedbackModal({ onClose, t }) {
  const [step, setStep] = useState(1)
  const [complaint, setComplaint] = useState('')

  const handleUnderstand = () => {
    setStep(2)
  }

  const handleSubmit = () => {
    setStep(3)
    setTimeout(() => {
      onClose()
    }, 2000)
  }

  if (step === 3) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content text-center" onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }} className="animate-pulse">✨</div>
          <h2 className="text-h1">{t.feedback.thanks}</h2>
          <p className="text-body mb-24">{t.feedback.thanksBody}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex-row justify-between items-center mb-24">
          <h2 className="text-h2" style={{ margin: 0 }}>{t.feedback.title}</h2>
          <button className="btn-ghost" onClick={onClose} style={{ padding: '4px' }} aria-label={t.feedback.closeAria}>✕</button>
        </div>

        {step === 1 && (
          <div className="animate-slide-up">
            <p className="text-body font-bold mb-24" style={{ fontSize: '18px' }}>
              {t.feedback.step1}
            </p>
            <div className="flex-col gap-16">
              <button 
                className="btn btn-secondary" 
                onClick={() => handleUnderstand(true)}
              >
                {t.feedback.yes}
              </button>
              <button 
                className="btn btn-outline" 
                onClick={() => handleUnderstand(false)}
              >
                {t.feedback.no}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-slide-up">
            <p className="text-body font-bold mb-8">{t.feedback.step2}</p>
            <p className="text-caption mb-16">{t.feedback.step2Caption}</p>
            <textarea 
              className="feedback-textarea" 
              placeholder={t.feedback.placeholder}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleSubmit}>
              {t.feedback.submit}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
