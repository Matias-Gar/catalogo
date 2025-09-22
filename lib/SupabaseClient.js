import { createClient } from '@supabase/supabase-js'

// URL de tu proyecto Supabase
const supabaseUrl = "https://gzvtuenpwndodnetnmzi.supabase.co"

// Clave pública anónima
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dnR1ZW5wd25kb2RuZXRubXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MDUwODIsImV4cCI6MjA3NDA4MTA4Mn0.94z7ObbDdYydDTLtp5qZxIsB3XqFgGUBTxdP9pcf8z4"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
