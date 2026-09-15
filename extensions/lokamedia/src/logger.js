const SECRET_PATTERN = /(authorization|token|secret|password|cookie)/i;

export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, SECRET_PATTERN.test(key) ? '[REDACTED]' : redact(item)])
    );
  }
  return value;
}

export class Logger {
  constructor(prefix = 'LokaMedia') {
    this.prefix = prefix;
  }

  info(message, context = {}) {
    console.info(`[${this.prefix}] ${message}`, redact(context));
  }

  warn(message, context = {}) {
    console.warn(`[${this.prefix}] ${message}`, redact(context));
  }

  error(message, context = {}) {
    console.error(`[${this.prefix}] ${message}`, redact(context));
  }
}
