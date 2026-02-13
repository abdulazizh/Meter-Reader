import AsyncStorage from '@react-native-async-storage/async-storage';

const CONFIG_STORAGE_KEY = '@meter_reader_config';
const DEFAULT_SERVER_DOMAIN = 'AZIZ-PC.local:5000';

export interface AppConfig {
  serverDomain: string;
  version?: string;
  updatedAt?: string;
}

class ConfigService {
  private config: AppConfig | null = null;

  /**
   * Get the current server domain
   */
  async getServerDomain(): Promise<string> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config?.serverDomain || DEFAULT_SERVER_DOMAIN;
  }

  /**
   * Load config from AsyncStorage
   */
  async loadConfig(): Promise<AppConfig> {
    try {
      const stored = await AsyncStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        this.config = JSON.parse(stored);
        return this.config!;
      }
    } catch (error) {
      console.warn('Failed to load config from storage:', error);
    }

    // Return default if no stored config
    const envDomain = process.env.EXPO_PUBLIC_DOMAIN;
    this.config = { serverDomain: envDomain || DEFAULT_SERVER_DOMAIN };
    return this.config;
  }

  /**
   * Fetch config from server and save to AsyncStorage
   */
  async fetchAndSaveConfig(serverUrl?: string): Promise<AppConfig> {
    try {
      const baseUrl = serverUrl || (await this.getServerDomain());
      const protocol = baseUrl.includes('localhost') || /^\d+\.\d+\.\d+\.\d+/.test(baseUrl) || baseUrl.includes('.local') ? 'http' : 'https';
      const url = `${protocol}://${baseUrl}/api/config`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
      }

      const config: AppConfig = await response.json();
      await this.saveConfig(config);
      return config;
    } catch (error) {
      console.warn('Failed to fetch config from server:', error);
      // Return current config or default
      return this.config || { serverDomain: DEFAULT_SERVER_DOMAIN };
    }
  }

  /**
   * Save config to AsyncStorage
   */
  async saveConfig(config: AppConfig): Promise<void> {
    try {
      this.config = config;
      await AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  /**
   * Update server domain manually
   */
  async updateServerDomain(domain: string): Promise<void> {
    const newConfig: AppConfig = {
      ...this.config,
      serverDomain: domain,
      updatedAt: new Date().toISOString(),
    };
    await this.saveConfig(newConfig);
  }

  /**
   * Clear stored config
   */
  async clearConfig(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CONFIG_STORAGE_KEY);
      this.config = null;
    } catch (error) {
      console.error('Failed to clear config:', error);
    }
  }
}

export const configService = new ConfigService();
