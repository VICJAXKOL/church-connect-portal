import { supabase } from './supabase'

// ===== AUTH FUNCTIONS =====

/**
 * Sign up a follow-up worker using email & password
 * Creates a user in auth.users and a corresponding worker record
 */
export const signupWorker = async (email, password, fullName) => {
  try {
    // 1. Try to register through our custom SQL function first.
    // This bypasses email confirmation requirements and auth rate limits (429)
    try {
      const { data, error: rpcError } = await supabase.rpc('register_worker', {
        p_email: email,
        p_password: password,
        p_full_name: fullName
      })

      if (!rpcError) {
        return {
          success: true,
          user: { id: data },
          message: 'Account created successfully! You can now sign in.'
        }
      }

      // If the error is NOT that the function doesn't exist, throw it
      if (rpcError.message && !rpcError.message.includes('does not exist')) {
        throw rpcError
      }
    } catch (rpcErr) {
      console.warn('register_worker RPC not available, falling back to standard signUp:', rpcErr)
    }

    // 2. Fall back to standard sign up if RPC is not available
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    })

    if (authError) throw authError

    return {
      success: true,
      user: authData.user,
      message: 'Account created successfully! Please check your email or make sure email confirmation is turned off in Supabase.'
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Sign in a follow-up worker
 */
export const signinWorker = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error

    return { success: true, session: data.session }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Sign out the current user
 */
export const signoutWorker = async () => {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Get the current authenticated user
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  } catch (err) {
    console.error('Error fetching current user:', err)
    return null
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Get the week start date (Monday of current week)
 */
const getWeekStart = () => {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
  return new Date(today.setDate(diff)).toISOString().split('T')[0]
}

// ===== ASSIGNED PEOPLE FUNCTIONS =====

/**
 * Get all people assigned to the current worker for this week
 */
export const getAssignedPeople = async (workerId) => {
  try {
    const { data, error } = await supabase
      .from('follow_up_people')
      .select(`
        id,
        full_name,
        phone,
        email,
        status,
        follow_up_assignments (
          id,
          created_at,
          follow_up_updates (
            id,
            called,
            texted,
            note,
            member_status,
            service_attendance,
            week_start,
            updated_at
          )
        )
      `)
      .eq('follow_up_assignments.worker_id', workerId)

    if (error) throw error

    // Transform to include assignment and updates list
    return data.map((person) => {
      const assignment = person.follow_up_assignments[0] || { id: null, created_at: null, follow_up_updates: [] }
      const updates = assignment.follow_up_updates || []

      // Find current week's update
      const currentWeekStart = getWeekStart()
      const latestUpdate = updates.find(u => u.week_start === currentWeekStart) || null

      return {
        id: person.id,
        name: person.full_name,
        phone: person.phone,
        email: person.email,
        status: latestUpdate?.member_status || person.status,
        service: latestUpdate?.service_attendance || 'Not yet recorded',
        called: latestUpdate?.called || false,
        texted: latestUpdate?.texted || false,
        note: latestUpdate?.note || '',
        assignmentId: assignment.id,
        updateId: latestUpdate?.id,
        weekStart: latestUpdate?.week_start,
        allUpdates: updates
      }
    })
  } catch (err) {
    console.error('Error fetching assigned people:', err)
    return []
  }
}

// ===== FOLLOW-UP UPDATE FUNCTIONS =====

/**
 * Upsert (insert or update) a follow-up update for a person
 */
export const upsertFollowupUpdate = async (
  assignmentId,
  called,
  texted,
  note,
  memberStatus,
  serviceAttendance
) => {
  try {
    const weekStart = getWeekStart()

    // Try to find existing update for this week
    const { data: existingUpdate, error: selectError } = await supabase
      .from('follow_up_updates')
      .select('id')
      .eq('assignment_id', assignmentId)
      .eq('week_start', weekStart)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 means no row found, which is expected
      throw selectError
    }

    let result

    if (existingUpdate) {
      // Update existing record
      const { data, error } = await supabase
        .from('follow_up_updates')
        .update({
          called,
          texted,
          note,
          member_status: memberStatus,
          service_attendance: serviceAttendance,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUpdate.id)
        .select()

      if (error) throw error
      result = data[0]
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('follow_up_updates')
        .insert({
          assignment_id: assignmentId,
          called,
          texted,
          note,
          member_status: memberStatus,
          service_attendance: serviceAttendance,
          week_start: weekStart
        })
        .select()

      if (error) throw error
      result = data[0]
    }

    return { success: true, data: result }
  } catch (err) {
    console.error('Error saving follow-up update:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Batch update multiple follow-up records
 */
export const batchUpdateFollowups = async (updates) => {
  try {
    const results = []

    for (const update of updates) {
      const result = await upsertFollowupUpdate(
        update.assignmentId,
        update.called,
        update.texted,
        update.note,
        update.status,
        update.service
      )
      results.push(result)
    }

    const failed = results.filter((r) => !r.success)
    if (failed.length > 0) {
      throw new Error(`${failed.length} updates failed to save`)
    }

    return { success: true, count: results.length }
  } catch (err) {
    console.error('Error batch updating:', err)
    return { success: false, error: err.message }
  }
}

// ===== PEOPLE MANAGEMENT (Admin) =====

/**
 * Get all follow-up people (admin only)
 */
export const getAllPeople = async () => {
  try {
    const { data, error } = await supabase
      .from('follow_up_people')
      .select('*')
      .order('full_name')

    if (error) throw error
    return data
  } catch (err) {
    console.error('Error fetching all people:', err)
    return []
  }
}

/**
 * Add a new follow-up person
 */
export const addPerson = async (fullName, phone, email, status = 'Visiting member') => {
  try {
    const { data, error } = await supabase
      .from('follow_up_people')
      .insert({
        full_name: fullName,
        phone,
        email,
        status
      })
      .select()

    if (error) throw error
    return { success: true, data: data[0] }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Assign a person to a worker
 */
export const assignPersonToWorker = async (personId, workerId) => {
  try {
    const { data, error } = await supabase
      .from('follow_up_assignments')
      .insert({
        person_id: personId,
        worker_id: workerId
      })
      .select()

    if (error) throw error
    return { success: true, data: data[0] }
  } catch (err) {
    // Might fail if assignment already exists (unique constraint)
    return { success: false, error: err.message }
  }
}

/**
 * Remove an assignment
 */
export const removeAssignment = async (assignmentId) => {
  try {
    const { error } = await supabase
      .from('follow_up_assignments')
      .delete()
      .eq('id', assignmentId)

    if (error) throw error
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ===== REPORTING =====

/**
 * Get week's follow-up summary for a worker
 */
export const getWeeklySummary = async (workerId) => {
  try {
    const weekStart = getWeekStart()

    const { data, error } = await supabase
      .from('follow_up_updates')
      .select(`
        called,
        texted,
        member_status,
        service_attendance,
        follow_up_assignments (
          person_id,
          follow_up_people (full_name)
        )
      `)
      .eq('follow_up_assignments.worker_id', workerId)
      .eq('week_start', weekStart)

    if (error) throw error

    // Calculate stats
    const stats = {
      total: data.length,
      called: data.filter((u) => u.called).length,
      texted: data.filter((u) => u.texted).length,
      visited: data.filter((u) => u.member_status === 'Visiting member').length,
      intending: data.filter((u) => u.member_status === 'Intending member').length,
      sundayService: data.filter((u) => u.service_attendance === 'Sunday Service').length,
      wednesdayStudy: data.filter((u) => u.service_attendance === 'Wednesday Bible Study').length
    }

    return { success: true, data, stats }
  } catch (err) {
    console.error('Error fetching summary:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Get all updates for a specific person
 */
export const getPersonUpdateHistory = async (personId) => {
  try {
    const { data, error } = await supabase
      .from('follow_up_updates')
      .select(`
        *,
        follow_up_assignments (
          worker_id,
          follow_up_people (full_name)
        )
      `)
      .eq('follow_up_assignments.person_id', personId)
      .order('week_start', { ascending: false })

    if (error) throw error
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
