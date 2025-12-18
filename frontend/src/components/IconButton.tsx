import React from "react";
import type { LucideIcon } from "lucide-react";
import { LoadingSpinner } from "./LoadingSpinner";

/**
 * Props for the IconButton component.
 * @interface IconButtonProps
 */
interface IconButtonProps {
  /** The icon to display in the button - can be a React element or Lucide icon component */
  icon: React.ReactNode | LucideIcon;
  /** Function to call when the button is clicked */
  onClick?: () => void;
  /** Whether the button is disabled and cannot be interacted with */
  disabled?: boolean;
  /** Whether the button is in a loading state, showing a spinner instead of the icon */
  isLoading?: boolean;
  /** Additional CSS classes to apply to the button */
  className?: string;
  /** Visual variant of the button - affects colors and hover states */
  variant?: "primary" | "secondary";
  /** Size variant of the button - affects dimensions and icon size */
  size?: "sm" | "base" | "lg";
  /** Accessibility label for screen readers (required) */
  "aria-label": string;
  /** Accessibility description reference for screen readers */
  "aria-describedby"?: string;
}

/**
 * A versatile icon button component with loading states and accessibility features.
 *
 * The IconButton component provides a button element designed specifically for icon-based actions:
 * - Support for both React elements and Lucide icon components
 * - Loading states with spinner animation
 * - Multiple visual variants (primary/secondary) with distinct hover and active states
 * - Size variants affecting button dimensions and icon sizing
 * - Comprehensive accessibility features including required ARIA labels
 * - Disabled states with proper visual feedback
 * - Focus management with visible focus rings
 * - Smooth transitions and hover effects
 *
 * @component
 * @param {IconButtonProps} props - The props for the IconButton component
 * @param {React.ReactNode | LucideIcon} props.icon - The icon to display in the button
 * @param {() => void} [props.onClick] - Function to call when the button is clicked
 * @param {boolean} [props.disabled=false] - Whether the button is disabled
 * @param {boolean} [props.isLoading=false] - Whether the button is in a loading state
 * @param {string} [props.className] - Additional CSS classes to apply to the button
 * @param {'primary' | 'secondary'} [props.variant='primary'] - Visual variant affecting colors and hover states
 * @param {'sm' | 'base' | 'lg'} [props.size='base'] - Size variant affecting dimensions and icon size
 * @param {string} props.aria-label - Accessibility label for screen readers (required)
 * @param {string} [props.aria-describedby] - Accessibility description reference for screen readers
 *
 * @example
 * ```tsx
 * // Basic usage with Lucide icon
 * <IconButton
 *   icon={Plus}
 *   onClick={handleAdd}
 *   aria-label="Add new item"
 * />
 *
 * // With custom React element icon
 * <IconButton
 *   icon={<CustomIcon className="w-5 h-5" />}
 *   onClick={handleCustom}
 *   aria-label="Custom action"
 * />
 *
 * // Secondary variant with loading state
 * <IconButton
 *   icon={Save}
 *   variant="secondary"
 *   isLoading={true}
 *   aria-label="Saving changes"
 * />
 *
 * // Large button with custom styling
 * <IconButton
 *   icon={Trash2}
 *   size="lg"
 *   variant="secondary"
 *   className="text-red-400 border-red-400/50"
 *   aria-label="Delete item"
 * />
 *
 * // Different size variants
 * <IconButton icon={Edit} size="sm" aria-label="Edit small" />
 * <IconButton icon={Edit} size="base" aria-label="Edit base" />
 * <IconButton icon={Edit} size="lg" aria-label="Edit large" />
 * ```
 *
 * @returns {JSX.Element} A styled icon button with the specified props and functionality
 */
export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  disabled = false,
  isLoading = false,
  className = "",
  variant = "primary",
  size = "base",
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedby,
}) => {
  const baseClasses = `
    inline-flex items-center justify-center rounded-md
    font-sans font-medium transition-all duration-75
    border-2 border-orange-300/50
    cursor-pointer
    focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black
    disabled:opacity-50 disabled:cursor-not-allowed
    ${isLoading ? "cursor-not-allowed opacity-75" : ""}
  `;

  const sizeClasses = {
    sm: "w-8 h-8 text-base",
    base: "w-10 h-10 text-lg",
    lg: "w-12 h-12 text-xl",
  };

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
      onClick={isLoading ? undefined : onClick}
      disabled={disabled || isLoading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {isLoading ? (
        <LoadingSpinner size={size === "lg" ? "base" : "sm"} />
      ) : React.isValidElement(icon) ? (
        icon
      ) : (
        React.createElement(icon as LucideIcon)
      )}
    </button>
  );
};
