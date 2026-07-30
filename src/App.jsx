'use client'

import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from './lib/supabase'
import { getCurrentUser, getAssignedPeople } from './lib/supabaseAPI'
import { generateMockPeople } from './lib/helpers'
import HomePage from './components/HomePage'
import FollowUpPage from './components/FollowUpPage'
import AttendancePage from './components/AttendancePage'

// App shell: holds shared session state and routes between page views
function App() {
  const [view, setView] = useState('home') // 'home' | 'followup' | 'attendance'
  const [activeUser, setActiveUser] = useState(null)
  const [people, setPeople] = useState([])
  const [initializing, setInitializing] = useState(true)

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

  const goHome = () => setView('home')

  const handleAuthenticated = (user, assignedPeople) => {
    setActiveUser(user)
    setPeople(assignedPeople)
    setView('followup')
  }

  const handleSignedOut = () => {
    setActiveUser(null)
    setPeople([])
    setView('home')
  }

  if (initializing) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#fbfaf5' }}>
        <div style={{ textAlign: 'center', color: '#748078' }}>
          <p style={{ fontSize: '18px', marginBottom: '10px' }}>Loading...</p>
        </div>
      </main>
    )
  }

  if (view === 'followup') {
    return (
      <FollowUpPage
        activeUser={activeUser}
        people={people}
        setPeople={setPeople}
        onAuthenticated={handleAuthenticated}
        onSignedOut={handleSignedOut}
        onBack={goHome}
      />
    )
  }

  if (view === 'attendance') {
    return <AttendancePage onBack={goHome} />
  }

  return (
    <HomePage
      onOpenFollowup={() => setView('followup')}
      onOpenAttendance={() => setView('attendance')}
    />
  )
}

export default App
