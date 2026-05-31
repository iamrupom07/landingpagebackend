import app from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';

const PORT = Number(env.PORT);

async function bootstrap() {
  await prisma.$connect();
  console.log('✅ Database connected');

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${env.NODE_ENV}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — starting graceful shutdown...`);
    server.close(async () => {
      console.log('🔌 HTTP server closed');
      await prisma.$disconnect();
      console.log('🗄️  Database disconnected');
      process.exit(0);
    });
    setTimeout(() => { console.error('❌ Forced exit'); process.exit(1); }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => { console.error('💥 Unhandled rejection:', reason); });
  process.on('uncaughtException',  (err)    => { console.error('💥 Uncaught exception:', err); process.exit(1); });
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
