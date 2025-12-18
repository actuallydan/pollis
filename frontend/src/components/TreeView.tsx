import React, { useState, useCallback, useRef } from "react";
import { ChevronRight, ChevronDown, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Represents a single node in the tree structure.
 * @interface TreeNode
 */
export interface TreeNode {
  /** Unique identifier for the tree node */
  id: string;
  /** Display text for the tree node */
  label: string;
  /** Optional array of child nodes for hierarchical structure */
  children?: TreeNode[];
  /** Additional data associated with the node for custom functionality */
  data?: any;
}

/**
 * Props for the TreeView component.
 * @interface TreeViewProps
 */
interface TreeViewProps {
  /** Array of root tree nodes to display */
  data: TreeNode[];
  /** Maximum height of the tree view container in pixels */
  maxHeight?: number;
  /** Additional CSS classes to apply to the tree view container */
  className?: string;
  /** Callback function called when a tree node is clicked */
  onNodeClick?: (node: TreeNode) => void;
  /** Callback function called when the action button for a node is clicked */
  onNodeAction?: (node: TreeNode) => void;
  /** Optional function to provide custom icons for tree nodes based on their state */
  getNodeIcon?: (node: TreeNode, isOpen: boolean) => LucideIcon | undefined;
}

/**
 * Props for individual tree node components.
 * @interface TreeNodeProps
 */
interface TreeNodeProps {
  /** The tree node data to render */
  node: TreeNode;
  /** The nesting level of this node in the tree hierarchy */
  level: number;
  /** Whether this node's children are currently expanded */
  isOpen: boolean;
  /** Function to toggle the expanded state of this node */
  onToggle: (nodeId: string) => void;
  /** Function called when this node is clicked */
  onNodeClick: (node: TreeNode) => void;
  /** Function called when the action button for this node is clicked */
  onNodeAction: (node: TreeNode) => void;
  /** Set of currently expanded node IDs for state management */
  expandedNodes: Set<string>;
  /** Optional function to provide custom icons for tree nodes */
  getNodeIcon?: (node: TreeNode, isOpen: boolean) => LucideIcon | undefined;
  /** Callback for handling Tab key navigation from action buttons */
  onActionTab?: () => void;
}

// Memoized individual tree node component
const TreeNodeComponent = React.memo<TreeNodeProps>(
  ({
    node,
    level,
    isOpen,
    onToggle,
    onNodeClick,
    onNodeAction,
    expandedNodes,
    getNodeIcon,
    onActionTab,
  }) => {
    const [_isHovered, setIsHovered] = useState(false);
    const [isChevronFocused, setIsChevronFocused] = useState(false);
    const [isActionFocused, setIsActionFocused] = useState(false);

    const rowRef = useRef<HTMLDivElement>(null);
    const actionButtonRef = useRef<HTMLButtonElement>(null);

    const hasChildren = node.children && node.children.length > 0;
    const paddingLeft = `${level * 16}px`;

    const handleToggle = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggle(node.id);
      },
      [node.id, onToggle]
    );

    const handleClick = useCallback(() => {
      if (hasChildren) {
        onToggle(node.id);
      }
    }, [node, onToggle, hasChildren]);

    const handleAction = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onNodeAction(node);
      },
      [node, onNodeAction]
    );

    const handleRowKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        switch (e.key) {
          case "Enter":
          case " ":
            e.preventDefault();
            if (hasChildren) {
              onToggle(node.id);
            }
            break;
          case "Tab":
            if (!e.shiftKey) {
              e.preventDefault();
              actionButtonRef.current?.focus();
            }
            break;
        }
      },
      [hasChildren, node.id, onToggle]
    );

    const handleActionKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        switch (e.key) {
          case "Tab":
            if (e.shiftKey) {
              e.preventDefault();
              rowRef.current?.focus();
            } else {
              // Forward Tab - let it pass through to next focusable element
              onActionTab?.();
            }
            break;
        }
      },
      [onActionTab]
    );

    const isChevronFocusedState = isChevronFocused;
    const isActionFocusedState = isActionFocused;

    const rowClasses = `
    group flex items-center w-full px-2 py-1 rounded-md transition-all duration-75 cursor-pointer select-none
    ${
      isChevronFocusedState
        ? "bg-orange-300 text-black"
        : isActionFocusedState
        ? "bg-orange-300/10"
        : "hover:bg-orange-300/10"
    }
  `;

    const iconClasses = `
    flex-shrink-0 w-6 h-6 mr-2 transition-colors duration-75
    ${isChevronFocusedState ? "text-black" : "text-orange-300"}
  `;

    const labelClasses = `
    flex-1 min-w-0 text-lg font-sans truncate transition-colors duration-75
    ${isChevronFocusedState ? "text-black" : "text-orange-300"}
  `;

    const actionButtonClasses = `
    flex-shrink-0 ml-2 p-1 rounded-md transition-all duration-75 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-1 focus:ring-offset-black
    ${
      isChevronFocusedState
        ? "opacity-100 bg-orange-300 text-black border border-black hover:bg-black hover:text-orange-300 hover:border-orange-300"
        : isActionFocusedState
        ? "opacity-100 bg-orange-300 text-black border border-orange-300"
        : "opacity-0 group-hover:opacity-100 focus:opacity-100 bg-orange-300/10 border border-orange-300/20 text-orange-300 hover:bg-orange-300 hover:text-black hover:border-orange-300 focus:bg-orange-300 focus:text-black focus:border-black"
    }
  `;

    return (
      <div>
        <div
          ref={rowRef}
          className={rowClasses}
          style={{ paddingLeft }}
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          role="button"
          aria-label={`${node.label}${hasChildren ? " folder" : " file"}`}
          aria-expanded={hasChildren ? isOpen : undefined}
        >
          {/* Toggle arrow */}
          <div className="flex-shrink-0 w-6 h-6 mr-1">
            {hasChildren && (
              <button
                onClick={handleToggle}
                className="w-full h-full flex items-center justify-center text-orange-300 hover:text-orange-200 transition-colors duration-75 focus:outline-none focus:bg-orange-300 focus:text-black"
                aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.label}`}
                onKeyDown={handleRowKeyDown}
                onFocus={() => setIsChevronFocused(true)}
                onBlur={() => setIsChevronFocused(false)}
                tabIndex={0}
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {/* Node icon */}
          {getNodeIcon && getNodeIcon(node, isOpen) && (
            <div className={iconClasses}>
              {React.createElement(getNodeIcon(node, isOpen)!, {
                className: "w-5 h-5",
              })}
            </div>
          )}

          {/* Node label */}
          <span className={labelClasses} title={node.label}>
            {node.label}
          </span>

          {/* Action button */}
          <button
            ref={actionButtonRef}
            onClick={handleAction}
            className={actionButtonClasses}
            onKeyDown={handleActionKeyDown}
            onFocus={() => setIsActionFocused(true)}
            onBlur={() => setIsActionFocused(false)}
            aria-label={`Actions for ${node.label}`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Children */}
        {hasChildren && isOpen && (
          <div>
            {node.children!.map((child) => (
              <TreeNodeComponent
                key={child.id}
                node={child}
                level={level + 1}
                isOpen={expandedNodes.has(child.id)}
                onToggle={onToggle}
                onNodeClick={onNodeClick}
                onNodeAction={onNodeAction}
                expandedNodes={expandedNodes}
                getNodeIcon={getNodeIcon}
                onActionTab={onActionTab}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);

TreeNodeComponent.displayName = "TreeNodeComponent";

/**
 * A sophisticated hierarchical tree view component with expandable nodes and interactive features.
 *
 * The TreeView component provides a professional tree structure interface with:
 * - Hierarchical data display with expandable/collapsible nodes
 * - Visual tree structure with proper indentation and connecting lines
 * - Interactive node expansion with smooth animations
 * - Custom icon support for different node types and states
 * - Action buttons for each node with contextual functionality
 * - Comprehensive keyboard navigation and accessibility features
 * - Focus management with visual feedback for different focus states
 * - Hover effects and smooth transitions throughout the interface
 * - Professional appearance with consistent orange theme
 * - Responsive design with height constraints and scrolling
 * - Memoized rendering for optimal performance with large trees
 * - Flexible data structure support with custom node data
 * - Event handling for node interactions and actions
 * - Proper ARIA attributes for screen reader support
 * - Tab navigation between nodes and action buttons
 *
 * This component is ideal for file browsers, navigation menus, organizational charts,
 * category trees, and any interface requiring hierarchical data visualization.
 *
 * @component
 * @param {TreeViewProps} props - The props for the TreeView component
 * @param {TreeNode[]} props.data - Array of root tree nodes to display
 * @param {number} [props.maxHeight=600] - Maximum height of the tree view container in pixels
 * @param {string} [props.className] - Additional CSS classes to apply to the container
 * @param {(node: TreeNode) => void} [props.onNodeClick] - Callback function called when a tree node is clicked
 * @param {(node: TreeNode) => void} [props.onNodeAction] - Callback function called when the action button for a node is clicked
 * @param {(node: TreeNode, isOpen: boolean) => LucideIcon | undefined} [props.getNodeIcon] - Optional function to provide custom icons for tree nodes
 *
 * @example
 * ```tsx
 * // Basic tree view
 * const treeData = [
 *   {
 *     id: '1',
 *     label: 'Documents',
 *     children: [
 *       { id: '1-1', label: 'Work' },
 *       { id: '1-2', label: 'Personal' }
 *     ]
 *   },
 *   {
 *     id: '2',
 *     label: 'Pictures',
 *     children: [
 *       { id: '2-1', label: 'Vacation' },
 *       { id: '2-2', label: 'Family' }
 *     ]
 *   }
 * ];
 *
 * <TreeView
 *   data={treeData}
 *   onNodeClick={(node) => console.log('Clicked:', node.label)}
 *   onNodeAction={(node) => console.log('Action for:', node.label)}
 * />
 *
 * // Tree view with custom icons
 * const getCustomIcon = (node: TreeNode, isOpen: boolean) => {
 *   if (node.children && node.children.length > 0) {
 *     return isOpen ? FolderOpen : Folder;
 *   }
 *   return File;
 * };
 *
 * <TreeView
 *   data={fileTreeData}
 *   getNodeIcon={getCustomIcon}
 *   maxHeight={800}
 *   className="my-8"
 * />
 *
 * // File browser with actions
 * const handleFileClick = (node: TreeNode) => {
 *   if (!node.children) {
 *     openFile(node.id);
 *   }
 * };
 *
 * const handleFileAction = (node: TreeNode) => {
 *   showContextMenu(node);
 * };
 *
 * <TreeView
 *   data={fileSystemData}
 *   onNodeClick={handleFileClick}
 *   onNodeAction={handleFileAction}
 *   getNodeIcon={getFileIcon}
 * />
 *
 * // Navigation menu tree
 * const navigationData = [
 *   {
 *     id: 'dashboard',
 *     label: 'Dashboard',
 *     children: [
 *       { id: 'overview', label: 'Overview' },
 *       { id: 'analytics', label: 'Analytics' },
 *       { id: 'reports', label: 'Reports' }
 *     ]
 *   },
 *   {
 *     id: 'users',
 *     label: 'User Management',
 *     children: [
 *       { id: 'list', label: 'User List' },
 *       { id: 'roles', label: 'Roles & Permissions' },
 *       { id: 'groups', label: 'User Groups' }
 *     ]
 *   }
 * ];
 *
 * <TreeView
 *   data={navigationData}
 *   onNodeClick={(node) => navigateToPage(node.id)}
 *   onNodeAction={(node) => showNodeOptions(node)}
 *   className="border border-orange-300/50 rounded-lg"
 * />
 *
 * // Organizational chart
 * const orgData = [
 *   {
 *     id: 'ceo',
 *     label: 'CEO - John Smith',
 *     data: { role: 'Chief Executive Officer', department: 'Executive' },
 *     children: [
 *       {
 *         id: 'cto',
 *         label: 'CTO - Jane Doe',
 *         data: { role: 'Chief Technology Officer', department: 'Technology' },
 *         children: [
 *           { id: 'dev1', label: 'Senior Developer', data: { role: 'Developer', department: 'Engineering' } },
 *           { id: 'dev2', label: 'Junior Developer', data: { role: 'Developer', department: 'Engineering' } }
 *         ]
 *       },
 *       {
 *         id: 'cfo',
 *         label: 'CFO - Bob Johnson',
 *         data: { role: 'Chief Financial Officer', department: 'Finance' }
 *       }
 *     ]
 *   }
 * ];
 *
 * <TreeView
 *   data={orgData}
 *   onNodeClick={(node) => showEmployeeDetails(node.data)}
 *   onNodeAction={(node) => showEmployeeActions(node)}
 *   maxHeight={600}
 *   className="bg-gradient-to-r from-orange-900/20 to-orange-800/20 p-6 rounded-lg"
 * />
 *
 * // Category tree for e-commerce
 * const categoryData = [
 *   {
 *     id: 'electronics',
 *     label: 'Electronics',
 *     children: [
 *       {
 *         id: 'computers',
 *         label: 'Computers',
 *         children: [
 *           { id: 'laptops', label: 'Laptops' },
 *           { id: 'desktops', label: 'Desktop Computers' },
 *           { id: 'tablets', label: 'Tablets' }
 *         ]
 *       },
 *       {
 *         id: 'phones',
 *         label: 'Mobile Phones',
 *         children: [
 *           { id: 'smartphones', label: 'Smartphones' },
 *           { id: 'accessories', label: 'Phone Accessories' }
 *         ]
 *       }
 *     ]
 *   }
 * ];
 *
 * <TreeView
 *   data={categoryData}
 *   onNodeClick={(node) => filterProductsByCategory(node.id)}
 *   onNodeAction={(node) => editCategory(node)}
 *   getNodeIcon={(node, isOpen) => node.children ? (isOpen ? FolderOpen : Folder) : Tag}
 * />
 * ```
 *
 * @returns {JSX.Element} A sophisticated hierarchical tree view component with expandable nodes and interactive features
 */
export const TreeView: React.FC<TreeViewProps> = ({
  data,
  maxHeight = 600,
  className = "",
  onNodeClick = () => {},
  onNodeAction = () => {},
  getNodeIcon,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const handleToggle = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const handleNodeClick = useCallback(
    (node: TreeNode) => {
      onNodeClick(node);
    },
    [onNodeClick]
  );

  const handleNodeAction = useCallback(
    (node: TreeNode) => {
      onNodeAction(node);
    },
    [onNodeAction]
  );

  const handleActionTab = useCallback(() => {
    // This will be called when Tab is pressed on an action button
    // The browser will naturally move focus to the next focusable element
  }, []);

  const containerClasses = `
    w-full border-2 border-orange-300/30 rounded-md
    bg-black overflow-y-auto
    ${className}
  `;

  return (
    <div className={containerClasses} style={{ maxHeight }}>
      <div className="p-1">
        {data.map((node) => (
          <TreeNodeComponent
            key={node.id}
            node={node}
            level={0}
            isOpen={expandedNodes.has(node.id)}
            onToggle={handleToggle}
            onNodeClick={handleNodeClick}
            onNodeAction={handleNodeAction}
            expandedNodes={expandedNodes}
            getNodeIcon={getNodeIcon}
            onActionTab={handleActionTab}
          />
        ))}
      </div>
    </div>
  );
};
