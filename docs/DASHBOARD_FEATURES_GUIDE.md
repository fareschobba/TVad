# 🎛️ Professional Dashboard - Complete Features Guide

## 🌐 Access the Dashboard

```
http://localhost:3001/dashboard
```

## ✨ New Features Added

### 🏷️ **Complete Tag Support**
All 20 supported tags are now available as quick filter buttons:

- **🌐 ALL** - **Special tag for complete logcat streaming** (high volume!)
- **SocketIO** - Socket.IO communications
- **VideoActivity** - Video activity management
- **DownloadProcess** - File download operations
- **StorageManager** - Storage management
- **NetworkManager** - Network operations
- **SystemMonitor** - System monitoring
- **MemoryMonitor** - Memory usage tracking
- **USBManager** - USB device management
- **ScheduleManager** - Advertisement scheduling
- **TvAdApp** - TV advertisement application
- **DeviceManager** - Device management
- **ApiService** - API service calls
- **BootManager** - Boot process management
- **ActivityLifecycle** - Activity lifecycle events
- **VideoValidation** - Video validation processes
- **MediaPlayback** - Media playback events
- **OrientationManager** - Screen orientation management
- **CacheManager** - Cache management
- **HealthCheck** - System health monitoring

### 📱 **Enhanced Device Management**
- **Primary API**: Uses `/api/devices/getdevicelist` endpoint
- **Fallback API**: Falls back to `/api/devices` if primary fails
- **Demo Mode**: Provides demo devices if APIs are unavailable
- **Rich Display**: Shows device name, ID, and location
- **Persistence**: Remembers last selected device

### 🎯 **Advanced Tag Management**
- **Auto-complete**: Tab completion for supported tags
- **Suggestions**: Live suggestions as you type
- **Bulk Operations**: "Add All" and "Clear All" buttons
- **Visual Feedback**: System logs for all tag operations
- **Smart Input**: Validates against supported tags



## 🚀 **How to Use the Enhanced Dashboard**

### **Step 1: Device Selection**
1. Dashboard automatically loads devices from database
2. If authentication fails, demo devices are provided
3. Select device from dropdown (shows name, ID, location)
4. Selection is remembered for next visit

### **Step 2: Tag Filtering**
Choose from multiple methods:

#### **Quick Filter Buttons**
- Click any of the 19 tag buttons for instant filtering
- Buttons are organized in a 3-column grid for easy access
- Each button adds the tag as a visual chip

#### **Custom Tag Input**
- Type in the tag input field
- Get auto-suggestions as you type
- Press Tab for auto-completion
- Press Enter to add the tag

#### **Bulk Operations**
- **Add All**: Adds all 19 supported tags at once
- **Clear All**: Removes all selected tags instantly

### **Step 3: Configure Settings**
- **Historical Logs**: Check to request stored logs from device
- **Real-time Logs**: Check to receive live logs (default: enabled)
- **Both Modes**: Use together for complete log coverage

### **Step 4: Start Monitoring**
1. Click **▶️ Start** button
2. Watch session info appear with details
3. Monitor live statistics (Total, Historical, Real-time)
4. See logs appear with color coding and timestamps

### **Step 5: Use Advanced Features**
- **Search**: Type in search bar to filter displayed logs
- **Export**: Download all logs as text file
- **Auto-scroll**: Toggle automatic scrolling
- **Clear**: Clear displayed logs anytime

## 🎨 **Visual Features**

### **Tag Chips**
- Beautiful gradient chips for selected tags
- Easy removal with × button
- Smooth animations when adding/removing
- Empty state message when no tags selected

### **Device Dropdown**
- Rich formatting: "Device Name (ID) - Location"
- Handles multiple device data formats
- Loading states and error handling
- Refresh button for manual updates

### **Log Display**
- **Color-coded levels**: V (gray), D (cyan), I (green), W (orange), E (red)
- **Type indicators**: System (gold), Historical (blue), Real-time (green)
- **Hover effects**: Logs highlight and slide on hover
- **Timestamps**: Full formatted timestamps for each entry

### **Statistics Panel**
- **Live counters**: Total, Historical, Real-time log counts
- **Color-coded dots**: Visual indicators for each type
- **Real-time updates**: Counts update as logs arrive

## 🔧 **API Integration**

### **Device List API**
```javascript
// Primary endpoint
GET /api/devices/getdevicelist
Authorization: Bearer <token>

// Fallback endpoint
GET /api/devices
Authorization: Bearer <token>

// Expected response format
{
  "data": [
    {
      "deviceId": "DEVICE123",
      "name": "Device Name",
      "location": "Device Location"
    }
  ]
}
```

