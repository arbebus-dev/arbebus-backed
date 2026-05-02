import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
}

interface OfflineConfig {
  maxCacheSize: number;
  defaultTTL: number; // Time to live in milliseconds
  cacheVersion: string;
}

class OfflineService {
  private config: OfflineConfig = {
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
    cacheVersion: '1.0.0',
  };

  private isOnline = true;
  private networkListener: any = null;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Set up network listener
    this.networkListener = NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
    });

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

  // Cache management
  async setCache<T>(key: string, data: T, ttl?: number): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + (ttl || this.config.defaultTTL),
        version: this.config.cacheVersion,
      };

      const serialized = JSON.stringify(entry);
      await AsyncStorage.setItem(`@arbebus_cache_${key}`, serialized);

      // Check cache size and cleanup if needed
      await this.enforceCacheSize();
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }

  async getCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`@arbebus_cache_${key}`);
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);

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
    } catch (error) {
      console.warn('Failed to remove cache:', error);
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('@arbebus_cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  private async cleanupExpiredCache(): Promise<void> {
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

  private async enforceCacheSize(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('@arbebus_cache_'));

      if (cacheKeys.length > 100) { // If we have too many entries
        // Remove oldest entries
        const entries = await Promise.all(
          cacheKeys.map(async key => {
            const cached = await AsyncStorage.getItem(key);
            if (cached) {
              try {
                const entry = JSON.parse(cached);
                return { key, timestamp: entry.timestamp };
              } catch {
                return { key, timestamp: 0 };
              }
            }
            return { key, timestamp: 0 };
          })
        );

        // Sort by timestamp (oldest first) and remove oldest 20%
        entries.sort((a, b) => a.timestamp - b.timestamp);
        const toRemove = entries.slice(0, Math.floor(entries.length * 0.2));
        await AsyncStorage.multiRemove(toRemove.map(entry => entry.key));
      }
    } catch (error) {
      console.warn('Failed to enforce cache size:', error);
    }
  }

  // Transit-specific offline features
  async cacheTransitData(data: {
    stops?: any[];
    routes?: any[];
    trips?: any[];
    shapes?: any[];
  }) {
    const promises = [];

    if (data.stops) {
      promises.push(this.setCache('transit_stops', data.stops, 7 * 24 * 60 * 60 * 1000)); // 7 days
    }

    if (data.routes) {
      promises.push(this.setCache('transit_routes', data.routes, 7 * 24 * 60 * 60 * 1000));
    }

    if (data.trips) {
      promises.push(this.setCache('transit_trips', data.trips, 24 * 60 * 60 * 1000)); // 1 day
    }

    if (data.shapes) {
      promises.push(this.setCache('transit_shapes', data.shapes, 7 * 24 * 60 * 60 * 1000));
    }

    await Promise.all(promises);
  }

  async getCachedTransitData() {
    const [stops, routes, trips, shapes] = await Promise.all([
      this.getCache<any[]>('transit_stops'),
      this.getCache<any[]>('transit_routes'),
      this.getCache<any[]>('transit_trips'),
      this.getCache<any[]>('transit_shapes'),
    ]);

    return {
      stops: stops || [],
      routes: routes || [],
      trips: trips || [],
      shapes: shapes || [],
    };
  }

  // Offline queue for actions that require network
  private offlineQueue: Array<{
    id: string;
    action: () => Promise<any>;
    retryCount: number;
  }> = [];

  async queueOfflineAction(action: () => Promise<any>): Promise<string> {
    const id = `offline_action_${Date.now()}_${Math.random()}`;
    this.offlineQueue.push({
      id,
      action,
      retryCount: 0,
    });

    // Try to execute immediately if online
    if (this.isConnected) {
      this.processOfflineQueue();
    }

    return id;
  }

  private async processOfflineQueue() {
    if (!this.isConnected || this.offlineQueue.length === 0) return;

    const actions = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of actions) {
      try {
        await item.action();
      } catch (error) {
        console.warn('Offline action failed:', error);
        // Re-queue with increased retry count
        if (item.retryCount < 3) {
          this.offlineQueue.push({
            ...item,
            retryCount: item.retryCount + 1,
          });
        }
      }
    }
  }

  // Sync when coming back online
  onNetworkReconnect() {
    this.processOfflineQueue();
  }

  // Cleanup
  dispose() {
    if (this.networkListener) {
      this.networkListener();
    }
  }
}

// Singleton instance
export const offlineService = new OfflineService();

export default offlineService;