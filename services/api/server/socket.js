import { Server } from 'socket.io';
import {
  verifyAccessToken,
  getApplicationUser,
} from '../modules/protect/index.js';

export function initSocket(
  server,
  protect = { verifyAccessToken, getApplicationUser },
  socketAccess = {}
) {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const {
    getErrand,
    isUserAuthorizedForErrand,
  } = socketAccess;

  io.use(async (socket, next) => {
    try {
      const accessToken = socket.handshake.auth?.accessToken;

      if (!accessToken) {
        return next(new Error('Authentication required.'));
      }

      const authResult = await protect.verifyAccessToken(accessToken);

      if (!authResult.success) {
        return next(
          new Error(authResult.message ?? 'Invalid access token.')
        );
      }

      const accountResult = await protect.getApplicationUser(
        authResult.user.id
      );

      if (!accountResult.success) {
        return next(
          new Error(
            accountResult.message ?? 'Application user not found.'
          )
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

    socket.on('join:errand', async (errandId, callback) => {
      const respond = typeof callback === 'function' ? callback : () => {};

      if (!errandId || typeof errandId !== 'string') {
        return respond({
          success: false,
          error: 'Invalid errand ID.',
        });
      }

      try {
        if (typeof isUserAuthorizedForErrand === 'function') {
          const authorized = await isUserAuthorizedForErrand(
            socket.user,
            errandId
          );

          if (!authorized) {
            return respond({
              success: false,
              error: 'Not authorized for this errand.',
            });
          }
        } else if (typeof getErrand === 'function') {
          const errand = await getErrand(errandId);

          if (!errand) {
            return respond({
              success: false,
              error: 'Errand not found.',
            });
          }

          const isClient = errand.client_id === socket.user.id;
          const isAssignedRunner =
            errand.assigned_runner_id === socket.user.id;

          if (!isClient && !isAssignedRunner) {
            return respond({
              success: false,
              error: 'Not authorized for this errand.',
            });
          }
        } else {
          return respond({
            success: false,
            error: 'Errand authorization unavailable.',
          });
        }

        await socket.join(`errand:${errandId}`);

        return respond({
          success: true,
        });
      } catch (_error) {
        return respond({
          success: false,
          error: 'Unable to authorize errand room.',
        });
      }
    });

    socket.on('location:update', async (payload, callback) => {
      const respond = typeof callback === 'function' ? callback : () => {};

      if (!payload || typeof payload !== 'object') {
        return respond({
          success: false,
          error: 'Invalid location payload.',
        });
      }

      const { errandId, lat, lng } = payload;

      if (
        !errandId ||
        typeof errandId !== 'string' ||
        typeof lat !== 'number' ||
        typeof lng !== 'number'
      ) {
        return respond({
          success: false,
          error: 'Invalid location payload.',
        });
      }

      try {
        if (typeof getErrand !== 'function') {
          return respond({
            success: false,
            error: 'Errand authorization unavailable.',
          });
        }

        const errand = await getErrand(errandId);

        if (!errand) {
          return respond({
            success: false,
            error: 'Errand not found.',
          });
        }

        if (errand.assigned_runner_id !== socket.user.id) {
          return respond({
            success: false,
            error: 'Only the assigned runner can publish location.',
          });
        }

        if (!socket.rooms.has(`errand:${errandId}`)) {
          return respond({
            success: false,
            error: 'Join the errand room before publishing location.',
          });
        }

        socket.to(`errand:${errandId}`).emit('location:update', {
          lat,
          lng,
        });

        return respond({
          success: true,
        });
      } catch (_error) {
        return respond({
          success: false,
          error: 'Unable to publish location.',
        });
      }
    });

    socket.on('join:user', (userId, callback) => {
      const respond = typeof callback === 'function' ? callback : () => {};

      if (!userId || typeof userId !== 'string') {
        return respond({
          success: false,
          error: 'Invalid user ID.',
        });
      }

      if (userId !== socket.user.id) {
        return respond({
          success: false,
          error: 'Not authorized for this user room.',
        });
      }

      socket.join(`user:${socket.user.id}`);

      return respond({
        success: true,
      });
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected');
    });
  });

  return io;
}
