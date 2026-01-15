import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env.js';
import { prisma, connectDatabase, disconnectDatabase } from './db/client.js';
import healthRoutes from './routes/health.js';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: config.cors.origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-View-Key', 'X-Priv-Key'],
    maxAge: 86400,
  })
);

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan(config.server.isDev ? 'dev' : 'combined'));

// Routes
app.use('/api/health', healthRoutes);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'OneKey Locker API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      createBlob: 'POST /api/blob',
      readBlob: 'GET /api/blob/:id',
      updateBlob: 'PUT /api/blob/:id',
    },
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Server startup
async function start() {
  try {
    await connectDatabase();

    const server = app.listen(config.server.port, config.server.host, () => {
      console.log('OneKey Locker API Server');
      console.log(`--> Server running on http://${config.server.host}:${config.server.port}`);
      console.log(`--> Environment: ${config.server.isDev ? 'development' : 'production'}`);
      console.log(`--> CORS origins: ${config.cors.origins.join(', ')}`);
      console.log(`--> Database connected`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await disconnectDatabase();
        console.log('Server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
