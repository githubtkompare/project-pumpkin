import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';
import { initializePool, healthCheck } from './database/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve test-history for screenshots and HAR files
app.use('/test-history', express.static(path.join(__dirname, '../test-history')));

// API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbHealthy = await healthCheck();
  res.json({
    status: 'ok',
    service: 'Project Pumpkin',
    database: dbHealthy ? 'connected' : 'disconnected'
  });
});

// Initialize database and start server
async function start() {
  // Initialize database connection
  await initializePool();

  // Start server
  app.listen(PORT, () => {
    console.log(`🐈 Project Pumpkin server running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔌 API: http://localhost:${PORT}/api`);
  });
}

start();
