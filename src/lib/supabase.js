/* global process */

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env?.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined)
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined)

export const isSupabaseConfigured = Boolean(url && anonKey)

// The placeholder client lets the visual app run before environment variables are supplied.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
)
