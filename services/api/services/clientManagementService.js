import supabase from '../supabase.js';

function getAccountStatus(profile, kycProfile) {
  if (kycProfile?.status === 'pending') {
    return 'pending';
  }

  if (profile?.verified || kycProfile?.status === 'approved') {
    return 'verified';
  }

  return 'unverified';
}

function mapClient(profile, kycProfile, wallet, totalErrands) {
  return {
    id: profile.id,
    email: profile.email ?? null,
    fullName: kycProfile?.full_name ?? null,
    phone: kycProfile?.phone ?? null,
    role: profile.role ?? null,
    verified: Boolean(profile.verified),
    status: 'active',
    kycVerified: kycProfile?.status === 'approved',
    createdAt: profile.created_at ?? null,
    accountStatus: getAccountStatus(profile, kycProfile),
    totalErrands,
    walletBalance: Number(wallet?.available_balance ?? wallet?.balance ?? 0),
  };
}


async function getClientAggregateData(clientIds) {
  if (clientIds.length === 0) {
    return {
      kycMap: new Map(),
      walletMap: new Map(),
      errandMap: new Map(),
    };
  }

  const [{ data: kycProfiles, error: kycError }, { data: wallets, error: walletError }, { data: errands, error: errandError }] =
    await Promise.all([
      supabase
        .from('kyc_profiles')
        .select('user_id, full_name, phone, status')
        .in('user_id', clientIds),

      supabase
        .from('wallets')
        .select('user_id, balance, available_balance')
        .in('user_id', clientIds),

      supabase
        .from('errands')
        .select('client_id, price, payout_amount')
        .in('client_id', clientIds),
    ]);

  if (kycError) throw new Error(kycError.message);
  if (walletError) throw new Error(walletError.message);
  if (errandError) throw new Error(errandError.message);

  const kycMap = new Map(
    (kycProfiles ?? []).map((profile) => [profile.user_id, profile]),
  );

  const walletMap = new Map(
    (wallets ?? []).map((wallet) => [wallet.user_id, wallet]),
  );

  const errandMap = new Map();

  for (const errand of errands ?? []) {
    const clientId = errand.client_id;

    if (!clientId) continue;

    const current = errandMap.get(clientId) ?? {
      totalErrands: 0,
    };

    current.totalErrands += 1;

    errandMap.set(clientId, current);
  }

  return {
    kycMap,
    walletMap,
    errandMap,
  };
}

export async function getAdminClientList({
  search = '',
  accountStatus = 'all',
  page = 1,
  limit = 20,
} = {}) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, role, verified, created_at')
    .eq('role', 'client')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const clientProfiles = profiles ?? [];
  const clientIds = clientProfiles.map((profile) => profile.id);

  const { kycMap, walletMap, errandMap } =
    await getClientAggregateData(clientIds);

  let items = clientProfiles.map((profile) => {
    const aggregates = errandMap.get(profile.id) ?? {
      totalErrands: 0,
    };

    return mapClient(
      profile,
      kycMap.get(profile.id) ?? null,
      walletMap.get(profile.id) ?? null,
      aggregates.totalErrands,
    );
  });

  const query = search.trim().toLowerCase();

  if (query) {
    items = items.filter((client) => {
      const haystack =
        `${client.fullName ?? ''} ${client.email ?? ''} ${client.phone ?? ''}`
          .toLowerCase();

      return haystack.includes(query);
    });
  }


  if (accountStatus !== 'all') {
    items = items.filter(
      (client) => client.accountStatus === accountStatus,
    );
  }

  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / normalizedLimit));
  const pageIndex = Math.min(normalizedPage, totalPages);
  const start = (pageIndex - 1) * normalizedLimit;

  return {
    clients: items.slice(start, start + normalizedLimit),
    totalCount,
    page: pageIndex,
    limit: normalizedLimit,
    totalPages,
  };
}

export async function getAdminClientById(clientId) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role, verified, created_at')
    .eq('id', clientId)
    .eq('role', 'client')
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    throw new Error('Client not found.');
  }

  const { kycMap, walletMap, errandMap } =
    await getClientAggregateData([clientId]);

  const aggregates = errandMap.get(clientId) ?? {
    totalErrands: 0,
  };

  return mapClient(
    profile,
    kycMap.get(clientId) ?? null,
    walletMap.get(clientId) ?? null,
    aggregates.totalErrands,
  );
}

export async function getAdminClientActivity(
  clientId,
  { page = 1, limit = 20 } = {},
) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const { data: client, error: clientError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', clientId)
    .eq('role', 'client')
    .maybeSingle();

  if (clientError) {
    throw new Error(clientError.message);
  }

  if (!client) {
    throw new Error('Client not found.');
  }

  const { data: errands, error: errandsError } = await supabase
    .from('errands')
    .select('id')
    .eq('client_id', clientId);

  if (errandsError) {
    throw new Error(errandsError.message);
  }

  const errandIds = (errands ?? []).map((errand) => errand.id).filter(Boolean);

  if (errandIds.length === 0) {
    return {
      activities: [],
      totalCount: 0,
      page: 1,
      limit: normalizedLimit,
      totalPages: 1,
    };
  }

  const from = (normalizedPage - 1) * normalizedLimit;
  const to = from + normalizedLimit - 1;

  const {
    data: events,
    count,
    error: eventsError,
  } = await supabase
    .from('errand_events')
    .select(
      'id, errand_id, event_type, from_status, to_status, actor_id, actor_role, metadata, created_at',
      { count: 'exact' },
    )
    .in('errand_id', errandIds)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / normalizedLimit));

  return {
    activities: (events ?? []).map((event) => ({
      id: event.id,
      errandId: event.errand_id,
      eventType: event.event_type,
      fromStatus: event.from_status,
      toStatus: event.to_status,
      actorId: event.actor_id,
      actorRole: event.actor_role,
      metadata: event.metadata ?? null,
      createdAt: event.created_at,
    })),
    totalCount,
    page: Math.min(normalizedPage, totalPages),
    limit: normalizedLimit,
    totalPages,
  };
}
