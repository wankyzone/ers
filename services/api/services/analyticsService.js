import supabase from '../supabase.js';

const RANGE_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function normalizeRange(value = '30d') {
  return RANGE_DAYS[value] ? value : '30d';
}

function getStartDate(range) {
  const days = RANGE_DAYS[range];
  return new Date(
    Date.now() - days * 24 * 60 * 60 * 1000,
  ).toISOString();
}

async function countRows(table, filters = []) {
  let query = supabase.from(table).select('id', {
    count: 'exact',
    head: true,
  });

  for (const { method, args } of filters) {
    query = query[method](...args);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`);
  }

  return count ?? 0;
}

async function getRevenue(startDate) {
  const { data, error } = await supabase
    .from('errands')
    .select('price, payout_amount')
    .eq('status', 'confirmed')
    .eq('escrow_status', 'released')
    .gte('created_at', startDate);

  if (error) {
    throw new Error(`Failed to fetch analytics revenue: ${error.message}`);
  }

  return (data ?? []).reduce((sum, errand) => {
    const price = Number(errand.price ?? 0);
    const payout =
      errand.payout_amount != null
        ? Number(errand.payout_amount)
        : Math.floor(price * 0.8);

    return sum + (price - payout);
  }, 0);
}

async function getErrandCounts(startDate) {
  const { data, error } = await supabase
    .from('errands')
    .select('id, status, created_at')
    .gte('created_at', startDate);

  if (error) {
    throw new Error(`Failed to fetch analytics errands: ${error.message}`);
  }

  const rows = data ?? [];

  return {
    total: rows.length,
    completed: rows.filter((errand) => errand.status === 'completed').length,
    confirmed: rows.filter((errand) => errand.status === 'confirmed').length,
    created: rows.filter((errand) => errand.status === 'created').length,
    accepted: rows.filter((errand) => errand.status === 'accepted').length,
  };
}

function buildDailyTrend(rows, startDate) {
  const buckets = new Map();

  const start = new Date(startDate);
  const now = new Date();

  for (
    let cursor = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
    );
    cursor <= now;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const key = cursor.toISOString().slice(0, 10);

    buckets.set(key, {
      date: key,
      total: 0,
      completed: 0,
      confirmed: 0,
    });
  }

  for (const row of rows) {
    if (!row.created_at) continue;

    const key = new Date(row.created_at).toISOString().slice(0, 10);
    const bucket = buckets.get(key);

    if (!bucket) continue;

    bucket.total += 1;

    if (row.status === 'completed') {
      bucket.completed += 1;
    }

    if (row.status === 'confirmed') {
      bucket.confirmed += 1;
    }
  }

  return Array.from(buckets.values());
}

async function getErrandTrend(startDate) {
  const { data, error } = await supabase
    .from('errands')
    .select('status, created_at')
    .gte('created_at', startDate)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch errand trends: ${error.message}`);
  }

  return buildDailyTrend(data ?? [], startDate);
}

async function getUserGrowth(startDate) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, created_at')
    .gte('created_at', startDate)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch user growth: ${error.message}`);
  }

  const buckets = new Map();

  for (const profile of data ?? []) {
    if (!profile.created_at) continue;

    const date = new Date(profile.created_at).toISOString().slice(0, 10);

    if (!buckets.has(date)) {
      buckets.set(date, {
        date,
        clients: 0,
        runners: 0,
        users: 0,
      });
    }

    const bucket = buckets.get(date);

    bucket.users += 1;

    if (profile.role === 'client') {
      bucket.clients += 1;
    }

    if (profile.role === 'runner') {
      bucket.runners += 1;
    }
  }

  return Array.from(buckets.values());
}

export async function getAnalyticsOverview({
  range = '30d',
} = {}) {
  const normalizedRange = normalizeRange(range);
  const startDate = getStartDate(normalizedRange);

  const [
    totalUsers,
    totalClients,
    totalRunners,
    errandCounts,
    revenue,
    errandTrend,
    userGrowth,
  ] = await Promise.all([
    countRows('profiles'),
    countRows('profiles', [
      { method: 'eq', args: ['role', 'client'] },
    ]),
    countRows('runners'),
    getErrandCounts(startDate),
    getRevenue(startDate),
    getErrandTrend(startDate),
    getUserGrowth(startDate),
  ]);

  const totalErrands = errandCounts.total;
  const successfulErrands = errandCounts.confirmed;

  const successRate =
    totalErrands > 0
      ? Number(((successfulErrands / totalErrands) * 100).toFixed(2))
      : 0;

  return {
    range: normalizedRange,
    startDate,
    overview: {
      totalUsers,
      totalClients,
      totalRunners,
      totalErrands,
      completedErrands: errandCounts.completed,
      confirmedErrands: errandCounts.confirmed,
      revenue,
      successRate,
    },
    trends: {
      errands: errandTrend,
      users: userGrowth,
    },
    funnel: {
      created: errandCounts.created,
      accepted: errandCounts.accepted,
      completed: errandCounts.completed,
      confirmed: errandCounts.confirmed,
    },
  };
}