### **Log Streaming**
```javascript
// Request with all supported tags
{
  "deviceId": "DEVICE123",
  "tags": ["SocketIO", "VideoActivity", "NetworkManager", ...],
  "includeHistorical": true,
  "sessionId": "dashboard-session-123"
}
```

## 🎯 **Testing Scenarios**

### **Scenario 1: Complete Tag Testing**
1. Open dashboard
2. Click "Add All" to add all 19 tags
3. Start logging
4. Verify all tag types are received and displayed
5. Test individual tag removal

### **Scenario 2: Device API Testing**
1. Test with valid authentication token
2. Test without authentication (demo mode)
3. Test device selection and persistence
4. Test device refresh functionality

### **Scenario 3: Mixed Log Types**
1. Enable both historical and real-time logs
2. Start logging
3. Verify historical logs appear first (blue)
4. Verify real-time logs appear after (green)
5. Check statistics update correctly

### **Scenario 4: Advanced Features**
1. Start logging with multiple tags
2. Use search to filter displayed logs
3. Export logs to file
4. Toggle auto-scroll
5. Clear and restart logging

## 🔍 **Troubleshooting**

### **Device List Issues**
- **Empty dropdown**: Check API endpoints and authentication
- **Demo devices only**: Authentication failed, add valid token
- **Refresh not working**: Check network connection and API status

### **Tag Filtering Issues**
- **Tags not working**: Verify device sends logs with correct tag names
- **No suggestions**: Check SUPPORTED_TAGS array matches device tags
- **Auto-complete not working**: Ensure tag names match exactly

### **Log Display Issues**
- **No logs appearing**: Check device connection and session status
- **Wrong colors**: Verify log level and type fields in data
- **Search not working**: Check search function and log content

## 📊 **Performance Features**

### **Optimized Rendering**
- Maximum 500 log entries displayed
- Automatic cleanup of old entries
- Efficient DOM manipulation
- Smooth scrolling and animations

### **Memory Management**
- Automatic log rotation
- Session cleanup on disconnect
- Efficient tag management
- Optimized search algorithms

### **Network Efficiency**
- Smart API fallbacks
- Cached device selections
- Efficient WebSocket usage
- Minimal data transfer

## 🛠️ **Cache Management & Health Monitoring**

### **New Features Added**
- **🧹 Remote Cache Management**: Clear device cache remotely with support for different cache types
- **🏥 Health Check Monitoring**: Comprehensive system health status including memory, storage, network, and uptime
- **📊 Real-time Status Updates**: Live feedback on cache operations and health status
- **🎛️ Dedicated Management Dashboard**: Separate interface at `/device-management` for focused device operations

### **Cache Management**
- **Cache Types**: All, App, Glide, Logs, ExoPlayer, Shared Preferences
- **Real-time Feedback**: Success/failure notifications with size information
- **Socket.IO Events**: `clearCache/{deviceId}` and `cacheCleared` responses
- **REST API**: `POST /api/devices/{deviceId}/cache/clear`

### **Health Monitoring**
- **System Metrics**: Memory usage, storage space, network connectivity
- **Device Information**: Uptime, app version, Android version, device model
- **Status Indicators**: Healthy, Warning, Error states with color coding
- **Auto Health Checks**: Optional periodic monitoring every 5 minutes
- **Socket.IO Events**: `healthCheck/{deviceId}` and `healthStatus` responses
- **REST API**: `POST /api/devices/{deviceId}/health/check`

### **Dashboard Access**
- **Professional Dashboard**: `http://localhost:3001/dashboard` (enhanced with cache & health features)
- **Device Management Dashboard**: `http://localhost:3001/device-management` (dedicated interface)
- **API Documentation**: See `CACHE_HEALTH_MANAGEMENT_GUIDE.md` for complete reference

## 🎉 **Ready for Production**

The enhanced dashboard now provides:

- ✅ **Complete tag support** (all 19 tags)
- ✅ **Robust device management** (database + fallback)
- ✅ **Advanced filtering** (chips, autocomplete, bulk operations)
- ✅ **Professional UI/UX** (modern design, responsive)
- ✅ **Real-time monitoring** (live logs, statistics)
- ✅ **Export capabilities** (download logs)
- ✅ **Search functionality** (filter displayed logs)
- ✅ **Session management** (persistent, tracked)
- ✅ **Error handling** (graceful fallbacks)
- ✅ **Mobile responsive** (works on all devices)
- ✅ **🧹 Remote cache management** (clear device cache remotely)
- ✅ **🏥 Health monitoring** (system status, memory, storage, network)
- ✅ **📊 Status indicators** (visual health alerts with color coding)
- ✅ **🎛️ Dedicated management interface** (separate device operations dashboard)

Perfect for monitoring Android TV devices in development, testing, and production environments! 🚀
