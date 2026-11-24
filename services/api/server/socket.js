import { Server } from 'socket.io';
import {
  verifyAccessToken,
  getApplicationUser,
  isEmailVerifiedAuthUser,
  hasActiveRunnerCapability,
} from '../modules/protect/index.js';

const SUPPORTED_PROFILE_ROLES = new Set([
  'client',
  'runner',
  'admin',
  'super_admin',
]);
const EMAIL_VERIFIED_SOCKET_ROLES = new Set(['client', 'runner']);

export function initSocket(
  server,
  protect = {
    verifyAccessToken,
    getApplicationUser,
    hasActiveRunnerCapability,
  },
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

      if (accountResult.user.id !== authResult.user.id) {
        return next(new Error('Application user not found.'));
      }

      if (!SUPPORTED_PROFILE_ROLES.has(accountResult.user.role)) {
        return next(new Error('Unsupported account role.'));
      }

      const emailVerified = isEmailVerifiedAuthUser(authResult.user);
      if (
        !emailVerified &&
        EMAIL_VERIFIED_SOCKET_ROLES.has(accountResult.user.role)
      ) {
        return next(new Error('Email verification is required.'));
      }

      socket.user = {
        ...accountResult.user,
        id: authResult.user.id,
        emailVerified,
      };

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
          if (
            socket.user.role === 'runner' &&
            !(await isActiveRunner(socket.user))
          ) {
            return respond({
              success: false,
              error: 'Not authorized for this errand.',
            });
          }

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

          const isClient =
            ['client', 'runner'].includes(socket.user.role) &&
            socket.user.emailVerified &&
            errand.client_id === socket.user.id;
          const isAssignedRunner =
            socket.user.role === 'runner' &&
            (await isActiveRunner(socket.user)) &&
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

        if (
          socket.user.role !== 'runner' ||
          !(await isActiveRunner(socket.user)) ||
          errand.assigned_runner_id !== socket.user.id
        ) {
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

      if (
        ['client', 'runner'].includes(socket.user.role) &&
        !socket.user.emailVerified
      ) {
        return respond({
          success: false,
          error: 'Email verification is required.',
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

  async function isActiveRunner(user) {
    return (
      user.role === 'runner' &&
      user.emailVerified &&
      user.verified === true &&
      (await protect.hasActiveRunnerCapability(user.id))
    );
  }

  return io;
}
