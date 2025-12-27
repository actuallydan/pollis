import React from "react";
import {
  Lock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { Badge } from "monopollis";

type IndicatorKind =
  | "encrypted"
  | "verified"
  | "warning"
  | "unverified"
  | "group-shield";

type BadgeVariant = "default" | "success" | "warning" | "error";

interface SecurityIndicatorProps {
  kind: IndicatorKind;
  label?: string;
}

export const SecurityIndicator: React.FC<SecurityIndicatorProps> = ({
  kind,
  label,
}) => {
  const config: Record<
    IndicatorKind,
    { icon: React.ReactNode; variant: BadgeVariant; text: string }
  > = {
    encrypted: {
      icon: <Lock className="w-3 h-3" />,
      variant: "default",
      text: "Encrypted",
    },
    verified: {
      icon: <ShieldCheck className="w-3 h-3" />,
      variant: "success",
      text: "Verified",
    },
    warning: {
      icon: <AlertTriangle className="w-3 h-3" />,
      variant: "warning",
      text: "Warning",
    },
    unverified: {
      icon: <ShieldAlert className="w-3 h-3" />,
      variant: "error",
      text: "Unverified",
    },
    "group-shield": {
      icon: <Shield className="w-3 h-3" />,
      variant: "default",
      text: "Group protected",
    },
  };

  const data = config[kind];

  return (
    <Badge variant={data.variant} size="sm" className="flex items-center gap-1">
      {data.icon}
      {label || data.text}
    </Badge>
  );
};
