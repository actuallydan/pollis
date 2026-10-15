import React from "react";
import { useTranslation } from "react-i18next";
import { LockKeyhole } from "lucide-react";
import { formatTimeOfDay, formatFullTimestamp, toMs } from "../../utils/format";
import type { Message } from "../../types";
import type { Skin } from "../../utils/colorUtils";

interface UndecryptableMessageProps {
  message: Message;
  skin: Skin;
}

/**
 * A message this device was entitled to read and could not decrypt (#1312).
 *
 * It stands where the message would have been, so a loss is visible instead
 * of silent. Nothing readable says who sent it, so there is no author, and
 * nothing can be done with it, so there are no actions.
 */
export const UndecryptableMessage: React.FC<UndecryptableMessageProps> = ({ message, skin }) => {
  const { t } = useTranslation("chat");
  const at = toMs(message.created_at);
  const detail = t("message.undecryptable.detail");

  if (skin === "refined") {
    return (
      <div
        data-testid={`message-${message.id}`}
        data-undecryptable="true"
        tabIndex={-1}
        className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2 items-start px-4 pt-msg-header pb-msg-row outline-none"
      >
        <div className="flex justify-center pt-0.5 select-none">
          <div className="flex items-center justify-center w-9 h-9 rounded-full border border-line bg-surface text-muted">
            <LockKeyhole size={16} aria-hidden="true" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-sm font-semibold text-dim">
              {t("message.undecryptable.title")}
            </span>
            <bdi
              data-testid="message-timestamp"
              dir="ltr"
              title={formatFullTimestamp(at)}
              className="font-machine text-2xs tabular-nums select-none flex-shrink-0 text-muted"
            >
              {formatTimeOfDay(at)}
            </bdi>
          </div>
          <div data-testid="message-content" className="text-sm leading-msg text-muted">
            {t("message.undecryptable.body")}
          </div>
          <div className="text-xs text-muted">{detail}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`message-${message.id}`}
      data-undecryptable="true"
      tabIndex={-1}
      title={detail}
      className="px-4 py-1 outline-none"
    >
      <div className="flex items-start gap-0 min-w-0">
        <bdi
          data-testid="message-timestamp"
          dir="ltr"
          title={formatFullTimestamp(at)}
          className="flex-shrink-0 text-xs font-mono tabular-nums select-none w-20 text-muted"
          style={{ lineHeight: "1.5rem" }}
        >
          {formatTimeOfDay(at)}
        </bdi>
        <span
          data-testid="message-content"
          className="font-mono text-sm break-words flex-1 min-w-0 text-muted"
        >
          <span className="text-fg">[{t("message.undecryptable.tag")}]</span>{" "}
          {t("message.undecryptable.body")}
        </span>
      </div>
    </div>
  );
};
