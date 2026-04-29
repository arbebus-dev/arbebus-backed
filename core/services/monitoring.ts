import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import React from 'react';

class MonitoringService {
  private initialized = false;

  initialize() {
    if (this.initialized) return;

    Sentry.init({
      dsn: Constants.expoConfig?.extra?.sentryDsn || process.env.EXPO_PUBLIC_SENTRY_DSN,
      environment: __DEV__ ? 'development' : 'production',
      enableTracing: true,
      tracesSampleRate: __DEV__ ? 1.0 : 0.1,
      integrations: [
        new Sentry.ReactNativeTracing({
          routingInstrumentation: Sentry.reactNavigationIntegration(),
        }),
      ],
    });

    // Set user context (anonymized)
    Sentry.setUser({
      id: `device-${Device.modelId || 'unknown'}`,
      device: {
        brand: Device.brand,
        model: Device.modelName,
        type: Device.deviceType === Device.DeviceType.PHONE ? 'phone' : 'tablet',
      },
    });

    // Set tags
    Sentry.setTags({
      app_version: Constants.expoConfig?.version,
      platform: 'mobile',
      framework: 'react-native',
    });

    this.initialized = true;
  }

  // Performance monitoring
  startTransaction(name: string, operation: string) {
    return Sentry.startTransaction({
      name,
      op: operation,
    });
  }

  // Error tracking
  captureException(error: Error, context?: Record<string, any>) {
    Sentry.captureException(error, {
      tags: context,
    });
  }

  captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info', context?: Record<string, any>) {
    Sentry.captureMessage(message, {
      level,
      tags: context,
    });
  }

  // Performance metrics
  addBreadcrumb(message: string, category?: string, level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug') {
    Sentry.addBreadcrumb({
      message,
      category: category || 'custom',
      level: level || 'info',
    });
  }

  // User feedback
  captureUserFeedback(feedback: {
    name?: string;
    email?: string;
    message: string;
  }) {
    // Note: User feedback requires an event ID in modern Sentry
    Sentry.captureMessage(`User feedback: ${feedback.message}`, {
      level: 'info',
      user: {
        email: feedback.email,
        username: feedback.name,
      },
    });
  }

  // Custom metrics
  setContext(key: string, value: any) {
    Sentry.setContext(key, value);
  }

  // Performance spans
  startSpan(name: string, operation: string) {
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
    return transaction?.startChild({
      op: operation,
      description: name,
    });
  }
}

// Singleton instance
export const monitoring = new MonitoringService();

// React Error Boundary for automatic error catching
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: (error: Error) => React.ReactNode },
  { error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }
      return React.createElement('div', null, 'Error occurred');
    }

    return this.props.children;
  }
}

// Performance monitoring HOC
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return (props: P) => {
    React.useEffect(() => {
      const transaction = monitoring.startTransaction(
        `render-${componentName}`,
        'ui.render'
      );

      return () => {
        transaction?.finish();
      };
    }, []);

    return Component;
  };
}

// API monitoring
export function monitorApiCall<T>(
  apiCall: () => Promise<T>,
  operationName: string
): Promise<T> {
  const span = monitoring.startSpan(operationName, 'http.client');

  return apiCall()
    .then((result) => {
      span?.setStatus('ok');
      return result;
    })
    .catch((error) => {
      span?.setStatus('error');
      monitoring.captureException(error, {
        operation: operationName,
        type: 'api_error',
      });
      throw error;
    })
    .finally(() => {
      span?.finish();
    });
}

export default monitoring;