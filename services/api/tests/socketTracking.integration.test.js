import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { io as createClient } from 'socket.io-client';

import { initSocket } from '../server/socket.js';

const ERRAND_A = '00000000-0000-0000-0000-000000000401';
const ERRAND_B = '00000000-0000-0000-0000-000000000402';

const servers = new Set();

async function createSocketServer() {
  const httpServer = http.createServer();
  const io = initSocket(httpServer);

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

function connectClient(url) {
  return new Promise((resolve, reject) => {
    const socket = createClient(url, {
      transports: ['websocket'],
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

  const client = await connectClient(url);
  const runner = await connectClient(url);

  client.emit('join:errand', ERRAND_A);

  const locationPromise = waitForEvent(client, 'location:update');

  runner.emit('location:update', {
    errandId: ERRAND_A,
    lat: 6.5244,
    lng: 3.3792,
  });

  const location = await locationPromise;

  assert.deepEqual(location, {
    lat: 6.5244,
    lng: 3.3792,
  });

  client.disconnect();
  runner.disconnect();
});

test('location updates are isolated to the matching errand room', async () => {
  const { url } = await createSocketServer();

  const clientA = await connectClient(url);
  const clientB = await connectClient(url);
  const runner = await connectClient(url);

  clientA.emit('join:errand', ERRAND_A);
  clientB.emit('join:errand', ERRAND_B);

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
