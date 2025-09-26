# 💾 USB Storage Management System

## Overview

This document describes the comprehensive USB storage monitoring and remote cleaning system for Android TV devices. The system provides real-time USB device detection, health monitoring, and remote cleaning capabilities through Socket.IO and REST API endpoints.

## 🚀 Quick Access

### Dashboard URLs
- **Device Management Dashboard**: `http://localhost:3001/device-management`
- **Professional Log Dashboard**: `http://localhost:3001/dashboard` (includes USB storage features)

### API Endpoints
- **Clean USB Storage**: `POST /api/devices/{deviceId}/usb/clean`
- **Request Health Check**: `POST /api/devices/{deviceId}/health/check` (includes USB storage data)

## 💾 USB Storage Features

### 1. Real-time USB Device Detection
- Automatically detects connected USB storage devices
- Monitors mount/unmount states
- Supports multiple USB devices simultaneously

### 2. Storage Health Monitoring
- Tracks total, used, and available space for each USB device
- Evaluates USB storage health based on usage patterns
- Monitors file count on each USB device
- Connection status tracking

### 3. Remote USB Storage Cleaning
- Remotely delete all content from USB devices
- Real-time feedback on cleaning operations
- Size reporting (total bytes cleared)
- Multiple device cleaning support
- Safe operation (preserves directory structure)

## 🔧 Socket.IO Events

### Clean USB Storage Request (Admin → Device)
```javascript
socket.emit('cleanUsbStorage', {
    deviceId: 'DEVICE_ID',
    cleanType: 'all', // Currently only 'all' is supported
    requestId: 'unique_request_id'
});
```

### USB Storage Cleaned Response (Device → Admin)
```javascript
socket.on('usbStorageCleaned', (data) => {
    if (data.success) {
        console.log(`✅ ${data.message}`);
        console.log(`Bytes cleared: ${data.bytesCleared}`);
        console.log(`Duration: ${data.duration}ms`);
    } else {
        console.error(`❌ ${data.message}`);
    }
});
```

## 🌐 REST API Usage

### Clean USB Storage via API
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

## 📊 Health Check Integration

### Enhanced Health Status Response
The health check now includes comprehensive USB storage information:

```json
{
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

## 🎯 Health Status Indicators

### USB Storage Health Thresholds
- **healthy** - USB device usage < 85%
- **warning** - USB device usage >= 85%
- **critical** - USB device usage >= 95%
- **disconnected** - USB device not connected
- **error** - Unable to access USB device

## 🎛️ Dashboard Features

### USB Storage Management Card
- Device selection dropdown
- Clean type selection (currently "All USB Storage")
- One-click USB storage cleaning
- Real-time status feedback
- Success/error notifications

### USB Storage Health Monitoring
- Overall USB storage status badge
- Connected devices count
- Overall health indicator
- Total devices count
- Individual USB device cards with:
  - Device description and health status
  - Usage progress bar
  - Detailed storage information (used, available, total)
  - File count
  - Mount path
  - Connection status

## 💻 JavaScript Implementation

### Basic USB Storage Management
```javascript
// Initialize Socket.IO connection
const socket = io();

// Clean USB storage function
function cleanUsbStorage(deviceId, cleanType = 'all') {
    const requestId = `usb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    socket.emit('cleanUsbStorage', {
        deviceId,
        cleanType,
        requestId
    });
    
    return requestId;
}

// Listen for USB storage clean responses
socket.on('usbStorageCleaned', (data) => {
    if (data.success) {
        console.log(`🧹 USB Storage Cleaned: ${formatBytes(data.bytesCleared)}`);
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

### Angular Service Integration
```typescript
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class UsbStorageService {
  private socket: Socket;

  constructor() {
    this.socket = io();
  }

  cleanUsbStorage(deviceId: string, cleanType: string = 'all'): string {
    const requestId = `usb_clean_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.socket.emit('cleanUsbStorage', {
      deviceId,
      cleanType,
      requestId
    });

    return requestId;
  }

  onUsbStorageCleaned(callback: (data: any) => void) {
    this.socket.on('usbStorageCleaned', callback);
  }
}
```

## 🔐 Security Considerations

1. **Permission Validation** - Ensure proper external storage permissions
2. **Path Validation** - Validate USB storage paths before operations
3. **Safe Deletion** - Use safe deletion methods to prevent data corruption
4. **Access Control** - Restrict USB cleaning operations to authorized administrators

## ⚡ Performance Impact

1. **Minimal Overhead** - USB monitoring adds minimal performance overhead
2. **Async Operations** - All USB operations are performed asynchronously
3. **Efficient Scanning** - USB device scanning is optimized for performance
4. **Resource Management** - Proper cleanup of resources after operations

## 🛠️ Best Practices

### USB Storage Management
1. **Monitor regularly** - Check USB storage health every 10-15 minutes
2. **Clean sparingly** - Only clean USB storage when necessary (>90% usage)
3. **Backup important data** - Ensure important files are backed up before cleaning
4. **Handle disconnections** - Gracefully handle USB device disconnections during operations
5. **Monitor file counts** - Track file accumulation to prevent performance issues

### Error Handling
1. **Check mount status** - Verify USB devices are properly mounted before operations
2. **Handle permissions** - Ensure proper write permissions for USB devices
3. **Retry logic** - Implement retry mechanisms for failed cleaning operations
4. **Logging** - Log all USB storage operations for debugging and monitoring

## 🚀 Future Enhancements

1. **Selective Cleaning** - Support for cleaning specific file types (videos, cache, etc.)
2. **Scheduled Cleaning** - Automatic USB storage cleaning based on schedules
3. **Usage Analytics** - Detailed USB storage usage analytics and trends
4. **Smart Cleaning** - AI-based cleaning recommendations based on usage patterns

---

**Ready to manage USB storage on your Android TV devices remotely!** 🚀

Access the dashboard: `http://localhost:3001/device-management`
