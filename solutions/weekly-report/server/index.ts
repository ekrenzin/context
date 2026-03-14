import Fastify from 'fastify';
import dotenv from 'dotenv';
import { registerRoutes } from './routes';

dotenv.config();

const server = Fastify({ logger: true });

const PORT = parseInt(process.env.PORT || '3000', 10);
const MQTT_URL = process.env.MQTT_URL;

registerRoutes(server);

const start = async () => {
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Weekly Report service listening on port ${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully');
  await server.close();
  process.exit(0);
});

start();