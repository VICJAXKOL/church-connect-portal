'use client'

import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import {
  signupWorker,
  signinWorker,
  signoutWorker,
  getCurrentUser,
  getAssignedPeople,
  upsertFollowupUpdate
} from './lib/supabaseAPI'

// Get week start string YYYY-MM-DD for offset weeksAgo
const getWeekStartForOffset = (weeksAgo = 0) => {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) - (weeksAgo * 7)
  return new Date(today.setDate(diff)).toISOString().split('T')[0]
}

// Generate realistic mock people for demo/testing before real data is connected
const generateMockPeople = (count) => {
  const firstNames = ['Ugochukwu', 'Chinwe', 'Emeka', 'Ngozi', 'Olamide', 'Amina', 'Tunde', 'Fatima', 'Obinna', 'Yewande', 'Ikechukwu', 'Adaeze']
  const lastNames = ['Saviour', 'Okonkwo', 'Adeyemi', 'Okafor', 'Balogun', 'Ibrahim', 'Nwosu', 'Abubakar', 'Eze', 'Ajayi', 'Onwumere', 'Chukwu']
  const addresses = ['Vulcanizer', 'Market Road', 'Church Street', 'Ojuelegba', 'Ikeja', 'Yaba', 'Surulere', 'Ikoyi', 'Agege', 'Ikorodu']
  const genders = ['Male', 'Female']
  const statuses = ['Visiting member', 'Intending member', 'Active member', 'Inactive']

  return Array.from({ length: count }, (_, i) => {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
    const gender = genders[Math.floor(Math.random() * genders.length)]
    const phonePrefix = ['070', '080', '090', '081'][Math.floor(Math.random() * 4)]
    const phone = `${phonePrefix}${Math.floor(10000000 + Math.random() * 90000000)}`
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const address = addresses[Math.floor(Math.random() * addresses.length)]

    return {
      id: `${i}-${firstName.toLowerCase()}-${lastName.toLowerCase()}-${Date.now()}`,
      name: `${firstName} ${lastName}`,
      phone,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      gender,
      address,
      status,
      service: 'Not yet recorded',
      called: false,
      texted: false,
      note: '',
      feedback: '',
      assignmentId: `assignment-${i}-${Date.now()}`,
      updateId: null,
      weekStart: getWeekStartForOffset(0),
      allUpdates: []
    }
  })
}

