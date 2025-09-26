# 🛠️ Cache Management and Health Check System

## Overview

This document describes the comprehensive cache management and health monitoring system for Android TV devices. The system provides both real-time Socket.IO-based operations and REST API endpoints for remote device management.

## 🚀 Quick Access

### Dashboard URLs
- **Device Management Dashboard**: `http://localhost:3001/device-management`
- **Professional Log Dashboard**: `http://localhost:3001/dashboard` (includes cache & health features)

### API Endpoints
- **Clear Device Cache**: `POST /api/devices/{deviceId}/cache/clear`
- **Clean USB Storage**: `POST /api/devices/{deviceId}/usb/clean`
- **Request Health Check**: `POST /api/devices/{deviceId}/health/check`
- **Get Device List**: `GET /api/devices/getdevicelist`

## 🧹 Cache Management

### Supported Cache Types

| Cache Type | Description | Impact |
|------------|-------------|---------|
| `all` | Clear all cache types | Complete cache cleanup |
| `app` | App's internal cache directory | App-specific cached data |
| `glide` | Glide image cache | Cached images and thumbnails |
| `logs` | Log files | Historical log data |
| `exoplayer` | ExoPlayer cache | Video playback cache |
| `shared_prefs` | Shared preferences | App settings (preserves device_id) |

### Socket.IO Events

#### Clear Cache Request (Admin → Device)
```javascript
socket.emit('clearCache', {
    deviceId: 'DEVICE_ID',
    cacheType: 'all', // or specific type
    requestId: 'unique_request_id'
});
```

#### Cache Cleared Response (Device → Admin)
```javascript
socket.on('cacheCleared', (data) => {
    if (data.success) {
        console.log(`✅ ${data.message}`);
        console.log(`Bytes cleared: ${data.bytesCleared}`);
    } else {
        console.error(`❌ ${data.message}`);
    }
});
```

### REST API Usage

#### Clear Cache via API
```bash
POST /api/devices/DEVICE_ID/cache/clear
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
    "cacheType": "all"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Cache clear request sent to device",
    "data": {
        "deviceId": "DEVICE_ID",
        "cacheType": "all",
        "requestId": "cache_api_123456789",
        "timestamp": "2023-12-21T10:30:56.789Z"
    }
}
```

## 💾 USB Storage Management

### Socket.IO Events

#### Clean USB Storage Request (Admin → Device)
```javascript
socket.emit('cleanUsbStorage', {
    deviceId: 'DEVICE_ID',
    cleanType: 'all', // Currently only 'all' is supported
    requestId: 'unique_request_id'
});
```

#### USB Storage Cleaned Response (Device → Admin)
```javascript
socket.on('usbStorageCleaned', (data) => {
    if (data.success) {
        console.log(`✅ ${data.message}`);
        console.log(`Bytes cleared: ${data.bytesCleared}`);
    } else {
        console.error(`❌ ${data.message}`);
    }
});
```

### REST API Usage

#### Clean USB Storage via API
```bash
POST /api/devices/DEVICE_ID/usb/clean
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
    "cleanType": "all"
}
```

**Response:**
```json
{
    "success": true,
    "message": "USB storage clean request sent to device",
    "data": {
        "deviceId": "DEVICE_ID",
        "cleanType": "all",
        "requestId": "usb_api_123456789",
        "timestamp": "2023-12-21T10:30:56.789Z"
    }
}
```

## 🏥 Health Monitoring

### Health Check Data Structure

```javascript
{
    "timestamp": 1703123456789,
    "formattedTime": "2023-12-21 10:30:56",
    "deviceId": "DEVICE_ID",
    "appVersion": "1.0 (1)",
    "androidVersion": "11",
    "deviceModel": "Samsung SM-T870",
    "uptime": {
        "uptimeMs": 3600000,
        "formattedUptime": "1h 0m 0s"
    },
    "memory": {
        "maxMemoryMB": 512,
        "usedMemoryMB": 128,
        "memoryUsagePercent": 25,
        "status": "healthy"
    },
    "storage": {
        "internal": {
            "totalMB": 8192,
            "availableMB": 4096,
            "usagePercent": 50,
            "status": "healthy"
        }
    },
    "network": {
        "isConnected": true,
        "hasInternet": true,
        "status": "connected"
    },
    "socket": {
        "isConnected": true,
        "serverUrl": "http://57.129.128.102:3001",
        "status": "connected"
    },
    "usbStorage": {
        "hasUsbStorage": true,
        "totalDevices": 2,
        "connectedDevices": 2,
        "overallHealth": "healthy",
        "status": "connected",
        "devices": [
            {
                "uuid": "1234-5678",
                "description": "USB Drive",
                "isPrimary": false,
                "isRemovable": true,
                "isEmulated": false,
                "mountState": "mounted",
                "connectionStatus": "connected",
                "totalGB": 32,
                "availableGB": 18,
                "usedGB": 14,
                "usagePercent": 43,
                "path": "/storage/usb1",
                "health": "healthy",
                "fileCount": 156
            }
        ]
    }
}
```

