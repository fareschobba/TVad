const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Use routes
app.use('/api/devices', deviceRoutes);
app.use('/api/advertisements', advertisementRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/auth', authRoutes);
    // Handle custom events from the client
   
// Database connection
const mongooseOptions = {
  // useNewUrlParser: true,
  // useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
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

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle custom events from the client
  socket.on('message', (data) => {
    console.log('Message received:', data);
    // Emit an acknowledgment or broadcast to all clients
    io.emit('message', `Server received: ${data}`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

app.get("/", (req, res) => res.send("Express with Socket.IO"));

// Basic error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Start server
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

module.exports = { app, io };
