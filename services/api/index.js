import { createApiServer, registeredRoutes } from './app.js';
import { startEscrowAutoReleaseScheduler } from './jobs/escrow.js';

const PORT = process.env.PORT || 3000;

const { server } = createApiServer();

startEscrowAutoReleaseScheduler();

server.listen(PORT, () => {
  console.log(`🚀 ERS API running on port ${PORT}`);
  console.log('REGISTERED ROUTES');
  console.log(registeredRoutes());
});
