import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
// Network status methods will be available after Wails bindings are regenerated
// For now, we'll use type-safe wrappers
const getNetworkStatus = async (): Promise<string> => {
  try {
    // @ts-ignore - Will be available after Wails bindings regeneration
    const { GetNetworkStatus } = await import('../../wailsjs/go/main/App');
    return await GetNetworkStatus();
  } catch (error) {
    console.warn('GetNetworkStatus not available yet:', error);
    return 'offline';
  }
};

const setKillSwitch = async (enabled: boolean): Promise<void> => {
  try {
    // @ts-ignore - Will be available after Wails bindings regeneration
    const { SetKillSwitch } = await import('../../wailsjs/go/main/App');
    await SetKillSwitch(enabled);
  } catch (error) {
    console.warn('SetKillSwitch not available yet:', error);
  }
};

export const useNetworkStatus = () => {
  const { networkStatus, killSwitchEnabled, setNetworkStatus, setKillSwitchEnabled } = useAppStore();

  useEffect(() => {
    // Check initial network status
    const checkStatus = async () => {
      try {
        const status = await getNetworkStatus();
        setNetworkStatus(status as 'online' | 'offline' | 'kill-switch');
      } catch (error) {
        console.error('Failed to get network status:', error);
        setNetworkStatus('offline');
      }
    };

    checkStatus();

    // Poll for network status changes
    const interval = setInterval(checkStatus, 2000);

    // Listen to browser online/offline events
    const handleOnline = () => {
      if (!killSwitchEnabled) {
        setNetworkStatus('online');
      }
    };
    const handleOffline = () => {
      if (!killSwitchEnabled) {
        setNetworkStatus('offline');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [killSwitchEnabled, setNetworkStatus]);

  const toggleKillSwitch = async (enabled: boolean) => {
    try {
      await setKillSwitch(enabled);
      setKillSwitchEnabled(enabled);
      if (enabled) {
        setNetworkStatus('kill-switch');
      } else {
        // Check actual network status
        const status = await getNetworkStatus();
        setNetworkStatus(status as 'online' | 'offline' | 'kill-switch');
      }
    } catch (error) {
      console.error('Failed to set kill switch:', error);
    }
  };

  return {
    networkStatus,
    killSwitchEnabled,
    toggleKillSwitch,
    isOnline: networkStatus === 'online',
  };
};

