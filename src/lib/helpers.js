// Shared helper utilities used across pages

// Get week start string YYYY-MM-DD for offset weeksAgo
export const getWeekStartForOffset = (weeksAgo = 0) => {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) - (weeksAgo * 7)
  return new Date(today.setDate(diff)).toISOString().split('T')[0]
}

// Generate realistic mock people for demo/testing before real data is connected
export const generateMockPeople = (count) => {
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

// Convert worker's full name to a pseudo-email for seamless name-based login in Supabase
export const getPseudoEmail = (name) => {
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return `${clean}.gcccigando@gmail.com`
}

// Calculate dot color for a specific person on a specific week date
export const getDotColor = (person, dateStr) => {
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
