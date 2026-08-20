import supabase from '../supabase.js';
import { getPendingKycs } from './kycService.js';

const ACTIVE_CLIENT_WINDOW_DAYS = 30;
const RECENT_ACTIVITY_LIMIT = 20;

async function countRows(table, filters = []) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });

  for (const { method, args } of filters) {
    query = query[method](...args);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`);
  }

  return count ?? 0;
}

export async function getTotalRunners() {
  return countRows('runners');
}

export async function getOpenErrands() {
  // Count errands that are newly created or accepted (assigned).
  // 'pending' is not used by errands routes; include 'accepted' to treat assigned work as open.
  return countRows('errands', [
    { method: 'in', args: ['status', ['created', 'accepted']] },
  ]);
}

export async function getErrandPipelineCounts() {
  // Return counts for the canonical lifecycle stages: created -> accepted -> completed -> confirmed
  const [created, accepted, completed, confirmed] = await Promise.all([
    countRows('errands', [{ method: 'eq', args: ['status', 'created'] }]),
    countRows('errands', [{ method: 'eq', args: ['status', 'accepted'] }]),
    countRows('errands', [{ method: 'eq', args: ['status', 'completed'] }]),
    countRows('errands', [{ method: 'eq', args: ['status', 'confirmed'] }]),
  ]);

  return { created, accepted, completed, confirmed };
}

export async function getActiveClients() {
  const thirtyDaysAgo = new Date(Date.now() - ACTIVE_CLIENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('errands')
    .select('client_id')
    .not('client_id', 'is', null)
    .gte('created_at', thirtyDaysAgo);

  if (error) {
    throw new Error(`Failed to count active clients: ${error.message}`);
  }

  const ids = (data ?? []).map((r) => r.client_id).filter((id) => id != null);
  const unique = new Set(ids);
  return unique.size;
}

export async function getPendingKycReviews() {
  const pending = await getPendingKycs();
  return pending.length;
}

export async function getTotalUsers() {
  return countRows('users');
}

export async function getTotalClients() {
  // Count accounts that are marked as client in the profiles table
  return countRows('profiles', [{ method: 'eq', args: ['role', 'client'] }]);
}

export async function getRevenue() {
  // Sum platform commission (price - payout_amount) for finalized errands.
  // Only confirmed errands with released escrow are counted.
  // If payout_amount is null, use 80% convention (price * 0.2 commission).
  const { data, error } = await supabase
    .from('errands')
    .select('price, payout_amount')
    .eq('status', 'confirmed')
    .eq('escrow_status', 'released');

  if (error) {
    throw new Error(`Failed to fetch revenue data: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return 0;
  }

  const revenue = (data ?? []).reduce((sum, errand) => {
    const price = Number(errand.price ?? 0);
    const payoutAmount = errand.payout_amount != null ? Number(errand.payout_amount) : Math.floor(price * 0.8);
    const commission = price - payoutAmount;
    return sum + commission;
  }, 0);

  return revenue;
}

export async function getWalletBalance() {
  // Sum aggregate balance across all user wallets.
  const { data, error } = await supabase
    .from('wallets')
    .select('balance');

  if (error) {
    throw new Error(`Failed to fetch wallet balance: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return 0;
  }

  const totalBalance = (data ?? []).reduce((sum, wallet) => sum + Number(wallet.balance ?? 0), 0);
  return totalBalance;
}

function mapErrandEvent(event) {
  return {
    id: event.id,
    source: 'errand_event',
    eventType: event.event_type,
    errandId: event.errand_id,
    actorId: event.actor_id,
    actorRole: event.actor_role,
    fromStatus: event.from_status,
    toStatus: event.to_status,
    metadata: event.metadata,
    createdAt: event.created_at,
  };
}

function mapAuditLog(log) {
  return {
    id: log.id,
    source: 'audit_log',
    action: log.action,
    entity: log.entity,
    entityId: log.entity_id,
    actorId: log.actor_id,
    actorRole: log.actor_role,
    metadata: log.metadata,
    createdAt: log.created_at,
  };
}

export async function getRecentActivity(limit = RECENT_ACTIVITY_LIMIT) {
  const [{ data: errandEvents, error: errandError }, { data: auditLogs, error: auditError }] =
    await Promise.all([
      supabase
        .from('errand_events')
        .select(
          'id, errand_id, actor_id, actor_role, event_type, from_status, to_status, metadata, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('audit_logs')
        .select('id, actor_id, actor_role, action, entity, entity_id, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

  if (errandError) {
    throw new Error(`Failed to fetch recent errand activity: ${errandError.message}`);
  }

  if (auditError) {
    throw new Error(`Failed to fetch recent audit activity: ${auditError.message}`);
  }

  const items = [
    ...(errandEvents ?? []).map(mapErrandEvent),
    ...(auditLogs ?? []).map(mapAuditLog),
  ];

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export async function getDashboardOverview() {
  const [totalUsers, totalClients, totalRunners, activeClients, openErrands, pendingKycReviews, recentActivity, errandPipeline, revenue, walletBalance] =
    await Promise.all([
      getTotalUsers(),
      getTotalClients(),
      getTotalRunners(),
      getActiveClients(),
      getOpenErrands(),
      getPendingKycReviews(),
      getRecentActivity(),
      getErrandPipelineCounts(),
      getRevenue(),
      getWalletBalance(),
    ]);

  return {
    stats: {
      totalUsers,
      totalClients,
      totalRunners,
      activeClients,
      openErrands,
      pendingKycReviews,
      completedErrands: errandPipeline?.completed ?? 0,
      revenue,
      walletBalance,
      errandPipeline, // { created, accepted, completed, confirmed }
    },
    recentActivity,
  };
}
