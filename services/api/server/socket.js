const { Server } = require('socket.io');

let io;

function init(server) {
  io = new Server(server, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
      socket.join(userId);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });
}

function emitToUser(userId, event, data) {
  if (io) {
    io.to(userId).emit(event, data);
  }
}

module.exports = { init, emitToUser };