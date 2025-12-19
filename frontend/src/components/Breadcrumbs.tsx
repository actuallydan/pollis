import React from "react";
import { ChevronRight, Home } from "lucide-react";

/**
 * Represents a single breadcrumb navigation item.
 * @interface BreadcrumbItem
 */
interface BreadcrumbItem {
  /** The text label to display for this breadcrumb item */
  label: string;
  /** Optional URL for navigation when the item is clicked */
  href?: string;
  /** Optional click handler function for custom navigation logic */
  onClick?: () => void;
}

/**
 * Props for the Breadcrumbs component.
 * @interface BreadcrumbsProps
 */
interface BreadcrumbsProps {
  /** Array of breadcrumb items to display in the navigation */
  items: BreadcrumbItem[];
  /** Whether to show a home breadcrumb item at the beginning */
  showHome?: boolean;
  /** URL for the home breadcrumb item when showHome is true */
  homeHref?: string;
  /** Click handler for the home breadcrumb item when showHome is true */
  homeOnClick?: () => void;
  /** Additional CSS classes to apply to the breadcrumbs container */
  className?: string;
  /** Custom separator element to display between breadcrumb items */
  separator?: React.ReactNode;
}

/**
 * A navigation breadcrumb component for displaying hierarchical page navigation.
 *
 * The Breadcrumbs component renders a horizontal navigation trail showing the user's
 * current location within a website hierarchy. It supports:
 * - Optional home breadcrumb with customizable link and click handler
 * - Custom separator elements between breadcrumb items
 * - Clickable breadcrumb items with href or onClick handlers
 * - Current page indication with proper ARIA attributes
 * - Responsive design with proper spacing and typography
 * - Accessibility features including ARIA labels and current page indication
 *
 * @component
 * @param {BreadcrumbsProps} props - The props for the Breadcrumbs component
 * @param {BreadcrumbItem[]} props.items - Array of breadcrumb items to display
 * @param {boolean} [props.showHome=true] - Whether to show a home breadcrumb item
 * @param {string} [props.homeHref] - URL for the home breadcrumb item
 * @param {() => void} [props.homeOnClick] - Click handler for the home breadcrumb item
 * @param {string} [props.className] - Additional CSS classes to apply to the container
 * @param {React.ReactNode} [props.separator] - Custom separator element between items
 *
 * @example
 * ```tsx
 * // Basic usage with default home breadcrumb
 * <Breadcrumbs
 *   items={[
 *     { label: 'Products', href: '/products' },
 *     { label: 'Electronics', href: '/products/electronics' },
 *     { label: 'Smartphones' }
 *   ]}
 * />
 *
 * // Custom home configuration
 * <Breadcrumbs
 *   items={[
 *     { label: 'Dashboard', href: '/dashboard' },
 *     { label: 'Settings' }
 *   ]}
 *   homeHref="/"
 *   homeOnClick={() => navigate('/')}
 * />
 *
 * // Custom separator and styling
 * <Breadcrumbs
 *   items={[
 *     { label: 'Section', href: '/section' },
 *     { label: 'Subsection' }
 *   ]}
 *   separator={<span className="mx-2">/</span>}
 *   className="my-4"
 * />
 *
 * // Without home breadcrumb
 * <Breadcrumbs
 *   items={[
 *     { label: 'Page 1', href: '/page1' },
 *     { label: 'Page 2' }
 *   ]}
 *   showHome={false}
 * />
 * ```
 *
 * @returns {JSX.Element} A navigation breadcrumb component with proper accessibility and styling
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  showHome = true,
  homeHref,
  homeOnClick,
  className = "",
  separator = <ChevronRight className="w-4 h-4 text-orange-300/50" />,
}) => {
  const allItems = showHome
    ? [{ label: "Home", href: homeHref, onClick: homeOnClick }, ...items]
    : items;

  return (
    <nav
      className={`flex items-center space-x-2 font-sans text-sm ${className}`}
      aria-label="Breadcrumb"
    >
      {allItems.map((item, index) => {
        const isLast = index === allItems.length - 1;
        const isHome = showHome && index === 0;

        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <span className="flex-shrink-0" aria-hidden="true">
                {separator}
              </span>
            )}

            {isLast ? (
              <span className="text-orange-300 font-medium" aria-current="page">
                {isHome && <Home className="inline w-4 h-4 mr-1" />}
                {item.label}
              </span>
            ) : (
              <a
                href={item.href}
                onClick={item.onClick}
                className="text-orange-300/80 hover:text-orange-300 hover:underline transition-colors duration-200 focus:outline-none focus:bg-orange-300 focus:text-black rounded px-1 py-0.5"
              >
                {isHome && <Home className="inline w-4 h-4 mr-1" />}
                {item.label}
              </a>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
