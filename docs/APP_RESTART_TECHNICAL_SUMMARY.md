# 🔄 App Restart Functionality - Technical Summary

## Overview

This document provides a comprehensive technical summary of the App Restart functionality implemented for the Android TV device management system. This feature allows remote restarting of the TV Ad application on Android TV devices using Socket.IO real-time communication.

## 🚀 Quick Access

### Dashboard URLs
- **Device Management Dashboard**: `http://localhost:3001/device-management`
- **Professional Log Dashboard**: `http://localhost:3001/dashboard`

### API Endpoints
- **Restart App**: `POST /api/devices/{deviceId}/app/restart`

## 🔄 App Restart System

### Socket.IO Events

#### Restart App Request (Admin → Device)
```javascript
socket.emit('restartApp', {
    deviceId: 'DEVICE_ID',
    requestId: 'unique_request_id'
});
```

#### App Restarted Response (Device → Admin)
```javascript
socket.on('appRestarted', (data) => {
    if (data.success) {
        console.log(`✅ ${data.message}`);
        console.log(`Restart time: ${data.restartTime}ms`);
    } else {
        console.error(`❌ ${data.message}`);
        console.error(`Error: ${data.error}`);
    }
});
```

### REST API Usage

#### Restart App via API
```bash
POST /api/devices/DEVICE_ID/app/restart
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Response:**
```json
{
    "success": true,
    "message": "App restart request sent to device",
    "data": {
        "deviceId": "DEVICE_ID",
        "requestId": "restart_api_1234567890_abc123",
        "timestamp": "2024-01-15T10:30:00.000Z"
    }
}
```

## 🛠️ Backend Implementation

### Socket.IO Event Handlers (src/config/socket.js)

```javascript
// Listen for app restart requests from admin
socket.on('restartApp', (data) => {
    const { deviceId, requestId } = data;
    console.log(`App restart request for device ${deviceId}, requestId: ${requestId}`);

    // Forward to specific device
    io.emit(`restartApp/${deviceId}`, {
        requestId,
        adminSocketId: socket.id
    });

    console.log(`Emitted restartApp/${deviceId} event`);
});

// Listen for app restart responses from devices
socket.on('appRestarted', (data) => {
    console.log('App restart response received:', data);

    // Broadcast to all admin clients
    io.emit('appRestarted', data);
});
```

### Controller Function (src/controllers/deviceController.js)

```javascript
const restartApp = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const userId = req.user._id;
        const userRole = req.user.role;

        // Verify device exists and user has access
        let query = { deviceId, isDeleted: false };
        if (userRole !== 'admin' && userRole !== 'SUPERADMIN') {
            query.userId = userId;
        }

        const device = await Device.findOne(query);
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found or access denied'
            });
        }

        const requestId = `restart_api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Get Socket.IO instance
        const socketConfig = require('../config/socket');
        const io = socketConfig.getIO();

        if (!io) {
            return res.status(503).json({
                success: false,
                message: 'Socket.IO service unavailable'
            });
        }

        // Emit app restart request
        io.emit(`restartApp/${deviceId}`, {
            requestId,
            adminSocketId: `api_${userId}`
        });

        res.status(200).json({
            success: true,
            message: 'App restart request sent to device',
            data: {
                deviceId,
                requestId,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error in restartApp:', error);
        res.status(500).json({
            success: false,
            message: 'Unable to restart app. Please try again later.'
        });
    }
};
```

### Route Definition (src/routes/deviceRoutes.js)

```javascript
router.post('/:deviceId/app/restart', restartApp); // Restart app
```

## 🎯 Frontend Implementation

### HTML Interface
- **Restart Button**: Provides one-click app restart functionality
- **Status Display**: Shows real-time restart status and results
- **Confirmation Dialog**: Prevents accidental restarts

### JavaScript Functions

```javascript
// Restart app function
function restartApp() {
    const deviceId = document.getElementById('deviceSelect').value;

    if (!deviceId) {
        alert('Please select a device first');
        return;
    }

    if (!socket || !socket.connected) {
        alert('Not connected to server');
        return;
    }

    // Confirmation dialog
    if (!confirm('Are you sure you want to restart the application?')) {
        return;
    }

    const requestId = `restart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update UI
    const btn = document.getElementById('restartAppBtn');
    btn.innerHTML = '<div class="loading"></div> Restarting...';
    btn.disabled = true;

    updateRestartStatus('Requesting app restart...', 'info');

    // Send app restart request
    socket.emit('restartApp', {
        deviceId,
        requestId
    });

    addLog(`Requesting app restart for device: ${deviceId}`, 'system');

    // Reset button after timeout
    setTimeout(() => {
        btn.innerHTML = '🔄 Restart App';
        btn.disabled = false;
    }, 15000); // Longer timeout for app restart
}

