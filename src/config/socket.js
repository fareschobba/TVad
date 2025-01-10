
const socketIO = require('socket.io');
const { emit } = require('../server');

let io;

module.exports = {
  init: (server) => {
    io = socketIO(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });

      socket.on("message", (data) => {
        console.log(data);
      });

      // Listen for "currentAd/{deviceId}" event
      socket.on("currentAd/:deviceId", (data) => {
        const deviceId = data.deviceId;
        socket.emit(`currentAd/${deviceId}`, data);
        console.log(data);
      });

      // Listen for "TVState/{deviceId}" event
      socket.on("TVState/:deviceId", (data) => {
        const deviceId = data.deviceId;
        console.log("Received TVState event for device:", deviceId);
        console.log("Data:", data);
      });

      // Listen for "SystemState/{deviceId}" event
      socket.on("SystemState/:deviceId", (data) => {
        const deviceId = data.deviceId;
        console.log("Received SystemState event for device:", deviceId);
        console.log("Data:", data);
      });

      // Listen for "AppState/{deviceId}" event
      socket.on("AppState/:deviceId", (data) => {
        const deviceId = data.deviceId;
        console.log("Received AppState event for device:", deviceId);
        console.log("Data:", data);
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!');
    }
    return io;
  }
};