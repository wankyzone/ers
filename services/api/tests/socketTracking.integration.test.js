import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { io as createClient } from 'socket.io-client';

process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-placeholder-key';

const { initSocket } = await import('../server/socket.js');

const ERRAND_A = '00000000-0000-0000-0000-000000000401';
const ERRAND_B = '00000000-0000-0000-0000-000000000402';

const ACCESS_TOKENS = {
  client: 'client-access-token',
  runner: 'runner-access-token',
  other: 'other-access-token',
  clientB: 'client-b-access-token',
  runnerB: 'runner-b-access-token',
};

const USERS = {
  client: {
    id: 'client-user-id',
    email: 'client@example.com',
    role: 'client',
  },
  runner: {
    id: 'runner-user-id',
    email: 'runner@example.com',
    role: 'runner',
  },
  other: {
    id: 'other-user-id',
    email: 'other@example.com',
    role: 'runner',
  },
  clientB: {
    id: 'client-b-user-id',
    email: 'client-b@example.com',
    role: 'client',
  },
  runnerB: {
    id: 'runner-b-user-id',
    email: 'runner-b@example.com',
    role: 'runner',
  },
};

const ERRANDS = {
  [ERRAND_A]: {
    id: ERRAND_A,
    client_id: USERS.client.id,
    assigned_runner_id: USERS.runner.id,
  },
  [ERRAND_B]: {
    id: ERRAND_B,
    client_id: USERS.clientB.id,
    assigned_runner_id: USERS.runnerB.id,
  },
};

const protect = {
  verifyAccessToken: async (accessToken) => {
    const entry = Object.entries(ACCESS_TOKENS).find(
      ([, token]) => token === accessToken
    );

    return {
      success: Boolean(entry),
      user: { id: entry?.[0] },
      message: 'Invalid or expired access token.',
    };
  },
  getApplicationUser: async (identity) => ({
    success: Boolean(USERS[identity]),
    user: USERS[identity],
    message: 'Application user not found.',
  }),
};

const servers = new Set();

async function createSocketServer() {
  const httpServer = http.createServer();

  const getErrand = async (errandId) => ERRANDS[errandId] ?? null;

  const io = initSocket(httpServer, protect, {
    getErrand,
  });

  await new Promise((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve);
  });

  const address = httpServer.address();

  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine test server address');
  }

  servers.add({ httpServer, io });

  return {
    httpServer,
    io,
    url: `http://127.0.0.1:${address.port}`,
  };
}

function connectClient(
  url,
  accessToken = ACCESS_TOKENS.client,
  extraAuth = {}
) {
  const auth =
    accessToken && typeof accessToken === 'object'
      ? accessToken
      : {
          accessToken,
          ...extraAuth,
        };

  return new Promise((resolve, reject) => {
    const socket = createClient(url, {
      transports: ['websocket'],
      auth,
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timed out'));
    }, 5000);

    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve(socket);
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      socket.disconnect();
      reject(error);
    });
  });
}

function waitForEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    function handler(payload) {
      clearTimeout(timer);
      resolve(payload);
    }

    socket.once(event, handler);
  });
}

async function closeSocketServer(httpServer, io) {
  io.close();

  await new Promise((resolve) => {
    if (!httpServer.listening) {
      resolve();
      return;
    }

    httpServer.close(() => resolve());
  });
}

afterEach(async () => {
  for (const { httpServer, io } of servers) {
    await closeSocketServer(httpServer, io);
  }

  servers.clear();
});

test('client receives runner location updates for its errand tracking room', async () => {
  const { url } = await createSocketServer();

  const client = await connectClient(url, ACCESS_TOKENS.client);
  const runner = await connectClient(url, ACCESS_TOKENS.runner);

  const clientJoin = await new Promise((resolve) => {
    client.emit('join:errand', ERRAND_A, resolve);
  });

  const runnerJoin = await new Promise((resolve) => {
    runner.emit('join:errand', ERRAND_A, resolve);
  });

  assert.deepEqual(clientJoin, { success: true });
  assert.deepEqual(runnerJoin, { success: true });

  const locationPromise = waitForEvent(client, 'location:update');

  const publishResult = await new Promise((resolve) => {
    runner.emit(
      'location:update',
      {
        errandId: ERRAND_A,
        lat: 6.5244,
        lng: 3.3792,
      },
      resolve
    );
  });

  assert.deepEqual(publishResult, { success: true });

  const location = await locationPromise;

  assert.deepEqual(location, {
    lat: 6.5244,
    lng: 3.3792,
  });

  client.disconnect();
  runner.disconnect();
});

