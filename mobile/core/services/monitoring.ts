import React from "react";

type SentryLevel = "fatal" | "error" | "warning" | "log" | "info" | "debug";

class MonitoringService {
  private initialized = false;

  initialize() {
    this.initialized = true;
  }

  startTransaction(_name: string, _operation: string) {
    return {
      finish() {},
      setStatus(_status: string) {},
      startChild() {
        return { finish() {}, setStatus(_status: string) {} };
      },
    };
  }

  startSpan(_name: string, _operation: string) {
    return { finish() {}, setStatus(_status: string) {} };
  }

  captureException(error: Error, context?: Record<string, any>) {
    if (__DEV__)
      console.warn("Monitoring captureException:", error?.message, context);
  }

  captureMessage(
    message: string,
    level: SentryLevel = "info",
    context?: Record<string, any>,
  ) {
    if (__DEV__) console.debug("Monitoring message:", level, message, context);
  }

  addBreadcrumb(_message: string, _category?: string, _level?: SentryLevel) {}

  captureUserFeedback(_feedback: {
    name?: string;
    email?: string;
    message: string;
  }) {}

  setUser(_user: Record<string, any> | null) {}

  clearUser() {}

  setTag(_key: string, _value: string) {}

  setContext(_key: string, _context: Record<string, any>) {}
}

export const monitoring = new MonitoringService();

export function withMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  _name?: string,
) {
  return Component;
}

export async function monitorApiCall<T>(
  operationName: string,
  apiCall: () => Promise<T>,
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    monitoring.captureException(error as Error, { operationName });
    throw error;
  }
}

export default monitoring;
