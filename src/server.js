const express = require('express');
const ensureDirectories = require('./utils/ensureDirectories');
const { cleanupAllTempFiles } = require('./utils/cleanup');

// Ensure required directories exist before starting the server
ensureDirectories();

const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../swagger.json');

// Load environment variables
dotenv.config();

// Run cleanup every hour
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

// Initial cleanup when server starts
cleanupAllTempFiles().catch(err => {
  console.error('Initial cleanup failed:', err);
});

// Schedule regular cleanup
setInterval(() => {
  cleanupAllTempFiles().catch(err => {
    console.error('Scheduled cleanup failed:', err);
  });
}, CLEANUP_INTERVAL);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdir(uploadsDir, { recursive: true })
  .catch(err => console.error('Error creating uploads directory:', err));

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Add this before your routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const socketConfig = require('./config/socket');
const io = socketConfig.init(server);

// Import routes
const deviceRoutes = require('./routes/deviceRoutes');
const advertisementRoutes = require('./routes/advertisementRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const userRoutes = require('./routes/userRoutes');
const cloudinaryAdvertisementRoutes = require('./routes/cloudinaryAdvertisementRoutes');
const logRoutes = require('./routes/logRoutes');

// Import authentication middleware
const { protect } = require('./middleware/authMiddleware');

// Use routes
app.use('/api/devices', deviceRoutes);
app.use('/api/advertisements', advertisementRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cloudinary-advertisements', cloudinaryAdvertisementRoutes);
app.use('/api/logs', logRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login route (public)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'login.html'));
});

// Change password route
app.get('/change-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'change-password.html'));
});

// Middleware to check authentication for dashboard routes
const checkAuthForDashboard = async (req, res, next) => {
  try {
    // Check for token in various places
    const authHeader = req.headers.authorization;
    const tokenFromQuery = req.query.token;
    const tokenFromCookie = req.cookies?.authToken;

    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (tokenFromQuery) {
      token = tokenFromQuery;
    } else if (tokenFromCookie) {
      token = tokenFromCookie;
    }

    // If no token found, redirect to login
    if (!token) {
      const redirectUrl = encodeURIComponent(req.originalUrl);
      return res.redirect(`/login?redirect=${redirectUrl}`);
    }

    // Verify the token
    const jwt = require('jsonwebtoken');
    const AdminUser = require('./models/adminUser');

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await AdminUser.findById(decoded.id);

      if (!user || user.isDeleted || !user.isActive) {
        const redirectUrl = encodeURIComponent(req.originalUrl);
        return res.redirect(`/login?redirect=${redirectUrl}&error=invalid_token`);
      }

      // Token is valid, proceed
      next();
    } catch (jwtError) {
      // Invalid token, redirect to login
      const redirectUrl = encodeURIComponent(req.originalUrl);
      return res.redirect(`/login?redirect=${redirectUrl}&error=invalid_token`);
    }
  } catch (error) {
    console.error('Dashboard auth check error:', error);
    const redirectUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?redirect=${redirectUrl}&error=server_error`);
  }
};

// Device management dashboard route (public - frontend handles auth)
app.get('/device-management', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'device_management.html'));
});

// Professional dashboard route (public - frontend handles auth)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'professional_dashboard.html'));
});

// App restart test route
app.get('/test/restart-app', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'test_restart_app.html'));
});

// Dark mode demo route
app.get('/demo/dark-mode', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dark_mode_demo.html'));
});

// Database connection
const mongooseOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Root route
app.get("/", (req, res) => res.send("Express with Socket.IO"));

// Basic error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
// if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
// }

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

module.exports = app;