test('valid access token authenticates a socket with the trusted user', async () => {
  const { url, io } = await createSocketServer();

  const client = await connectClient(url, {
    accessToken: ACCESS_TOKENS.client,
    userId: 'client-supplied-id',
    role: 'admin',
  });
  const serverSocket = io.sockets.sockets.get(client.id);

  assert.deepEqual(serverSocket.user, USERS.client);

  client.disconnect();
});

test('unauthorized user cannot join an errand room', async () => {
  const { url, io } = await createSocketServer();

  const other = await connectClient(url, ACCESS_TOKENS.other);

  const joinResult = await new Promise((resolve) => {
    other.emit('join:errand', ERRAND_A, resolve);
  });

  assert.deepEqual(joinResult, {
    success: false,
    error: 'Not authorized for this errand.',
  });

  const serverSocket = io.sockets.sockets.get(other.id);

  assert.ok(serverSocket);
  assert.equal(serverSocket.rooms.has("errand:" + ERRAND_A), false);

  other.disconnect();
});

test('missing access token is rejected', async () => {
  const { url } = await createSocketServer();

  await assert.rejects(
    connectClient(url, {}),
    (error) => error.message === 'Authentication required.'
  );
});

test('invalid access token is rejected', async () => {
  const { url } = await createSocketServer();

  await assert.rejects(
    connectClient(url, { accessToken: 'invalid-access-token' }),
    (error) => error.message === 'Invalid or expired access token.'
  );
});

test('assigned runner cannot publish location before joining the errand room', async () => {
  const { url } = await createSocketServer();

  const client = await connectClient(url, ACCESS_TOKENS.client);
  const runner = await connectClient(url, ACCESS_TOKENS.runner);

  const clientJoin = await new Promise((resolve) => {
    client.emit('join:errand', ERRAND_A, resolve);
  });

  assert.deepEqual(clientJoin, { success: true });

  let locationReceived = false;
  client.on('location:update', () => {
    locationReceived = true;
  });

  const publishResult = await new Promise((resolve) => {
    runner.emit(
      'location:update',
      {
        errandId: ERRAND_A,
        lat: 6.7101,
        lng: 3.5101,
      },
      resolve
    );
  });

  assert.deepEqual(publishResult, {
    success: false,
    error: 'Join the errand room before publishing location.',
  });

  await new Promise((resolve) => setTimeout(resolve, 250));

  assert.equal(locationReceived, false);

  client.disconnect();
  runner.disconnect();
});

test('unauthorized user cannot publish location for an errand', async () => {
  const { url } = await createSocketServer();

  const client = await connectClient(url, ACCESS_TOKENS.client);
  const other = await connectClient(url, ACCESS_TOKENS.other);

  const clientJoin = await new Promise((resolve) => {
    client.emit('join:errand', ERRAND_A, resolve);
  });

  assert.deepEqual(clientJoin, { success: true });

  let locationReceived = false;
  client.on('location:update', () => {
    locationReceived = true;
  });

  const publishResult = await new Promise((resolve) => {
    other.emit(
      'location:update',
      {
        errandId: ERRAND_A,
        lat: 6.7001,
        lng: 3.5001,
      },
      resolve
    );
  });

  assert.deepEqual(publishResult, {
    success: false,
    error: 'Only the assigned runner can publish location.',
  });

  await new Promise((resolve) => setTimeout(resolve, 250));

  assert.equal(locationReceived, false);

  client.disconnect();
  other.disconnect();
});

test('location updates are isolated to the matching errand room', async () => {
  const { url } = await createSocketServer();

  const clientA = await connectClient(url, ACCESS_TOKENS.client);
  const clientB = await connectClient(url, ACCESS_TOKENS.clientB);
  const runner = await connectClient(url, ACCESS_TOKENS.runner);

  const clientAJoin = await new Promise((resolve) => {
    clientA.emit('join:errand', ERRAND_A, resolve);
  });

  const clientBJoin = await new Promise((resolve) => {
    clientB.emit('join:errand', ERRAND_B, resolve);
  });

  const runnerJoin = await new Promise((resolve) => {
    runner.emit('join:errand', ERRAND_A, resolve);
  });

  assert.deepEqual(clientAJoin, { success: true });
  assert.deepEqual(clientBJoin, { success: true });
  assert.deepEqual(runnerJoin, { success: true });

  const locationPromise = waitForEvent(clientA, 'location:update');

  let clientBReceived = false;
  clientB.on('location:update', () => {
    clientBReceived = true;
  });

  runner.emit('location:update', {
    errandId: ERRAND_A,
    lat: 6.6001,
    lng: 3.4001,
  });

  const location = await locationPromise;

  assert.deepEqual(location, {
    lat: 6.6001,
    lng: 3.4001,
  });

  await new Promise((resolve) => setTimeout(resolve, 250));

  assert.equal(clientBReceived, false);

  clientA.disconnect();
  clientB.disconnect();
  runner.disconnect();
});

