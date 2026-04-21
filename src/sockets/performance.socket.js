const socketIO = require('socket.io');
const { verifyToken } = require('../utils/jwt.util');
const logger = require('../utils/logger');

let io;

// Initialize Socket.io
exports.initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: [process.env.CLIENT_URL, process.env.ADMIN_URL],
      credentials: true,
    },
  });

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = verifyToken(token);
      socket.userId = decoded.id;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.userId}`);

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Subscribe to product performance updates
    socket.on('subscribe:product', (data) => {
      const { productId } = data;
      socket.join(`product:${productId}`);
      logger.info(`User ${socket.userId} subscribed to product ${productId}`);
    });

    // Unsubscribe from product
    socket.on('unsubscribe:product', (data) => {
      const { productId } = data;
      socket.leave(`product:${productId}`);
      logger.info(`User ${socket.userId} unsubscribed from product ${productId}`);
    });

    // Subscribe to investment updates
    socket.on('subscribe:investment', (data) => {
      const { investmentId } = data;
      socket.join(`investment:${investmentId}`);
      logger.info(`User ${socket.userId} subscribed to investment ${investmentId}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userId}`);
    });
  });

  logger.info('✅ Socket.io initialized');
};

// Get Socket.io instance
exports.getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

// Emit performance update to all subscribers
exports.emitPerformanceUpdate = (productId, data) => {
  if (io) {
    io.to(`product:${productId}`).emit('performance:update', {
      productId,
      ...data,
      timestamp: new Date(),
    });
    logger.info(`Performance update emitted for product ${productId}`);
  }
};

// Emit investment update to specific user
exports.emitInvestmentUpdate = (investmentId, userId, data) => {
  if (io) {
    io.to(`user:${userId}`).emit('investment:update', {
      investmentId,
      ...data,
      timestamp: new Date(),
    });
    logger.info(`Investment update emitted for investment ${investmentId}`);
  }
};

// Emit wallet update to user
exports.emitWalletUpdate = (userId, data) => {
  if (io) {
    io.to(`user:${userId}`).emit('wallet:update', {
      ...data,
      timestamp: new Date(),
    });
    logger.info(`Wallet update emitted for user ${userId}`);
  }
};

// Emit notification to user
exports.emitNotification = (userId, notification) => {
  if (io) {
    io.to(`user:${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date(),
    });
    logger.info(`Notification emitted to user ${userId}`);
  }
};

// Broadcast to all connected users
exports.broadcastToAll = (event, data) => {
  if (io) {
    io.emit(event, {
      ...data,
      timestamp: new Date(),
    });
    logger.info(`Broadcast emitted: ${event}`);
  }
};
