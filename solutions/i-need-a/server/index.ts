import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import routes from './routes.js';

dotenv.config();

const fastify = Fastify({
  logger: true
});

fastify.register(cors, {
  origin: true
});

fastify.register(routes);

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully');
  await fastify.close();
  process.exit(0);
});

start();