import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronRight, ArrowUp, ArrowDown } from "lucide-react";

/**
 * Represents a single menu item in the terminal menu.
 * @interface TerminalMenuItem
 */
export interface TerminalMenuItem {
  /** Unique identifier for the menu item */
  id: string;
  /** Display text for the menu item */
  label: string;
  /** Optional descriptive text displayed below the label */
  description?: string;
  /** Optional function to execute when the item is selected */
  action?: () => void;
  /** Optional URL to navigate to when the item is selected */
  href?: string;
  /** Whether the menu item is disabled and cannot be selected */
  disabled?: boolean;
  /** Optional icon to display next to the menu item */
  icon?: React.ReactNode;
}

/**
 * Props for the TerminalMenu component.
 * @interface TerminalMenuProps
 */
export interface TerminalMenuProps {
  /** Array of menu items to display */
  items: TerminalMenuItem[];
  /** Optional callback function called when Escape key is pressed */
  onEsc?: () => void;
  /** Additional CSS classes to apply to the menu container */
  className?: string;
  /** Whether to automatically focus the menu when it mounts */
  autoFocus?: boolean;
  /** Maximum height of the menu container in pixels */
  maxHeight?: number;
}

/**
 * A terminal-style navigation menu with keyboard navigation and visual feedback.
 *
 * The TerminalMenu component provides a command-line inspired interface with:
 * - Full keyboard navigation (arrow keys, Enter, Escape, Home, End)
 * - Visual selection indicators with orange theme
 * - Smooth scrolling to keep selected items in view
 * - Support for both action functions and navigation links
 * - Disabled state handling for unavailable options
 * - Custom icons and descriptions for each menu item
 * - Auto-focus capability for immediate interaction
 * - Responsive design with customizable height constraints
 * - Accessibility features with proper ARIA attributes
 * - Hover and focus states with smooth transitions
 * - Professional terminal aesthetic with consistent styling
 * - Navigation instructions displayed at the top
 *
 * This component is ideal for command palettes, navigation menus, settings panels,
 * and any interface requiring keyboard-driven navigation with a terminal aesthetic.
 *
 * @component
 * @param {TerminalMenuProps} props - The props for the TerminalMenu component
 * @param {TerminalMenuItem[]} props.items - Array of menu items to display
 * @param {() => void} [props.onEsc] - Optional callback function called when Escape key is pressed
 * @param {string} [props.className] - Additional CSS classes to apply to the menu container
 * @param {boolean} [props.autoFocus=true] - Whether to automatically focus the menu when it mounts
 * @param {number} [props.maxHeight] - Maximum height of the menu container in pixels
 *
 * @example
 * ```tsx
 * // Basic menu with actions
 * const menuItems = [
 *   { id: 'new', label: 'New Project', action: () => createProject() },
 *   { id: 'open', label: 'Open Project', action: () => openProject() },
 *   { id: 'save', label: 'Save Project', action: () => saveProject() }
 * ];
 *
 * <TerminalMenu
 *   items={menuItems}
 *   onEsc={() => setMenuOpen(false)}
 * />
 *
 * // Menu with descriptions and icons
 * const settingsItems = [
 *   {
 *     id: 'theme',
 *     label: 'Theme',
 *     description: 'Change application appearance',
 *     icon: <Palette className="w-4 h-4" />,
 *     action: () => openThemeSettings()
 *   },
 *   {
 *     id: 'language',
 *     label: 'Language',
 *     description: 'Select your preferred language',
 *     icon: <Globe className="w-4 h-4" />,
 *     action: () => openLanguageSettings()
 *   }
 * ];
 *
 * <TerminalMenu
 *   items={settingsItems}
 *   maxHeight={400}
 *   className="my-4"
 * />
 *
 * // Navigation menu with links
 * const navItems = [
 *   { id: 'home', label: 'Home', href: '/', icon: <Home className="w-4 h-4" /> },
 *   { id: 'docs', label: 'Documentation', href: '/docs', icon: <Book className="w-4 h-4" /> },
 *   { id: 'about', label: 'About', href: '/about', icon: <Info className="w-4 h-4" /> }
 * ];
 *
 * <TerminalMenu
 *   items={navItems}
 *   autoFocus={false}
 * />
 *
 * // Menu with disabled items
 * const featureItems = [
 *   { id: 'basic', label: 'Basic Features', action: () => enableBasic() },
 *   { id: 'pro', label: 'Pro Features', action: () => enablePro(), disabled: !hasProLicense },
 *   { id: 'enterprise', label: 'Enterprise Features', action: () => enableEnterprise(), disabled: !hasEnterpriseLicense }
 * ];
 *
 * <TerminalMenu
 *   items={featureItems}
 *   onEsc={() => setFeatureMenuOpen(false)}
 *   maxHeight={300}
 * />
 *
 * // Command palette style
 * const commands = [
 *   { id: 'search', label: 'Search Files', description: 'Quick file search', action: () => openSearch() },
 *   { id: 'terminal', label: 'Open Terminal', description: 'Launch integrated terminal', action: () => openTerminal() },
 *   { id: 'git', label: 'Git Operations', description: 'Manage version control', action: () => openGitPanel() }
 * ];
 *
 * <TerminalMenu
 *   items={commands}
 *   onEsc={() => setCommandPaletteOpen(false)}
 *   autoFocus={true}
 *   className="fixed top-4 left-1/2 transform -translate-x-1/2 w-96 z-50"
 * />
 * ```
 *
 * @returns {JSX.Element} A terminal-style navigation menu with keyboard navigation and visual feedback
 */
