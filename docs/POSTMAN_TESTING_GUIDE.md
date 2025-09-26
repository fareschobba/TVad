# Postman & Emulator Testing Guide for Log Streaming

## Overview
This guide shows you how to test the log streaming feature using Postman for API calls and an emulator/browser for Socket.IO connections.

## Prerequisites

1. **Server Running**: Start your server with `npm start`
2. **Authentication**: You need a valid JWT token
3. **Postman**: Install Postman for API testing
4. **Browser/Emulator**: For Socket.IO connections

## Step 1: Get Authentication Token

### Login Request
```
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "username": "admin",
    "role": "admin"
  }
}
```

**Copy the token** - you'll need it for all subsequent requests.

## Step 2: Test Log Streaming Endpoints

### 2.1 Check System Status
```
GET http://localhost:3001/api/logs/status
Authorization: Bearer YOUR_TOKEN_HERE
```

### 2.2 Get System Information
```
GET http://localhost:3001/api/logs/info
Authorization: Bearer YOUR_TOKEN_HERE
```

### 2.3 View Active Sessions
```
GET http://localhost:3001/api/logs/sessions
Authorization: Bearer YOUR_TOKEN_HERE
```

## Step 3: Test Log Streaming Flow

### 3.1 Request Logs from Device
```
POST http://localhost:3001/api/logs/test/request
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "deviceId": "TEST_DEVICE_001",
  "tags": ["TAG_VIDEO", "TAG_NETWORK"],
  "sessionId": "test-session-123"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Log request sent to device",
  "data": {
    "sessionId": "test-session-123",
    "deviceId": "TEST_DEVICE_001",
    "tags": ["TAG_VIDEO", "TAG_NETWORK"],
    "adminSocketId": "admin-user-id-timestamp",
    "instructions": {
      "emulator": "Listen for event: requestLogs/TEST_DEVICE_001",
      "response": "Send logsData event with the sessionId"
    }
  }
}
```

### 3.2 Simulate Device Sending Logs
```
POST http://localhost:3001/api/logs/test/simulate
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "deviceId": "TEST_DEVICE_001",
  "sessionId": "test-session-123",
  "count": 10
}
```

### 3.3 Stop Log Streaming
```
POST http://localhost:3001/api/logs/test/stop
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "deviceId": "TEST_DEVICE_001",
  "sessionId": "test-session-123"
}
```

## Step 4: Emulator Testing with Socket.IO

### 4.1 Device Emulator (HTML)

Create `device_emulator.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Device Emulator</title>
    <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
</head>
<body>
    <h1>Android TV Device Emulator</h1>
    
    <div>
        <label>Device ID:</label>
        <input type="text" id="deviceId" value="TEST_DEVICE_001">
        <button onclick="connect()">Connect</button>
        <button onclick="disconnect()">Disconnect</button>
    </div>
    
    <div>
        <h3>Status: <span id="status">Disconnected</span></h3>
        <div id="logs"></div>
    </div>

    <script>
        let socket = null;
        let deviceId = 'TEST_DEVICE_001';
        let activeSession = null;

        function connect() {
            deviceId = document.getElementById('deviceId').value;
            socket = io('http://localhost:3001');

            socket.on('connect', () => {
                document.getElementById('status').textContent = 'Connected';
                addLog('Connected to server');
            });

            socket.on('disconnect', () => {
                document.getElementById('status').textContent = 'Disconnected';
                addLog('Disconnected from server');
            });

            // Listen for log requests
            socket.on(`requestLogs/${deviceId}`, (data) => {
                addLog(`Received log request: ${JSON.stringify(data)}`);
                activeSession = data.sessionId;
                
                // Start sending logs
                startSendingLogs(data.sessionId, data.tags);
            });

            // Listen for stop requests
            socket.on(`stopLogs/${deviceId}`, (data) => {
                addLog(`Received stop request: ${JSON.stringify(data)}`);
                activeSession = null;
            });
        }

        function disconnect() {
            if (socket) {
                socket.disconnect();
                socket = null;
            }
        }

        function startSendingLogs(sessionId, tags) {
            if (!socket || !activeSession) return;

            const logInterval = setInterval(() => {
                if (!activeSession || activeSession !== sessionId) {
                    clearInterval(logInterval);
                    return;
                }

                const logs = generateSampleLogs(tags || ['TAG_VIDEO', 'TAG_NETWORK']);
                
                socket.emit('logsData', {
                    sessionId,
                    deviceId,
                    logs
                });

                addLog(`Sent ${logs.length} log entries`);
            }, 2000); // Send logs every 2 seconds
        }

        function generateSampleLogs(tags) {
            const levels = ['V', 'D', 'I', 'W', 'E'];
            const messages = [
                'Video playback started',
                'Network request completed',
                'System status check',
                'Memory usage updated',
                'Download in progress'
            ];

            const logs = [];
            for (let i = 0; i < 3; i++) {
                const timestamp = Date.now() + (i * 100);
                logs.push({
                    timestamp,
                    level: levels[Math.floor(Math.random() * levels.length)],
                    tag: tags[Math.floor(Math.random() * tags.length)],
                    message: messages[Math.floor(Math.random() * messages.length)],
                    deviceId,
                    formattedTime: new Date(timestamp).toISOString()
                });
            }
            return logs;
        }

        function addLog(message) {
            const logs = document.getElementById('logs');
            const logEntry = document.createElement('div');
            logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logs.appendChild(logEntry);
            logs.scrollTop = logs.scrollHeight;
        }
    </script>
</body>
</html>
```

