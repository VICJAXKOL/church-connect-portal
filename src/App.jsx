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
          // Load their assigned people
          const assignedPeople = await getAssignedPeople(user.id)
          setPeople(assignedPeople)
          setView('dashboard')
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

  // Get week start string YYYY-MM-DD for offset weeksAgo
  const getWeekStartForOffset = (weeksAgo = 0) => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) - (weeksAgo * 7) // Adjust to Monday and subtract weeks
    return new Date(today.setDate(diff)).toISOString().split('T')[0]
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
          const mockAssigned = [
            {
              id: '11111111-1111-1111-1111-111111111111',
              name: 'John Doe',
              phone: '+1234567890',
              email: 'johndoe@example.com',
              status: 'Visiting member',
              service: 'Not yet recorded',
              called: false,
              texted: false,
              note: '',
              assignmentId: '22222222-2222-2222-2222-222222222222',
              updateId: null,
              weekStart: getWeekStartForOffset(0),
              allUpdates: [
                { week_start: getWeekStartForOffset(1), called: true, texted: false, member_status: 'Visiting member', service_attendance: 'Not yet recorded' },
                { week_start: getWeekStartForOffset(2), called: true, texted: true, member_status: 'Active member', service_attendance: 'Sunday Service' }
              ]
            },
            {
              id: '33333333-3333-3333-3333-333333333333',
              name: 'Sarah Smith',
              phone: '+1987654321',
              email: 'sarah@example.com',
              status: 'Active member',
              service: 'Sunday Service',
              called: false,
              texted: false,
              note: 'Doing great!',
              assignmentId: '44444444-4444-4444-4444-444444444444',
              updateId: null,
              weekStart: getWeekStartForOffset(0),
              allUpdates: [
                { week_start: getWeekStartForOffset(0), called: false, texted: false, member_status: 'Active member', service_attendance: 'Sunday Service' },
                { week_start: getWeekStartForOffset(1), called: false, texted: false, member_status: 'Active member', service_attendance: 'Sunday Service' },
                { week_start: getWeekStartForOffset(2), called: false, texted: false, member_status: 'Active member', service_attendance: 'Sunday Service' },
                { week_start: getWeekStartForOffset(3), called: false, texted: false, member_status: 'Active member', service_attendance: 'Sunday Service' }
              ]
            }
          ]
          setPeople(mockAssigned)
          setView('followup')
          setMessage('Welcome! (Demo Mode Fallback)')
          setLoading(false)
          return
        }

        setMessage(result.error)
        setLoading(false)
        return
      }

      if (authMode === 'signup') {
        setMessage('Account created! You can now sign in.')
        setAuthMode('signin')
      } else {
        // Get current user and their assigned people
        const user = await getCurrentUser()
        if (user) {
          setActiveUser(user)
          const assignedPeople = await getAssignedPeople(user.id)
          setPeople(assignedPeople)
          setView('dashboard')
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
        p_service_code: data.get('serviceCode'),
      })

      if (error) throw error

      form.reset()
      setMessage('Attendance recorded. Thank you for joining us!')
      setTimeout(() => goHome(), 2000)
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
        <nav>
          <button className="brand" onClick={goHome}>
            <span className="brand-mark">✦</span> Connect
          </button>
          <span className="nav-note">Member Portal</span>
        </nav>
        <section className="reference-home-hero">
          <div className="reference-title">
            <span className="section-kicker">Welcome to</span>
            <h1>Glory Center <em>Community</em> Church</h1>
            <p>
              Connect with our community through follow-up care, attendance tracking, and
              member updates. Choose how you'd like to engage.
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
              <div className="slate-icon">👥</div>
              <h3>Follow-up Team</h3>
              <p>Clock in as a follow-up worker and manage your assigned members.</p>
              <span className="arrow">→</span>
            </button>
            <button
              className="slate"
              onClick={() => setView('attendance')}
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
            >
              <div className="slate-icon">✓</div>
              <h3>Attendance</h3>
              <p>Record your attendance for today's service.</p>
              <span className="arrow">→</span>
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
      <main className="mobile-dashboard-wrap">
        <div className="mobile-dashboard-container">
          <header className="mobile-topbar">
            <button className="brand" onClick={goHome}>
              <span className="brand-mark">✦</span> Connect
            </button>
            <div className="user-menu">
              <div className="avatar">{(activeUser.user_metadata?.full_name || 'U').charAt(0).toUpperCase()}</div>
              <button className="signout-btn" onClick={handleSignOut} disabled={loading}>
                Sign out
              </button>
            </div>
          </header>

          <div className="mobile-heading">
            <h1>Your Assignments</h1>
            <p>Update status for each assigned member</p>
            <div className="stats-text">
              {people.length} member{people.length !== 1 ? 's' : ''} in your care
            </div>
          </div>

          {message && (
            <div style={{ padding: '10px', fontSize: '13px', borderRadius: '8px', background: message.includes('failed') || message.includes('Failed') ? '#fdf2e9' : '#eef4ed', border: '1px solid', borderColor: message.includes('failed') || message.includes('Failed') ? '#f4e1d1' : '#dbe9d8', color: '#24382e' }}>
              {message}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '32px' }}>
            {people.map((person) => {
              const isUnlocked = Boolean(unlockedCards[person.id])
              const currentSaveStatus = saveStatus[person.id] || 'idle'
              const links = getOutreachLinks(person)
              const hasPhone = Boolean(person.phone && person.phone.trim())

              return (
                <div key={person.id} className={`contact-card ${isUnlocked ? 'unlocked' : ''}`}>
                  <div className="card-top">
                    <div className="card-info">
                      <div className="card-name">{person.name}</div>
                      {hasPhone ? (
                        <a href={`tel:${person.phone}`} className="card-phone">📞 {person.phone}</a>
                      ) : (
                        <span className="card-phone" style={{ color: '#9ca39b' }}>No phone available</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`card-lock-btn ${isUnlocked ? 'unlocked-state' : ''}`}
                      onClick={() => {
                        setUnlockedCards(prev => ({ ...prev, [person.id]: !isUnlocked }))
                      }}
                    >
                      {isUnlocked ? '🔓 Unlocked' : '🔒 Locked'}
                    </button>
                  </div>

                  {/* 4-dot tracker row */}
                  <div className="tracker-row">
                    <div className="tracker-row-header">
                      <span>4-Week History</span>
                      <span style={{ fontSize: '9px', fontWeight: 'normal' }}>Older → Newer</span>
                    </div>
                    <div className="tracker-dots">
                      {trackerWeeks.map((wk) => {
                        const colorClass = getDotColor(person, wk.dateStr)
                        return (
                          <div key={wk.weeksAgo} className="tracker-dot-container" title={`${wk.label}: ${wk.dateStr}`}>
                            <span className={`tracker-dot ${colorClass}`}></span>
                            <span className="tracker-dot-label">{wk.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Outreach buttons */}
                  <div className="outreach-row">
                    {hasPhone ? (
                      <>
                        <a
                          href={links.call}
                          className="outreach-btn call-btn"
                          onClick={() => {
                            setUnlockedCards(prev => ({ ...prev, [person.id]: true }))
                            updatePerson(person.id, 'called', true)
                          }}
                        >
                          📞 Call
                        </a>
                        <a
                          href={links.sms}
                          className="outreach-btn sms-btn"
                          onClick={() => {
                            setUnlockedCards(prev => ({ ...prev, [person.id]: true }))
                            updatePerson(person.id, 'texted', true)
                          }}
                        >
                          💬 SMS
                        </a>
                        <a
                          href={links.whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="outreach-btn wa-btn"
                          onClick={() => {
                            setUnlockedCards(prev => ({ ...prev, [person.id]: true }))
                            updatePerson(person.id, 'texted', true)
                          }}
                        >
                          🟢 WA
                        </a>
                      </>
                    ) : (
                      <div style={{ width: '100%', textAlign: 'center', fontSize: '11px', color: '#748078', padding: '10px 0' }}>
                        Add phone number to enable quick outreach options.
                      </div>
                    )}
                  </div>

                  {/* Form fields */}
                  <div className="card-form">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <button
                          type="button"
                          className={`check ${person.called ? 'checked' : ''}`}
                          disabled={!isUnlocked}
                          onClick={() => updatePerson(person.id, 'called', !person.called)}
                          style={{ margin: 0 }}
                        >
                          {person.called ? '✓' : ''}
                        </button>
                        <span onClick={() => isUnlocked && updatePerson(person.id, 'called', !person.called)} style={{ fontSize: '12px', fontWeight: 600, color: '#24382e', userSelect: 'none' }}>Called</span>
                      </div>

                      <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <button
                          type="button"
                          className={`check ${person.texted ? 'checked' : ''}`}
                          disabled={!isUnlocked}
                          onClick={() => updatePerson(person.id, 'texted', !person.texted)}
                          style={{ margin: 0 }}
                        >
                          {person.texted ? '✓' : ''}
                        </button>
                        <span onClick={() => isUnlocked && updatePerson(person.id, 'texted', !person.texted)} style={{ fontSize: '12px', fontWeight: 600, color: '#24382e', userSelect: 'none' }}>Texted</span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Member Status</label>
                      <select
                        value={person.status}
                        disabled={!isUnlocked}
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
                        disabled={!isUnlocked}
                        onChange={(e) => updatePerson(person.id, 'service', e.target.value)}
                      >
                        <option value="Not yet recorded">Not yet recorded</option>
                        <option value="Sunday Service">Sunday Service</option>
                        <option value="Wednesday Bible Study">Wednesday Bible Study</option>
                        <option value="Did not attend">Did not attend</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Note</label>
                      <textarea
                        value={person.note}
                        disabled={!isUnlocked}
                        onChange={(e) => updatePerson(person.id, 'note', e.target.value)}
                        placeholder="Add a note..."
                      />
                    </div>

                    <button
                      type="button"
                      className={`card-save-btn ${currentSaveStatus === 'success' ? 'success' : ''}`}
                      disabled={!isUnlocked || currentSaveStatus === 'saving'}
                      onClick={() => saveCard(person)}
                    >
                      {currentSaveStatus === 'saving' && '⏳ Saving...'}
                      {currentSaveStatus === 'success' && '✓ Saved!'}
                      {currentSaveStatus === 'error' && '❌ Error Saving'}
                      {currentSaveStatus === 'idle' && '💾 Save Changes'}
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
              <div className={`form-message ${message.includes('Thank you') ? 'success-message' : ''}`}>
                {message}
              </div>
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