### Socket.IO Events

#### Health Check Request (Admin → Device)
```javascript
socket.emit('healthCheck', {
    deviceId: 'DEVICE_ID',
    requestId: 'unique_request_id'
});
```

#### Health Status Response (Device → Admin)
```javascript
socket.on('healthStatus', (data) => {
    if (data.error) {
        console.error(`Health check failed: ${data.errorMessage}`);
    } else {
        console.log('Health data:', data);
        // Process health information
    }
});
```

### REST API Usage

#### Request Health Check via API
```bash
POST /api/devices/DEVICE_ID/health/check
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
    "success": true,
    "message": "Health check request sent to device",
    "data": {
        "deviceId": "DEVICE_ID",
        "requestId": "health_api_123456789",
        "timestamp": "2023-12-21T10:30:56.789Z"
    }
}
```

## 📊 Status Indicators

### Health Status Values

| Status | Condition | Color |
|--------|-----------|-------|
| `healthy` | Normal operation | Green |
| `warning` | Attention needed | Yellow |
| `error` | Critical issue | Red |
| `unknown` | No data available | Gray |

### Memory Status Thresholds
- **Healthy**: < 80% usage
- **Warning**: ≥ 80% usage
- **Error**: Unable to get memory info

### Storage Status Thresholds
- **Healthy**: < 90% usage
- **Warning**: ≥ 90% usage
- **Error**: Unable to get storage info

### USB Storage Status Thresholds
- **Healthy**: < 85% usage
- **Warning**: ≥ 85% usage
- **Critical**: ≥ 95% usage
- **Disconnected**: USB device not connected
- **Error**: Unable to access USB device

## 🎛️ Dashboard Features

### Device Management Dashboard (`/device-management`)

**Features:**
- ✅ Dedicated cache management interface
- ✅ USB storage management interface
- ✅ Real-time health monitoring
- ✅ Device selection dropdown
- ✅ Activity logging
- ✅ Connection status indicator
- ✅ Responsive design

**Cache Management:**
- Select cache type (all, app, glide, logs, exoplayer, shared_prefs)
- One-click cache clearing
- Real-time status feedback
- Success/error notifications

**USB Storage Management:**
- One-click USB storage cleaning
- Real-time cleaning status feedback
- USB device health monitoring
- Multiple USB device support

**Health Monitoring:**
- Overall system status
- Memory usage with percentage
- Storage usage monitoring
- USB storage health monitoring
- Network connectivity status
- Device uptime tracking
- Socket connection status

### Professional Dashboard (`/dashboard`)

**Enhanced Features:**
- ✅ Integrated cache management section
- ✅ Health monitoring panel
- ✅ Auto health check (every 5 minutes)
- ✅ Combined with log streaming
- ✅ Advanced filtering and search

## 🔧 Implementation Examples

### JavaScript Integration

```javascript
// Initialize Socket.IO connection
const socket = io();

// Clear cache function
function clearDeviceCache(deviceId, cacheType = 'all') {
    const requestId = `cache_${Date.now()}`;
    
    socket.emit('clearCache', {
        deviceId,
        cacheType,
        requestId
    });
    
    return requestId;
}

// Request health check function
function requestHealthCheck(deviceId) {
    const requestId = `health_${Date.now()}`;

    socket.emit('healthCheck', {
        deviceId,
        requestId
    });

    return requestId;
}

// Clean USB storage function
function cleanUsbStorage(deviceId, cleanType = 'all') {
    const requestId = `usb_${Date.now()}`;

    socket.emit('cleanUsbStorage', {
        deviceId,
        cleanType,
        requestId
    });

    return requestId;
}

// Listen for responses
socket.on('cacheCleared', (data) => {
    if (data.success) {
        console.log(`✅ Cache cleared: ${data.message}`);
        showNotification(`Cache cleared successfully: ${formatBytes(data.bytesCleared)}`, 'success');
    } else {
        console.error(`❌ Cache clear failed: ${data.message}`);
        showNotification(`Cache clear failed: ${data.message}`, 'error');
    }
});

socket.on('healthStatus', (data) => {
    if (data.error) {
        console.error(`❌ Health check failed: ${data.errorMessage}`);
        showNotification(`Health check failed: ${data.errorMessage}`, 'error');
    } else {
        console.log('📊 Health status received:', data);
        updateHealthDisplay(data);
    }
});

socket.on('usbStorageCleaned', (data) => {
    if (data.success) {
        console.log(`✅ USB storage cleaned: ${data.message}`);
        showNotification(`USB storage cleaned successfully: ${formatBytes(data.bytesCleared)}`, 'success');
    } else {
        console.error(`❌ USB storage clean failed: ${data.message}`);
        showNotification(`USB storage clean failed: ${data.message}`, 'error');
    }
});

// Helper function to format bytes
function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}
```

