// 统一响应与轻量校验工具
export function asInt(value, fallback = 1) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

export function ok(res, data, status = 200) {
  return res.status(status).json(data);
}

export function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

// rules: { field: { required, label, maxLength, type: 'array' } }
export function validate(body, rules) {
  const source = body && typeof body === 'object' ? body : {};
  for (const [key, rule] of Object.entries(rules)) {
    const value = source[key];
    if (rule.required && (value === undefined || value === null || String(value).trim() === '')) {
      return `${rule.label || key}不能为空`;
    }
    if (value !== undefined && rule.maxLength && String(value).length > rule.maxLength) {
      return `${rule.label || key}长度不能超过 ${rule.maxLength} 字`;
    }
    if (value !== undefined && rule.type === 'array' && !Array.isArray(value)) {
      return `${rule.label || key}格式不正确`;
    }
  }
  return null;
}
