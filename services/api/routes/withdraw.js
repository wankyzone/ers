const { emitToUser } = require('../socket');

// Example lifecycle updates:

emitToUser(userId, 'withdrawal:update', {
  id: withdrawal.id,
  status: 'pending',
});

setTimeout(() => {
  emitToUser(userId, 'withdrawal:update', {
    id: withdrawal.id,
    status: 'processing',
  });
}, 3000);

setTimeout(() => {
  emitToUser(userId, 'withdrawal:update', {
    id: withdrawal.id,
    status: 'completed',
  });
}, 8000);