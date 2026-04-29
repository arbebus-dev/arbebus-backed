import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

interface OfflineConfig {
  maxCacheSize: number;
  defaultTTL: number;
  cacheVersion: string;
}

interface OfflineQueueItem {
  id: string;
  action: () => Promise<any>;
  retryCount: number;
  timestamp: number;
  priority: 'low' | 'normal' | 'high';
  maxRetries: number;
  description: string;
}

class OfflineManager {
  private config: OfflineConfig = {
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
    cacheVersion: '1.0.0',
  };

  private isOnline = true;
  private networkListener: any = null;
  private offlineQueue: OfflineQueueItem[] = [];

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Set up network listener
    this.networkListener = NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      // If we came back online, process the queue
      if (wasOffline && this.isOnline) {
        this.processOfflineQueue();
      }
    });

    // Load persisted offline queue
    await this.loadOfflineQueue();

    // Clean up expired cache on startup
    await this.cleanupExpiredCache();
  }

  // Network status
  get isConnected(): boolean {
    return this.isOnline;
  }

  async getNetworkState() {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected,
      type: state.type,
      isInternetReachable: state.isInternetReachable,
    };
  }

  // Cache management with enhanced offline support
  async setCache<T>(key: string, data: T, options?: {
    ttl?: number;
    priority?: 'low' | 'normal' | 'high';
    compress?: boolean;
  }): Promise<void> {
    try {
      const entry = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + (options?.ttl || this.config.defaultTTL),
        version: this.config.cacheVersion,
        priority: options?.priority || 'normal',
        compressed: options?.compress || false,
      };

      const serialized = JSON.stringify(entry);
      await AsyncStorage.setItem(`@arbebus_cache_${key}`, serialized);

      // Update cache metadata
      await this.updateCacheMetadata(key, entry);

      // Enforce cache size limits
      await this.enforceCacheSize();
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }

  async getCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`@arbebus_cache_${key}`);
      if (!cached) return null;

      const entry = JSON.parse(cached);

      // Check if cache is valid
      if (Date.now() > entry.expiresAt) {
        await this.removeCache(key);
        return null;
      }

      // Check version compatibility
      if (entry.version !== this.config.cacheVersion) {
        await this.removeCache(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn('Failed to get cached data:', error);
      return null;
    }
  }

  async removeCache(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`@arbebus_cache_${key}`);
      await this.removeCacheMetadata(key);
    } catch (error) {
      console.warn('Failed to remove cache:', error);
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key =>
        key.startsWith('@arbebus_cache_') ||
        key.startsWith('@arbebus_meta_')
      );
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  // Enhanced offline queue with persistence
  async queueOfflineAction(
    action: () => Promise<any>,
    options?: {
      priority?: 'low' | 'normal' | 'high';
      maxRetries?: number;
      description?: string;
    }
  ): Promise<string> {
    const id = `offline_action_${Date.now()}_${Math.random()}`;
    const item: OfflineQueueItem = {
      id,
      action,
      retryCount: 0,
      timestamp: Date.now(),
      priority: options?.priority || 'normal',
      maxRetries: options?.maxRetries || 3,
      description: options?.description || 'Offline action',
    };

    this.offlineQueue.push(item);
    // Note: Functions cannot be persisted, so we only keep them in memory
    return id;
  }

  private async processOfflineQueue() {
    if (!this.isConnected || this.offlineQueue.length === 0) return;

    // Sort by priority (high first)
    const priorityOrder = { high: 3, normal: 2, low: 1 };
    this.offlineQueue.sort((a, b) =>
      priorityOrder[b.priority] - priorityOrder[a.priority]
    );

    const actions = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of actions) {
      try {
        // Reconstruct function from string (simplified approach)
        const action = new Function('return ' + item.action)();

        await action();
        console.log(`✅ Offline action completed: ${item.description}`);
      } catch (error) {
        console.warn(`❌ Offline action failed: ${item.description}`, error);

        // Re-queue with increased retry count
        if (item.retryCount < item.maxRetries) {
          this.offlineQueue.push({
            ...item,
            retryCount: item.retryCount + 1,
          });
        } else {
          console.warn(`💀 Offline action abandoned after ${item.maxRetries} retries: ${item.description}`);
        }
      }
    }

    await this.persistOfflineQueue();
  }

  private async persistOfflineQueue() {
    try {
      await AsyncStorage.setItem(
        '@arbebus_offline_queue',
        JSON.stringify(this.offlineQueue)
      );
    } catch (error) {
      console.warn('Failed to persist offline queue:', error);
    }
  }

  private async loadOfflineQueue() {
    try {
      const persisted = await AsyncStorage.getItem('@arbebus_offline_queue');
      if (persisted) {
        const parsed = JSON.parse(persisted);
        // Filter out old actions (older than 7 days)
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        this.offlineQueue = parsed.filter((item: any) => item.timestamp > weekAgo);
      }
    } catch (error) {
      console.warn('Failed to load offline queue:', error);
    }
  }

  // Cache metadata management
  private async updateCacheMetadata(key: string, entry: any) {
    try {
      const metadata = await this.getCacheMetadata();
      metadata[key] = {
        size: JSON.stringify(entry).length,
        priority: entry.priority,
        timestamp: entry.timestamp,
      };
      await AsyncStorage.setItem('@arbebus_cache_metadata', JSON.stringify(metadata));
    } catch (error) {
      console.warn('Failed to update cache metadata:', error);
    }
  }

  private async removeCacheMetadata(key: string) {
    try {
      const metadata = await this.getCacheMetadata();
      delete metadata[key];
      await AsyncStorage.setItem('@arbebus_cache_metadata', JSON.stringify(metadata));
    } catch (error) {
      console.warn('Failed to remove cache metadata:', error);
    }
  }

  private async getCacheMetadata() {
    try {
      const metadata = await AsyncStorage.getItem('@arbebus_cache_metadata');
      return metadata ? JSON.parse(metadata) : {};
    } catch {
      return {};
    }
  }

  private async enforceCacheSize() {
    try {
      const metadata = await this.getCacheMetadata();
      const entries = Object.entries(metadata);

      if (entries.length > 200) { // If we have too many entries
        // Sort by priority and timestamp, remove oldest low-priority items
        entries.sort(([, a]: any, [, b]: any) => {
          const priorityOrder = { high: 3, normal: 2, low: 1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return b.timestamp - a.timestamp; // Newer first
        });

        // Remove oldest 30% of low-priority items
        const toRemove = entries
          .filter(([, meta]: any) => meta.priority === 'low')
          .slice(-Math.floor(entries.length * 0.3))
          .map(([key]) => key);

        for (const key of toRemove) {
          await this.removeCache(key);
        }
      }
    } catch (error) {
      console.warn('Failed to enforce cache size:', error);
    }
  }

  private async cleanupExpiredCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('@arbebus_cache_'));

      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          try {
            const entry = JSON.parse(cached);
            if (Date.now() > entry.expiresAt || entry.version !== this.config.cacheVersion) {
              await AsyncStorage.removeItem(key);
            }
          } catch {
            // Invalid cache entry, remove it
            await AsyncStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup cache:', error);
    }
  }

  // Transit-specific offline features
  async cacheTransitData(data: {
    stops?: any[];
    routes?: any[];
    trips?: any[];
    shapes?: any[];
    liveVehicles?: any[];
  }) {
    const promises = [];

    if (data.stops) {
      promises.push(this.setCache('transit_stops', data.stops, {
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
        priority: 'high'
      }));
    }

    if (data.routes) {
      promises.push(this.setCache('transit_routes', data.routes, {
        ttl: 7 * 24 * 60 * 60 * 1000,
        priority: 'high'
      }));
    }

    if (data.trips) {
      promises.push(this.setCache('transit_trips', data.trips, {
        ttl: 24 * 60 * 60 * 1000, // 1 day
        priority: 'normal'
      }));
    }

    if (data.shapes) {
      promises.push(this.setCache('transit_shapes', data.shapes, {
        ttl: 7 * 24 * 60 * 60 * 1000,
        priority: 'normal'
      }));
    }

    if (data.liveVehicles) {
      promises.push(this.setCache('live_vehicles', data.liveVehicles, {
        ttl: 5 * 60 * 1000, // 5 minutes
        priority: 'high'
      }));
    }

    await Promise.all(promises);
  }

  async getCachedTransitData() {
    const [stops, routes, trips, shapes, liveVehicles] = await Promise.all([
      this.getCache<any[]>('transit_stops'),
      this.getCache<any[]>('transit_routes'),
      this.getCache<any[]>('transit_trips'),
      this.getCache<any[]>('transit_shapes'),
      this.getCache<any[]>('live_vehicles'),
    ]);

    return {
      stops: stops || [],
      routes: routes || [],
      trips: trips || [],
      shapes: shapes || [],
      liveVehicles: liveVehicles || [],
      isFromCache: true,
      cacheTimestamp: Date.now(),
    };
  }

  // Offline route planning (simplified version)
  async planRouteOffline(origin: any, destination: any) {
    const cachedData = await this.getCachedTransitData();

    if (!cachedData.stops.length || !cachedData.routes.length) {
      throw new Error('Insufficient offline data for route planning');
    }

    // Simplified offline route planning logic
    // Find nearest stops to origin and destination
    const nearestOriginStops = this.findNearestStops(cachedData.stops, origin, 3);
    const nearestDestStops = this.findNearestStops(cachedData.stops, destination, 3);

    // Find routes that connect these stops
    const possibleRoutes = this.findConnectingRoutes(
      cachedData.routes,
      cachedData.trips,
      nearestOriginStops,
      nearestDestStops
    );

    return {
      routes: possibleRoutes,
      isOfflineResult: true,
      disclaimer: 'This is an offline route suggestion. Please check for updates when online.',
    };
  }

  private findNearestStops(stops: any[], location: any, limit: number) {
    return stops
      .map(stop => ({
        ...stop,
        distance: this.calculateDistance(location, stop),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  private findConnectingRoutes(routes: any[], trips: any[], originStops: any[], destStops: any[]) {
    // Simplified route finding - in a real implementation, this would be much more complex
    const routeSuggestions = [];

    for (const route of routes.slice(0, 5)) { // Limit to first 5 routes
      const routeTrips = trips.filter(trip => trip.route_id === route.route_id);
      if (routeTrips.length > 0) {
        routeSuggestions.push({
          ...route,
          estimatedDuration: 30 + Math.random() * 30, // Mock duration
          transfers: Math.floor(Math.random() * 2), // Mock transfers
          isOfflineEstimate: true,
        });
      }
    }

    return routeSuggestions;
  }

  private calculateDistance(loc1: any, loc2: any): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(loc2.stop_lat - loc1.latitude);
    const dLon = this.toRadians(loc2.stop_lon - loc1.longitude);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(loc1.latitude)) * Math.cos(this.toRadians(loc2.stop_lat)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // Distance in meters
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Cleanup
  dispose() {
    if (this.networkListener) {
      this.networkListener();
    }
  }

  // Get offline status summary
  async getOfflineStatus() {
    const networkState = await this.getNetworkState();
    const cachedData = await this.getCachedTransitData();
    const queueLength = this.offlineQueue.length;

    return {
      isOnline: networkState.isConnected,
      networkType: networkState.type,
      hasCachedData: cachedData.stops.length > 0,
      cachedStopsCount: cachedData.stops.length,
      cachedRoutesCount: cachedData.routes.length,
      pendingActionsCount: queueLength,
      cacheSize: await this.getCacheSize(),
    };
  }

  private async getCacheSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('@arbebus_cache_'));

      let totalSize = 0;
      for (const key of cacheKeys.slice(0, 50)) { // Sample first 50
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }

      return totalSize;
    } catch {
      return 0;
    }
  }
}

// Singleton instance
export const offlineManager = new OfflineManager();

export default offlineManager;