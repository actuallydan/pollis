import React, { useState, useCallback } from "react";
import { ChevronRight, ChevronDown, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  data?: any;
  // Preserved for Playwright E2E tests
  testId?: string;
  hideAction?: boolean;
}

interface TreeViewProps {
  data: TreeNode[];
  className?: string;
  selectedId?: string | null;
  onNodeClick?: (node: TreeNode) => void;
  onNodeAction?: (node: TreeNode, e: React.MouseEvent) => void;
  getNodeIcon?: (node: TreeNode, isOpen: boolean) => LucideIcon | undefined;
  defaultExpandedIds?: string[];
}

interface TreeNodeProps {
  node: TreeNode;
  level: number;
  isOpen: boolean;
  isSelected: boolean;
  selectedId?: string | null;
  onToggle: (nodeId: string) => void;
  onNodeClick: (node: TreeNode) => void;
  onNodeAction: (node: TreeNode, e: React.MouseEvent) => void;
  expandedNodes: Set<string>;
  getNodeIcon?: (node: TreeNode, isOpen: boolean) => LucideIcon | undefined;
}

const TreeNodeComponent = React.memo<TreeNodeProps>(
  ({
    node,
    level,
    isOpen,
    isSelected,
    selectedId,
    onToggle,
    onNodeClick,
    onNodeAction,
    expandedNodes,
    getNodeIcon,
  }) => {
    const [isActionFocused, setIsActionFocused] = useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const paddingLeft = `${level * 16 + 8}px`;

    const handleClick = useCallback(() => {
      onNodeClick(node);
      if (hasChildren) {
        onToggle(node.id);
      }
    }, [node, onToggle, onNodeClick, hasChildren]);

    const handleAction = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onNodeAction(node, e);
      },
      [node, onNodeAction]
    );

    return (
      <div>
        <div
          data-testid={node.testId}
          className="group flex items-center w-full py-1 cursor-pointer select-none transition-colors"
          style={{
            paddingLeft,
            paddingRight: "6px",
            background: isSelected ? "var(--c-active)" : undefined,
            borderLeft: isSelected
              ? "2px solid var(--c-accent)"
              : "2px solid transparent",
          }}
          onClick={handleClick}
          onMouseEnter={(e) => {
            if (!isSelected) {
              (e.currentTarget as HTMLElement).style.background =
                "var(--c-hover)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              (e.currentTarget as HTMLElement).style.background = "";
            }
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick();
            }
          }}
        >
          {/* Chevron */}
          <div className="flex-shrink-0 w-4 h-4 mr-1 flex items-center justify-center">
            {hasChildren &&
              (isOpen ? (
                <ChevronDown
                  className="w-3 h-3"
                  style={{ color: "var(--c-text-muted)" }}
                />
              ) : (
                <ChevronRight
                  className="w-3 h-3"
                  style={{ color: "var(--c-text-muted)" }}
                />
              ))}
          </div>

          {/* Optional icon */}
          {getNodeIcon && getNodeIcon(node, isOpen) && (
            <div className="flex-shrink-0 w-4 h-4 mr-1.5 flex items-center justify-center">
              {React.createElement(getNodeIcon(node, isOpen)!, {
                className: "w-4 h-4",
                style: { color: "var(--c-text-dim)" },
              })}
            </div>
          )}

          {/* Label */}
          <span
            className="flex-1 min-w-0 truncate text-xs font-mono"
            style={{ color: isSelected ? "var(--c-accent)" : "var(--c-text)" }}
          >
            {node.label}
          </span>

          {/* Action button */}
          {!node.hideAction && (
            <button
              onClick={handleAction}
              onFocus={() => setIsActionFocused(true)}
              onBlur={() => setIsActionFocused(false)}
              aria-label={`Actions for ${node.label}`}
              className="flex-shrink-0 ml-1 p-0.5 rounded transition-colors"
              style={{
                background: isActionFocused ? "var(--c-accent)" : "transparent",
                color: isActionFocused ? "var(--c-bg)" : "var(--c-text-muted)",
              }}
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>
          )}
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
                isSelected={selectedId === child.id}
                selectedId={selectedId}
                onToggle={onToggle}
                onNodeClick={onNodeClick}
                onNodeAction={onNodeAction}
                expandedNodes={expandedNodes}
                getNodeIcon={getNodeIcon}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);

TreeNodeComponent.displayName = "TreeNodeComponent";

export const TreeView: React.FC<TreeViewProps> = ({
  data,
  className = "",
  selectedId,
  onNodeClick = () => {},
  onNodeAction = () => {},
  getNodeIcon,
  defaultExpandedIds,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(defaultExpandedIds || [])
  );

  const handleToggle = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  return (
    <div className={`w-full ${className}`}>
      {data.map((node) => (
        <TreeNodeComponent
          key={node.id}
          node={node}
          level={0}
          isOpen={expandedNodes.has(node.id)}
          isSelected={selectedId === node.id}
          selectedId={selectedId}
          onToggle={handleToggle}
          onNodeClick={onNodeClick}
          onNodeAction={onNodeAction}
          expandedNodes={expandedNodes}
          getNodeIcon={getNodeIcon}
        />
      ))}
    </div>
  );
};