### REST API Integration

```javascript
// Clear cache via REST API
async function clearCacheAPI(deviceId, cacheType = 'all') {
    try {
        const response = await fetch(`/api/devices/${deviceId}/cache/clear`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ cacheType })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Cache clear request sent:', result.data);
            return result.data.requestId;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Cache clear API error:', error);
        throw error;
    }
}

// Request health check via REST API
async function healthCheckAPI(deviceId) {
    try {
        const response = await fetch(`/api/devices/${deviceId}/health/check`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        const result = await response.json();

        if (result.success) {
            console.log('Health check request sent:', result.data);
            return result.data.requestId;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Health check API error:', error);
        throw error;
    }
}

// Clean USB storage via REST API
async function cleanUsbStorageAPI(deviceId, cleanType = 'all') {
    try {
        const response = await fetch(`/api/devices/${deviceId}/usb/clean`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ cleanType })
        });

        const result = await response.json();

        if (result.success) {
            console.log('USB storage clean request sent:', result.data);
            return result.data.requestId;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('USB storage clean API error:', error);
        throw error;
    }
}
```

## 🔐 Authentication

All API endpoints require authentication via JWT token:

```javascript
// Get auth token (multiple methods supported)
function getAuthToken() {
    // 1. URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token') || urlParams.get('authToken');
    if (urlToken) return urlToken;
    
    // 2. Local storage
    return localStorage.getItem('authToken') || 
           localStorage.getItem('token') || 
           sessionStorage.getItem('authToken') || 
           sessionStorage.getItem('token');
}
```

## 🚨 Error Handling

### Common Error Scenarios

1. **Device Not Found**
   ```json
   {
       "success": false,
       "message": "Device not found or access denied"
   }
   ```

2. **Socket.IO Unavailable**
   ```json
   {
       "success": false,
       "message": "Socket.IO service unavailable"
   }
   ```

3. **Authentication Failed**
   ```json
   {
       "success": false,
       "message": "Authentication required"
   }
   ```

4. **Device Offline**
   ```javascript
   {
       "error": true,
       "errorMessage": "Device not responding",
       "requestId": "health_req_001",
       "deviceId": "DEVICE_ID",
       "timestamp": 1703123456789
   }
   ```

### Best Practices

1. **Always check response status**
2. **Implement timeout handling**
3. **Provide user feedback**
4. **Log operations for debugging**
5. **Handle network disconnections gracefully**

## 📈 Monitoring and Analytics

### Cache Management Metrics
- Cache clear frequency
- Cache sizes cleared
- Cache types most commonly cleared
- Success/failure rates

### Health Check Metrics
- Device uptime trends
- Memory usage patterns
- Storage usage growth
- Network connectivity issues
- Response time monitoring

## 🔄 Integration with Existing Systems

The cache management and health check system integrates seamlessly with:

- ✅ **Log Streaming System**: Combined dashboard interface
- ✅ **Device Management**: Uses existing device database
- ✅ **Authentication System**: JWT token support
- ✅ **Socket.IO Infrastructure**: Reuses existing connections
- ✅ **Admin Dashboard**: Can be embedded or standalone

## 🎯 Next Steps

1. **Set up device endpoints** to handle cache and health requests
2. **Configure authentication** for API access
3. **Test with real devices** using the provided dashboards
4. **Monitor performance** and adjust thresholds as needed
5. **Customize UI** to match your branding requirements

---

**Ready to manage your Android TV devices remotely!** 🚀

Access the dashboards:
- Device Management: `http://localhost:3001/device-management`
- Professional Dashboard: `http://localhost:3001/dashboard`
