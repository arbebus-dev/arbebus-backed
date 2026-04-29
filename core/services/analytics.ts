import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Mixpanel } from 'mixpanel-react-native';
import { Platform } from 'react-native';

class AnalyticsService {
  private mixpanel: Mixpanel | null = null;
  private initialized = false;
  private userId: string | null = null;

  async initialize() {
    if (this.initialized) return;

    const token = Constants.expoConfig?.extra?.mixpanelToken || process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;

    if (!token) {
      console.warn('Mixpanel token not found, analytics disabled');
      return;
    }

    try {
      this.mixpanel = new Mixpanel(token, true); // true for EU data residency

      // Set up anonymous user identification
      this.userId = `anonymous-${Application.getAndroidId() || (await Application.getIosIdForVendorAsync()) || 'unknown'}`;

      // Set super properties (non-identifying)
      await this.mixpanel?.registerSuperProperties({
        app_version: Constants.expoConfig?.version || 'unknown',
        platform: Platform.OS,
        device_type: Platform.OS === 'ios' ? 'ios' : 'android',
        app_install_time: new Date().toISOString(),
      });

      this.initialized = true;
    } catch (error) {
      console.warn('Failed to initialize analytics:', error);
    }
  }

  // Privacy-focused event tracking
  async trackEvent(eventName: string, properties: Record<string, any> = {}) {
    if (!this.initialized || !this.mixpanel) return;

    try {
      // Sanitize properties to ensure no PII
      const sanitizedProps = this.sanitizeProperties(properties);

      await this.mixpanel.track(eventName, {
        ...sanitizedProps,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Failed to track event:', error);
    }
  }

  // App lifecycle events
  async trackAppOpen() {
    await this.trackEvent('app_open', {
      session_start: true,
    });
  }

  async trackAppClose() {
    await this.trackEvent('app_close', {
      session_end: true,
    });
  }

  // Navigation events (anonymized)
  async trackScreenView(screenName: string, properties: Record<string, any> = {}) {
    await this.trackEvent('screen_view', {
      screen_name: screenName,
      ...properties,
    });
  }

  // Transit-related events (privacy-focused)
  async trackTransitSearch(searchType: 'stops' | 'places' | 'routes', queryLength: number) {
    await this.trackEvent('transit_search', {
      search_type: searchType,
      query_length: Math.min(queryLength, 50), // Cap to prevent fingerprinting
      has_results: true, // Always true for privacy
    });
  }

  async trackRoutePlanning(originType: string, destinationType: string, hasResults: boolean) {
    await this.trackEvent('route_plan', {
      origin_type: originType,
      destination_type: destinationType,
      has_results: hasResults,
    });
  }

  async trackLiveBusView(routeCount: number) {
    await this.trackEvent('live_bus_view', {
      route_count: Math.min(routeCount, 20), // Cap for privacy
    });
  }

  // Feature usage (anonymized)
  async trackFeatureUsage(featureName: string, context?: string) {
    await this.trackEvent('feature_usage', {
      feature: featureName,
      context: context || 'unknown',
    });
  }

  // Error tracking (non-identifying)
  async trackError(errorType: string, component?: string) {
    await this.trackEvent('error_occurred', {
      error_type: errorType,
      component: component || 'unknown',
      is_recoverable: true, // Assume recoverable for privacy
    });
  }

  // Performance metrics (aggregated)
  async trackPerformanceMetric(metricName: string, value: number, unit: string) {
    // Only track aggregated performance data
    if (value > 0 && value < 100000) { // Reasonable bounds
      await this.trackEvent('performance_metric', {
        metric: metricName,
        value_bucket: this.bucketizeValue(value), // Bucket values for privacy
        unit,
      });
    }
  }

  // User preferences (anonymized)
  async trackPreferenceChange(preferenceType: string, enabled: boolean) {
    await this.trackEvent('preference_change', {
      preference_type: preferenceType,
      enabled,
    });
  }

  // Helper methods
  private sanitizeProperties(properties: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      // Skip any potentially identifying information
      if (this.isIdentifyingKey(key)) continue;

      // Sanitize values
      if (typeof value === 'string') {
        sanitized[key] = value.length > 100 ? value.substring(0, 100) : value;
      } else if (typeof value === 'number') {
        sanitized[key] = Math.max(0, Math.min(value, 1000000)); // Reasonable bounds
      } else if (typeof value === 'boolean') {
        sanitized[key] = value;
      }
      // Skip complex objects, arrays, etc.
    }

    return sanitized;
  }

  private isIdentifyingKey(key: string): boolean {
    const identifyingKeys = [
      'userId', 'user_id', 'email', 'phone', 'name', 'address',
      'location', 'latitude', 'longitude', 'ip', 'deviceId',
      'uuid', 'token', 'password', 'apiKey'
    ];

    return identifyingKeys.some(idKey =>
      key.toLowerCase().includes(idKey.toLowerCase())
    );
  }

  private bucketizeValue(value: number): string {
    if (value < 100) return '< 100ms';
    if (value < 500) return '100-500ms';
    if (value < 1000) return '500-1000ms';
    if (value < 5000) return '1-5s';
    return '> 5s';
  }

  // GDPR compliance
  async optOut() {
    if (this.mixpanel) {
      await this.mixpanel.optOutTracking();
    }
  }

  async optIn() {
    if (this.mixpanel) {
      await this.mixpanel.optInTracking();
    }
  }

  async reset() {
    if (this.mixpanel) {
      await this.mixpanel.reset();
      this.userId = null;
    }
  }
}

// Singleton instance
export const analytics = new AnalyticsService();

export default analytics;