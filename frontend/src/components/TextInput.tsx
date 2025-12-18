import React, { useState } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Props for the TextInput component.
 * @interface TextInputProps
 */
interface TextInputProps {
  /** The label text displayed above the input field */
  label: string;
  /** The current value of the input field */
  value: string;
  /** Function called when the input value changes */
  onChange: (value: string) => void;
  /** Placeholder text displayed when the input is empty */
  placeholder?: string;
  /** Optional descriptive text displayed below the input */
  description?: string;
  /** Error message to display below the input */
  error?: string;
  /** Whether the input is disabled and cannot be interacted with */
  disabled?: boolean;
  /** The type of input field (text, password, email, number) */
  type?: "text" | "password" | "email" | "number";
  /** Additional CSS classes to apply to the input container */
  className?: string;
  /** Unique identifier for the input element */
  id?: string;
  /** Whether the input field is required (shows required indicator) */
  required?: boolean;
  /** Custom aria-describedby attribute for additional accessibility */
  "aria-describedby"?: string;
}

/**
 * A sophisticated text input component with enhanced visual feedback and accessibility features.
 *
 * The TextInput component provides a professional input interface with:
 * - Visual focus indicator with animated chevron icon
 * - Comprehensive error handling and validation display
 * - Accessible label association and description support
 * - Required field indication with visual indicator
 * - Disabled state handling with proper visual feedback
 * - Multiple input types (text, password, email, number)
 * - Customizable styling with orange theme
 * - Smooth transitions and hover effects
 * - Automatic ID generation for accessibility
 * - ARIA attributes for screen reader support
 * - Responsive design with proper spacing and typography
 * - Professional appearance with consistent borders and focus states
 * - Placeholder text support for user guidance
 * - Custom aria-describedby support for complex accessibility needs
 *
 * This component is ideal for forms, search interfaces, user authentication,
 * and any interface requiring single-line text input with enhanced UX.
 *
 * @component
 * @param {TextInputProps} props - The props for the TextInput component
 * @param {string} props.label - The label text displayed above the input field
 * @param {string} props.value - The current value of the input field
 * @param {(value: string) => void} props.onChange - Function called when the input value changes
 * @param {string} [props.placeholder] - Placeholder text displayed when the input is empty
 * @param {string} [props.description] - Optional descriptive text displayed below the input
 * @param {string} [props.error] - Error message to display below the input
 * @param {boolean} [props.disabled=false] - Whether the input is disabled
 * @param {'text' | 'password' | 'email' | 'number'} [props.type='text'] - The type of input field
 * @param {string} [props.className] - Additional CSS classes to apply to the container
 * @param {string} [props.id] - Unique identifier for the input element
 * @param {boolean} [props.required=false] - Whether the input field is required
 * @param {string} [props.aria-describedby] - Custom aria-describedby attribute for accessibility
 *
 * @example
 * ```tsx
 * // Basic text input
 * <TextInput
 *   label="Username"
 *   value={username}
 *   onChange={setUsername}
 *   placeholder="Enter your username"
 * />
 *
 * // Email input with validation
 * <TextInput
 *   label="Email Address"
 *   value={email}
 *   onChange={setEmail}
 *   type="email"
 *   required={true}
 *   placeholder="your.email@example.com"
 *   error={emailError}
 *   description="We'll never share your email with anyone else"
 * />
 *
 * // Password input
 * <TextInput
 *   label="Password"
 *   value={password}
 *   onChange={setPassword}
 *   type="password"
 *   required={true}
 *   placeholder="Enter your password"
 *   description="Must be at least 8 characters long"
 * />
 *
 * // Number input
 * <TextInput
 *   label="Age"
 *   value={age}
 *   onChange={setAge}
 *   type="number"
 *   placeholder="Enter your age"
 *   description="Must be 18 or older"
 * />
 *
 * // Disabled state
 * <TextInput
 *   label="Account ID"
 *   value={accountId}
 *   onChange={setAccountId}
 *   disabled={true}
 *   description="Account ID cannot be changed"
 * />
 *
 * // Search input
 * <TextInput
 *   label="Search"
 *   value={searchQuery}
 *   onChange={setSearchQuery}
 *   placeholder="Search for anything..."
 *   className="max-w-md"
 * />
 *
 * // Form with multiple inputs
 * <div className="space-y-4">
 *   <TextInput
 *     label="First Name"
 *     value={firstName}
 *     onChange={setFirstName}
 *     required={true}
 *     placeholder="Enter your first name"
 *   />
 *   <TextInput
 *     label="Last Name"
 *     value={lastName}
 *     onChange={setLastName}
 *     required={true}
 *     placeholder="Enter your last name"
 *   />
 *   <TextInput
 *     label="Phone Number"
 *     value={phone}
 *     onChange={setPhone}
 *     type="text"
 *     placeholder="(555) 123-4567"
 *     description="Optional contact number"
 *   />
 * </div>
 *
 * // With custom accessibility
 * <TextInput
 *   label="Special Field"
 *   value={specialValue}
 *   onChange={setSpecialValue}
 *   aria-describedby="custom-help-text"
 *   description="This field has custom accessibility"
 * />
 * ```
 *
 * @returns {JSX.Element} A sophisticated text input component with enhanced visual feedback and accessibility features
 */
export const TextInput: React.FC<TextInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  description,
  error,
  disabled = false,
  type = "text",
  className = "",
  id,
  required = false,
  "aria-describedby": ariaDescribedby,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const baseClasses = `
    relative w-full
  `;

  const inputClasses = `
    w-full px-4 py-2 rounded-md
    font-sans text-base
    bg-black text-orange-300
    border-2 border-orange-300/50
    placeholder-orange-300/50
    focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-all duration-200
  `;

  const labelClasses = `
    block text-sm font-sans font-medium text-orange-300 mb-2
  `;

  const descriptionClasses = `
    mt-1 text-xs font-sans text-orange-300/80
  `;

  const errorClasses = `
    mt-1 text-xs font-sans text-red-400
  `;

  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [ariaDescribedby, descriptionId, errorId]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`${baseClasses} ${className}`}>
      <label htmlFor={inputId} className={labelClasses}>
        {label}
        {required && (
          <span className="text-red-400 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      <div className="relative">
        {isFocused && !disabled && (
          <ChevronRight className="absolute left-2 top-1/2 transform -translate-y-1/2 text-orange-300 w-4 h-4" />
        )}

        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-describedby={describedBy || undefined}
          aria-invalid={!!error}
          className={`${inputClasses} ${isFocused && !disabled ? "pl-6" : ""}`}
        />
      </div>

      {description && !error && (
        <p id={descriptionId} className={descriptionClasses}>
          {description}
        </p>
      )}

      {error && (
        <p id={errorId} className={errorClasses} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
