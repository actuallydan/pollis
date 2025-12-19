import React from "react";

/**
 * Props for the Paragraph component.
 * @interface ParagraphProps
 */
interface ParagraphProps {
  /** The content to be displayed as paragraph text */
  children: React.ReactNode;
  /** Additional CSS classes to apply to the paragraph element */
  className?: string;
  /** The size variant of the paragraph - affects font size */
  size?: "sm" | "base" | "lg";
}

/**
 * A flexible paragraph component with multiple size variants and consistent styling.
 *
 * The Paragraph component provides a standardized way to display text content with:
 * - Multiple size variants from small to large
 * - Consistent typography and color scheme
 * - Customizable styling through className prop
 * - Semantic HTML structure using p element
 * - Responsive design with proper line height
 * - Consistent spacing and readability
 *
 * This component is ideal for body text, descriptions, captions, and any
 * text content that needs consistent styling across the application.
 *
 * @component
 * @param {ParagraphProps} props - The props for the Paragraph component
 * @param {React.ReactNode} props.children - The content to be displayed as paragraph text
 * @param {string} [props.className] - Additional CSS classes to apply to the paragraph element
 * @param {'sm' | 'base' | 'lg'} [props.size='base'] - The size variant affecting font size
 *
 * @example
 * ```tsx
 * // Basic usage with default size
 * <Paragraph>
 *   This is a standard paragraph with default styling and size.
 * </Paragraph>
 *
 * // Small paragraph for captions or fine print
 * <Paragraph size="sm">
 *   This is a small paragraph, perfect for captions or secondary information.
 * </Paragraph>
 *
 * // Large paragraph for emphasis
 * <Paragraph size="lg">
 *   This is a large paragraph that draws attention and provides emphasis.
 * </Paragraph>
 *
 * // With custom styling
 * <Paragraph
 *   size="lg"
 *   className="text-center italic mb-6"
 * >
 *   This is a centered, italic paragraph with custom margins.
 * </Paragraph>
 *
 * // Different size variants
 * <Paragraph size="sm">Small text for details</Paragraph>
 * <Paragraph size="base">Standard body text</Paragraph>
 * <Paragraph size="lg">Large text for emphasis</Paragraph>
 *
 * // In a card or container
 * <Card>
 *   <Header>Card Title</Header>
 *   <Paragraph>
 *     This is the main content of the card, providing context and information
 *     about the card's purpose and contents.
 *   </Paragraph>
 * </Card>
 * ```
 *
 * @returns {JSX.Element} A styled paragraph element with the specified size and styling
 */
export const Paragraph: React.FC<ParagraphProps> = ({
  children,
  className = "",
  size = "base",
}) => {
  const sizeClasses = {
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
  };

  const baseClasses = `
    font-sans text-orange-300 leading-relaxed
  `;

  return (
    <p className={`${baseClasses} ${sizeClasses[size]} ${className}`}>
      {children}
    </p>
  );
};
