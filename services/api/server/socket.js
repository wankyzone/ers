import { Server } from 'socket.io';

export function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
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
