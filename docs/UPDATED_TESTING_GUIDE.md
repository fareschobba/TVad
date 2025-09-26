# 🔄 Updated Log Streaming Testing Guide

## ✅ **What's Fixed**

I've updated the system to handle your device's actual data format and added the `includeHistorical` parameter:

### **1. Device Data Format Support**
The server now handles both formats your device sends:

**Realtime Format:**
```json
{
  "type": "realtime",
  "log": {
    "timestamp": 1750514840714,
    "level": "D",
    "tag": "SocketIO",
    "message": "Emitted currentAd event: {...}",
    "deviceId": "2KEOJ",
    "formattedTime": "2025-06-21 14:07:20.714"
  },
  "sessionId": "admin-session-1750514710711"
}
```

**Historical Format:**
```json
{
  "type": "historical",
  "logs": [
    {
      "timestamp": 1750514840714,
      "level": "D",
      "tag": "SocketIO",
      "message": "Historical log entry",
      "deviceId": "2KEOJ",
      "formattedTime": "2025-06-21 14:07:20.714"
    }
  ],
  "sessionId": "admin-session-1750514710711"
}
```

### **2. includeHistorical Parameter**
Added to all request endpoints and interfaces:

```json
{
  "deviceId": "2KEOJ",
  "tags": ["TAG_VIDEO", "SocketIO"],
  "includeHistorical": true,
  "sessionId": "admin-session-123"
}
```

## 🚀 **Testing Your Real Device**

### **Step 1: Start Server**
```bash
npm start
```

### **Step 2: Test with Postman**

#### **Request Logs (with Historical)**
```
POST http://localhost:3001/api/logs/test/request
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "deviceId": "2KEOJ",
  "tags": ["SocketIO", "TAG_VIDEO"],
  "includeHistorical": true,
  "sessionId": "test-session-123"
}
```

#### **Expected Device Event:**
Your device should receive:
```json
{
  "sessionId": "test-session-123",
  "tags": ["SocketIO", "TAG_VIDEO"],
  "includeHistorical": true,
  "adminSocketId": "admin-socket-id"
}
```

### **Step 3: Device Response**

Your device should respond with:

#### **Historical Logs (if available):**
```kotlin
socket.emit("logsData", JSONObject().apply {
    put("type", "historical")
    put("logs", historicalLogsArray)
    put("sessionId", sessionId)
})
```

#### **Real-time Logs:**
```kotlin
socket.emit("logsData", JSONObject().apply {
    put("type", "realtime")
    put("log", logEntry.toJson())
    put("sessionId", sessionId)
})
```

## 🧪 **Testing with Updated Emulators**

### **Device Emulator Updates**
- ✅ Handles `includeHistorical` parameter
- ✅ Sends historical logs first (if requested)
- ✅ Sends real-time logs in correct format
- ✅ Uses your device's data structure

### **Admin Client Updates**
- ✅ `includeHistorical` checkbox
- ✅ Shows `[HISTORICAL]` vs `[REALTIME]` labels
- ✅ Handles both log types

### **Test Flow:**
1. **Open Admin Client:** `http://localhost:3001/test/admin-client`
2. **Open Device Emulator:** `http://localhost:3001/test/device-emulator`
3. **Connect both** to server
4. **Check "Include Historical Logs"** in admin client
5. **Request logs** - you'll see:
   - Historical logs sent first (batch)
   - Real-time logs sent individually
   - Proper labeling in admin interface

## 📊 **API Testing Examples**

### **Test Historical + Realtime Flow**
```bash
# 1. Request logs with historical
curl -X POST http://localhost:3001/api/logs/test/request \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "2KEOJ",
    "tags": ["SocketIO", "TAG_VIDEO"],
    "includeHistorical": true,
    "sessionId": "test-123"
  }'

# 2. Simulate historical logs
curl -X POST http://localhost:3001/api/logs/test/simulate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "2KEOJ",
    "sessionId": "test-123",
    "count": 5,
    "type": "historical",
    "format": "device"
  }'

# 3. Simulate realtime logs
curl -X POST http://localhost:3001/api/logs/test/simulate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "2KEOJ",
    "sessionId": "test-123",
    "count": 3,
    "type": "realtime",
    "format": "device"
  }'
```

## 🔧 **Server Log Output**

You should now see proper logs like:
```
📦 Received 1 realtime log entries from device 2KEOJ, session: test-123
   Sample realtime logs:
   1. [D] [SocketIO] Emitted currentAd event: {"title":"THE_ROOF_cld.mp4"...}

📦 Received 5 historical log entries from device 2KEOJ, session: test-123
   Sample historical logs:
   1. [I] [TAG_VIDEO] Video playback started
   2. [D] [SocketIO] Socket connection established
```

## 🎯 **Integration with Your Android TV**

### **Your Device Should:**

1. **Listen for requests:**
```kotlin
socket.on("requestLogs/${deviceId}") { args ->
    val data = args[0] as JSONObject
    val sessionId = data.getString("sessionId")
    val tags = data.optJSONArray("tags")
    val includeHistorical = data.optBoolean("includeHistorical", false)
    
    if (includeHistorical) {
        sendHistoricalLogs(sessionId, tags)
    }
    
    startRealtimeLogging(sessionId, tags)
}
```

2. **Send historical logs:**
```kotlin
fun sendHistoricalLogs(sessionId: String, tags: JSONArray?) {
    val historicalLogs = getHistoricalLogs(tags) // Your implementation
    
    socket.emit("logsData", JSONObject().apply {
        put("type", "historical")
        put("logs", historicalLogs)
        put("sessionId", sessionId)
    })
}
```

3. **Send realtime logs:**
```kotlin
fun sendRealtimeLog(logEntry: LogEntry, sessionId: String) {
    socket.emit("logsData", JSONObject().apply {
        put("type", "realtime")
        put("log", logEntry.toJson())
        put("sessionId", sessionId)
    })
}
```

## ✅ **Verification Checklist**

- [ ] Server starts without errors
- [ ] Device receives `requestLogs/DEVICE_ID` with `includeHistorical`
- [ ] Historical logs sent in batch format
- [ ] Realtime logs sent individually
- [ ] Admin receives both types with proper labels
- [ ] No more "Invalid logsData received" errors
- [ ] Tags filtering works for both log types
- [ ] Sessions properly managed and cleaned up

## 🐛 **Troubleshooting**

### **Still getting "Invalid logsData"?**
1. Check your device is sending the exact format shown above
2. Verify `sessionId` is included in all messages
3. Ensure `deviceId` is in the log entries themselves

### **Historical logs not working?**
1. Verify `includeHistorical: true` in request
2. Check device responds to the parameter
3. Ensure historical logs are sent before realtime

### **Tags not filtering?**
1. Verify tag names match exactly (case-sensitive)
2. Check tags are in individual log entries
3. Ensure tags array is properly formatted

Your system should now work perfectly with your Android TV device! 🎉