test('client stops receiving location updates after disconnecting', async () => {
  const { url } = await createSocketServer();

  const client = await connectClient(url);
  const runner = await connectClient(url);

  client.emit('join:errand', ERRAND_A);
  client.disconnect();

  let received = false;

  client.on('location:update', () => {
    received = true;
  });

  runner.emit('location:update', {
    errandId: ERRAND_A,
    lat: 6.7001,
    lng: 3.5001,
  });

  await new Promise((resolve) => setTimeout(resolve, 250));

  assert.equal(received, false);

  runner.disconnect();
});

test('invalid errand join payload does not create a room', async () => {
  const { url } = await createSocketServer();

  const client = await connectClient(url);

  client.emit('join:errand', '');

  assert.equal(client.connected, true);

  client.disconnect();
});

test('authenticated user can join their own user room', async () => {
  const { url, io } = await createSocketServer();

  const client = await connectClient(url, ACCESS_TOKENS.client);

  const joinResult = await new Promise((resolve) => {
    client.emit('join:user', USERS.client.id, resolve);
  });

  assert.deepEqual(joinResult, {
    success: true,
  });

  const serverSocket = io.sockets.sockets.get(client.id);

  assert.ok(serverSocket);
  assert.equal(serverSocket.rooms.has('user:' + USERS.client.id), true);

  client.disconnect();
});


test('assigned runner cannot spoof another errand location update', async () => {
  const { httpServer } = await createSocketServer();
  const url = `http://localhost:${httpServer.address().port}`;

  const runner = await connectClient(url, ACCESS_TOKENS.runner);

  const joinResult = await new Promise((resolve) => {
    runner.emit('join:errand', ERRAND_A, resolve);
  });

  assert.deepEqual(joinResult, { success: true });

  const updateResult = await new Promise((resolve) => {
    runner.emit(
      'location:update',
      {
        errandId: ERRAND_B,
        lat: 6.5244,
        lng: 3.3792,
      },
      resolve,
    );
  });

  assert.deepEqual(updateResult, {
    success: false,
    error: 'Only the assigned runner can publish location.',
  });

  runner.disconnect();
});

test('reconnect preserves errand authorization boundaries', async () => {
  const { httpServer } = await createSocketServer();
  const url = `http://localhost:${httpServer.address().port}`;

  const client = await connectClient(url, ACCESS_TOKENS.client);

  const firstJoinResult = await new Promise((resolve) => {
    client.emit('join:errand', ERRAND_A, resolve);
  });

  assert.deepEqual(firstJoinResult, { success: true });

  client.disconnect();

  const reconnectedClient = await connectClient(url, ACCESS_TOKENS.client);

  const unauthorizedJoinResult = await new Promise((resolve) => {
    reconnectedClient.emit('join:errand', ERRAND_B, resolve);
  });

  assert.deepEqual(unauthorizedJoinResult, {
    success: false,
    error: 'Not authorized for this errand.',
  });

  const authorizedJoinResult = await new Promise((resolve) => {
    reconnectedClient.emit('join:errand', ERRAND_A, resolve);
  });

  assert.deepEqual(authorizedJoinResult, { success: true });

  reconnectedClient.disconnect();
});

test('authenticated user cannot join another user room', async () => {
  const { url, io } = await createSocketServer();

  const client = await connectClient(url, ACCESS_TOKENS.client);

  const joinResult = await new Promise((resolve) => {
    client.emit('join:user', USERS.runner.id, resolve);
  });

  assert.deepEqual(joinResult, {
    success: false,
    error: 'Not authorized for this user room.',
  });

  const serverSocket = io.sockets.sockets.get(client.id);

  assert.ok(serverSocket);
  assert.equal(serverSocket.rooms.has('user:' + USERS.runner.id), false);

  client.disconnect();
});
