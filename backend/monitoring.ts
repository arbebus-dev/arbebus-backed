import * as Sentry from '@sentry/node';

export function initializeMonitoring() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn('SENTRY_DSN not configured, monitoring disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      Sentry.httpIntegration(),
      Sentry.consoleIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 1.0,
    beforeSend(event) {
      // Sanitize sensitive data
      if (event.request?.data) {
        // Remove sensitive fields from request data
        const sanitized = { ...event.request.data };
        delete sanitized.password;
        delete sanitized.token;
        delete sanitized.apiKey;
        event.request.data = sanitized;
      }
      return event;
    },
  });

  // Set tags
  Sentry.setTag('service', 'arbebus-backend');
  Sentry.setTag('version', process.env.npm_package_version || 'unknown');

  console.log('✅ Backend monitoring initialized with Sentry');
}

// Performance monitoring middleware
export function performanceMiddleware(req: any, res: any, next: any) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Track slow requests
    if (duration > 1000) {
      Sentry.withScope(scope => {
        scope.setLevel('warning');
        Sentry.captureMessage(`Slow request: ${req.method} ${req.url} (${duration}ms)`, 'warning');
      });
    }
  });

  next();
}

// Error tracking middleware
export function errorMiddleware(err: any, req: any, res: any, next: any) {
  Sentry.withScope(scope => {
    scope.setTag('method', req.method);
    scope.setTag('url', req.url);
    scope.setUser({
      ip_address: req.ip,
    });

    Sentry.captureException(err);
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const statusCode = err.statusCode || 500;
  const message = isDevelopment ? err.message : 'Internal server error';

  res.status(statusCode).json({
    error: message,
    ...(isDevelopment && { stack: err.stack }),
  });
}

// Health check with monitoring
export function createHealthCheck() {
  return async (req: any, res: any) => {
    const startTime = Date.now();

    try {
      // Add health check logic here
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version,
      };

      const responseTime = Date.now() - startTime;

      // Track health check performance
      Sentry.metrics.increment('health_check_total');
      Sentry.metrics.distribution('health_check_duration', responseTime);

      res.json(health);
    } catch (error) {
      Sentry.captureException(error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
      });
    }
  };
}

// Database monitoring
export async function monitorDatabaseQuery(queryName: string, queryFn: () => Promise<any>) {
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;

    // Track slow queries
    if (duration > 100) {
      Sentry.withScope(scope => {
        scope.setLevel('warning');
        Sentry.captureMessage(`Slow database query: ${queryName} (${duration}ms)`, 'warning');
      });
    }

    return result;
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}

// API monitoring
export function monitorApiCall(operationName: string) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    const originalJson = res.json;
    res.json = function(data: any) {
      const duration = Date.now() - startTime;
      // Track slow API calls
      if (duration > 500) {
        Sentry.withScope(scope => {
          scope.setLevel('warning');
          scope.setTag('operation', operationName);
          Sentry.captureMessage(`Slow API call: ${operationName} (${duration}ms)`, 'warning');
        });
      }
      return originalJson.call(this, data);
    };

    next();
  };
}