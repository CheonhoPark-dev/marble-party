import { useState } from 'react'

export function FeedbackModal({ onClose }) {
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
          <h2 className="text-h1">THANKS!</h2>
          <p className="text-body mb-24">Your feedback helps us make the race fairer.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex-row justify-between items-center mb-24">
          <h2 className="text-h2" style={{ margin: 0 }}>FAIRNESS CHECK</h2>
          <button className="btn-ghost" onClick={onClose} style={{ padding: '4px' }}>✕</button>
        </div>

        {step === 1 && (
          <div className="animate-slide-up">
            <p className="text-body font-bold mb-24" style={{ fontSize: '18px' }}>
              Did you understand the rules clearly?
            </p>
            <div className="flex-col gap-16">
              <button 
                className="btn btn-secondary" 
                onClick={() => handleUnderstand(true)}
              >
                YES, CRYSTAL CLEAR
              </button>
              <button 
                className="btn btn-outline" 
                onClick={() => handleUnderstand(false)}
              >
                NO, IT WAS CONFUSING
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-slide-up">
            <p className="text-body font-bold mb-8">Any complaints or suggestions?</p>
            <p className="text-caption mb-16">We value fairness above all. Be honest!</p>
            <textarea 
              className="feedback-textarea" 
              placeholder="e.g., The game started too fast..."
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleSubmit}>
              SUBMIT FEEDBACK
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