// Socket event listener
socket.on('appRestarted', (data) => {
    if (data.success) {
        updateRestartStatus(`✅ ${data.message}`, 'success');
        addLog(`App restarted successfully: ${data.message}`, 'success');
    } else {
        updateRestartStatus(`❌ ${data.message}`, 'error');
        addLog(`App restart failed: ${data.message}`, 'error');
    }
});
```

## 📱 Kotlin Implementation Requirements

### Socket.IO Event Listener

The Android TV app needs to implement the following Socket.IO event listener:

```kotlin
// Listen for restart requests
socket.on("restartApp/$DEVICE_ID") { args ->
    handleRestartRequest(args[0] as JSONObject)
}

private fun handleRestartRequest(data: JSONObject) {
    val requestId = data.getString("requestId")
    val adminSocketId = data.getString("adminSocketId")
    
    Log.d(TAG_SOCKET, "Received app restart request: $requestId")
    
    try {
        // Perform app restart
        restartApplication()
        
        // Send success response
        val response = JSONObject().apply {
            put("success", true)
            put("message", "Application restarted successfully")
            put("deviceId", DEVICE_ID)
            put("requestId", requestId)
            put("adminSocketId", adminSocketId)
            put("restartTime", System.currentTimeMillis())
            put("timestamp", System.currentTimeMillis())
        }
        
        socket.emit("appRestarted", response)
        Log.d(TAG_SOCKET, "App restart completed successfully")
        
    } catch (e: Exception) {
        Log.e(TAG_SOCKET, "App restart failed", e)
        
        // Send error response
        val response = JSONObject().apply {
            put("success", false)
            put("message", "Application restart failed")
            put("error", e.message ?: "Unknown error")
            put("deviceId", DEVICE_ID)
            put("requestId", requestId)
            put("adminSocketId", adminSocketId)
            put("timestamp", System.currentTimeMillis())
        }
        
        socket.emit("appRestarted", response)
    }
}

private fun restartApplication() {
    // Method 1: Using ActivityManager (requires system permissions)
    val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    activityManager.restartPackage(packageName)
    
    // Method 2: Self-restart approach
    val intent = packageManager.getLaunchIntentForPackage(packageName)
    intent?.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
    startActivity(intent)
    
    // Force exit current process
    android.os.Process.killProcess(android.os.Process.myPid())
}
```

### Required Permissions

Add to AndroidManifest.xml:
```xml
<uses-permission android:name="android.permission.RESTART_PACKAGES" />
<uses-permission android:name="android.permission.KILL_BACKGROUND_PROCESSES" />
```

### Implementation Notes

1. **Restart Methods**: The app can use multiple approaches for restarting
2. **Error Handling**: Always send response back to server (success or failure)
3. **Logging**: Use TAG_SOCKET for consistent logging
4. **Graceful Shutdown**: Ensure proper cleanup before restart

## 🔐 Security & Authentication

- **JWT Authentication**: Required for API access
- **Device Ownership**: Users can only restart their own devices (except admins)
- **Confirmation Dialog**: Prevents accidental restarts
- **Request ID Tracking**: Each restart request has unique identifier

## 🚨 Error Handling

### Common Error Scenarios
1. **Device Not Found**: Invalid device ID or access denied
2. **Socket Disconnected**: Device offline or connection lost
3. **Restart Failed**: App restart process failed on device
4. **Permission Denied**: Insufficient permissions for restart

### Response Format
```json
{
    "success": false,
    "message": "Application restart failed",
    "error": "Specific error details",
    "deviceId": "DEVICE_ID",
    "requestId": "restart_123456789",
    "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🧪 Testing

### Manual Testing
1. Open Device Management Dashboard
2. Select target device
3. Click "🔄 Restart App" button
4. Confirm restart in dialog
5. Monitor status display for results

### API Testing
```bash
curl -X POST "http://localhost:3001/api/devices/DEVICE_ID/app/restart" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## 📊 Monitoring & Logging

### Server Logs
- Restart requests received
- Socket.IO event emissions
- Device responses
- Error conditions

### Device Logs
- Restart request received
- Restart process initiated
- Success/failure status
- Response sent to server

This implementation provides a robust, secure, and user-friendly app restart functionality that integrates seamlessly with the existing device management system.