### 4.2 Admin Client (Use existing admin_client_example.html)

Open `admin_client_example.html` in another browser tab to act as the admin client.

## Step 5: Complete Testing Flow

### Test Scenario 1: Basic Flow
1. **Start Device Emulator**: Open `device_emulator.html`, enter device ID, click Connect
2. **Start Admin Client**: Open `admin_client_example.html`, connect to server
3. **Request Logs via Postman**: Use the `/api/logs/test/request` endpoint
4. **Observe**: Device emulator should receive request and start sending logs
5. **Stop Logs via Postman**: Use the `/api/logs/test/stop` endpoint

### Test Scenario 2: Direct Socket.IO Flow
1. **Start Device Emulator**: Connect device emulator
2. **Start Admin Client**: Connect admin client
3. **Request Logs via Admin Client**: Use the web interface to request logs
4. **Observe**: Real-time log streaming between device and admin
5. **Stop via Admin Client**: Stop logs using web interface

### Test Scenario 3: API Simulation
1. **Request Logs via Postman**: Use `/api/logs/test/request`
2. **Simulate Logs via Postman**: Use `/api/logs/test/simulate`
3. **Check Sessions via Postman**: Use `/api/logs/sessions`
4. **Stop via Postman**: Use `/api/logs/test/stop`

## Postman Collection JSON

```json
{
  "info": {
    "name": "Log Streaming API Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3001"
    },
    {
      "key": "token",
      "value": "YOUR_JWT_TOKEN_HERE"
    }
  ],
  "item": [
    {
      "name": "Auth - Login",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"admin@example.com\",\n  \"password\": \"password123\"\n}"
        },
        "url": "{{baseUrl}}/api/auth/login"
      }
    },
    {
      "name": "Logs - Get Status",
      "request": {
        "method": "GET",
        "header": [{"key": "Authorization", "value": "Bearer {{token}}"}],
        "url": "{{baseUrl}}/api/logs/status"
      }
    },
    {
      "name": "Logs - Request from Device",
      "request": {
        "method": "POST",
        "header": [
          {"key": "Content-Type", "value": "application/json"},
          {"key": "Authorization", "value": "Bearer {{token}}"}
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"deviceId\": \"TEST_DEVICE_001\",\n  \"tags\": [\"TAG_VIDEO\", \"TAG_NETWORK\"],\n  \"sessionId\": \"test-session-123\"\n}"
        },
        "url": "{{baseUrl}}/api/logs/test/request"
      }
    },
    {
      "name": "Logs - Simulate Device Logs",
      "request": {
        "method": "POST",
        "header": [
          {"key": "Content-Type", "value": "application/json"},
          {"key": "Authorization", "value": "Bearer {{token}}"}
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"deviceId\": \"TEST_DEVICE_001\",\n  \"sessionId\": \"test-session-123\",\n  \"count\": 5\n}"
        },
        "url": "{{baseUrl}}/api/logs/test/simulate"
      }
    },
    {
      "name": "Logs - Stop Streaming",
      "request": {
        "method": "POST",
        "header": [
          {"key": "Content-Type", "value": "application/json"},
          {"key": "Authorization", "value": "Bearer {{token}}"}
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"deviceId\": \"TEST_DEVICE_001\",\n  \"sessionId\": \"test-session-123\"\n}"
        },
        "url": "{{baseUrl}}/api/logs/test/stop"
      }
    },
    {
      "name": "Logs - Get Active Sessions",
      "request": {
        "method": "GET",
        "header": [{"key": "Authorization", "value": "Bearer {{token}}"}],
        "url": "{{baseUrl}}/api/logs/sessions"
      }
    }
  ]
}
```

## Expected Results

1. **Successful Authentication**: Get JWT token
2. **Log Request**: Device receives `requestLogs/DEVICE_ID` event
3. **Log Streaming**: Device sends `logsData` events with logs
4. **Admin Receives**: Admin client receives filtered logs in real-time
5. **Session Management**: Active sessions tracked in memory
6. **Stop Request**: Device receives `stopLogs/DEVICE_ID` event and stops streaming

## Troubleshooting

1. **401 Unauthorized**: Check your JWT token
2. **Device not receiving events**: Verify device ID matches
3. **No logs received**: Check tag filtering
4. **Connection issues**: Verify server is running on correct port
5. **CORS errors**: Check server CORS configuration
