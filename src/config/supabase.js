import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wgdohslxnbbzttyyqmxa.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZG9oc2x4bmJienR0eXlxbXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxOTg0MDEsImV4cCI6MjA4NTc3NDQwMX0.QctYRX-lxwxR1WES4SdDJi_5YhWCF7-z0Pc2OB0yh-Q'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
