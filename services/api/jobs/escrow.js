import supabase from '../supabase.js';

const ESCROW_CONFIRMATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function runEscrowAutoRelease() {
  console.log("⏳ Checking escrow...");

  const { data: errands, error } = await supabase
    .from('errands')
    .select('*')
    .eq('escrow_status', 'awaiting_confirmation');

  if (error) {
    console.error('AUTO RELEASE ESCROW LOOKUP ERROR:', error);
    return;
  }

  const now = new Date();

  for (const e of errands || []) {
    if (!e.completed_at) {
      continue;
    }

    const diff = now - new Date(e.completed_at);

    if (diff <= ESCROW_CONFIRMATION_WINDOW_MS) {
      continue;
    }

    console.log("⚡ AUTO RELEASE:", e.id);

    const { data, error: releaseError } = await supabase.rpc(
      'release_escrow_atomic',
      {
        p_client_id: e.client_id,
        p_errand_id: e.id,
      }
    );

    if (releaseError) {
      console.error(
        'AUTO RELEASE ESCROW ERROR:',
        e.id,
        releaseError
      );
      continue;
    }

    console.log('AUTO RELEASE ESCROW SUCCESS:', e.id, data?.status);
  }
}

const escrowAutoReleaseInterval = setInterval(runEscrowAutoRelease, 60000);
escrowAutoReleaseInterval.unref();
