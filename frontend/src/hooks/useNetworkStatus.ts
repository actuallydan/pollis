import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import * as api from '../services/api';

/**
 * Hook to monitor network status
 * - Polls backend network status every 5 seconds
 * - Listens to browser online/offline events for immediate feedback
 * - Updates the app store with current network status
 *
 * @param enabled - Whether to enable network status monitoring (default: true)
 */
export const useNetworkStatus = (enabled: boolean = true) => {
  const { networkStatus, killSwitchEnabled, setNetworkStatus, setKillSwitchEnabled } = useAppStore();

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    // Check network status from backend
    const checkStatus = async () => {
      if (!mounted) return;
      try {
        const status = await api.getNetworkStatus();
        if (mounted) {
          setNetworkStatus(status);
        }
      } catch (error) {
        // Ignore errors during polling - don't log to avoid spam
        // Network status errors shouldn't cause app reload
      }
    };

    // Handle browser online event - immediately check backend status
    const handleOnline = () => {
      console.log('[NetworkStatus] Browser online event detected');
      if (!killSwitchEnabled) {
        checkStatus(); // Verify with backend
      }
    };

    // Handle browser offline event - immediately update status
    const handleOffline = () => {
      console.log('[NetworkStatus] Browser offline event detected');
      if (!killSwitchEnabled) {
        setNetworkStatus('offline');
      }
    };

    // Initial check
    checkStatus();

    // Poll for network status changes every 5 seconds
    const interval = setInterval(checkStatus, 5000);

    // Listen to browser online/offline events for immediate feedback
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, killSwitchEnabled, setNetworkStatus]);

  const toggleKillSwitch = async (enabled: boolean) => {
    try {
      const { SetKillSwitch } = await import('../../wailsjs/go/main/App');
      await SetKillSwitch(enabled);
      setKillSwitchEnabled(enabled);
      if (enabled) {
        setNetworkStatus('kill-switch');
      } else {
        // Check actual network status
        const status = await api.getNetworkStatus();
        setNetworkStatus(status);
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

