// Defense-in-depth redactor for log lines forwarded from devices to admins.
// Runs before any logsData forward.

const MAX_LINE_LEN = 8192;

const PATTERNS = [
  { re: /Bearer\s+[A-Za-z0-9._\-]+/gi, sub: 'Bearer [REDACTED]' },
  { re: /eyJ[A-Za-z0-9._\-]{20,}/g, sub: '[JWT_REDACTED]' },
  { re: /([?&](?:token|key|secret|password|auth|apikey|api_key)=)[^&\s"']+/gi, sub: '$1[REDACTED]' },
  { re: /cloudinary:\/\/[^@\s]+@/gi, sub: 'cloudinary://[REDACTED]@' },
  { re: /[\w.+\-]+@[\w-]+\.[\w.-]+/g, sub: '[EMAIL_REDACTED]' },
  { re: /"password"\s*:\s*"[^"]*"/gi, sub: '"password":"[REDACTED]"' }
];

function redactString(input) {
  if (typeof input !== 'string') return input;
  let s = input.length > MAX_LINE_LEN ? input.slice(0, MAX_LINE_LEN) + '...[TRUNCATED]' : input;
  for (const { re, sub } of PATTERNS) s = s.replace(re, sub);
  return s;
}

function redactLogEntry(log) {
  if (!log || typeof log !== 'object') return log;
  const out = { ...log };
  if (typeof out.message === 'string') out.message = redactString(out.message);
  if (typeof out.tag === 'string') out.tag = redactString(out.tag);
  return out;
}

function redactLogs(logs) {
  if (!Array.isArray(logs)) return logs;
  return logs.map(redactLogEntry);
}

module.exports = { redactString, redactLogEntry, redactLogs, MAX_LINE_LEN };
