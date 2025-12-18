import React, { useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
} from "lucide-react";
import { Checkbox } from "./Checkbox";
import { Button } from "./Button";

/**
 * Represents a single item in the transfer list.
 * @interface TransferItem
 */
interface TransferItem {
  /** Unique identifier for the transfer item */
  id: string;
  /** Display text for the transfer item */
  label: string;
  /** Whether the item is disabled and cannot be selected or transferred */
  disabled?: boolean;
}

/**
 * Props for the TransferList component.
 * @interface TransferListProps
 */
interface TransferListProps {
  /** Title displayed above the left (available) items list */
  leftTitle?: string;
  /** Title displayed above the right (selected) items list */
  rightTitle?: string;
  /** Array of items available for selection on the left side */
  leftItems: TransferItem[];
  /** Array of items currently selected on the right side */
  rightItems: TransferItem[];
  /** Callback function called when items are transferred between lists */
  onTransfer: (fromLeft: boolean, itemIds: string[]) => void;
  /** Additional CSS classes to apply to the transfer list container */
  className?: string;
  /** Maximum height of each list container in pixels */
  maxHeight?: number;
  /** Whether to enable search functionality within each list */
  searchable?: boolean;
  /** Whether to show select all/deselect all buttons */
  selectAll?: boolean;
}

/**
 * A comprehensive dual-list transfer component for managing item selection and movement.
 *
 * The TransferList component provides an intuitive interface for transferring items between two lists:
 * - Dual-panel layout with available and selected items
 * - Individual item selection with checkboxes
 * - Bulk transfer operations (selected items or all items)
 * - Search functionality within each list for easy item discovery
 * - Select all/deselect all functionality for bulk operations
 * - Visual feedback for selected states and hover interactions
 * - Disabled item support for unavailable options
 * - Customizable titles and styling for each list
 * - Responsive design with height constraints and scrolling
 * - Professional appearance with consistent orange theme
 * - Accessibility features with proper ARIA labels
 * - Smooth transitions and hover effects
 * - Clear visual indicators for transfer directions
 * - Automatic search clearing after successful transfers
 *
 * This component is ideal for user management, permission systems, role assignments,
 * feature toggles, and any interface requiring item selection and transfer between groups.
 *
 * @component
 * @param {TransferListProps} props - The props for the TransferList component
 * @param {string} [props.leftTitle='Available Items'] - Title displayed above the left items list
 * @param {string} [props.rightTitle='Selected Items'] - Title displayed above the right items list
 * @param {TransferItem[]} props.leftItems - Array of items available for selection on the left side
 * @param {TransferItem[]} props.rightItems - Array of items currently selected on the right side
 * @param {(fromLeft: boolean, itemIds: string[]) => void} props.onTransfer - Callback function called when items are transferred
 * @param {string} [props.className] - Additional CSS classes to apply to the container
 * @param {number} [props.maxHeight=300] - Maximum height of each list container in pixels
 * @param {boolean} [props.searchable=true] - Whether to enable search functionality within each list
 * @param {boolean} [props.selectAll=true] - Whether to show select all/deselect all buttons
 *
 * @example
 * ```tsx
 * // Basic transfer list for user roles
 * const availableRoles = [
 *   { id: 'admin', label: 'Administrator' },
 *   { id: 'moderator', label: 'Moderator' },
 *   { id: 'user', label: 'Regular User' }
 * ];
 *
 * const selectedRoles = [
 *   { id: 'guest', label: 'Guest User' }
 * ];
 *
 * <TransferList
 *   leftTitle="Available Roles"
 *   rightTitle="Assigned Roles"
 *   leftItems={availableRoles}
 *   rightItems={selectedRoles}
 *   onTransfer={(fromLeft, itemIds) => {
 *     // Handle role assignment/removal
 *     if (fromLeft) {
 *       assignRolesToUser(userId, itemIds);
 *     } else {
 *       removeRolesFromUser(userId, itemIds);
 *     }
 *   }}
 * />
 *
 * // Transfer list with custom styling and search disabled
 * <TransferList
 *   leftTitle="Available Features"
 *   rightTitle="Enabled Features"
 *   leftItems={availableFeatures}
 *   rightItems={enabledFeatures}
 *   onTransfer={handleFeatureToggle}
 *   searchable={false}
 *   maxHeight={400}
 *   className="my-8 p-4 border border-orange-300/30 rounded-lg"
 * />
 *
 * // User management transfer list
 * const availableUsers = [
 *   { id: 'user1', label: 'John Doe', disabled: false },
 *   { id: 'user2', label: 'Jane Smith', disabled: false },
 *   { id: 'user3', label: 'Bob Johnson', disabled: true }
 * ];
 *
 * const selectedUsers = [
 *   { id: 'user4', label: 'Alice Brown' }
 * ];
 *
 * <TransferList
 *   leftTitle="Available Users"
 *   rightTitle="Team Members"
 *   leftItems={availableUsers}
 *   rightItems={selectedUsers}
 *   onTransfer={handleTeamMembershipChange}
 *   selectAll={true}
 *   maxHeight={500}
 * />
 *
 * // Permission system transfer list
 * const availablePermissions = [
 *   { id: 'read', label: 'Read Access' },
 *   { id: 'write', label: 'Write Access' },
 *   { id: 'delete', label: 'Delete Access' },
 *   { id: 'admin', label: 'Administrative Access' }
 * ];
 *
 * const selectedPermissions = [
 *   { id: 'read', label: 'Read Access' }
 * ];
 *
 * <TransferList
 *   leftTitle="Available Permissions"
 *   rightTitle="Granted Permissions"
 *   leftItems={availablePermissions}
 *   rightItems={selectedPermissions}
 *   onTransfer={handlePermissionChange}
 *   leftTitle="Available Permissions"
 *   rightTitle="Granted Permissions"
 * />
 *
 * // Feature flag management
 * const availableFeatures = [
 *   { id: 'dark-mode', label: 'Dark Mode' },
 *   { id: 'notifications', label: 'Push Notifications' },
 *   { id: 'analytics', label: 'Analytics Dashboard' },
 *   { id: 'api-access', label: 'API Access' }
 * ];
 *
 * const enabledFeatures = [
 *   { id: 'dark-mode', label: 'Dark Mode' }
 * ];
 *
 * <TransferList
 *   leftTitle="Available Features"
 *   rightTitle="Enabled Features"
 *   leftItems={availableFeatures}
 *   rightItems={enabledFeatures}
 *   onTransfer={handleFeatureToggle}
 *   className="bg-gradient-to-r from-orange-900/20 to-orange-800/20 p-6 rounded-lg"
 * />
 *
 * // With custom transfer logic
 * const handleCustomTransfer = (fromLeft: boolean, itemIds: string[]) => {
 *   if (fromLeft) {
 *     // Items moving from left to right
 *     console.log('Adding items:', itemIds);
 *     // Custom logic for adding items
 *   } else {
 *     // Items moving from right to left
 *     console.log('Removing items:', itemIds);
 *     // Custom logic for removing items
 *   }
 * };
 *
 * <TransferList
 *   leftItems={leftItems}
 *   rightItems={rightItems}
 *   onTransfer={handleCustomTransfer}
 *   leftTitle="Source Items"
 *   rightTitle="Target Items"
 * />
 * ```
 *
 * @returns {JSX.Element} A comprehensive dual-list transfer component for managing item selection and movement
 */
