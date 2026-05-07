import AsyncStorage from '@react-native-async-storage/async-storage';

type NetworkState = {
  isConnected: boolean;
  type: string;
  isInternetReachable: boolean;
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
}

class OfflineService {
  private cacheVersion = '1.0.0';
  private defaultTTL = 24 * 60 * 60 * 1000;

  get isConnected(): boolean {
    return true;
  }

  async getNetworkState(): Promise<NetworkState> {
    return { isConnected: true, type: 'unknown', isInternetReachable: true };
  }

  async setCache<T>(key: string, data: T, ttl?: number): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + (ttl || this.defaultTTL),
      version: this.cacheVersion,
    };
    await AsyncStorage.setItem(`@arbebus_cache_${key}`, JSON.stringify(entry));
  }

  async getCache<T>(key: string): Promise<T | null> {
    const cached = await AsyncStorage.getItem(`@arbebus_cache_${key}`);
    if (!cached) return null;
    const entry = JSON.parse(cached) as CacheEntry<T>;
    if (entry.expiresAt < Date.now()) {
      await AsyncStorage.removeItem(`@arbebus_cache_${key}`);
      return null;
    }
    return entry.data;
  }

  async removeCache(key: string): Promise<void> {
    await AsyncStorage.removeItem(`@arbebus_cache_${key}`);
  }

  async clearCache(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith('@arbebus_cache_'));
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  }

  async queueOfflineAction(_description: string, _action: () => Promise<any>) {
    return null;
  }
}

export const offlineService = new OfflineService();
export default offlineService;
