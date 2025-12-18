import React from "react";

/**
 * Props for the Checkbox component.
 * @interface CheckboxProps
 */
interface CheckboxProps {
  /** The text label displayed next to the checkbox */
  label: string;
  /** Whether the checkbox is currently checked */
  checked: boolean;
  /** Function called when the checkbox state changes, receives the new checked state */
  onChange: (checked: boolean) => void;
  /** Whether the checkbox is disabled and cannot be interacted with */
  disabled?: boolean;
  /** Additional CSS classes to apply to the checkbox container */
  className?: string;
  /** Unique identifier for the checkbox input element */
  id?: string;
  /** Optional descriptive text displayed below the checkbox and label */
  description?: string;
}

/**
 * A fully-featured checkbox component with accessibility features and custom styling.
 *
 * The Checkbox component provides a customizable checkbox input with:
 * - Custom styled checkbox appearance with orange theme
 * - Accessible label association and description support
 * - Focus management with visible focus rings
 * - Disabled state handling with proper visual feedback
 * - Smooth transitions and hover effects
 * - Automatic ID generation for accessibility
 * - ARIA attributes for screen reader support
 * - Responsive design with proper spacing and typography
 *
 * @component
 * @param {CheckboxProps} props - The props for the Checkbox component
 * @param {string} props.label - The text label displayed next to the checkbox
 * @param {boolean} props.checked - Whether the checkbox is currently checked
 * @param {(checked: boolean) => void} props.onChange - Function called when checkbox state changes
 * @param {boolean} [props.disabled=false] - Whether the checkbox is disabled
 * @param {string} [props.className] - Additional CSS classes to apply to the container
 * @param {string} [props.id] - Unique identifier for the checkbox input
 * @param {string} [props.description] - Optional descriptive text displayed below the checkbox
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Checkbox
 *   label="Accept terms and conditions"
 *   checked={accepted}
 *   onChange={setAccepted}
 * />
 *
 * // With description and custom styling
 * <Checkbox
 *   label="Subscribe to newsletter"
 *   checked={subscribed}
 *   onChange={setSubscribed}
 *   description="Receive updates about new features and announcements"
 *   className="my-4"
 * />
 *
 * // Disabled state
 * <Checkbox
 *   label="Premium feature"
 *   checked={false}
 *   onChange={() => {}}
 *   disabled={true}
 *   description="Upgrade to access this feature"
 * />
 *
 * // With custom ID
 * <Checkbox
 *   id="custom-checkbox"
 *   label="Custom checkbox"
 *   checked={customChecked}
 *   onChange={setCustomChecked}
 * />
 * ```
 *
 * @returns {JSX.Element} A styled checkbox input with label and optional description
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  onChange,
  disabled = false,
  className = "",
  id,
  description,
}) => {
  const inputId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
  const descriptionId = description ? `${inputId}-description` : undefined;

  const baseClasses = `
    relative flex items-start
  `;

  const checkboxClasses = `
    w-5 h-5 rounded border-2 border-orange-300/50
    bg-black text-orange-300
    focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-all duration-200
    flex-shrink-0 mt-0.5
    appearance-none checked:bg-orange-300 checked:border-orange-300
    checked:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M13.854%203.646a.5.5%200%200%201%200%20.708l-7%207a.5.5%200%200%201-.708%200l-3.5-3.5a.5.5%200%201%201%20.708-.708L6.5%2010.293l6.646-6.647a.5.5%200%200%201%20.708%200z%22%20fill%3D%22%23000%22/%3E%3C/svg%3E')] checked:bg-center checked:bg-no-repeat
  `;

  const labelClasses = `
    ml-3 text-base font-sans text-orange-300 cursor-pointer
    ${disabled ? "cursor-not-allowed" : ""}
  `;

  const descriptionClasses = `
    mt-1 text-xs font-sans text-orange-300/80 ml-7
  `;

  return (
    <div className={`${baseClasses} ${className}`}>
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-describedby={descriptionId}
        className={checkboxClasses}
      />

      <label htmlFor={inputId} className={labelClasses}>
        {label}
      </label>

      {description && (
        <p id={descriptionId} className={descriptionClasses}>
          {description}
        </p>
      )}
    </div>
  );
};
