import React from "react";
import {
  Lock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Shield,
} from "lucide-react";

type IndicatorKind =
  | "encrypted"
  | "verified"
  | "warning"
  | "unverified"
  | "group-shield";

interface SecurityIndicatorProps {
  kind: IndicatorKind;
  label?: string;
}

const kindConfig: Record<IndicatorKind, { icon: React.ReactNode; text: string }> = {
  encrypted: { icon: <Lock aria-hidden="true" />, text: "Encrypted" },
  verified: { icon: <ShieldCheck aria-hidden="true" />, text: "Verified" },
  warning: { icon: <AlertTriangle aria-hidden="true" />, text: "Warning" },
  unverified: { icon: <ShieldAlert aria-hidden="true" />, text: "Unverified" },
  "group-shield": { icon: <Shield aria-hidden="true" />, text: "Group protected" },
};

export const SecurityIndicator: React.FC<SecurityIndicatorProps> = ({
  kind,
  label,
}) => {
  const data = kindConfig[kind];

  return (
    <span data-testid="security-indicator">
      {data.icon}
      {label || data.text}
    </span>
  );
};
