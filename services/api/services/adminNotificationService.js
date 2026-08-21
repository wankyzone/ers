import supabase from '../supabase.js';

const RECENT_WINDOW_HOURS = 24;

function getRecentCutoff() {
  return new Date(
    Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();
}

function createNotification({
  id,
  type,
  title,
  description,
  href,
  count = 0,
  createdAt = null,
}) {
  return {
    id,
    type,
    title,
    description,
    href,
    count,
    createdAt,
  };
}

export async function getAdminNotifications() {
  const cutoff = getRecentCutoff();

  const [
    { count: pendingKycCount, error: kycError },
    { count: openErrandCount, error: errandError },
    { count: newRunnerCount, error: runnerError },
    { count: newClientCount, error: clientError },
  ] = await Promise.all([
    supabase
      .from('kyc_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),

    supabase
      .from('errands')
      .select('id', { count: 'exact', head: true })
      .in('status', ['created', 'accepted']),

    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'runner')
      .gte('created_at', cutoff),

    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'client')
      .gte('created_at', cutoff),
  ]);

  if (kycError) {
    throw new Error(`Failed to fetch pending KYC notifications: ${kycError.message}`);
  }

  if (errandError) {
    throw new Error(`Failed to fetch errand notifications: ${errandError.message}`);
  }

  if (runnerError) {
    throw new Error(`Failed to fetch runner notifications: ${runnerError.message}`);
  }

  if (clientError) {
    throw new Error(`Failed to fetch client notifications: ${clientError.message}`);
  }

  const notifications = [];

  if ((pendingKycCount ?? 0) > 0) {
    notifications.push(
      createNotification({
        id: 'pending-kyc',
        type: 'action',
        title: 'KYC review required',
        description: `${pendingKycCount} runner submission${pendingKycCount === 1 ? '' : 's'} waiting for review.`,
        href: '/kyc',
        count: pendingKycCount,
      }),
    );
  }

  if ((openErrandCount ?? 0) > 0) {
    notifications.push(
      createNotification({
        id: 'open-errands',
        type: 'action',
        title: 'Open errands',
        description: `${openErrandCount} errand${openErrandCount === 1 ? '' : 's'} currently active.`,
        href: '/errands',
        count: openErrandCount,
      }),
    );
  }

  if ((newRunnerCount ?? 0) > 0) {
    notifications.push(
      createNotification({
        id: 'new-runners',
        type: 'info',
        title: 'New runner activity',
        description: `${newRunnerCount} runner${newRunnerCount === 1 ? '' : 's'} joined in the last 24 hours.`,
        href: '/runners',
        count: newRunnerCount,
      }),
    );
  }

  if ((newClientCount ?? 0) > 0) {
    notifications.push(
      createNotification({
        id: 'new-clients',
        type: 'info',
        title: 'New client activity',
        description: `${newClientCount} client${newClientCount === 1 ? '' : 's'} joined in the last 24 hours.`,
        href: '/clients',
        count: newClientCount,
      }),
    );
  }

  return {
    notifications,
    activeAlertCount: notifications.filter(
      (notification) => notification.type === 'action',
    ).length,
  };
}
