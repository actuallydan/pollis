import React from "react";
import { Header } from "./Header";

/**
 * Props for the Card component.
 * @interface CardProps
 */
interface CardProps {
  /** The content to be rendered inside the card */
  children: React.ReactNode;
  /** Additional CSS classes to apply to the card */
  className?: string;
  /** Optional title to display at the top of the card */
  title?: string;
  /** Visual variant of the card - affects border styling */
  variant?: "default" | "bordered";
}

/**
 * A versatile card component that provides a container with customizable styling and optional title.
 *
 * The Card component renders a bordered container with rounded corners and padding. It supports
 * different visual variants and can optionally display a title using the Header component.
 *
 * @component
 * @param {CardProps} props - The props for the Card component
 * @param {React.ReactNode} props.children - The content to be rendered inside the card
 * @param {string} [props.className] - Additional CSS classes to apply to the card
 * @param {string} [props.title] - Optional title to display at the top of the card
 * @param {'default' | 'bordered'} [props.variant='default'] - Visual variant affecting border styling
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Card>
 *   <p>This is the card content</p>
 * </Card>
 *
 * // With title and custom styling
 * <Card
 *   title="My Card"
 *   variant="bordered"
 *   className="my-custom-class"
 * >
 *   <p>Card with title and custom styling</p>
 * </Card>
 * ```
 *
 * @returns {JSX.Element} A styled card container with optional title and content
 */
export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  title,
  variant = "default",
}) => {
  const baseClasses = `
    bg-black rounded-md p-4
  `;

  const variantClasses = {
    default: "border-2 border-orange-300/20",
    bordered: "border-2 border-orange-300/50",
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {title && (
        <Header size="lg" className="mb-3">
          {title}
        </Header>
      )}
      {children}
    </div>
  );
};
