# 🔒 Session Cleanup & Authentication Guide

## Overview

The Professional Dashboard now includes comprehensive session cleanup and flexible authentication handling for seamless integration with admin dashboards and standalone use.

## 🧹 Session Cleanup Features

### **Automatic Cleanup Triggers**
- **Socket Disconnection**: All sessions cleaned up when socket disconnects
- **Stop Button**: Cleans up specific session
- **Stop All Button**: Emergency cleanup for all device sessions
- **Page Refresh**: Proper session termination before reload
- **Browser Close**: Cleanup on window unload

### **Server-Side Cleanup**
```javascript
// Enhanced stopLogs handler
socket.on("stopLogs", (data) => {
  const { deviceId, sessionId } = data;
  
  if (sessionId) {
    // Stop specific session
    endLogSession(sessionId);
  } else {
    // Stop ALL sessions for this admin/device
    const adminSessions = getActiveSessionsForAdmin(socket.id);
    const deviceSessions = adminSessions.filter(s => s.deviceId === deviceId);
    deviceSessions.forEach(s => endLogSession(s.sessionId));
  }
});

// Disconnect cleanup
socket.on('disconnect', () => {
  cleanupSessionsForSocket(socket.id);
});
```

### **Client-Side Cleanup**
```javascript
// Comprehensive session cleanup
function cleanupCurrentSession() {
  if (currentSession) {
    addSystemLog(`Cleaning up session: ${currentSession.sessionId}`);
    currentSession = null;
  }
  hideSessionInfo();
  updateUI();
}

// Emergency cleanup for all sessions
function stopAllSessions() {
  const deviceId = document.getElementById('deviceSelect').value;
  if (deviceId) {
    socket.emit('stopLogs', { deviceId }); // No sessionId = stop all
  }
  cleanupCurrentSession();
}
```

## 🔐 Flexible Authentication System

### **Multiple Authentication Methods**

#### **1. URL Parameters (Admin Dashboard Integration)**
```javascript
// Automatic token detection from URL
const urlParams = new URLSearchParams(window.location.search);
const urlToken = urlParams.get('token') || urlParams.get('authToken');

// Usage: http://localhost:3001/dashboard?token=your_jwt_token
```

#### **2. Cookie-Based Authentication**
```javascript
// Automatic cookie detection
const cookieToken = getCookie('authToken') || getCookie('token') || getCookie('jwt');

// Supports standard cookie names used by admin dashboards
```

#### **3. Local/Session Storage**
```javascript
// Fallback to stored tokens
return localStorage.getItem('authToken') || 
       localStorage.getItem('token') || 
       sessionStorage.getItem('authToken') || 
       sessionStorage.getItem('token');
```

#### **4. Manual Token Entry**
```javascript
// Traditional manual entry with improved UI
function showAuthPrompt() {
  // Beautiful modal with token input
  // Supports JWT token pasting
  // Validates token format
}
```

### **Admin Dashboard Integration**

#### **Iframe Communication**
```javascript
// Detect if embedded in admin dashboard
function isEmbeddedInAdminDashboard() {
  // Check if in iframe
  if (window.self !== window.top) return true;
  
  // Check URL patterns
  if (pathname.includes('/admin/') || hostname.includes('admin.')) {
    return true;
  }
  
  return false;
}

// Request token from parent window
function tryAdminDashboardAuth() {
  window.parent.postMessage({
    type: 'REQUEST_AUTH_TOKEN',
    source: 'log_dashboard'
  }, '*');
  
  // Listen for response
  window.addEventListener('message', function(event) {
    if (event.data.type === 'AUTH_TOKEN_RESPONSE' && event.data.token) {
      localStorage.setItem('authToken', event.data.token);
      loadDevices(); // Retry with new token
    }
  });
}
```

#### **Parent Dashboard Integration**
```javascript
// In your admin dashboard, listen for token requests
window.addEventListener('message', function(event) {
  if (event.data.type === 'REQUEST_AUTH_TOKEN' && 
      event.data.source === 'log_dashboard') {
    
    // Send current auth token to log dashboard
    event.source.postMessage({
      type: 'AUTH_TOKEN_RESPONSE',
      token: getCurrentAuthToken() // Your admin dashboard's token
    }, '*');
  }
});
```

## 🎮 Usage Scenarios

### **Scenario 1: Standalone Dashboard**
1. User opens `http://localhost:3001/dashboard`
2. No token found, shows manual entry prompt
3. User enters JWT token
4. Token stored for future sessions
5. Dashboard loads with full functionality

### **Scenario 2: Admin Dashboard Integration**
1. Admin dashboard embeds log dashboard in iframe
2. Log dashboard detects iframe environment
3. Requests token from parent window
4. Parent provides current auth token
5. Seamless authentication without user input

