import React from "react";

/**
 * Props for the Radio component.
 * @interface RadioProps
 */
interface RadioProps {
  /** The text label displayed next to the radio button */
  label: string;
  /** Whether the radio button is currently selected */
  checked: boolean;
  /** Function called when the radio button state changes, receives the new checked state */
  onChange: (checked: boolean) => void;
  /** Whether the radio button is disabled and cannot be interacted with */
  disabled?: boolean;
  /** Additional CSS classes to apply to the radio button container */
  className?: string;
  /** Unique identifier for the radio button input element */
  id?: string;
  /** Optional descriptive text displayed below the radio button and label */
  description?: string;
}

/**
 * A fully-featured radio button component with accessibility features and custom styling.
 *
 * The Radio component provides a customizable radio button input with:
 * - Custom styled radio button appearance with orange theme
 * - Accessible label association and description support
 * - Focus management with visible focus rings
 * - Disabled state handling with proper visual feedback
 * - Smooth transitions and hover effects
 * - Automatic ID generation for accessibility
 * - ARIA attributes for screen reader support
 * - Responsive design with proper spacing and typography
 * - Custom radio button design using CSS and SVG background
 *
 * This component is designed to work within radio button groups where only one
 * option can be selected at a time. It provides excellent accessibility and
 * visual feedback for user interactions.
 *
 * @component
 * @param {RadioProps} props - The props for the Radio component
 * @param {string} props.label - The text label displayed next to the radio button
 * @param {boolean} props.checked - Whether the radio button is currently selected
 * @param {(checked: boolean) => void} props.onChange - Function called when radio button state changes
 * @param {boolean} [props.disabled=false] - Whether the radio button is disabled
 * @param {string} [props.className] - Additional CSS classes to apply to the container
 * @param {string} [props.id] - Unique identifier for the radio button input
 * @param {string} [props.description] - Optional descriptive text displayed below the radio button
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Radio
 *   label="Option 1"
 *   checked={selectedOption === 'option1'}
 *   onChange={() => setSelectedOption('option1')}
 * />
 *
 * // With description and custom styling
 * <Radio
 *   label="Premium Plan"
 *   checked={selectedPlan === 'premium'}
 *   onChange={() => setSelectedPlan('premium')}
 *   description="Includes all features and priority support"
 *   className="my-4"
 * />
 *
 * // Disabled state
 * <Radio
 *   label="Enterprise Plan"
 *   checked={false}
 *   onChange={() => {}}
 *   disabled={true}
 *   description="Contact sales for enterprise pricing"
 * />
 *
 * // Radio button group
 * <div>
 *   <h3>Select your preferred contact method:</h3>
 *   <Radio
 *     label="Email"
 *     checked={contactMethod === 'email'}
 *     onChange={() => setContactMethod('email')}
 *   />
 *   <Radio
 *     label="Phone"
 *     checked={contactMethod === 'phone'}
 *     onChange={() => setContactMethod('phone')}
 *   />
 *   <Radio
 *     label="SMS"
 *     checked={contactMethod === 'sms'}
 *     onChange={() => setContactMethod('sms')}
 *   />
 * </div>
 *
 * // With custom ID
 * <Radio
 *   id="custom-radio"
 *   label="Custom Radio"
 *   checked={customChecked}
 *   onChange={setCustomChecked}
 * />
 * ```
 *
 * @returns {JSX.Element} A styled radio button input with label and optional description
 */
export const Radio: React.FC<RadioProps> = ({
  label,
  checked,
  onChange,
  disabled = false,
  className = "",
  id,
  description,
}) => {
  const inputId = id || `radio-${Math.random().toString(36).substr(2, 9)}`;
  const descriptionId = description ? `${inputId}-description` : undefined;

  const baseClasses = `
    relative flex items-start
  `;

  const radioClasses = `
    w-4 h-4 rounded-full border-2 border-orange-300/50
    bg-black text-orange-300
    focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-all duration-200
    flex-shrink-0 mt-0.5
    appearance-none checked:bg-orange-300 checked:border-orange-300
    checked:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22none%22%3E%3Ccircle%20cx%3D%228%22%20cy%3D%228%22%20r%3D%223%22%20fill%3D%22%23000%22/%3E%3C/svg%3E')] checked:bg-center checked:bg-no-repeat
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
        type="radio"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-describedby={descriptionId}
        className={radioClasses}
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
