import React from 'react';
import { Wifi, WifiOff, Shield } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Badge } from './Badge';
import { Switch } from './Switch';

export const NetworkStatusIndicator: React.FC = () => {
  const { networkStatus, killSwitchEnabled, toggleKillSwitch } = useNetworkStatus();

  const getStatusConfig = () => {
    switch (networkStatus) {
      case 'online':
        return {
          icon: Wifi,
          label: 'Online',
          variant: 'success' as const,
          color: 'text-green-300',
        };
      case 'offline':
        return {
          icon: WifiOff,
          label: 'Offline',
          variant: 'error' as const,
          color: 'text-red-300',
        };
      case 'kill-switch':
        return {
          icon: Shield,
          label: 'Kill Switch',
          variant: 'warning' as const,
          color: 'text-yellow-300',
        };
      default:
        return {
          icon: WifiOff,
          label: 'Unknown',
          variant: 'default' as const,
          color: 'text-orange-300',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border border-orange-300/20 rounded-md bg-black">
      <Icon className={`w-4 h-4 ${config.color}`} />
      <Badge variant={config.variant} size="sm">
        {config.label}
      </Badge>
      <div className="flex items-center gap-2 ml-2 pl-2 border-l border-orange-300/20">
        <Switch
          label=""
          checked={killSwitchEnabled}
          onChange={toggleKillSwitch}
          className="m-0"
        />
        <span className="text-xs text-orange-300/70 font-mono">kill-switch</span>
      </div>
    </div>
  );
};

