// @ts-check
import pg from 'pg';
const { Pool } = pg;

/**
 * PostgreSQL connection pool for Project Pumpkin
 * Handles database connections with retry logic and graceful degradation
 */

let pool = null;
let isConnected = false;

/**
 * Get database connection configuration from environment
 */
function getConfig() {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://pumpkin:pumpkin_password@postgres:5432/playwright_metrics';

  return {
    connectionString: databaseUrl,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // Retry configuration
    maxRetries: 5,
    retryDelay: 2000 // 2 seconds between retries
  };
}

/**
 * Initialize database connection pool
 * @returns {Promise<Pool|null>} PostgreSQL pool instance or null if connection fails
 */
export async function initializePool() {
  if (pool) {
    return pool;
  }

  const config = getConfig();
  pool = new Pool({
    connectionString: config.connectionString,
    max: config.max,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: config.connectionTimeoutMillis
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
    isConnected = false;
  });

  // Test connection with retries
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      isConnected = true;
      console.error('✓ Database connection established successfully');
      return pool;
    } catch (error) {
      console.error(`Database connection attempt ${attempt}/${config.maxRetries} failed:`, error.message);

      if (attempt < config.maxRetries) {
        console.error(`Retrying in ${config.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
      } else {
        console.error('⚠ Database connection failed after all retries. Tests will continue without database storage.');
        isConnected = false;
        return null;
      }
    }
  }

  return null;
}

/**
 * Get the database pool instance
 * @returns {Pool|null}
 */
export function getPool() {
  return pool;
}

/**
 * Check if database is connected
 * @returns {boolean}
 */
export function isDatabaseConnected() {
  return isConnected && pool !== null;
}

/**
 * Execute a query with automatic retry on connection failure
 * @param {string} text - SQL query text
 * @param {any[]} params - Query parameters
 * @returns {Promise<any>} Query result or null on failure
 */
export async function query(text, params = []) {
  if (!pool || !isConnected) {
    console.warn('Database not connected. Query skipped:', text.substring(0, 50) + '...');
    return null;
  }

  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error.message);
    console.error('Query:', text);

    // Try to reconnect once
    if (error.message.includes('connection') || error.message.includes('timeout')) {
      console.error('Attempting to reconnect to database...');
      isConnected = false;
      await initializePool();

      // Retry query once after reconnection
      if (isConnected) {
        try {
          const result = await pool.query(text, params);
          return result;
        } catch (retryError) {
          console.error('Query retry failed:', retryError.message);
          return null;
        }
      }
    }

    return null;
  }
}

/**
 * Execute a transaction with multiple queries
 * @param {Function} callback - Async function that receives a client and executes queries
 * @returns {Promise<any>} Transaction result or null on failure
 */
export async function transaction(callback) {
  if (!pool || !isConnected) {
    console.warn('Database not connected. Transaction skipped.');
    return null;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the database pool
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    isConnected = false;
    console.error('Database pool closed');
  }
}

/**
 * Health check - verify database connection is working
 * @returns {Promise<boolean>}
 */
export async function healthCheck() {
  try {
    const result = await query('SELECT NOW() as now, version() as version');
    if (result && result.rows.length > 0) {
      console.error('Database health check passed:', result.rows[0].now);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return false;
  }
}

// Graceful shutdown on process termination
process.on('SIGINT', async () => {
  console.error('\nReceived SIGINT, closing database connections...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('\nReceived SIGTERM, closing database connections...');
  await closePool();
  process.exit(0);
});
