import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Icon } from "../icons";
import { fonts, semantic, type as ty } from "../../theme/tokens";

// Same columns as MessageRow, so the placeholder lines up with the messages
// around it.
const AVATAR = 40;
const AVATAR_GAP = 12;

/**
 * A message this device was entitled to read and could not decrypt (#1312).
 *
 * It stands where the message would have been, so a loss shows instead of
 * vanishing. Nothing readable says who sent it, so there is no avatar or
 * name; nothing can be done with it, so it takes no press, swipe or long
 * press. One accessible element, like every message row.
 */
export function UndecryptableRow({
  messageId,
  time,
}: {
  messageId: string;
  time: string;
}) {
  const { t } = useTranslation("chat");
  const title = t("message.undecryptable.title");
  const body = t("message.undecryptable.body");
  const detail = t("message.undecryptable.detail");
  return (
    <View
      testID={`row-message-${messageId}`}
      accessible
      accessibilityLabel={`${title}, ${time}. ${body} ${detail}`}
      style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 }}
    >
      <View style={{ flexDirection: "row", gap: AVATAR_GAP }}>
        <View
          style={{
            width: AVATAR,
            height: AVATAR,
            borderRadius: AVATAR / 2,
            borderWidth: 1,
            borderColor: semantic.edge,
            backgroundColor: semantic.raised,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon.lock size={16} color={semantic.muted} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View
            style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 8 }}
          >
            <Text style={[ty.body, { fontFamily: fonts.semibold, color: semantic.dim }]}>
              {title}
            </Text>
            <Text style={[ty.meta, { color: semantic.muted }]}>{time}</Text>
          </View>
          <Text testID={`text-undecryptable-${messageId}`} style={[ty.body, { color: semantic.muted }]}>
            {body}
          </Text>
          <Text style={[ty.meta, { color: semantic.muted }]}>{detail}</Text>
        </View>
      </View>
    </View>
  );
}
