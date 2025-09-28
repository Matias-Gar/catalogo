// lib/SupabaseClient.js
import { createClient } from '@supabase/supabase-js'

// Asegúrate de usar 'process.env.NEXT_PUBLIC_'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)