### **Scenario 3: Direct Link with Token**
1. Admin dashboard provides direct link: `/dashboard?token=jwt_token`
2. Dashboard extracts token from URL
3. Stores token and cleans URL
4. Immediate access without prompts

### **Scenario 4: Cookie-Based SSO**
1. User already authenticated in admin system
2. Auth cookie available in browser
3. Dashboard reads cookie automatically
4. Silent authentication

## 🔧 Implementation Details

### **Enhanced Token Management**
```javascript
function getAuthToken() {
  // Priority order:
  // 1. URL parameters (highest priority)
  // 2. Cookies (SSO integration)
  // 3. Local storage (persistent)
  // 4. Session storage (temporary)
  
  const urlToken = getTokenFromURL();
  if (urlToken) {
    localStorage.setItem('authToken', urlToken);
    cleanURLParameters();
    return urlToken;
  }
  
  const cookieToken = getTokenFromCookies();
  if (cookieToken) {
    localStorage.setItem('authToken', cookieToken);
    return cookieToken;
  }
  
  return getTokenFromStorage();
}
```

### **Session Cleanup Architecture**
```javascript
// Server-side session tracking
const activeSessions = new Map(); // sessionId -> session data
const deviceSessions = new Map(); // deviceId -> Set of sessionIds
const adminSessions = new Map();  // adminSocketId -> Set of sessionIds

// Cleanup functions
function cleanupSessionsForSocket(socketId) {
  // End admin sessions
  const adminSessionIds = adminSessions.get(socketId) || new Set();
  for (const sessionId of [...adminSessionIds]) {
    endLogSession(sessionId);
  }
  
  // Clear device socket references
  for (const [sessionId, session] of activeSessions) {
    if (session.deviceSocketId === socketId) {
      session.deviceSocketId = null;
    }
  }
}
```

## 🎯 UI Improvements

### **New Control Buttons**
- **🛑 Stop All**: Emergency cleanup for all device sessions
- **🔄 Refresh Auth**: Re-attempt authentication
- **🔓 Manual Auth**: Force manual token entry

### **Enhanced Session Info**
```html
<div class="session-info">
  <h4>📡 Active Session</h4>
  <div>Session ID: <span id="sessionId">-</span></div>
  <div>Device: <span id="activeDevice">-</span></div>
  <div>Auth Method: <span id="authMethod">-</span></div>
  <div>Started: <span id="sessionStartTime">-</span></div>
</div>
```

### **Connection Status Indicators**
- **🟢 Connected + Authenticated**: Full functionality
- **🟡 Connected + No Auth**: Limited to demo mode
- **🔴 Disconnected**: No functionality, attempting reconnect

## 📊 Monitoring & Debugging

### **Session Tracking**
```javascript
// Server logs
console.log(`Created log session: ${sessionId} for device: ${deviceId}`);
console.log(`Ended log session: ${sessionId}`);
console.log(`Cleaned up sessions for socket: ${socketId}`);

// Client logs
addSystemLog(`Session started: ${sessionId}`);
addSystemLog(`Session cleanup completed`);
addSystemLog(`Auth method: ${authMethod}`);
```

### **Debug Information**
- **Active Sessions**: Server tracks all active sessions
- **Socket Connections**: Monitor connection states
- **Auth Status**: Track authentication method used
- **Cleanup Events**: Log all cleanup operations

## ✅ Best Practices

### **For Developers**
1. **Always cleanup**: Ensure sessions are properly terminated
2. **Handle disconnections**: Implement proper disconnect handlers
3. **Token security**: Never log full tokens, use truncated versions
4. **Graceful degradation**: Provide demo mode when auth fails

### **For Integration**
1. **Use URL tokens**: For direct links from admin dashboards
2. **Implement iframe communication**: For embedded scenarios
3. **Set proper cookies**: For SSO integration
4. **Handle token refresh**: Implement token renewal logic

### **For Users**
1. **Use Stop All**: When experiencing session issues
2. **Check connection**: Monitor connection status indicator
3. **Refresh auth**: If authentication seems stale
4. **Clear storage**: Reset tokens if having persistent issues

## 🎉 Summary

The enhanced system provides:

- ✅ **Comprehensive Session Cleanup**: No orphaned sessions
- ✅ **Flexible Authentication**: Multiple integration methods
- ✅ **Admin Dashboard Ready**: Seamless iframe integration
- ✅ **Emergency Controls**: Stop All sessions functionality
- ✅ **Automatic Detection**: Smart auth method selection
- ✅ **Graceful Fallbacks**: Demo mode when auth unavailable
- ✅ **Security Focused**: Proper token handling and cleanup

Perfect for both standalone use and integration with existing admin systems! 🔒✨
