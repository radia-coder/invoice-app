import * as Sentry from '@sentry/nextjs';

/**
 * Centralized logging utility that:
 * - Logs to console in development
 * - Sends to Sentry in production
 * - Prevents stack trace leakage to users
 */

export function logError(context: string, error: unknown, extra?: Record<string, any>) {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // Full error details in development
    console.error(`[${context}]`, error, extra);
  } else {
    // Minimal console output in production
    console.error(`[${context}] Error occurred`);
    
    // Send to Sentry with context
    Sentry.captureException(error, {
      tags: {
        context,
      },
      extra: {
        ...extra,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

export function logWarning(context: string, message: string, extra?: Record<string, any>) {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    console.warn(`[${context}]`, message, extra);
  } else {
    Sentry.captureMessage(message, {
      level: 'warning',
      tags: { context },
      extra,
    });
  }
}

export function logInfo(context: string, message: string, extra?: Record<string, any>) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${context}]`, message, extra);
  }
  // Don't send info logs to Sentry to avoid noise
}

/**
 * Set user context for Sentry error tracking
 */
export function setUserContext(user: { id: number; email: string; role: string; company_id?: number | null }) {
  Sentry.setUser({
    id: user.id.toString(),
    email: user.email,
    role: user.role,
    company_id: user.company_id?.toString(),
  });
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUserContext() {
  Sentry.setUser(null);
}
