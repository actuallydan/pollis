import React from "react";
import type { LucideIcon } from "lucide-react";
import { LoadingSpinner } from "./LoadingSpinner";

/**
 * Props for the Button component.
 * @interface ButtonProps
 */
interface ButtonProps {
  /** The content to be displayed inside the button */
  children: React.ReactNode;
  /** Function to call when the button is clicked */
  onClick?: () => void;
  /** Whether the button is disabled and cannot be interacted with */
  disabled?: boolean;
  /** Whether the button is in a loading state, showing a spinner and loading text */
  isLoading?: boolean;
  /** Text to display when the button is in loading state */
  loadingText?: string;
  /** Icon to display before the button text - can be a React element or Lucide icon component */
  icon?: React.ReactNode | LucideIcon;
  /** Additional CSS classes to apply to the button */
  className?: string;
  /** Visual variant of the button - affects colors and hover states */
  variant?: "primary" | "secondary";
  /** HTML button type attribute - 'button', 'submit', or 'reset' */
  type?: "button" | "submit" | "reset";
  /** Accessibility label for screen readers */
  "aria-label"?: string;
  /** Accessibility description reference for screen readers */
  "aria-describedby"?: string;
}

/**
 * A versatile button component with comprehensive styling, loading states, and accessibility features.
 *
 * The Button component provides a fully-featured button element with:
 * - Multiple visual variants (primary/secondary) with distinct hover and active states
 * - Loading states with spinner animation and customizable loading text
 * - Icon support for both React elements and Lucide icon components
 * - Comprehensive accessibility features including ARIA labels and descriptions
 * - Disabled states with proper visual feedback
 * - Focus management with visible focus rings
 * - Smooth transitions and hover effects
 *
 * @component
 * @param {ButtonProps} props - The props for the Button component
 * @param {React.ReactNode} props.children - The content to be displayed inside the button
 * @param {() => void} [props.onClick] - Function to call when the button is clicked
 * @param {boolean} [props.disabled=false] - Whether the button is disabled and cannot be interacted with
 * @param {boolean} [props.isLoading=false] - Whether the button is in a loading state
 * @param {string} [props.loadingText='Loading...'] - Text to display when the button is in loading state
 * @param {React.ReactNode | LucideIcon} [props.icon] - Icon to display before the button text
 * @param {string} [props.className] - Additional CSS classes to apply to the button
 * @param {'primary' | 'secondary'} [props.variant='primary'] - Visual variant affecting colors and hover states
 * @param {'button' | 'submit' | 'reset'} [props.type='button'] - HTML button type attribute
 * @param {string} [props.aria-label] - Accessibility label for screen readers
 * @param {string} [props.aria-describedby] - Accessibility description reference for screen readers
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Button onClick={() => console.log('clicked')}>
 *   Click me
 * </Button>
 *
 * // With icon and variant
 * <Button
 *   variant="secondary"
 *   icon={<Plus className="w-4 h-4" />}
 *   onClick={handleAdd}
 * >
 *   Add Item
 * </Button>
 *
 * // Loading state
 * <Button
 *   isLoading={true}
 *   loadingText="Saving..."
 *   onClick={handleSave}
 * >
 *   Save Changes
 * </Button>
 *
 * // Submit button with accessibility
 * <Button
 *   type="submit"
 *   aria-label="Submit form data"
 *   aria-describedby="submit-help"
 * >
 *   Submit
 * </Button>
 * ```
 *
 * @returns {JSX.Element} A fully-featured button element with the specified props and styling
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled = false,
  isLoading = false,
  icon,
  className = "",
  variant = "primary",
  type = "button",
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedby,
  loadingText = "Loading...",
}) => {
  const baseClasses = `
    inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md
    font-sans text-base font-medium transition-all duration-75
    border-2 border-orange-300/50
    cursor-pointer
    focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black
    disabled:opacity-50 disabled:cursor-not-allowed
    ${isLoading ? "cursor-not-allowed opacity-75" : ""}
  `;

  const variantClasses = {
    primary: `
      bg-black text-orange-300
      hover:bg-orange-300 hover:text-black
      active:bg-orange-300 active:text-black active:opacity-80 active:border-orange-200
      disabled:hover:bg-black disabled:hover:text-orange-300
    `,
    secondary: `
      bg-transparent text-orange-300 border-orange-300/30
      hover:bg-orange-300/10 hover:border-orange-300/80
      active:bg-orange-300/20 active:opacity-80 active:border-orange-200
      disabled:hover:bg-transparent disabled:hover:border-orange-300/30
    `,
  };

  return (
    <button
      type={type}
      onClick={isLoading ? undefined : onClick}
      disabled={disabled || isLoading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {isLoading ? (
        <LoadingSpinner size="sm" />
      ) : (
        icon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {React.isValidElement(icon)
              ? icon
              : React.createElement(icon as LucideIcon)}
          </span>
        )
      )}
      {isLoading ? loadingText : children}
    </button>
  );
};
