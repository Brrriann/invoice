import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://puofpkpwfqwyzdsrvupf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1b2Zwa3B3ZnF3eXpkc3J2dXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTQ5OTMsImV4cCI6MjA4ODQzMDk5M30.1vDMhYabqa2Ay-TZvuDng1GuKTwKGTFB6qAImBwAE9g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
