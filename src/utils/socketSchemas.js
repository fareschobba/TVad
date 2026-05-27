// Zod schemas for every admin-initiated Socket.IO event payload.
// Strict: extra fields rejected.

const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'invalid ObjectId');
const deviceIdStr = z.string().min(1).max(64);
const requestIdStr = z.string().min(1).max(128);
const sessionIdStr = z.string().min(1).max(128);

const clearCacheSchema = z.object({
  deviceId: deviceIdStr,
  cacheType: z.enum(['app', 'system', 'browser', 'glide', 'exoplayer', 'all']).optional().default('all'),
  requestId: requestIdStr
}).strict();

const cleanUsbStorageSchema = z.object({
  deviceId: deviceIdStr,
  cleanType: z.enum(['temp', 'logs', 'media', 'all']).optional().default('all'),
  requestId: requestIdStr
}).strict();

const restartAppSchema = z.object({
  deviceId: deviceIdStr,
  requestId: requestIdStr
}).strict();

const healthCheckSchema = z.object({
  deviceId: deviceIdStr,
  requestId: requestIdStr
}).strict();

const requestDeviceStateSchema = z.object({
  deviceId: deviceIdStr,
  requestId: requestIdStr
}).strict();

const requestLogsSchema = z.object({
  deviceId: deviceIdStr,
  tags: z.array(z.string().max(64)).optional().default([]),
  packageFilter: z.string().max(128).optional(),
  sessionId: sessionIdStr.optional(),
  includeHistorical: z.boolean().optional().default(false)
}).strict();

const stopLogsSchema = z.object({
  deviceId: deviceIdStr,
  sessionId: sessionIdStr.optional()
}).strict();

const checkStatesSchema = z.object({
  devices: z.array(deviceIdStr).min(1).max(200)
}).strict();

const registerDeviceSchema = z.object({
  deviceId: deviceIdStr
}).passthrough();

module.exports = {
  clearCacheSchema,
  cleanUsbStorageSchema,
  restartAppSchema,
  healthCheckSchema,
  requestDeviceStateSchema,
  requestLogsSchema,
  stopLogsSchema,
  checkStatesSchema,
  registerDeviceSchema,
  objectId
};
