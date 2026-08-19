import supabase from '../supabase.js';

/**
 * Maps raw errand + joined data into a normalized errand record.
 * Joins are performed separately from the main query for flexibility.
 */
function mapErrand(errand, clientProfile = null, runnerData = null) {
  return {
    id: errand.id,
    title: errand.title ?? null,
    description: errand.description ?? null,
    status: errand.status ?? null,
    price: Number(errand.price ?? 0),
    payoutAmount: Number(errand.payout_amount ?? 0),
    clientId: errand.client_id ?? null,
    clientName: clientProfile?.name ?? null,
    clientEmail: clientProfile?.email ?? null,
    assignedRunnerId: errand.assigned_runner_id ?? null,
    runnerName: runnerData?.name ?? null,
    runnerEmail: runnerData?.email ?? null,
    runnerVerified: runnerData?.verified ?? false,
    runnerEarnings: Number(runnerData?.total_earnings ?? 0),
    escrowStatus: errand.escrow_status ?? null,
    createdAt: errand.created_at ?? null,
    assignedAt: errand.assigned_at ?? null,
    completedAt: errand.completed_at ?? null,
    confirmedAt: errand.confirmed_at ?? null,
  };
}

/**
 * Maps timeline event from errand_events table.
 */
function mapErrandEvent(event) {
  return {
    id: event.id,
    eventType: event.event_type,
    fromStatus: event.from_status,
    toStatus: event.to_status,
    actorId: event.actor_id,
    actorRole: event.actor_role,
    metadata: event.metadata ?? null,
    createdAt: event.created_at,
  };
}

/**
 * Fetch paginated list of errands with server-side search and filtering.
 *
 * Search is applied BEFORE pagination, so totalCount and totalPages
 * reflect the filtered result set, not all errands.
 *
 * @param {Object} params
 * @param {string} params.search - Search text (searches title + description)
 * @param {string} params.status - Status filter ('all' or specific status value)
 * @param {number} params.page - Page number (1-based)
 * @param {number} params.limit - Results per page
 * @returns {Promise<Object>} { errands, totalCount, page, limit, totalPages }
 */
export async function getAdminErrandList({
  search = '',
  status = 'all',
  page = 1,
  limit = 20,
} = {}) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  // Build base query with count
  let query = supabase
    .from('errands')
    .select(
      'id, title, description, status, price, payout_amount, client_id, assigned_runner_id, escrow_status, created_at, assigned_at, completed_at, confirmed_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  // Apply search filter BEFORE pagination (server-side, database-level)
  if (search && search.trim()) {
    const searchTerm = search.trim();
    // Search across title and description using case-insensitive LIKE
    query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
  }

  // Apply status filter BEFORE pagination
  if (status !== 'all' && status) {
    query = query.eq('status', status);
  }

  // Apply pagination to filtered results
  const start = (normalizedPage - 1) * normalizedLimit;
  const { data: errands, count, error } = await query.range(start, start + normalizedLimit - 1);

  if (error) {
    throw new Error(`Failed to fetch errands: ${error.message}`);
  }

  // Fetch client profiles for all errands
  const clientIds = (errands ?? [])
    .map((e) => e.client_id)
    .filter((id) => id != null && id !== '');
  let clientProfiles = {};

  if (clientIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', [...new Set(clientIds)]); // Deduplicate

    if (profileError) {
      throw new Error(`Failed to fetch client profiles: ${profileError.message}`);
    }

    clientProfiles = new Map((profiles ?? []).map((p) => [p.id, p]));
  }

  // Fetch runner data for all assigned errands
  const runnerIds = (errands ?? [])
    .map((e) => e.assigned_runner_id)
    .filter((id) => id != null && id !== '');
  let runnerMap = {};

  if (runnerIds.length > 0) {
    const { data: runners, error: runnerError } = await supabase
      .from('runners')
      .select('id, name, email, total_earnings')
      .in('id', [...new Set(runnerIds)]); // Deduplicate

    if (runnerError) {
      throw new Error(`Failed to fetch runners: ${runnerError.message}`);
    }

    // Join runner data with profile verified status
    const runnerIds2 = (runners ?? []).map((r) => r.id);
    let runnerProfiles = {};
    if (runnerIds2.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, verified')
        .in('id', runnerIds2);

      if (profileError) {
        throw new Error(`Failed to fetch runner profiles: ${profileError.message}`);
      }

      runnerProfiles = new Map((profiles ?? []).map((p) => [p.id, p]));
    }

    runnerMap = new Map(
      (runners ?? []).map((r) => [
        r.id,
        {
          name: r.name,
          email: r.email,
          total_earnings: r.total_earnings,
          verified: runnerProfiles.get(r.id)?.verified ?? false,
        },
      ])
    );
  }

  // Map errands with joined data
  const mappedErrands = (errands ?? []).map((errand) =>
    mapErrand(
      errand,
      clientProfiles.get(errand.client_id) ?? null,
      errand.assigned_runner_id ? runnerMap.get(errand.assigned_runner_id) ?? null : null
    )
  );

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / normalizedLimit));
  const pageIndex = Math.min(Math.max(1, normalizedPage), totalPages);

  return {
    errands: mappedErrands,
    totalCount,
    page: pageIndex,
    limit: normalizedLimit,
    totalPages,
  };
}

