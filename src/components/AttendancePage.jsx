'use client'

import { useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

// Attendance page: form and submission flow
function AttendancePage({ onBack }) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

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
      setTimeout(() => onBack(), 3000)
    } catch (err) {
      setMessage(err.message || 'Failed to record attendance.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="attendance-page reference-page">
      <section className="attendance-hero">
        <button className="back" onClick={onBack}>
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
            (typeof message === 'string' && message.includes('|')) ? (
              <div className="attendance-success-banner">
                <div className="success-icon">✓</div>
                <div className="success-text">
                  <strong>{message.split('|')[0]}</strong>
                  <span>{message.split('|')[1]}</span>
                </div>
              </div>
            ) : (
              <div className={`form-message ${(typeof message === 'string' && message.includes('Thank you')) ? 'success-message' : ''}`}>
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

export default AttendancePage
