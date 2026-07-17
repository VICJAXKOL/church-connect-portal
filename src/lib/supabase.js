/* global process */

import { createClient } from '@supabase/supabase-js'

const url = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined) || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined)
const anonKey = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined) || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined)

export const isSupabaseConfigured = Boolean(url && anonKey)

// The placeholder client lets the visual app run before environment variables are supplied.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
)
