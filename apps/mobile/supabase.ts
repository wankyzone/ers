import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://acspvovspjhqeboqbgjh.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjc3B2b3ZzcGpocWVib3FiZ2poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTIzNDEsImV4cCI6MjA3NTQ4ODM0MX0.xqmBc9885sZFxtkzn87bvErRyyGn0AjPT8yUp0DwZao"
);

export default supabase;