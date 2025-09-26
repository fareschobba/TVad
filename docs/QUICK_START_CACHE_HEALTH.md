# 🚀 Quick Start: Cache Management & Health Monitoring

## 🎯 What's New

Your Android TV management system now includes:
- **🧹 Remote Cache Management**: Clear device cache from the dashboard
- **🏥 Health Monitoring**: Real-time system status monitoring
- **📊 Visual Status Indicators**: Color-coded health alerts
- **🎛️ Dedicated Management Interface**: Focused device operations dashboard

## 🌐 Access Points

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| **Device Management** | `http://localhost:3001/device-management` | **Enhanced** dedicated cache & health operations with detailed charts and comprehensive system monitoring |
| **Professional Dashboard** | `http://localhost:3001/dashboard` | Enhanced log streaming with cache & health |

## ⚡ Quick Actions

### Clear Device Cache
1. **Select Device** from dropdown
2. **Choose Cache Type**:
   - `All` - Complete cache cleanup
   - `App` - Application cache only
   - `Glide` - Image cache
   - `Logs` - Log files
   - `ExoPlayer` - Video cache
   - `Shared Prefs` - Settings (preserves device ID)
3. **Click "Clear Cache"**
4. **Monitor Status** - Real-time feedback with size information

### Check Device Health
1. **Select Device** from dropdown
2. **Click "Check Health"**
3. **View Comprehensive Results**:
   - 📱 **Device Information**: Model, Android version, app version, uptime
   - 🧠 **Memory Usage**: Detailed breakdown with progress bars and all memory metrics
   - 💾 **Storage Usage**: Internal and cache storage with visual indicators
   - 🌐 **Network Status**: WiFi, Ethernet, Cellular, Internet connectivity indicators
   - ⚙️ **System Information**: SDK version, hardware, CPU ABI, bootloader, build time
   - 🔌 **Socket Connection**: Server URL and connection status
   - 📊 **Visual Charts**: Progress bars and color-coded status indicators
   - ⏰ **Real-time Updates**: Live timestamp and status monitoring

## 🎨 Status Colors

| Color | Status | Meaning |
|-------|--------|---------|
| 🟢 Green | Healthy | Normal operation |
| 🟡 Yellow | Warning | Attention needed |
| 🔴 Red | Error | Critical issue |
| ⚪ Gray | Unknown | No data available |

## 🔧 API Integration

### Clear Cache via API
```bash
curl -X POST "http://localhost:3001/api/devices/DEVICE_ID/cache/clear" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cacheType": "all"}'
```

### Request Health Check via API
```bash
curl -X POST "http://localhost:3001/api/devices/DEVICE_ID/health/check" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔐 Authentication

The system supports multiple authentication methods:
- **URL Token**: `?token=YOUR_JWT_TOKEN`
- **Local Storage**: Automatically saved from URL or manual entry
- **Cookie**: Integration with admin dashboard
- **Manual Entry**: Authentication prompt when needed

## 📱 Device Requirements

Your Android TV app needs to handle these Socket.IO events:

### Cache Management
- **Listen for**: `clearCache/{deviceId}`
- **Respond with**: `cacheCleared` event

### Health Monitoring
- **Listen for**: `healthCheck/{deviceId}`
- **Respond with**: `healthStatus` event

## 🚨 Troubleshooting

### Common Issues

1. **"Device not found"**
   - Verify device is in database
   - Check authentication token
   - Ensure device ID is correct

2. **"Not connected to server"**
   - Check Socket.IO connection status
   - Verify server is running on port 3001
   - Check network connectivity

3. **"No response from device"**
   - Ensure device is online
   - Verify device is listening for Socket.IO events
   - Check device Socket.IO connection

### Debug Steps

1. **Check Connection Status** (top-right indicator)
2. **Monitor Activity Logs** (bottom panel)
3. **Verify Device Selection** (dropdown shows correct devices)
4. **Test with Demo Devices** (if API unavailable)

## 📊 Monitoring Best Practices

### Cache Management
- **Regular Cleanup**: Schedule periodic cache clearing for long-running devices
- **Monitor Sizes**: Track cache growth patterns
- **Selective Clearing**: Use specific cache types for targeted cleanup

### Health Monitoring
- **Periodic Checks**: Enable auto health check (every 5 minutes)
- **Threshold Monitoring**: Watch for memory/storage warnings
- **Trend Analysis**: Track uptime and performance over time

## 🔄 Integration Examples

### JavaScript Socket.IO
```javascript
// Clear all cache
socket.emit('clearCache', {
    deviceId: 'DEVICE_123',
    cacheType: 'all',
    requestId: 'cache_' + Date.now()
});

// Request health check
socket.emit('healthCheck', {
    deviceId: 'DEVICE_123',
    requestId: 'health_' + Date.now()
});

// Listen for responses
socket.on('cacheCleared', (data) => {
    console.log(data.success ? '✅ Cache cleared' : '❌ Failed');
});

socket.on('healthStatus', (data) => {
    console.log('📊 Health:', data.memory.memoryUsagePercent + '% memory');
});
```

### REST API with Fetch
```javascript
// Clear cache
const clearCache = async (deviceId, cacheType = 'all') => {
    const response = await fetch(`/api/devices/${deviceId}/cache/clear`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cacheType })
    });
    return response.json();
};

// Health check
const healthCheck = async (deviceId) => {
    const response = await fetch(`/api/devices/${deviceId}/health/check`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};
```

## 📚 Complete Documentation

For detailed implementation guides, see:
- **`CACHE_HEALTH_MANAGEMENT_GUIDE.md`** - Complete feature documentation
- **`DASHBOARD_FEATURES_GUIDE.md`** - Enhanced dashboard features
- **`LOG_STREAMING_DOCUMENTATION.md`** - Socket.IO system details

## 🎉 Ready to Use!

1. **Start your server**: `npm start`
2. **Open dashboard**: `http://localhost:3001/device-management`
3. **Select a device** from the dropdown
4. **Clear cache** or **check health** with one click!

Your Android TV device management system is now equipped with powerful remote cache management and health monitoring capabilities! 🚀
