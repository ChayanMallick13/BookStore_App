function redact(value: string) {
  return value
    .replace(/(mongodb(?:\+srv)?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .replace(/\b(password|secret|token|authorization)\s*[:=]\s*["']?[^"'\s,;]+/gi, '$1=[redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]');
}

export function errorDetails(error: unknown, depth = 0): Record<string, unknown> {
  if (error instanceof Error) {
    const details: Record<string, unknown> = {
      name: error.name,
      message: redact(error.message),
      stack: error.stack ? redact(error.stack) : undefined,
    };
    const errorWithCode = error as Error & {
      code?: unknown;
      statusCode?: unknown;
      command?: unknown;
      provider?: unknown;
      providerCode?: unknown;
      cause?: unknown;
    };
    if (typeof errorWithCode.code === 'string' || typeof errorWithCode.code === 'number') {
      details.code = errorWithCode.code;
    }
    if (typeof errorWithCode.statusCode === 'number') details.statusCode = errorWithCode.statusCode;
    if (typeof errorWithCode.command === 'string') details.command = errorWithCode.command;
    if (typeof errorWithCode.provider === 'string') details.provider = errorWithCode.provider;
    if (typeof errorWithCode.providerCode === 'string') details.providerCode = errorWithCode.providerCode;
    if (depth < 2 && errorWithCode.cause !== undefined) {
      details.cause = errorDetails(errorWithCode.cause, depth + 1);
    }
    return details;
  }
  return { name: 'UnknownError', message: redact(String(error)) };
}
