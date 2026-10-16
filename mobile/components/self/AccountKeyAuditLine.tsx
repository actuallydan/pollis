import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { semantic, type as ty } from "../../theme/tokens";
import { Icon } from "../icons";
import type { AuditStatus } from "../../hooks/queries/useAccount";

// Label and icon per verdict; the labels are desktop's (settings catalogue,
// frontend/src/components/Security/AccountKeyAuditLine.tsx), so both apps
// say the same thing. The icon and the words carry the state, never colour
// alone: `ok` is the only accent-toned line, and `alarm` adds the reason.
const STATUS: Record<AuditStatus, { icon: keyof typeof Icon; labelKey: string }> = {
  ok: { icon: "shieldCheck", labelKey: "security.accountKeyStatusOk" },
  pending: { icon: "clock", labelKey: "security.accountKeyStatusPending" },
  alarm: { icon: "warning", labelKey: "security.accountKeyStatusAlarm" },
  unavailable: { icon: "shieldQuestion", labelKey: "security.accountKeyStatusUnavailable" },
};

/**
 * The verdict of the account-key transparency check (#330): one advisory
 * line, spoken as one element. On `alarm` the report's reason follows, so
 * the user has something to act on.
 */
export function AccountKeyAuditLine({ status, detail }: { status: AuditStatus; detail: string }) {
  const { t } = useTranslation("settings");
  const { icon, labelKey } = STATUS[status];
  const Glyph = Icon[icon];
  const color = status === "ok" ? semantic.accent : semantic.dim;
  const label = t(labelKey);
  const reason = status === "alarm" && detail ? detail : null;
  return (
    <View
      testID="text-account-key-audit"
      accessible
      accessibilityLabel={reason ? `${label}. ${reason}` : label}
      style={{ gap: 4 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Glyph size={16} color={color} />
        <Text testID={`text-account-key-audit-${status}`} style={[ty.secondary, { color }]}>
          {label}
        </Text>
      </View>
      {reason ? <Text style={[ty.meta, { color: semantic.dim }]}>{reason}</Text> : null}
    </View>
  );
}
