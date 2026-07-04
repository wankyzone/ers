import supabase from '../supabase.js';

setInterval(async () => {
  console.log("⏳ Checking escrow...");

  const { data: errands } = await supabase
    .from('errands')
    .select('*')
    .eq('escrow_status', 'awaiting_confirmation');

  const now = new Date();

  for (const e of errands || []) {
    const diff = now - new Date(e.completed_at);

    if (diff > 24 * 60 * 60 * 1000) {
      console.log("⚡ AUTO RELEASE:", e.id);

      await fetch(`http://localhost:3000/errands/${e.id}/confirm`, {
        method: 'POST',
        headers: {
          'x-client-id': e.client_id
        }
      });
    }
  }
}, 60000);