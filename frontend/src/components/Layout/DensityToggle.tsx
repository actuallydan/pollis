import React from "react";
import { usePreferences, useDensity } from "../../hooks/queries/usePreferences";
import { applyDensity, type Density } from "../../utils/colorUtils";

const OPTIONS: readonly { value: Density; label: string }[] = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

/**
 * Segmented Comfortable/Compact control for the refined status bar. Density is
 * a synced preference; flipping it applies immediately (CSS `data-density`) and
 * persists through the throttled preferences save. Self-contained so the shell
 * just renders `<DensityToggle />`.
 */
export const DensityToggle: React.FC = () => {
  const density = useDensity();
  const { query, save } = usePreferences();

  const choose = (value: Density) => {
    if (value === density) {
      return;
    }
    applyDensity(value);
    // Drop the legacy device-local font_size field so we don't rewrite it to
    // the remote blob (mirrors PreferencesPage's save path).
    const { font_size: _legacy, ...rest } = query.data ?? {};
    void _legacy;
    save({ ...rest, density: value });
  };

  return (
    <div
      role="radiogroup"
      aria-label="Layout density"
      className="flex items-center overflow-hidden rounded-[var(--radius-control)] border border-line"
    >
      {OPTIONS.map((opt) => {
        const selected = density === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={`density-${opt.value}`}
            onClick={() => choose(opt.value)}
            className={`px-2 py-0.5 text-2xs transition-colors cursor-pointer ${
              selected ? "bg-active text-accent" : "text-muted hover:text-fg"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