/**
 * Fetch detailed view of a single errand with timeline.
 *
 * @param {string} errandId - UUID of errand
 * @returns {Promise<Object>} Full errand detail with nested client, runner, and events
 */
export async function getAdminErrandById(errandId) {
  // Fetch errand
  const { data: errand, error: errandError } = await supabase
    .from('errands')
    .select(
      'id, title, description, status, price, payout_amount, client_id, assigned_runner_id, escrow_status, created_at, assigned_at, completed_at, confirmed_at'
    )
    .eq('id', errandId)
    .maybeSingle();

  if (errandError) {
    throw new Error(`Failed to fetch errand: ${errandError.message}`);
  }

  if (!errand) {
    throw new Error('Errand not found.');
  }

  // Fetch client profile
  let clientProfile = null;
  if (errand.client_id) {
    const { data: profile, error: clientError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', errand.client_id)
      .maybeSingle();

    if (clientError) {
      throw new Error(`Failed to fetch client profile: ${clientError.message}`);
    }

    clientProfile = profile ?? null;
  }

  // Fetch runner data (if assigned)
  let runnerData = null;
  if (errand.assigned_runner_id) {
    const { data: runner, error: runnerError } = await supabase
      .from('runners')
      .select('id, name, email, total_earnings')
      .eq('id', errand.assigned_runner_id)
      .maybeSingle();

    if (runnerError) {
      throw new Error(`Failed to fetch runner: ${runnerError.message}`);
    }

    if (runner) {
      // Fetch runner profile for verified status
      const { data: runnerProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, verified')
        .eq('id', runner.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(`Failed to fetch runner profile: ${profileError.message}`);
      }

      runnerData = {
        name: runner.name,
        email: runner.email,
        total_earnings: runner.total_earnings,
        verified: runnerProfile?.verified ?? false,
      };
    }
  }

  // Fetch errand events (timeline)
  const { data: events, error: eventsError } = await supabase
    .from('errand_events')
    .select('id, event_type, from_status, to_status, actor_id, actor_role, metadata, created_at')
    .eq('errand_id', errandId)
    .order('created_at', { ascending: false });

  if (eventsError) {
    throw new Error(`Failed to fetch errand events: ${eventsError.message}`);
  }

  return {
    ...mapErrand(errand, clientProfile, runnerData),
    client: clientProfile
      ? {
          id: errand.client_id,
          email: clientProfile.email,
        }
      : null,
    runner: runnerData
      ? {
          id: errand.assigned_runner_id,
          name: runnerData.name,
          email: runnerData.email,
          verified: runnerData.verified,
          totalEarnings: Number(runnerData.total_earnings ?? 0),
        }
      : null,
    events: (events ?? []).map(mapErrandEvent),
  };
}
