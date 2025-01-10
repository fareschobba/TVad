const socketIO = require('socket.io');

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

      socket.on("currentAd/SLQHX", (data) => {
        console.log(data);
      });

      // Listen for "TVState/{deviceId}" event
    socket.on("TVState/SLQHX", (data) => {
      console.log("Received TVState event for device:", data.deviceId);
      console.log("Data:", data);
  });

  // Listen for "SystemState/{deviceId}" event
  socket.on("SystemState/SLQHX", (data) => {
      console.log("Received SystemState event for device:", data.deviceId);
      console.log("Data:", data);
  });

  // Listen for "AppState/{deviceId}" event
  socket.on("AppState/SLQHX", (data) => {
      console.log("Received AppState event for device:", data.deviceId);
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
