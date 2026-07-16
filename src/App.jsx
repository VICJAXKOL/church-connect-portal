'use client'

import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import {
  signupWorker,
  signinWorker,
  signoutWorker,
  getCurrentUser,
  getAssignedPeople,
  batchUpdateFollowups
} from './lib/supabaseAPI'

function App() {
  const [view, setView] = useState('home')
  const [authMode, setAuthMode] = useState('signin') // 'signin' or 'signup'
  const [activeUser, setActiveUser] = useState(null)
  const [people, setPeople] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)

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

  // ===== FOLLOW-UP AUTH FLOW =====
  const handleFollowupAuth = async (event) => {
    event.preventDefault()

    if (!isSupabaseConfigured) {
      setMessage('Supabase is not configured. Please add environment variables.')
      return
    }

    setLoading(true)
    const data = new FormData(event.currentTarget)
    const email = data.get('email')?.trim().toLowerCase()
    const password = data.get('password')?.trim()
    const fullName = data.get('name')?.trim()

    try {
      let result

      if (authMode === 'signup') {
        if (!fullName) {
          setMessage('Please provide your full name.')
          setLoading(false)
          return
        }
        result = await signupWorker(email, password, fullName)
      } else {
        result = await signinWorker(email, password)
      }

      if (!result.success) {
        setMessage(result.error)
        setLoading(false)
        return
      }

      if (authMode === 'signup') {
        setMessage('Account created! Check your email to verify, then sign in.')
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

  // ===== FOLLOW-UP DASHBOARD SUBMISSION =====
  const submitFollowupUpdates = async (event) => {
    event.preventDefault()

    if (!isSupabaseConfigured || !activeUser) {
      setMessage('Follow-up system is not fully set up. Please contact your administrator.')
      return
    }

    setLoading(true)
    try {
      // Collect all updated person records
      const formData = new FormData(event.currentTarget)
      const updates = []

      people.forEach((person) => {
        updates.push({
          assignmentId: person.assignmentId,
          called: formData.get(`person-${person.id}-called`) === 'true',
          texted: formData.get(`person-${person.id}-texted`) === 'true',
          note: formData.get(`person-${person.id}-note`) || '',
          status: formData.get(`person-${person.id}-status`) || person.status,
          service: formData.get(`person-${person.id}-service`) || person.service
        })
      })

      // Batch update to Supabase
      const result = await batchUpdateFollowups(updates)

      if (!result.success) {
        throw new Error(result.error)
      }

      setMessage(`✓ Weekly updates saved successfully for ${result.count} member${result.count > 1 ? 's' : ''}!`)
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage(err.message || 'Failed to save updates.')
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
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="you@example.com"
              required
            />

            {authMode === 'signup' && (
              <>
                <label htmlFor="name">Full Name</label>
                <input type="text" id="name" name="name" required />
              </>
            )}

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
    return (
      <main className="dashboard">
        <header className="topbar">
          <button className="brand" onClick={goHome}>
            <span className="brand-mark">✦</span> Connect
          </button>
          <div className="user-menu">
            <div>
              <strong>{activeUser.user_metadata?.full_name || activeUser.email?.split('@')[0]}</strong>
              <small>{activeUser.email}</small>
            </div>
            <div className="avatar">{(activeUser.user_metadata?.full_name || 'U').charAt(0).toUpperCase()}</div>
            <button className="signout" onClick={handleSignOut} disabled={loading}>
              Sign out
            </button>
          </div>
        </header>

        <div className="dashboard-heading">
          <div>
            <h1>Your Assignments</h1>
            <p>Update the status of your assigned members each week</p>
          </div>
          <button
            className="primary"
            onClick={() => document.querySelector('form')?.requestSubmit()}
            disabled={loading}
          >
            Submit Updates <span>→</span>
          </button>
        </div>

        {message && <div className={`success-message ${message.includes('Failed') ? 'form-message' : ''}`}>
          {message}
        </div>}

        <section className="followup-table">
          <div className="table-caption">
            <span>
              {people.length} member{people.length !== 1 ? 's' : ''} in your care
            </span>
            <span>Last updated: {new Date().toLocaleDateString()}</span>
          </div>
          <div className="table-wrap">
            <form onSubmit={submitFollowupUpdates}>
              <table>
                <thead>
                  <tr>
                    <th>Name & Contact</th>
                    <th>Note</th>
                    <th>Called</th>
                    <th>Texted</th>
                    <th>Member Status</th>
                    <th>Service Attended</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.id}>
                      <td>
                        <strong>{person.name}</strong>
                        <a href={`tel:${person.phone}`}>{person.phone}</a>
                        <a href={`mailto:${person.email}`}>{person.email}</a>
                      </td>
                      <td>
                        <textarea
                          name={`person-${person.id}-note`}
                          defaultValue={person.note}
                          onChange={(e) => updatePerson(person.id, 'note', e.target.value)}
                          placeholder="Add a note..."
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className={`check ${person.called ? 'checked' : ''}`}
                          onClick={() => updatePerson(person.id, 'called', !person.called)}
                        >
                          {person.called ? '✓' : ''}
                        </button>
                        <input
                          type="hidden"
                          name={`person-${person.id}-called`}
                          value={person.called ? 'true' : 'false'}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className={`check ${person.texted ? 'checked' : ''}`}
                          onClick={() => updatePerson(person.id, 'texted', !person.texted)}
                        >
                          {person.texted ? '✓' : ''}
                        </button>
                        <input
                          type="hidden"
                          name={`person-${person.id}-texted`}
                          value={person.texted ? 'true' : 'false'}
                        />
                      </td>
                      <td>
                        <select
                          name={`person-${person.id}-status`}
                          defaultValue={person.status}
                          onChange={(e) => updatePerson(person.id, 'status', e.target.value)}
                        >
                          <option>Visiting member</option>
                          <option>Intending member</option>
                          <option>Active member</option>
                          <option>Inactive</option>
                        </select>
                      </td>
                      <td>
                        <select
                          name={`person-${person.id}-service`}
                          defaultValue={person.service}
                          onChange={(e) => updatePerson(person.id, 'service', e.target.value)}
                        >
                          <option>Not yet recorded</option>
                          <option>Sunday Service</option>
                          <option>Wednesday Bible Study</option>
                          <option>Did not attend</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {people.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#748078' }}>
                  No members assigned yet. Contact your administrator.
                </div>
              )}
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <button
                  type="submit"
                  className="primary"
                  disabled={loading || people.length === 0}
                  style={{ maxWidth: '300px' }}
                >
                  {loading ? 'Saving...' : 'Submit Weekly Updates'}
                  <span>→</span>
                </button>
              </div>
            </form>
          </div>
        </section>
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