export const TransferList: React.FC<TransferListProps> = ({
  leftTitle = "Available Items",
  rightTitle = "Selected Items",
  leftItems,
  rightItems,
  onTransfer,
  className = "",
  maxHeight = 300,
  searchable = true,
  selectAll = true,
}) => {
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [leftSelected, setLeftSelected] = useState<Set<string>>(new Set());
  const [rightSelected, setRightSelected] = useState<Set<string>>(new Set());

  const filteredLeftItems = leftSearch
    ? leftItems.filter((item) =>
        item.label.toLowerCase().includes(leftSearch.toLowerCase())
      )
    : leftItems;

  const filteredRightItems = rightSearch
    ? rightItems.filter((item) =>
        item.label.toLowerCase().includes(rightSearch.toLowerCase())
      )
    : rightItems;

  const handleLeftSelect = (itemId: string) => {
    const newSelected = new Set(leftSelected);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setLeftSelected(newSelected);
  };

  const handleRightSelect = (itemId: string) => {
    const newSelected = new Set(rightSelected);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setRightSelected(newSelected);
  };

  const handleSelectAllLeft = () => {
    const allIds = filteredLeftItems.map((item) => item.id);
    setLeftSelected(new Set(allIds));
  };

  const handleSelectAllRight = () => {
    const allIds = filteredRightItems.map((item) => item.id);
    setRightSelected(new Set(allIds));
  };

  const handleDeselectAllLeft = () => {
    setLeftSelected(new Set());
  };

  const handleDeselectAllRight = () => {
    setRightSelected(new Set());
  };

  const handleTransferRight = () => {
    if (leftSelected.size > 0) {
      onTransfer(true, Array.from(leftSelected));
      setLeftSelected(new Set());
      setLeftSearch("");
    }
  };

  const handleTransferLeft = () => {
    if (rightSelected.size > 0) {
      onTransfer(false, Array.from(rightSelected));
      setRightSelected(new Set());
      setRightSearch("");
    }
  };

  const handleTransferAllRight = () => {
    const allIds = filteredLeftItems.map((item) => item.id);
    onTransfer(true, allIds);
    setLeftSelected(new Set());
    setLeftSearch("");
  };

  const handleTransferAllLeft = () => {
    const allIds = filteredRightItems.map((item) => item.id);
    onTransfer(false, allIds);
    setRightSelected(new Set());
    setRightSearch("");
  };

  const renderList = (
    title: string,
    items: TransferItem[],
    selected: Set<string>,
    onSelect: (id: string) => void,
    searchValue: string,
    onSearchChange: (value: string) => void,
    onSelectAll: () => void,
    onDeselectAll: () => void
  ) => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b-2 border-orange-300/50 bg-black">
        <h3 className="font-sans font-medium text-orange-300 text-sm">
          {title}
        </h3>
        {selectAll && items.length > 0 && (
          <div className="flex gap-2 mt-1">
            <Button
              onClick={onSelectAll}
              variant="secondary"
              className="text-xs px-2 py-1 h-auto"
            >
              Select All
            </Button>
            <Button
              onClick={onDeselectAll}
              variant="secondary"
              className="text-xs px-2 py-1 h-auto"
            >
              Deselect All
            </Button>
          </div>
        )}
      </div>

      {searchable && (
        <div className="p-2 border-b border-orange-300/30">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search items..."
            className="w-full px-3 py-1 bg-black text-orange-300 border border-orange-300/50 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>
      )}

      <div
        className="flex-1 overflow-auto"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {items.length > 0 ? (
          <div className="py-1">
            {items.map((item) => (
              <div
                key={item.id}
                className={`
                  px-4 py-2 font-sans text-sm cursor-pointer
                  transition-colors duration-200
                  ${
                    item.disabled
                      ? "text-orange-300/50 cursor-not-allowed"
                      : selected.has(item.id)
                      ? "bg-orange-300/20 text-orange-300"
                      : "text-orange-300 hover:bg-orange-300/10"
                  }
                `}
                onClick={() => !item.disabled && onSelect(item.id)}
              >
                <Checkbox
                  label={item.label}
                  checked={selected.has(item.id)}
                  onChange={() => !item.disabled && onSelect(item.id)}
                  disabled={item.disabled}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-orange-300/50 font-sans text-sm">
            No items available
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`flex gap-4 ${className}`}>
      {/* Left List */}
      <div className="flex-1 border-2 border-orange-300/50 rounded-md bg-black">
        {renderList(
          leftTitle,
          filteredLeftItems,
          leftSelected,
          handleLeftSelect,
          leftSearch,
          setLeftSearch,
          handleSelectAllLeft,
          handleDeselectAllLeft
        )}
      </div>

      {/* Transfer Controls */}
      <div className="flex flex-col justify-center gap-2">
        <Button
          onClick={handleTransferRight}
          disabled={leftSelected.size === 0}
          variant="secondary"
          className="p-2 h-auto"
          aria-label="Transfer selected items"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>

        <Button
          onClick={handleTransferAllRight}
          disabled={filteredLeftItems.length === 0}
          variant="secondary"
          className="p-2 h-auto"
          aria-label="Transfer all items"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>

        <Button
          onClick={handleTransferLeft}
          disabled={rightSelected.size === 0}
          variant="secondary"
          className="p-2 h-auto"
          aria-label="Transfer selected items"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <Button
          onClick={handleTransferAllLeft}
          disabled={filteredRightItems.length === 0}
          variant="secondary"
          className="p-2 h-auto"
          aria-label="Transfer all items"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* Right List */}
      <div className="flex-1 border-2 border-orange-300/50 rounded-md bg-black">
        {renderList(
          rightTitle,
          filteredRightItems,
          rightSelected,
          handleRightSelect,
          rightSearch,
          setRightSearch,
          handleSelectAllRight,
          handleDeselectAllRight
        )}
      </div>
    </div>
  );
};
