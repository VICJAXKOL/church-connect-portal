'use client'

import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const getStored = (key, fallback) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))

function App() {
  const [view, setView] = useState('home')
  const [authMode, setAuthMode] = useState('signin') // 'signin' or 'signup'
  const [activeUser, setActiveUser] = useState(null)
  const [people, setPeople] = useState(() => getStored('cc-people', []))
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // Sync people to localStorage
  useEffect(() => localStorage.setItem('cc-people', JSON.stringify(people)), [people])

  const goHome = () => { setView('home'); setMessage(''); setAuthMode('signin') }

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
    const data = new FormData(event.currentTarget)
    const name = data.get('name')?.trim()
    const code = data.get('code')?.trim().toUpperCase()

    if (!name || !code) {
      setMessage('Please fill in all fields.')
      return
    }

    if (authMode === 'signup') {
      // Create new user with code
      const team = getStored('cc-team', [])
      const exists = team.find((item) => item.code === code)

      if (exists) {
        setMessage('This code already exists. Please choose a different one.')
        return
      }

      const newMember = { id: Date.now(), name, code }
      const updatedTeam = [...team, newMember]
      localStorage.setItem('cc-team', JSON.stringify(updatedTeam))

      setActiveUser(newMember)
      setView('dashboard')
      setAuthMode('signin')
      setMessage('')
    } else {
      // Sign in with existing code
      const team = getStored('cc-team', [])
      const member = team.find((item) => item.code === code)

      if (!member) {
        setMessage('We could not find these credentials. Please check with your administrator.')
        return
      }

      if (member.name.toLowerCase() !== name.toLowerCase()) {
        setMessage('The name does not match these credentials.')
        return
      }

      setActiveUser(member)
      setView('dashboard')
      setMessage('')
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

    if (!isSupabaseConfigured) {
      setMessage('Follow-up system is not fully set up. Please contact your administrator.')
      return
    }

    setLoading(true)
    try {
      // Collect all updated person records from the form
      const formData = new FormData(event.currentTarget)
      const updates = []

      for (const [key, value] of formData.entries()) {
        if (key.startsWith('person-')) {
          const [_, personId, field] = key.split('-')
          const updateIndex = updates.findIndex((u) => u.personId === personId)

          if (updateIndex === -1) {
            updates.push({ personId, [field]: value })
          } else {
            updates[updateIndex][field] = value
          }
        }
      }

      // Update local state
      updates.forEach((update) => {
        const person = people.find((p) => String(p.id) === update.personId)
        if (person) {
          Object.keys(update).forEach((key) => {
            if (key !== 'personId') {
              updatePerson(person.id, key, update[key])
            }
          })
        }
      })

      setMessage('Follow-up updates saved successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage(err.message || 'Failed to save updates.')
    } finally {
      setLoading(false)
    }
  }

  // ===== SIGN OUT =====
  const handleSignOut = () => {
    setActiveUser(null)
    goHome()
  }

  // ===== VIEWS =====

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
                ? 'Create a unique code to start managing your follow-ups.'
                : 'Enter your details to access your follow-up assignments.'}
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
              Create Code
            </button>
          </div>
          <form onSubmit={handleFollowupAuth}>
            <label htmlFor="name">Full Name</label>
            <input type="text" id="name" name="name" required />

            <label htmlFor="code">{authMode === 'signup' ? 'New Code' : 'Your Code'}</label>
            <input
              type="text"
              id="code"
              name="code"
              placeholder="e.g., WORKER-001"
              required
            />

            {message && <div className="form-message">{message}</div>}

            <button type="submit" className="primary">
              {authMode === 'signup' ? 'Create Code' : 'Sign In'}
              <span>→</span>
            </button>
          </form>
          <small>
            {authMode === 'signup'
              ? 'Already have a code? Switch to Sign In above.'
              : "Don't have a code? Ask your administrator or create one above."}
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
              <strong>{activeUser.name}</strong>
              <small>{activeUser.code}</small>
            </div>
            <div className="avatar">{activeUser.name.charAt(0).toUpperCase()}</div>
            <button className="signout" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        <div className="dashboard-heading">
          <div>
            <h1>Your Assignments</h1>
            <p>Update the status of your assigned members each week</p>
          </div>
          <button className="primary" onClick={() => document.querySelector('form')?.requestSubmit()}>
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
                          value={person.status}
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
                          value={person.service}
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
                  disabled={loading}
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

            <label htmlFor="serviceCode">Service Code (if provided)</label>
            <input
              type="text"
              id="serviceCode"
              name="serviceCode"
              placeholder="Ask usher for code"
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
