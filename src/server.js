const express = require('express');
const ensureDirectories = require('./utils/ensureDirectories');
const { cleanupAllTempFiles } = require('./utils/cleanup');

// Ensure required directories exist before starting the server
ensureDirectories();

const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const dotenv = require('dotenv');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../swagger.json');
const { generalApiLimiter } = require('./middleware/rateLimits');

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

// Trust proxy headers when deployed behind Vercel / Render / reverse proxy
app.set('trust proxy', 1);

// --- Security middleware ---
// CORS allowlist parsed from CORS_ALLOWED_ORIGINS env (comma-separated).
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const isProd = process.env.NODE_ENV === 'production';
if (allowedOrigins.length === 0) {
  console.warn(
    isProd
      ? '[CORS] CORS_ALLOWED_ORIGINS is empty in production — all cross-origin browser requests will be DENIED. Set it to your admin origin(s).'
      : '[CORS] CORS_ALLOWED_ORIGINS is empty — allowing all origins (development only).'
  );
}

app.use(cors({
  origin: (origin, cb) => {
    // No Origin header = same-origin / curl / native mobile client — always allowed.
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Empty allowlist: permit in dev for convenience, deny in production (fail-closed).
    if (allowedOrigins.length === 0 && !isProd) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

// Strict CSP by default — the API serves JSON; the only HTML is Swagger (own relaxed CSP below).
// upgrade-insecure-requests removed so local http/Swagger isn't force-upgraded pre-TLS.
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'upgrade-insecure-requests': null
    }
  }
}));

// Rate-limit all /api/* requests as a baseline (route-level limiters add extra).
app.use('/api/', generalApiLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// Strip MongoDB operator keys ($, .) from body/query/params — defense-in-depth against NoSQL injection.
app.use(mongoSanitize());
// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Swagger UI needs inline styles/scripts — give it a scoped, relaxed CSP instead of the strict global one.
const swaggerCsp = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https:'],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'https:', 'data:'],
      'connect-src': ["'self'"]
    }
  }
});
app.use('/api-docs', swaggerCsp, swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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

// Legacy HTML dashboards (/login, /change-password, /device-management, /dashboard) and
// the unused checkAuthForDashboard guard were removed — the Angular admin app fully
// replaces them. The backend now serves only the JSON API + Swagger.

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
  const status = err.status || 500;
  // Don't leak internal error details to clients on 5xx in production.
  const expose = status < 500 || process.env.NODE_ENV !== 'production';
  res.status(status).json({
    success: false,
    message: expose ? (err.message || 'Internal Server Error') : 'Internal Server Error',
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
