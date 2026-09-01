/**
 * Build the PostgREST OR filter for runner-visible errands.
 *
 * A runner may see:
 * - unassigned errands in the `created` state
 * - their own active errands in the `accepted` state
 *
 * Historical or completed work is excluded.
 */
export function getRunnerErrandVisibilityFilter(userId) {
  if (!userId) {
    throw new Error('Runner user ID is required');
  }

  return (
    `and(status.eq.created,assigned_runner_id.is.null),` +
    `and(status.eq.accepted,assigned_runner_id.eq.${userId})`
  );
}
