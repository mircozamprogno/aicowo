import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create the real Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// For development/testing, you can temporarily use mock data
// but the authentication will go through real Supabase
export default supabase;