# Quick Test Guide - Log Streaming Feature

## 🚀 Quick Start (5 Minutes)

### Step 1: Start the Server
```bash
npm start
```
Server should start on `http://localhost:3001`

### Step 2: Import Postman Collection
1. Open Postman
2. Click "Import" 
3. Select `Log_Streaming_Tests.postman_collection.json`
4. Collection will be imported with all test endpoints

### Step 3: Get Authentication Token
1. In Postman, go to "Authentication" → "Login"
2. Update the request body with your credentials:
   ```json
   {
     "email": "your-admin-email@example.com",
     "password": "your-password"
   }
   ```
3. Send the request
4. Token will be automatically saved to collection variables

### Step 4: Test Basic Endpoints
Run these requests in order:
1. **Health Check** - Verify server is running
2. **Log System Status** - Check log streaming system
3. **Log System Info** - Get detailed system information

### Step 5: Test Log Streaming
1. **Request Logs from Device** - Simulates admin requesting logs
2. **Get Active Sessions** - Verify session was created
3. **Simulate Device Logs** - Simulates device sending logs
4. **Stop Log Streaming** - Stops the session

## 🖥️ Testing with Device Emulator

### Step 1: Open Device Emulator
1. Open `device_emulator.html` in your browser
2. Enter Device ID: `TEST_DEVICE_001`
3. Click "Connect"

### Step 2: Open Admin Client
1. Open `admin_client_example.html` in another browser tab
2. Connect to server
3. Enter same Device ID: `TEST_DEVICE_001`

### Step 3: Test Real-Time Streaming
1. In Admin Client: Click "Start Log Streaming"
2. In Device Emulator: Watch for incoming log requests
3. Device will automatically start sending logs
4. Admin Client will display logs in real-time
5. Click "Stop Log Streaming" to end session

## 📱 Testing with Postman + Emulator

### Scenario 1: Postman Triggers, Emulator Responds
1. **Device Emulator**: Connect to server
2. **Postman**: Send "Request Logs from Device"
3. **Device Emulator**: Will receive request and start sending logs
4. **Postman**: Send "Stop Log Streaming"
5. **Device Emulator**: Will stop sending logs

### Scenario 2: Full API Testing
1. **Postman**: Run "Complete Test Flow" folder
2. This will:
   - Check initial sessions
   - Request logs from device
   - Verify session creation
   - Simulate device logs
   - Stop streaming
   - Verify session cleanup

## 🔧 Test Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Server health check |
| `/api/logs/status` | GET | Log system status |
| `/api/logs/info` | GET | System information |
| `/api/logs/sessions` | GET | Active sessions |
| `/api/logs/test/request` | POST | Request logs from device |
| `/api/logs/test/simulate` | POST | Simulate device logs |
| `/api/logs/test/stop` | POST | Stop log streaming |

## 📋 Test Scenarios

### Test 1: Basic API Flow
```bash
# 1. Login
POST /api/auth/login

# 2. Check status
GET /api/logs/status

# 3. Request logs
POST /api/logs/test/request
{
  "deviceId": "TEST_DEVICE_001",
  "tags": ["TAG_VIDEO", "TAG_NETWORK"]
}

# 4. Check sessions
GET /api/logs/sessions

# 5. Simulate logs
POST /api/logs/test/simulate
{
  "deviceId": "TEST_DEVICE_001",
  "sessionId": "your-session-id",
  "count": 5
}

# 6. Stop logs
POST /api/logs/test/stop
{
  "deviceId": "TEST_DEVICE_001",
  "sessionId": "your-session-id"
}
```

### Test 2: Socket.IO Flow
1. **Admin Client** → Connect → Request logs
2. **Device Emulator** → Receives request → Sends logs
3. **Admin Client** → Receives logs in real-time
4. **Admin Client** → Stop logs
5. **Device Emulator** → Stops sending logs

### Test 3: Mixed Flow
1. **Postman** → Request logs via API
2. **Device Emulator** → Receives Socket.IO event
3. **Device Emulator** → Sends logs via Socket.IO
4. **Admin Client** → Receives logs in real-time
5. **Postman** → Stop logs via API

## ✅ Expected Results

### Successful Log Request:
```json
{
  "success": true,
  "message": "Log request sent to device",
  "data": {
    "sessionId": "test-session-123",
    "deviceId": "TEST_DEVICE_001",
    "tags": ["TAG_VIDEO", "TAG_NETWORK"],
    "adminSocketId": "admin-user-id-timestamp"
  }
}
```

### Active Sessions:
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "test-session-123",
      "deviceId": "TEST_DEVICE_001",
      "adminSocketId": "admin-socket-id",
      "tags": ["TAG_VIDEO", "TAG_NETWORK"],
      "isActive": true,
      "startedAt": "2024-01-01T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Log Simulation:
```json
{
  "success": true,
  "message": "Simulated 5 log entries sent",
  "data": {
    "sessionId": "test-session-123",
    "deviceId": "TEST_DEVICE_001",
    "logCount": 5,
    "sampleLogs": [...]
  }
}
```

## 🐛 Troubleshooting

### Common Issues:

1. **401 Unauthorized**
   - Solution: Run login request first to get token

2. **Device not receiving events**
   - Check device ID matches exactly
   - Verify device emulator is connected

3. **No logs in admin client**
   - Check tag filtering
   - Verify session is active
   - Check browser console for errors

4. **Connection refused**
   - Verify server is running on port 3001
   - Check firewall settings

### Debug Commands:
```bash
# Check server logs
npm start

# Check active sessions
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/logs/sessions

# Check system status
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/logs/status
```

## 📊 Performance Testing

### Load Test with Multiple Devices:
1. Open multiple device emulator tabs with different device IDs
2. Use Postman to request logs from all devices
3. Monitor server performance and memory usage
4. Test with different tag combinations

### Stress Test:
1. Create multiple sessions simultaneously
2. Simulate high-frequency log generation
3. Test session cleanup on disconnect
4. Monitor memory usage for leaks

## 🎯 Success Criteria

- ✅ Server starts without errors
- ✅ Authentication works correctly
- ✅ Log requests reach devices via Socket.IO
- ✅ Devices can send logs back to server
- ✅ Admins receive filtered logs in real-time
- ✅ Sessions are properly managed and cleaned up
- ✅ Multiple admins can monitor same device
- ✅ Tag filtering works correctly
- ✅ Stop requests properly end sessions

Your log streaming system is working correctly if all these criteria are met! 🎉