export const TerminalMenu: React.FC<TerminalMenuProps> = ({
  items,
  onEsc,
  className = "",
  autoFocus = true,
  maxHeight,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Initialize refs array
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items.length]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus) {
      containerRef.current?.focus();
    }
  }, [autoFocus]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          const selectedItem = items[selectedIndex];
          if (selectedItem && !selectedItem.disabled) {
            if (selectedItem.action) {
              selectedItem.action();
            } else if (selectedItem.href) {
              window.location.href = selectedItem.href;
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          onEsc?.();
          break;
        case "Home":
          e.preventDefault();
          setSelectedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setSelectedIndex(items.length - 1);
          break;
      }
    },
    [items, selectedIndex, onEsc]
  );

  // Scroll selected item into view
  useEffect(() => {
    const selectedRef = itemRefs.current[selectedIndex];
    if (selectedRef && containerRef.current) {
      selectedRef.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  // Handle item click
  const handleItemClick = useCallback(
    (item: TerminalMenuItem, index: number) => {
      setSelectedIndex(index);
      if (item.action) {
        item.action();
      } else if (item.href) {
        window.location.href = item.href;
      }
    },
    []
  );

  // Handle item hover
  const handleItemHover = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const baseClasses = `
    outline-none
    ${className}
  `;

  const containerClasses = `
    border-2 border-orange-300/50 rounded-md bg-black
    ${isFocused ? "border-orange-300" : ""}
    transition-colors duration-200
  `;

  const getItemClasses = (index: number, item: TerminalMenuItem) => {
    const baseClasses = `
      flex items-center gap-3 px-4 py-3 cursor-pointer
      transition-all duration-150 border-l-4
      hover:bg-orange-300/10
      ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}
    `;

    const stateClasses = `
      ${
        index === selectedIndex
          ? "border-l-orange-300 bg-orange-300/10"
          : "border-l-transparent"
      }
    `;

    return `${baseClasses} ${stateClasses}`;
  };

  return (
    <div
      ref={containerRef}
      className={baseClasses}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      role="menu"
      aria-label="Terminal navigation menu"
    >
      <div className={containerClasses}>
        <div
          className="p-2 border-b border-orange-300/30 bg-orange-300/5"
          style={{ maxHeight }}
        >
          <div className="flex items-center gap-2 text-orange-300/80 text-sm">
            <ArrowUp className="w-4 h-4" />
            <ArrowDown className="w-4 h-4" />
            <span>Navigate with arrow keys</span>
            <span className="mx-2">•</span>
            <span>Enter to select</span>
            {onEsc && (
              <>
                <span className="mx-2">•</span>
                <span>Esc to go back</span>
              </>
            )}
          </div>
        </div>

        <div
          className="overflow-y-auto"
          style={{ maxHeight: maxHeight ? maxHeight - 60 : undefined }}
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              className={getItemClasses(index, item)}
              onClick={() => !item.disabled && handleItemClick(item, index)}
              onMouseEnter={() => !item.disabled && handleItemHover(index)}
              role="menuitem"
              tabIndex={-1}
              aria-label={item.description || item.label}
              aria-disabled={item.disabled}
            >
              {/* Selection indicator */}
              <div className="flex-shrink-0">
                {index === selectedIndex ? (
                  <ChevronRight className="w-4 h-4 text-orange-300" />
                ) : (
                  <div className="w-4 h-4" />
                )}
              </div>

              {/* Icon */}
              {item.icon && (
                <div className="flex-shrink-0 text-orange-300/80">
                  {item.icon}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="font-sans font-medium text-orange-300">
                  {item.label}
                </div>
                {item.description && (
                  <div className="text-sm text-orange-300/60 mt-1">
                    {item.description}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
