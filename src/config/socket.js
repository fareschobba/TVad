
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
      socket.on("currentAd", (data) => {
        const deviceId = data.deviceId;
        console.log("Received currentAd event for device:", deviceId);
        console.log("Data:", data);

        // Broadcast the update to all clients (including the web page)
        io.emit("currentAdWeb", data);
      });

      // Listen for "TVState/{deviceId}" event
      socket.on("TVState", (data) => {
        const deviceId = data.deviceId;
        console.log("Received TVState event for device:", deviceId);
        console.log("Data:", data);

        // Broadcast the update to all clients
        io.emit("TVStateWeb", data);
      });

      // Listen for "SystemState/{deviceId}" event
      socket.on("SystemState", (data) => {
        const deviceId = data.deviceId;
        console.log("Received SystemState event for device:", deviceId);
        console.log("Data:", data);

        // Broadcast the update to all clients
        io.emit("SystemStateWeb", data);
      });

      // Listen for "AppState/{deviceId}" event
      socket.on("AppState", (data) => {
        const deviceId = data.deviceId;
        console.log("Received AppState event for device:", deviceId);
        console.log("Data:", data);

        // Broadcast the update to all clients
        io.emit("AppStateWeb", data);
      });

      // Listen for CheckStates event
      socket.on("checkStates", (data) => {

        data.devices.forEach((deviceId) => {
          // Emit a "CheckState/$deviceId" event for each code

          io.emit(`checkState/${deviceId}`, "checkState");

          console.log(`Emitted event: checkState/${deviceId}`);
        });

      });

      // Listen for CheckStates event
      socket.on("returnState", (data) => {

        io.emit(`returnStateWeb`, data);

        console.log(`returnStateWeb data: ${data}`);

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