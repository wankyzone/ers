import { Server } from 'socket.io';
import {
  verifyAccessToken,
  getApplicationUser,
} from '../modules/protect/index.js';

export function initSocket(
  server,
  protect = { verifyAccessToken, getApplicationUser }
) {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const accessToken = socket.handshake.auth?.accessToken;

      if (!accessToken) {
        return next(new Error('Authentication required.'));
      }

      const authResult = await protect.verifyAccessToken(accessToken);

      if (!authResult.success) {
        return next(new Error(authResult.message ?? 'Invalid access token.'));
      }

      const accountResult = await protect.getApplicationUser(
        authResult.user.id
      );

      if (!accountResult.success) {
        return next(
          new Error(accountResult.message ?? 'Application user not found.')
        );
      }

      socket.user = accountResult.user;
      return next();
    } catch (_error) {
      return next(new Error('Authentication service unavailable.'));
    }
  });

  io.on('connection', (socket) => {
    console.log('⚡ Client connected');

    socket.on('join:errand', (errandId) => {
      if (!errandId) return;
      socket.join(`errand:${errandId}`);
    });

    socket.on('location:update', ({ errandId, lat, lng }) => {
      if (!errandId) return;

      socket.to(`errand:${errandId}`).emit('location:update', {
        lat,
        lng,
      });
    });

    // Withdrawal realtime
    socket.on('join:user', (userId) => {
      if (!userId) return;
      socket.join(`user:${userId}`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected');
    });
  });

  return io;
}
