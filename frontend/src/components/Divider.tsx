import React from "react";

/**
 * Props for the Divider component.
 * @interface DividerProps
 */
interface DividerProps {
  /** Additional CSS classes to apply to the divider */
  className?: string;
  /** The orientation of the divider - horizontal or vertical */
  orientation?: "horizontal" | "vertical";
  /** The size variant of the divider - affects spacing around the divider */
  size?: "sm" | "base" | "lg";
}

/**
 * A flexible divider component for creating visual separations in layouts.
 *
 * The Divider component provides a simple way to create visual separations between
 * content sections. It supports both horizontal and vertical orientations with
 * different size variants that automatically adjust spacing based on orientation.
 * The component uses semantic HTML with proper accessibility attributes.
 *
 * @component
 * @param {DividerProps} props - The props for the Divider component
 * @param {string} [props.className] - Additional CSS classes to apply to the divider
 * @param {'horizontal' | 'vertical'} [props.orientation='horizontal'] - The orientation of the divider
 * @param {'sm' | 'base' | 'lg'} [props.size='base'] - The size variant affecting spacing
 *
 * @example
 * ```tsx
 * // Basic horizontal divider
 * <Divider />
 *
 * // Vertical divider with custom size
 * <div className="flex">
 *   <div>Left content</div>
 *   <Divider orientation="vertical" size="lg" />
 *   <div>Right content</div>
 * </div>
 *
 * // Small horizontal divider with custom styling
 * <Divider
 *   size="sm"
 *   className="border-t-2 border-orange-300/50"
 * />
 *
 * // Large horizontal divider
 * <Divider size="lg" />
 * ```
 *
 * @returns {JSX.Element} A divider element with the specified orientation and size
 */
export const Divider: React.FC<DividerProps> = ({
  className = "",
  orientation = "horizontal",
  size = "base",
}) => {
  const baseClasses = `
    bg-orange-300/30
  `;

  const orientationClasses = {
    horizontal: "w-full h-px my-4",
    vertical: "h-full w-px mx-4",
  };

  const sizeClasses = {
    sm: orientation === "horizontal" ? "my-2" : "mx-2",
    base: orientation === "horizontal" ? "my-4" : "mx-4",
    lg: orientation === "horizontal" ? "my-6" : "mx-6",
  };

  return (
    <div
      className={`${baseClasses} ${orientationClasses[orientation]} ${sizeClasses[size]} ${className}`}
      role="separator"
    />
  );
};
