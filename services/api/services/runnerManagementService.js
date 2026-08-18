import supabase from '../supabase.js';

function getStatus(runner) {
  return runner.is_available === false ? 'suspended' : 'active';
}

function mapRunner(runner, profile = null) {
  const verified = Boolean(profile?.verified || false);

  return {
    id: runner.id,
    name: runner.name ?? profile?.full_name ?? null,
    email: runner.email ?? profile?.email ?? null,
    role: profile?.role ?? null,
    verified,
    verificationStatus: verified ? 'verified' : 'unverified',
    status: getStatus(runner),
    isAvailable: Boolean(runner.is_available ?? true),
    totalEarnings: Number(runner.total_earnings ?? 0),
    createdAt: runner.created_at ?? null,
    updatedAt: runner.updated_at ?? null,
    lat: runner.lat ?? null,
    lng: runner.lng ?? null,
  };
}

export async function getAdminRunnerList({
  search = '',
  status = 'all',
  verified = 'all',
  page = 1,
  limit = 20,
} = {}) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const { data: runners, error } = await supabase
    .from('runners')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const runnerIds = (runners ?? []).map((runner) => runner.id).filter(Boolean);
  let profileRows = [];

  if (runnerIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, verified, full_name')
      .in('id', runnerIds);

    if (profileError) {
      throw new Error(profileError.message);
    }

    profileRows = profiles ?? [];
  }

  const profileMap = new Map(profileRows.map((profile) => [profile.id, profile]));

  let items = (runners ?? []).map((runner) => mapRunner(runner, profileMap.get(runner.id) ?? null));

  const query = search?.trim()?.toLowerCase();
  if (query) {
    items = items.filter((runner) => {
      const haystack = `${runner.name ?? ''} ${runner.email ?? ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  if (status !== 'all') {
    items = items.filter((runner) => {
      if (status === 'active') return runner.status === 'active';
      if (status === 'suspended') return runner.status === 'suspended';
      return true;
    });
  }

  if (verified !== 'all') {
    items = items.filter((runner) => {
      if (verified === 'verified') return runner.verified;
      if (verified === 'unverified') return !runner.verified;
      return true;
    });
  }

  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / normalizedLimit));
  const pageIndex = Math.min(Math.max(1, normalizedPage), totalPages);
  const start = (pageIndex - 1) * normalizedLimit;

  return {
    runners: items.slice(start, start + normalizedLimit),
    totalCount,
    page: pageIndex,
    limit: normalizedLimit,
    totalPages,
  };
}

export async function getAdminRunnerById(runnerId) {
  const { data: runner, error: runnerError } = await supabase
    .from('runners')
    .select('*')
    .eq('id', runnerId)
    .maybeSingle();

  if (runnerError) {
    throw new Error(runnerError.message);
  }

  if (!runner) {
    throw new Error('Runner not found.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role, verified, full_name')
    .eq('id', runnerId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  return mapRunner(runner, profile ?? null);
}

export async function updateRunnerAvailability(runnerId, isAvailable) {
  const normalizedValue = Boolean(isAvailable);

  const { data: existing, error: existingError } = await supabase
    .from('runners')
    .select('*')
    .eq('id', runnerId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (!existing) {
    throw new Error('Runner not found.');
  }

  const { data: updatedRunner, error: updateError } = await supabase
    .from('runners')
    .update({ is_available: normalizedValue })
    .eq('id', runnerId)
    .select('*')
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role, verified, full_name')
    .eq('id', runnerId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  return {
    success: true,
    message: normalizedValue ? 'Runner activated successfully.' : 'Runner suspended successfully.',
    data: mapRunner(updatedRunner, profile ?? null),
  };
}
