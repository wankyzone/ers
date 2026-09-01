import test from 'node:test';
import assert from 'node:assert/strict';
import { getRunnerErrandVisibilityFilter } from '../utils/errandVisibility.js';

test('runner visibility includes created unassigned errands', () => {
  const filter = getRunnerErrandVisibilityFilter(
    'runner-123'
  );

  assert.match(
    filter,
    /and\(status\.eq\.created,assigned_runner_id\.is\.null\)/
  );
});

test('runner visibility includes accepted errands assigned to the authenticated runner', () => {
  const filter = getRunnerErrandVisibilityFilter(
    'runner-123'
  );

  assert.match(
    filter,
    /and\(status\.eq\.accepted,assigned_runner_id\.eq\.runner-123\)/
  );
});

test('runner visibility is scoped to the authenticated runner ID', () => {
  const filter = getRunnerErrandVisibilityFilter(
    'runner-abc'
  );

  assert.match(filter, /assigned_runner_id\.eq\.runner-abc/);
  assert.doesNotMatch(filter, /runner-123/);
});

test('runner visibility rejects a missing runner ID', () => {
  assert.throws(
    () => getRunnerErrandVisibilityFilter(),
    /Runner user ID is required/
  );
});
