require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/database');
const { createServer } = require('http');
const { initializeSocket } = require('./src/sockets/performance.socket');
const { initializeCronJobs } = require('./src/services/cron.service');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = createServer(app);

// Initialize Socket.io
initializeSocket(server);

// Connect to databases and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Initialize cron jobs
    initializeCronJobs();
    
    // Start server on all network interfaces (0.0.0.0) to allow connections from iOS simulator
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      logger.info(`📱 Client URL: ${process.env.CLIENT_URL}`);
      logger.info(`🔧 Admin URL: ${process.env.ADMIN_URL}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('💥 UNHANDLED REJECTION! Shutting down...', err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    logger.info('💥 Process terminated!');
  });
});

startServer();
