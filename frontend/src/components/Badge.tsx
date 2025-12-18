import React from "react";

/**
 * Props for the Badge component.
 * @interface BadgeProps
 */
interface BadgeProps {
  /** The content to be displayed inside the badge */
  children: React.ReactNode;
  /** Visual variant of the badge - affects colors and styling */
  variant?: "default" | "success" | "warning" | "error";
  /** Size variant of the badge - affects padding and text size */
  size?: "sm" | "base";
  /** Additional CSS classes to apply to the badge */
  className?: string;
}

/**
 * A versatile badge component for displaying status indicators, labels, or tags.
 *
 * The Badge component renders a small, rounded element with customizable styling.
 * It supports different visual variants for different contexts (default, success, warning, error)
 * and size options for different use cases. The component uses semantic colors that
 * automatically adapt to the chosen variant.
 *
 * @component
 * @param {BadgeProps} props - The props for the Badge component
 * @param {React.ReactNode} props.children - The content to be displayed inside the badge
 * @param {'default' | 'success' | 'warning' | 'error'} [props.variant='default'] - Visual variant affecting colors and styling
 * @param {'sm' | 'base'} [props.size='base'] - Size variant affecting padding and text size
 * @param {string} [props.className] - Additional CSS classes to apply to the badge
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Badge>New</Badge>
 *
 * // With variant and size
 * <Badge variant="success" size="sm">Completed</Badge>
 *
 * // With custom styling
 * <Badge variant="warning" className="my-custom-class">
 *   Pending Review
 * </Badge>
 *
 * // Different variants
 * <Badge variant="default">Default</Badge>
 * <Badge variant="success">Success</Badge>
 * <Badge variant="warning">Warning</Badge>
 * <Badge variant="error">Error</Badge>
 * ```
 *
 * @returns {JSX.Element} A styled badge element with the specified variant and size
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "base",
  className = "",
}) => {
  const baseClasses = `
    inline-flex items-center font-sans font-medium rounded-full
    border-2
  `;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-sm",
    base: "px-3 py-1 text-base",
  };

  const variantClasses = {
    default: "text-orange-300 border-orange-300/30 bg-orange-300/5",
    success:
      "bg-green-900/20 text-green-300 border-green-300/30 bg-green-300/5",
    warning:
      "bg-yellow-900/20 text-yellow-300 border-yellow-300/30 bg-yellow-300/5",
    error: "bg-red-900/20 text-red-300 border-red-300/30 bg-red-300/5",
  };

  return (
    <span
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
