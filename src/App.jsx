 'use client'

import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const starterPeople = [
  { id: 1, name: 'Esther Adebayo', phone: '+234 803 555 0142', email: 'esther.a@email.com', called: false, texted: false, status: 'Visiting member', service: 'Not yet recorded', note: '' },
  { id: 2, name: 'Daniel Okoro', phone: '+234 802 555 0198', email: 'daniel.o@email.com', called: false, texted: true, status: 'Intending member', service: 'Sunday service', note: 'Asked for service time and directions.' },
  { id: 3, name: 'Grace Mensah', phone: '+234 810 555 0167', email: 'grace.m@email.com', called: true, texted: false, status: 'Visiting member', service: 'Wednesday Bible Study', note: 'Enjoyed the welcome team.' },
]

const getStored = (key, fallback) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))

function App() {
  const [view, setView] = useState('home')
  const [team] = useState(() => getStored('cc-team', []))
  const [activeUser, setActiveUser] = useState(null)
  const [people, setPeople] = useState(() => getStored('cc-people', starterPeople))
  const [message, setMessage] = useState('')

  useEffect(() => localStorage.setItem('cc-people', JSON.stringify(people)), [people])

  const goHome = () => { setView('home'); setMessage('') }
  const updatePerson = (id, field, value) => setPeople((current) => current.map((person) => person.id === id ? { ...person, [field]: value } : person))

  const handleAuth = (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = data.get('name')?.trim()
    const code = data.get('code')?.trim().toUpperCase()
    const member = team.find((item) => item.code === code)
    if (!member) return setMessage('We could not find these credentials. Please check with your administrator.')
    if (name && member.name.toLowerCase() !== name.toLowerCase()) return setMessage('The name does not match these credentials.')
    setActiveUser(member); setView('dashboard'); setMessage('')
  }

  const submitAttendance = async (event) => {
    event.preventDefault()
    if (!isSupabaseConfigured) return setMessage('Attendance setup is not complete yet. Please add the Supabase environment values.')
    const form = event.currentTarget
    const data = new FormData(form)
    const { error } = await supabase.rpc('record_attendance', {
      p_full_name: data.get('fullName'),
      p_gender: data.get('gender'),
      p_worship_mode: data.get('mode'),
      p_service_day: data.get('service'),
      p_service_code: data.get('serviceCode'),
    })
    if (error) return setMessage(error.message)
    form.reset()
    setMessage('Attendance recorded. Thank you for joining us!')
  }

  if (view === 'followup') return <main className="auth-page reference-page"><section className="reference-hero"><button className="back" onClick={goHome}>← &nbsp;Back to portal</button><div className="reference-title"><div className="section-kicker">Follow-up</div><h1>Sign in to continue</h1><p>Enter your credentials to access the Follow-Up module.</p></div></section><div className="auth-card reference-card"><form onSubmit={handleAuth}><label>Name<input name="name" required placeholder="Your full name" /></label><label>Password<input name="code" type="password" required placeholder="••••••••" autoComplete="off" /></label>{message && <div className="form-message">{message}</div>}<button className="primary" type="submit">Login</button></form></div></main>

  if (view === 'dashboard') return <main className="dashboard"><header className="topbar"><button className="brand" onClick={goHome}><span className="brand-mark">✦</span> Connect</button><div className="user-menu"><span className="avatar">{activeUser.name.charAt(0)}</span><div><strong>{activeUser.name}</strong><small>Follow-up team</small></div><button className="signout" onClick={() => { setActiveUser(null); setView('followup') }}>Sign out</button></div></header><section className="dashboard-heading"><div><div className="section-kicker">Week of 13 July, 2026</div><h1>Your follow-up list</h1><p>Keep every person in your care connected and seen.</p></div><button className="primary" onClick={() => setMessage('Your weekly updates have been submitted successfully.')}>Submit weekly updates <span>→</span></button></section>{message && <div className="success-message">✓ {message}</div>}<section className="followup-table"><div className="table-caption"><span>{people.length} people assigned to you</span><span>Updates save automatically</span></div><div className="table-wrap"><table><thead><tr><th>Person</th><th>Called</th><th>Texted</th><th>Follow-up note</th><th>Status</th><th>Service attended</th></tr></thead><tbody>{people.map((person) => <tr key={person.id}><td><strong>{person.name}</strong><a href={`tel:${person.phone.replace(/\s/g, '')}`}>{person.phone}</a><a href={`mailto:${person.email}`}>{person.email}</a></td><td><button aria-label={`Mark ${person.name} as called`} className={`check ${person.called ? 'checked' : ''}`} onClick={() => updatePerson(person.id, 'called', !person.called)}>{person.called && '✓'}</button></td><td><button aria-label={`Mark ${person.name} as texted`} className={`check ${person.texted ? 'checked' : ''}`} onClick={() => updatePerson(person.id, 'texted', !person.texted)}>{person.texted && '✓'}</button></td><td><textarea aria-label={`Note for ${person.name}`} value={person.note} onChange={(e) => updatePerson(person.id, 'note', e.target.value)} placeholder="Add an update..." /></td><td><select value={person.status} onChange={(e) => updatePerson(person.id, 'status', e.target.value)}><option>Visiting member</option><option>Intending member</option><option>Member</option><option>Needs follow-up</option></select></td><td><select value={person.service} onChange={(e) => updatePerson(person.id, 'service', e.target.value)}><option>Not yet recorded</option><option>Sunday service</option><option>Wednesday Bible Study</option><option>Did not attend</option></select></td></tr>)}</tbody></table></div></section></main>

  if (view === 'attendance') return <main className="attendance-page reference-page"><section className="attendance-hero"><button className="back" onClick={goHome}>← &nbsp;Back to portal</button><div className="reference-title"><div className="section-kicker">Attendance</div><h1>Log your attendance</h1><p>Fill in your details below for today's service or gathering.</p></div></section><section className="attendance-card reference-card"><form onSubmit={submitAttendance}><label>Full Name<input required name="fullName" placeholder="e.g. Jane Doe" /></label><div className="form-grid"><label>Gender<select required name="gender" defaultValue=""><option value="" disabled>Select gender</option><option>Female</option><option>Male</option></select></label><label>Mode of Worship<select required name="mode" defaultValue=""><option value="" disabled>Select mode</option><option>Onsite</option><option>Online</option></select></label></div><label>Service Day<select required name="service" defaultValue=""><option value="" disabled>Select service</option><option>Sunday Service</option><option>Wednesday Bible Study</option></select></label><label>Unique Service Code <small>(optional)</small><input name="serviceCode" placeholder="Enter a code if one was provided" /><small>Codes are case-insensitive.</small></label>{message && <div className="success-message">✓ {message}</div>}<button className="primary" type="submit">Submit attendance</button></form></section></main>

  return <main className="home reference-home"><nav><button className="brand" onClick={goHome}><span className="brand-mark">≋</span></button><span className="nav-note">Member Portal</span></nav><section className="hero reference-home-hero"><div className="section-kicker">Member Portal</div><h1>Glory Center Community Church</h1><p>Welcome to Glory Center Community Church Igando, Choose a module below to get started.</p></section><section className="portal-section reference-portal"><div className="slates"><button className="slate followup-slate" onClick={() => { setView('followup'); setMessage('') }}><span className="slate-icon">♙</span><div><h3>Follow-Up</h3><p>Sign in to view and update member follow-up records.</p></div><span className="arrow">Sign in &nbsp;→</span></button><button className="slate attendance-slate" onClick={() => { setView('attendance'); setMessage('') }}><span className="slate-icon">▣</span><div><h3>Attendance</h3><p>Log your attendance for services and gatherings.</p></div><span className="arrow">Open form &nbsp;→</span></button></div></section></main>
}

export default App
