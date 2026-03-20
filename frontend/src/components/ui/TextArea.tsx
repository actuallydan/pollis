import React, { useState } from "react";

interface TextAreaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
  id?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  value,
  onChange,
  placeholder,
  description,
  error,
  disabled = false,
  rows = 3,
  className = "",
  id,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`relative w-full ${className}`}>
      <label
        htmlFor={inputId}
        className="block text-xs font-mono font-medium mb-1.5"
        style={{ color: "var(--c-text-dim)" }}
      >
        {label}
      </label>
      <textarea
        id={inputId}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        className="w-full px-3 py-2 font-mono text-sm resize-none transition-all"
        style={{
          background: "var(--c-surface)",
          color: "var(--c-text)",
          border: `1px solid ${error ? "#ff6b6b" : isFocused ? "var(--c-border-active)" : "var(--c-border)"}`,
          outline: "none",
          borderRadius: "4px",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : undefined,
        }}
      />
      {description && !error && (
        <p className="mt-1 text-xs font-mono" style={{ color: "var(--c-text-muted)" }}>
          {description}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs font-mono" style={{ color: "#ff6b6b" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
