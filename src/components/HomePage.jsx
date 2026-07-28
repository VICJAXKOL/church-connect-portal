'use client'

// Homepage: hero section and portal module cards
function HomePage({ onOpenFollowup, onOpenAttendance }) {
  return (
    <main className="reference-home">
      <section className="reference-home-hero">
        <div className="hero-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="10" width="40" height="6" rx="3" fill="#ef4660" />
            <rect x="4" y="19" width="40" height="6" rx="3" fill="#3157a8" />
            <rect x="4" y="28" width="40" height="6" rx="3" fill="#0dadd6" />
          </svg>
        </div>
        <span className="hero-kicker">Member Portal</span>
        <div className="reference-title">
          <h1>Glory Center Community Church</h1>
          <p>
            Welcome to Glory Center Community Church Igando, Choose a module below to get started.
          </p>
        </div>
      </section>
      <section className="reference-portal">
        <div className="slates">
          <button
            className="slate"
            onClick={onOpenFollowup}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
          >
            <div className="slate-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3>Follow-Up</h3>
            <p>Sign in to view and update member follow-up records.</p>
            <span className="slate-link">Sign in →</span>
          </button>
          <button
            className="slate"
            onClick={onOpenAttendance}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
          >
            <div className="slate-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <h3>Attendance</h3>
            <p>Log your attendance for services and gatherings.</p>
            <span className="slate-link">Open form →</span>
          </button>
        </div>
      </section>
    </main>
  )
}

export default HomePage
