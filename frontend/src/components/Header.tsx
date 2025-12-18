import React from "react";

/**
 * Props for the Header component.
 * @interface HeaderProps
 */
interface HeaderProps {
  /** The content to be displayed as the header text */
  children: React.ReactNode;
  /** Additional CSS classes to apply to the header element */
  className?: string;
  /** The size variant of the header - affects font size */
  size?: "sm" | "base" | "lg" | "xl" | "2xl";
}

/**
 * A flexible header component with multiple size variants and consistent styling.
 *
 * The Header component provides a standardized way to display headings with:
 * - Multiple size variants from small to extra large
 * - Consistent typography and color scheme
 * - Customizable styling through className prop
 * - Semantic HTML structure using h1 element
 * - Responsive design with proper line height
 *
 * @component
 * @param {HeaderProps} props - The props for the Header component
 * @param {React.ReactNode} props.children - The content to be displayed as the header text
 * @param {string} [props.className] - Additional CSS classes to apply to the header element
 * @param {'sm' | 'base' | 'lg' | 'xl' | '2xl'} [props.size='base'] - The size variant affecting font size
 *
 * @example
 * ```tsx
 * // Basic usage with default size
 * <Header>Welcome to Our App</Header>
 *
 * // Small header for section titles
 * <Header size="sm">Section Title</Header>
 *
 * // Large header for main page titles
 * <Header size="lg">Main Page Title</Header>
 *
 * // Extra large header with custom styling
 * <Header
 *   size="xl"
 *   className="text-center mb-8"
 * >
 *   Hero Section Title
 * </Header>
 *
 * // Different size variants
 * <Header size="sm">Small Header</Header>
 * <Header size="base">Base Header</Header>
 * <Header size="lg">Large Header</Header>
 * <Header size="xl">Extra Large Header</Header>
 * <Header size="2xl">2XL Header</Header>
 * ```
 *
 * @returns {JSX.Element} A styled header element with the specified size and styling
 */
export const Header: React.FC<HeaderProps> = ({
  children,
  className = "",
  size = "base",
}) => {
  const sizeClasses = {
    sm: "text-lg",
    base: "text-xl",
    lg: "text-2xl",
    xl: "text-3xl",
    "2xl": "text-4xl",
  };

  const baseClasses = `
    font-sans font-bold text-orange-300 leading-tight
  `;

  return (
    <h1 className={`${baseClasses} ${sizeClasses[size]} ${className}`}>
      {children}
    </h1>
  );
};
