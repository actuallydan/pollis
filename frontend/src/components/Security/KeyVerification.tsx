import React, { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ShieldAlert, ShieldCheck, X } from "lucide-react";

interface KeyVerificationProps {
  contactName: string;
  contactId?: string;
  localFingerprint: string;
  remoteFingerprint: string;
  keyChanged?: boolean;
  onVerified?: (contactId?: string) => void;
  onCancel?: () => void;
}

const formatSafetyNumber = (fingerprint: string): string[] => {
  return (
    fingerprint
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .match(/.{1,5}/g) || []
  );
};

export const KeyVerification: React.FC<KeyVerificationProps> = ({
  contactName,
  contactId,
  localFingerprint,
  remoteFingerprint,
  keyChanged = false,
  onVerified,
  onCancel,
}) => {
  const [manualEntry, setManualEntry] = useState("");
  const [copied, setCopied] = useState(false);

  const remoteGroups = useMemo(
    () => formatSafetyNumber(remoteFingerprint),
    [remoteFingerprint]
  );
  const localGroups = useMemo(
    () => formatSafetyNumber(localFingerprint),
    [localFingerprint]
  );

  const matches =
    formatSafetyNumber(manualEntry).join("") ===
    formatSafetyNumber(remoteFingerprint).join("");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(remoteFingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy fingerprint", error);
    }
  };

  return (
    <div data-testid="key-verification">
      <div>
        <div>
          <h1>Verify {contactName}</h1>
          <p>Compare safety numbers or scan QR to verify the contact's identity.</p>
        </div>
        {keyChanged && (
          <span>
            <ShieldAlert aria-hidden="true" />
            Key changed
          </span>
        )}
      </div>

      <div>
        <div>
          <h3>
            Your safety number
            <span>You</span>
          </h3>
          <div>
            {localGroups.map((g, idx) => (
              <span key={`local-${idx}`}>{g}</span>
            ))}
          </div>
        </div>

        <div>
          <h3>
            {contactName}'s safety number
            {keyChanged ? (
              <span>Needs verification</span>
            ) : (
              <span>Current</span>
            )}
          </h3>
          <div>
            {remoteGroups.map((g, idx) => (
              <span key={`remote-${idx}`}>{g}</span>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div>
          <QRCodeSVG
            value={`pollis-verification:${remoteFingerprint}`}
            size={160}
            bgColor="#000000"
            fgColor="#fdba74"
            includeMargin
          />
          <p>Scan to verify out-of-band</p>
          <button
            data-testid="copy-safety-number-button"
            onClick={handleCopy}
            aria-label="Copy safety number"
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Copied" : "Copy safety number"}
          </button>
        </div>

        <div>
          <h3>Manual comparison</h3>
          <label htmlFor="manual-entry">Enter the safety number you see on their device</label>
          <input
            id="manual-entry"
            data-testid="manual-safety-number-input"
            type="text"
            value={manualEntry}
            onChange={(e) => setManualEntry(e.target.value)}
            placeholder="ABCDE FGHIJ ..."
          />
          <div>
            {matches ? (
              <span data-testid="safety-number-match">
                <ShieldCheck aria-hidden="true" />
                Matches
              </span>
            ) : (
              <span data-testid="safety-number-no-match">
                <X aria-hidden="true" />
                Not verified
              </span>
            )}
          </div>
          <div>
            <button
              data-testid="mark-verified-button"
              onClick={() => onVerified?.(contactId)}
              disabled={!matches}
            >
              <ShieldCheck aria-hidden="true" />
              Mark as verified
            </button>
            <button
              data-testid="cancel-verification-button"
              onClick={onCancel}
            >
              <X aria-hidden="true" />
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