function App() {
  const [view, setView] = useState('home')
  const [authMode, setAuthMode] = useState('signin') // 'signin' or 'signup'
  const [activeUser, setActiveUser] = useState(null)
  const [people, setPeople] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [unlockedCards, setUnlockedCards] = useState({})
  const [saveStatus, setSaveStatus] = useState({})
  console.log('App render view:', view, 'activeUser:', activeUser ? activeUser.id : null)

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (user) {
          setActiveUser(user)
          // Load their assigned people (fallback to mock data for preview)
          const assignedPeople = await getAssignedPeople(user.id)
          setPeople(assignedPeople.length > 0 ? assignedPeople : generateMockPeople(Math.floor(Math.random() * 3) + 1))
          setView('followup')
        }
      } catch (err) {
        console.error('Auth check failed:', err)
      } finally {
        setInitializing(false)
      }
    }

    if (isSupabaseConfigured) {
      checkAuth()
    } else {
      setTimeout(() => {
        setInitializing(false)
      }, 0)
    }
  }, [])

  const goHome = () => {
    setView('home')
    setMessage('')
    setAuthMode('signin')
  }

  const updatePerson = (id, field, value) => {
    setPeople((current) =>
      current.map((person) =>
        person.id === id ? { ...person, [field]: value } : person
      )
    )
  }

  // Convert worker's full name to a pseudo-email for seamless name-based login in Supabase
  const getPseudoEmail = (name) => {
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.')
    return `${clean}.gcccigando@gmail.com`
  }

  // Calculate dot color for a specific person on a specific week date
  const getDotColor = (person, dateStr) => {
    const up = (person.allUpdates || []).find(u => u.week_start === dateStr)
    if (!up) return 'grey'

    // Green: Active status, or valid attendance
    if (
      up.member_status === 'Active member' ||
      up.service_attendance === 'Sunday Service' ||
      up.service_attendance === 'Wednesday Bible Study'
    ) {
      return 'green'
    }

    // Orange: Contact attempted (called or texted)
    if (up.called || up.texted) {
      return 'orange'
    }

    return 'grey'
  }

  // Generate warm GCCC outreach links
  const getOutreachLinks = (person) => {
    const workerName = activeUser?.user_metadata?.full_name || 'Your GCCC Follow-up Worker'
    const memberName = person.name || 'Member'
    const messageText = `Hello ${memberName}! This is ${workerName} from Grace Covenant Christian Centre (GCCC). We are so glad to have you with us and wanted to check in to see how you are doing this week. Please let us know if there's any way we can pray for you or assist you! God bless you.`

    const cleanPhone = person.phone ? person.phone.replace(/[^0-9+]/g, '') : ''

    return {
      call: `tel:${cleanPhone}`,
      sms: `sms:${cleanPhone}?body=${encodeURIComponent(messageText)}`,
      whatsapp: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
    }
  }

  // Individual Card Saving to Supabase
  const saveCard = async (person) => {
    if (!isSupabaseConfigured || !activeUser) {
      setMessage('Follow-up system is not fully set up. Please contact your administrator.')
      return
    }

    if (activeUser.id === '00000000-0000-0000-0000-000000000000') {
      // Demo Mode save logic
      setSaveStatus(prev => ({ ...prev, [person.id]: 'saving' }))
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [person.id]: 'success' }))

        // Update local state update records so dots are refreshed
        const weekStart = getWeekStartForOffset(0)
        const updatedRecord = {
          id: 'mock-update-id',
          called: person.called,
          texted: person.texted,
          note: person.note,
          member_status: person.status,
          service_attendance: person.service,
          week_start: weekStart,
          updated_at: new Date().toISOString()
        }

        setPeople((current) =>
          current.map((p) => {
            if (p.id === person.id) {
              const existsIndex = (p.allUpdates || []).findIndex(u => u.week_start === updatedRecord.week_start)
              let newAllUpdates = [...(p.allUpdates || [])]
              if (existsIndex >= 0) {
                newAllUpdates[existsIndex] = updatedRecord
              } else {
                newAllUpdates.push(updatedRecord)
              }
              return {
                ...p,
                updateId: updatedRecord.id,
                weekStart: updatedRecord.week_start,
                allUpdates: newAllUpdates
              }
            }
            return p
          })
        )

        setTimeout(() => {
          setSaveStatus(prev => ({ ...prev, [person.id]: 'idle' }))
        }, 2000)

        // Lock card again
        setUnlockedCards(prev => ({ ...prev, [person.id]: false }))
      }, 600)
      return
    }

    setSaveStatus(prev => ({ ...prev, [person.id]: 'saving' }))
    try {
      const result = await upsertFollowupUpdate(
        person.assignmentId,
        person.called,
        person.texted,
        person.note,
        person.status,
        person.service
      )

      if (!result.success) {
        throw new Error(result.error)
      }

      setSaveStatus(prev => ({ ...prev, [person.id]: 'success' }))

      // Clear success after 2 seconds
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [person.id]: 'idle' }))
      }, 2000)

      // Merge the new update record into local state person.allUpdates
      const updatedRecord = result.data
      setPeople((current) =>
        current.map((p) => {
          if (p.id === person.id) {
            const existsIndex = (p.allUpdates || []).findIndex(u => u.week_start === updatedRecord.week_start)
            let newAllUpdates = [...(p.allUpdates || [])]
            if (existsIndex >= 0) {
              newAllUpdates[existsIndex] = updatedRecord
            } else {
              newAllUpdates.push(updatedRecord)
            }
            return {
              ...p,
              updateId: updatedRecord.id,
              weekStart: updatedRecord.week_start,
              allUpdates: newAllUpdates
            }
          }
          return p
        })
      )

      // Lock the card
      setUnlockedCards(prev => ({ ...prev, [person.id]: false }))

    } catch (err) {
      console.error('Save card failed:', err)
      setSaveStatus(prev => ({ ...prev, [person.id]: 'error' }))
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [person.id]: 'idle' }))
      }, 3000)
    }
  }

  // ===== FOLLOW-UP AUTH FLOW =====
  const handleFollowupAuth = async (event) => {
    event.preventDefault()

    if (!isSupabaseConfigured) {
      setMessage('Supabase is not configured. Please add environment variables.')
      return
    }

    setLoading(true)
    const data = new FormData(event.currentTarget)
    const fullName = data.get('name')?.trim()
    const password = data.get('password')?.trim()

    if (!fullName || !password) {
      setMessage('Please enter both name and password.')
      setLoading(false)
      return
    }

    const email = getPseudoEmail(fullName)
    console.log('handleFollowupAuth name:', fullName, 'email:', email)

    try {
      let result

      if (authMode === 'signup') {
        result = await signupWorker(email, password, fullName)
      } else {
        result = await signinWorker(email, password)
      }

      if (!result.success) {
        // Fallback for local testing if rate limited or invalid config
        if (fullName.toLowerCase().includes('demo') || fullName.toLowerCase().includes('test')) {
          console.log('Using local demo fallback login for testing...');
          const mockUser = {
            id: '00000000-0000-0000-0000-000000000000',
            email: email,
            user_metadata: { full_name: fullName }
          }
          setActiveUser(mockUser)
          const mockAssigned = generateMockPeople(Math.floor(Math.random() * 3) + 1)
          setPeople(mockAssigned)
          setView('followup')
          setMessage('Welcome! (Demo Mode Fallback)')
          setLoading(false)
          return
        }

        let friendlyError = result.error
        const errorLower = result.error ? result.error.toLowerCase() : ''

        if (errorLower.includes('fetch') || errorLower.includes('network') || errorLower.includes('offline') || errorLower.includes('name_not_resolved')) {
          friendlyError = (
            <div style={{ textAlign: 'left', marginTop: '12px', padding: '12px', fontSize: '13px', lineHeight: '1.45', background: '#fff5f5', border: '1px solid #ffc9c9', borderRadius: '8px', color: '#c53030' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚠️ Connection Error</div>
              Unable to connect to the follow-up server. Please check your internet connection and try again.
              <div style={{ fontSize: '11px', marginTop: '6px', color: '#c53030', borderTop: '1px dashed #ffc9c9', paddingTop: '6px' }}>
                <strong>Tip:</strong> To test without a server, sign in with a name containing "demo" or "test".
              </div>
            </div>
          )
        } else if (errorLower.includes('email not confirmed') || errorLower.includes('confirm')) {
          friendlyError = (
            <div style={{ textAlign: 'left', marginTop: '12px', padding: '12px', fontSize: '13px', lineHeight: '1.45', background: '#fff5f5', border: '1px solid #ffc9c9', borderRadius: '8px', color: '#c53030' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚠️ Email Confirmation Required</div>
              Supabase Auth requires email confirmation by default. To sign in with Name & Password:
              <ol style={{ margin: '8px 0 0 16px', padding: 0, listStyleType: 'decimal' }}>
                <li>Go to your <strong>Supabase Dashboard</strong>.</li>
                <li>Navigate to <strong>Authentication &gt; Providers &gt; Email</strong>.</li>
                <li>Toggle <strong>"Confirm email" to OFF</strong> and click <strong>Save</strong>.</li>
              </ol>
            </div>
          )
        }

        setMessage(friendlyError)
        setLoading(false)
        return
      }

      if (authMode === 'signup') {
        setMessage(
          <div style={{ textAlign: 'left', marginTop: '12px', padding: '12px', fontSize: '13px', lineHeight: '1.45', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>✓ Account created!</div>
            Please sign in using your Full Name & Password.
            <div style={{ fontSize: '11px', marginTop: '6px', color: '#15803d', borderTop: '1px dashed #bbf7d0', paddingTop: '6px' }}>
              <strong>Note:</strong> If you get "Email not confirmed" on sign in, please toggle OFF "Confirm email" in your Supabase Auth settings.
            </div>
          </div>
        )
        setAuthMode('signin')
      } else {
        // Get current user and their assigned people
        const user = await getCurrentUser()
        if (user) {
          setActiveUser(user)
          const assignedPeople = await getAssignedPeople(user.id)
          setPeople(assignedPeople.length > 0 ? assignedPeople : generateMockPeople(Math.floor(Math.random() * 3) + 1))
          setView('followup')
          setMessage('')
        }
      }
    } catch (err) {
      setMessage(err.message || 'Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ===== ATTENDANCE FLOW =====
  const submitAttendance = async (event) => {
    event.preventDefault()

    if (!isSupabaseConfigured) {
      setMessage('Attendance setup is not complete yet. Please add the Supabase environment values.')
      return
    }

    setLoading(true)
    const form = event.currentTarget
    const data = new FormData(form)

    try {
      const { error } = await supabase.rpc('record_attendance', {
        p_full_name: data.get('fullName'),
        p_gender: data.get('gender'),
        p_worship_mode: data.get('mode'),
        p_service_day: data.get('service'),
        p_service_code: '',
      })

      if (error) throw error

      form.reset()
      setMessage('Attendance recorded|Thank you for joining us. God bless you!')
      setTimeout(() => goHome(), 3000)
    } catch (err) {
      setMessage(err.message || 'Failed to record attendance.')
    } finally {
      setLoading(false)
    }
  }

  // ===== SIGN OUT =====
  const handleSignOut = async () => {
    setLoading(true)
    try {
      const result = await signoutWorker()
      if (result.success) {
        setActiveUser(null)
        setPeople([])
        goHome()
      } else {
        setMessage(result.error)
      }
    } catch (err) {
      console.error('Sign out error:', err)
      setMessage('Sign out failed')
    } finally {
      setLoading(false)
    }
  }

  // ===== VIEWS =====

  if (initializing) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#fbfaf5' }}>
        <div style={{ textAlign: 'center', color: '#748078' }}>
          <p style={{ fontSize: '18px', marginBottom: '10px' }}>Loading...</p>
        </div>
      </main>
    )
  }

  // HOME VIEW
  if (view === 'home') {
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
              onClick={() => setView('followup')}
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
              onClick={() => setView('attendance')}
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

  // FOLLOW-UP AUTH VIEW (Sign in / Sign up)
  if (view === 'followup' && !activeUser) {
    return (
      <main className="auth-page reference-page">
        <section className="reference-hero">
          <button className="back" onClick={goHome}>
            ← &nbsp;Back to portal
          </button>
          <div className="reference-title">
            <span className="section-kicker">Follow-up Team</span>
            <h1>{authMode === 'signup' ? 'Create Your Account' : 'Welcome Back'}</h1>
            <p>
              {authMode === 'signup'
                ? 'Create an account to start managing your follow-ups.'
                : 'Enter your credentials to access your assignments.'}
            </p>
          </div>
        </section>
        <div className="auth-card reference-card">
          <div className="auth-switch">
            <button
              className={authMode === 'signin' ? 'active' : ''}
              onClick={() => { setAuthMode('signin'); setMessage('') }}
            >
              Sign In
            </button>
            <button
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => { setAuthMode('signup'); setMessage('') }}
            >
              Sign Up
            </button>
          </div>
          <form onSubmit={handleFollowupAuth}>
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="Enter your full name"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Min. 6 characters"
              required
            />

            {message && <div className="form-message">{message}</div>}

            <button type="submit" className="primary" disabled={loading}>
              {loading ? (authMode === 'signup' ? 'Creating...' : 'Signing in...') : (authMode === 'signup' ? 'Create Account' : 'Sign In')}
              <span>→</span>
            </button>
          </form>
          <small>
            {authMode === 'signup'
              ? 'Already have an account? Switch to Sign In above.'
              : "Don't have an account? Ask your administrator or create one above."}
          </small>
        </div>
      </main>
    )
  }

  // FOLLOW-UP DASHBOARD VIEW
  if (view === 'followup' && activeUser) {
    const trackerWeeks = [3, 2, 1, 0].map((weeksAgo) => {
      const dateStr = getWeekStartForOffset(weeksAgo)
      let label = ''
      if (weeksAgo === 0) label = 'This Wk'
      else if (weeksAgo === 1) label = '1 Wk Ago'
      else if (weeksAgo === 2) label = '2 Wks Ago'
      else if (weeksAgo === 3) label = '3 Wks Ago'
      return { weeksAgo, dateStr, label }
    })

    return (
      <main className="followup-dashboard">
        <header className="followup-hero">
          <div className="followup-hero-top">
            <button className="followup-back" onClick={goHome}>← Back</button>
            <div className="followup-hero-actions">
              <button className="followup-refresh" onClick={() => window.location.reload()}>↻ Refresh</button>
              <button className="followup-signout" onClick={handleSignOut} disabled={loading}>Sign out</button>
            </div>
          </div>
          <div className="followup-hero-content">
            <span className="followup-kicker">FOLLOWUP MODULE</span>
            <h1>Welcome, {activeUser.user_metadata?.full_name || 'Follow-up Worker'}</h1>
            <p>You have {people.length} assigned number{people.length !== 1 ? 's' : ''}.</p>
          </div>
        </header>

        {message && (
          <div className="followup-message-banner">
            {message}
          </div>
        )}

        <div className="followup-cards">
          {people.map((person) => {
            const isUnlocked = Boolean(unlockedCards[person.id])
            const currentSaveStatus = saveStatus[person.id] || 'idle'
            const links = getOutreachLinks(person)
            const hasPhone = Boolean(person.phone && person.phone.trim())

            return (
              <div key={person.id} className={`followup-card ${isUnlocked ? 'unlocked' : ''}`}>
                {/* 4-dot tracker */}
                <div className="card-top-dots">
                  {trackerWeeks.map((wk) => {
                    const colorClass = getDotColor(person, wk.dateStr)
                    return (
                      <span
                        key={wk.weeksAgo}
                        className={`card-top-dot ${colorClass}`}
                        title={`${wk.label}: ${wk.dateStr}`}
                      />
                    )
                  })}
                </div>

                <h2 className="card-person-name">{person.name}</h2>
                <span className="card-status-badge">{person.status}</span>

                <div className="card-fields">
                  <div className="card-field">
                    <span className="card-field-label">Phone Number:</span>
                    <span className="card-field-value">{hasPhone ? person.phone : 'Not available'}</span>
                  </div>
                  <div className="card-field">
                    <span className="card-field-label">Gender:</span>
                    <span className="card-field-value">{person.gender || 'Not specified'}</span>
                  </div>
                  <div className="card-field">
                    <span className="card-field-label">Address:</span>
                    <span className="card-field-value">{person.address || 'Not specified'}</span>
                  </div>
                </div>

                <div className="card-feedback">
                  <div className="card-feedback-header">
                    <span>Feedback:</span>
                    <button
                      type="button"
                      className="card-edit-btn"
                      onClick={() => setUnlockedCards(prev => ({ ...prev, [person.id]: !isUnlocked }))}
                    >
                      {isUnlocked ? 'Cancel' : '✎ Edit'}
                    </button>
                  </div>
                  <p className="card-feedback-text">{person.note || person.feedback || 'No feedback yet.'}</p>
                </div>

                {isUnlocked && (
                  <div className="card-form-section">
                    <div className="card-form-grid">
                      <div className="form-group inline-check">
                        <button
                          type="button"
                          className={`check ${person.called ? 'checked' : ''}`}
                          onClick={() => updatePerson(person.id, 'called', !person.called)}
                        >
                          {person.called ? '✓' : ''}
                        </button>
                        <span>Called</span>
                      </div>
                      <div className="form-group inline-check">
                        <button
                          type="button"
                          className={`check ${person.texted ? 'checked' : ''}`}
                          onClick={() => updatePerson(person.id, 'texted', !person.texted)}
                        >
                          {person.texted ? '✓' : ''}
                        </button>
                        <span>Texted</span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Member Status</label>
                      <select
                        value={person.status}
                        onChange={(e) => updatePerson(person.id, 'status', e.target.value)}
                      >
                        <option value="Visiting member">Visiting member</option>
                        <option value="Intending member">Intending member</option>
                        <option value="Active member">Active member</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Service Attended</label>
                      <select
                        value={person.service}
                        onChange={(e) => updatePerson(person.id, 'service', e.target.value)}
                      >
                        <option value="Not yet recorded">Not yet recorded</option>
                        <option value="Sunday Service">Sunday Service</option>
                        <option value="Wednesday Bible Study">Wednesday Bible Study</option>
                        <option value="Did not attend">Did not attend</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Note / Feedback</label>
                      <textarea
                        value={person.note || person.feedback || ''}
                        onChange={(e) => {
                          updatePerson(person.id, 'note', e.target.value)
                          updatePerson(person.id, 'feedback', e.target.value)
                        }}
                        placeholder="Add a note..."
                      />
                    </div>

                    <button
                      type="button"
                      className={`card-save-btn ${currentSaveStatus === 'success' ? 'success' : ''}`}
                      disabled={currentSaveStatus === 'saving'}
                      onClick={() => saveCard(person)}
                    >
                      {currentSaveStatus === 'saving' && '⏳ Saving...'}
                      {currentSaveStatus === 'success' && '✓ Saved!'}
                      {currentSaveStatus === 'error' && '❌ Error Saving'}
                      {currentSaveStatus === 'idle' && '💾 Save Changes'}
                    </button>
                  </div>
                )}

                <div className="card-actions">
                  {hasPhone ? (
                    <>
                      <a
                        href={links.call}
                        className="card-action-btn call"
                        onClick={() => updatePerson(person.id, 'called', true)}
                      >
                        📞
                      </a>
                      <a
                        href={links.sms}
                        className="card-action-btn sms"
                        onClick={() => updatePerson(person.id, 'texted', true)}
                      >
                        💬
                      </a>
                      <a
                        href={links.whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="card-action-btn whatsapp"
                        onClick={() => updatePerson(person.id, 'texted', true)}
                      >
                        🟢
                      </a>
                    </>
                  ) : (
                    <button type="button" className="card-action-btn" disabled>
                      📵
                    </button>
                  )}
                  <button
                    type="button"
                    className="card-action-btn note"
                    onClick={() => setUnlockedCards(prev => ({ ...prev, [person.id]: !isUnlocked }))}
                  >
                    📝
                  </button>
                </div>
              </div>
            )
          })}

          {people.length === 0 && (
            <div className="no-assignments">
              No members assigned yet. Contact your administrator.
            </div>
          )}
        </div>
      </main>
    )
  }

  // ATTENDANCE VIEW
  if (view === 'attendance') {
    return (
      <main className="attendance-page reference-page">
        <section className="attendance-hero">
          <button className="back" onClick={goHome}>
            ← &nbsp;Back to portal
          </button>
          <div className="reference-title">
            <span className="section-kicker">Record Your Presence</span>
            <h1>Church Attendance</h1>
            <p>Fill in your details below to mark your attendance for today's service.</p>
          </div>
        </section>
        <div className="attendance-card reference-card">
          <form onSubmit={submitAttendance}>
            <div className="form-grid">
              <div>
                <label htmlFor="fullName">Full Name *</label>
                <input type="text" id="fullName" name="fullName" required />
              </div>
              <div>
                <label htmlFor="gender">Gender *</label>
                <select id="gender" name="gender" required>
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <label htmlFor="mode">Mode of Joining *</label>
            <select id="mode" name="mode" required>
              <option value="">Select mode</option>
              <option value="Onsite">Onsite</option>
              <option value="Online">Online</option>
            </select>

            <label htmlFor="service">Service Attended *</label>
            <select id="service" name="service" required>
              <option value="">Select service</option>
              <option value="Sunday Service">Sunday Service</option>
              <option value="Wednesday Bible Study">Wednesday Bible Study</option>
            </select>

            <label htmlFor="serviceCode">Attendance Code</label>
            <input
              type="text"
              id="serviceCode"
              name="serviceCode"
              placeholder="Enter attendance code"
            />

            {message && (
              message.includes('|') ? (
                <div className="attendance-success-banner">
                  <div className="success-icon">✓</div>
                  <div className="success-text">
                    <strong>{message.split('|')[0]}</strong>
                    <span>{message.split('|')[1]}</span>
                  </div>
                </div>
              ) : (
                <div className={`form-message ${message.includes('Thank you') ? 'success-message' : ''}`}>
                  {message}
                </div>
              )
            )}

            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Recording...' : 'Record Attendance'}
              <span>→</span>
            </button>
          </form>
        </div>
      </main>
    )
  }

  return null
}

export default App
