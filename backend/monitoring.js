let Sentry = null;

try {
  Sentry = require("@sentry/node");
} catch (error) {
  console.warn("Sentry package not found, monitoring running in basic mode");
}

function initializeMonitoring() {
  const dsn = process.env.SENTRY_DSN;

  if (!Sentry || !dsn) {
    console.warn("SENTRY_DSN not configured, Sentry disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    beforeSend(event) {
      if (event.request && event.request.data) {
        const sanitized = { ...event.request.data };
        delete sanitized.password;
        delete sanitized.token;
        delete sanitized.apiKey;
        delete sanitized.authorization;
        event.request.data = sanitized;
      }
      return event;
    },
  });

  Sentry.setTag("service", "arbebus-backend");
  Sentry.setTag("version", process.env.npm_package_version || "unknown");

  console.log("✅ Backend monitoring initialized");
}

function performanceMiddleware(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;

    if (duration > 1000) {
      const message = `Slow request: ${req.method} ${req.originalUrl || req.url} (${duration}ms)`;

      console.warn("[MONITORING]", message);

      if (Sentry) {
        Sentry.withScope((scope) => {
          scope.setLevel("warning");
          scope.setTag("method", req.method);
          scope.setTag("url", req.originalUrl || req.url);
          Sentry.captureMessage(message);
        });
      }
    }
  });

  next();
}

function errorMiddleware(err, req, res, next) {
  console.error("[ERROR]", err);

  if (Sentry) {
    Sentry.withScope((scope) => {
      scope.setTag("method", req.method);
      scope.setTag("url", req.originalUrl || req.url);
      scope.setUser({ ip_address: req.ip });
      Sentry.captureException(err);
    });
  }

  const isDevelopment = process.env.NODE_ENV !== "production";
  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    error: isDevelopment ? err.message : "Internal server error",
    ...(isDevelopment && { stack: err.stack }),
  });
}

function createHealthCheck() {
  return async (req, res) => {
    try {
      res.json({
        ok: true,
        status: "healthy",
        service: "arbebus-backend",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || "unknown",
      });
    } catch (error) {
      if (Sentry) Sentry.captureException(error);

      res.status(503).json({
        ok: false,
        status: "unhealthy",
        error: "Health check failed",
      });
    }
  };
}

async function monitorDatabaseQuery(queryName, queryFn) {
  const start = Date.now();

  try {
    const result = await queryFn();
    const duration = Date.now() - start;

    if (duration > 100) {
      const message = `Slow database query: ${queryName} (${duration}ms)`;
      console.warn("[DB]", message);

      if (Sentry) {
        Sentry.withScope((scope) => {
          scope.setLevel("warning");
          scope.setTag("query", queryName);
          Sentry.captureMessage(message);
        });
      }
    }

    return result;
  } catch (error) {
    if (Sentry) Sentry.captureException(error);
    throw error;
  }
}

function monitorApiCall(operationName) {
  return (req, res, next) => {
    const start = Date.now();
    const originalJson = res.json;

    res.json = function patchedJson(data) {
      const duration = Date.now() - start;

      if (duration > 500) {
        const message = `Slow API call: ${operationName} (${duration}ms)`;
        console.warn("[API]", message);

        if (Sentry) {
          Sentry.withScope((scope) => {
            scope.setLevel("warning");
            scope.setTag("operation", operationName);
            Sentry.captureMessage(message);
          });
        }
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

module.exports = {
  initializeMonitoring,
  performanceMiddleware,
  errorMiddleware,
  createHealthCheck,
  monitorDatabaseQuery,
  monitorApiCall,
};