import AsyncStorage from '@react-native-async-storage/async-storage';

type Priority = 'low' | 'normal' | 'high';

type NetworkState = {
  isConnected: boolean;
  type: string;
  isInternetReachable: boolean;
};

class OfflineManager {
  private defaultTTL = 24 * 60 * 60 * 1000;
  private cacheVersion = '1.0.0';

  get isConnected(): boolean {
    return true;
  }

  async getNetworkState(): Promise<NetworkState> {
    return { isConnected: true, type: 'unknown', isInternetReachable: true };
  }

  async setCache<T>(key: string, data: T, options?: { ttl?: number; priority?: Priority; compress?: boolean }): Promise<void> {
    const entry = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + (options?.ttl || this.defaultTTL),
      version: this.cacheVersion,
      priority: options?.priority || 'normal',
      compressed: Boolean(options?.compress),
    };
    await AsyncStorage.setItem(`@arbebus_cache_${key}`, JSON.stringify(entry));
  }

  async getCache<T>(key: string): Promise<T | null> {
    const cached = await AsyncStorage.getItem(`@arbebus_cache_${key}`);
    if (!cached) return null;
    const entry = JSON.parse(cached);
    if (entry.expiresAt < Date.now()) {
      await AsyncStorage.removeItem(`@arbebus_cache_${key}`);
      return null;
    }
    return entry.data as T;
  }

  async removeCache(key: string): Promise<void> {
    await AsyncStorage.removeItem(`@arbebus_cache_${key}`);
  }

  async clearCache(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith('@arbebus_cache_'));
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  }

  async queueOfflineAction(_description: string, _action: () => Promise<any>, _priority: Priority = 'normal') {
    return null;
  }

  async processOfflineQueue(): Promise<void> {}

  async getOfflineStatusSummary() {
    return { isConnected: true, queueLength: 0, cacheItems: 0 };
  }
}

export const offlineManager = new OfflineManager();
export default offlineManager;
