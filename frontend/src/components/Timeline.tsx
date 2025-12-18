import React from "react";
import { CheckCircle, Clock, AlertCircle, XCircle } from "lucide-react";
import { Badge } from "./Badge";

/**
 * Status types for timeline items that determine their visual appearance and icon.
 * @typedef {string} TimelineItemStatus
 */
export type TimelineItemStatus =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "pending";

/**
 * Represents a single item in the timeline.
 * @interface TimelineItem
 */
export interface TimelineItem {
  /** Unique identifier for the timeline item */
  id: string;
  /** The title text displayed for the timeline item */
  title: string;
  /** Optional descriptive text displayed below the title */
  description?: string;
  /** Optional timestamp or date information displayed as a badge */
  timestamp?: string;
  /** Status of the timeline item that determines its visual appearance */
  status?: TimelineItemStatus;
  /** Optional custom icon to override the default status icon */
  icon?: React.ReactNode;
  /** Optional custom content to display below the description */
  children?: React.ReactNode;
  /** Position of the item content relative to the timeline line */
  position?: "left" | "right";
}

/**
 * Props for the Timeline component.
 * @interface TimelineProps
 */
export interface TimelineProps {
  /** Array of timeline items to display */
  items: TimelineItem[];
  /** Default positioning mode for timeline items (left or right) */
  mode?: "left" | "right";
  /** Optional pending item to display at the end of the timeline */
  pending?: boolean | React.ReactNode;
  /** Whether to reverse the order of timeline items */
  reverse?: boolean;
  /** Additional CSS classes to apply to the timeline container */
  className?: string;
  /** Maximum height of the timeline container with scroll support */
  maxHeight?: number;
}

/**
 * A comprehensive timeline component for displaying chronological events with status indicators.
 *
 * The Timeline component provides a professional event tracking interface with:
 * - Visual timeline with connecting lines and status dots
 * - Multiple status types (success, warning, error, pending, default)
 * - Automatic status icons with customizable overrides
 * - Flexible positioning (left-aligned, right-aligned, or mixed)
 * - Timestamp badges for each timeline item
 * - Custom content support for complex item displays
 * - Pending state indicator for ongoing processes
 * - Reversible timeline order for different display needs
 * - Scrollable container with height constraints
 * - Responsive design with proper spacing and typography
 * - Professional appearance with consistent orange theme
 * - Accessibility features with proper semantic structure
 * - Smooth visual connections between timeline items
 * - Status-based color coding for quick visual recognition
 *
 * This component is ideal for project timelines, order tracking, process workflows,
 * activity feeds, and any interface requiring chronological event visualization.
 *
 * @component
 * @param {TimelineProps} props - The props for the Timeline component
 * @param {TimelineItem[]} props.items - Array of timeline items to display
 * @param {'left' | 'right'} [props.mode='left'] - Default positioning mode for timeline items
 * @param {boolean | React.ReactNode} [props.pending=false] - Optional pending item to display
 * @param {boolean} [props.reverse=false] - Whether to reverse the order of timeline items
 * @param {string} [props.className] - Additional CSS classes to apply to the container
 * @param {number} [props.maxHeight] - Maximum height of the timeline container
 *
 * @example
 * ```tsx
 * // Basic timeline
 * const timelineItems = [
 *   { id: '1', title: 'Order Placed', timestamp: '2024-01-15', status: 'success' },
 *   { id: '2', title: 'Processing', timestamp: '2024-01-16', status: 'pending' },
 *   { id: '3', title: 'Shipped', timestamp: '2024-01-17', status: 'default' }
 * ];
 *
 * <Timeline items={timelineItems} />
 *
 * // Timeline with descriptions and custom content
 * const projectItems = [
 *   {
 *     id: 'planning',
 *     title: 'Project Planning',
 *     description: 'Requirements gathering and project scope definition',
 *     timestamp: 'Week 1',
 *     status: 'success',
 *     children: <div className="text-sm text-orange-300/60">Completed ahead of schedule</div>
 *   },
 *   {
 *     id: 'development',
 *     title: 'Development Phase',
 *     description: 'Core feature implementation and testing',
 *     timestamp: 'Week 2-4',
 *     status: 'pending'
 *   },
 *   {
 *     id: 'deployment',
 *     title: 'Deployment',
 *     description: 'Production deployment and monitoring',
 *     timestamp: 'Week 5',
 *     status: 'default'
 *   }
 * ];
 *
 * <Timeline
 *   items={projectItems}
 *   pending="Final testing and bug fixes"
 *   className="my-8"
 * />
 *
 * // Right-aligned timeline
 * <Timeline
 *   items={timelineItems}
 *   mode="right"
 *   maxHeight={400}
 * />
 *
 * // Reversed timeline for recent-first display
 * <Timeline
 *   items={activityItems}
 *   reverse={true}
 *   pending="More activities loading..."
 * />
 *
 * // Mixed positioning timeline
 * const mixedItems = [
 *   { id: '1', title: 'Start', status: 'success', position: 'left' },
 *   { id: '2', title: 'Middle', status: 'warning', position: 'right' },
 *   { id: '3', title: 'End', status: 'error', position: 'left' }
 * ];
 *
 * <Timeline items={mixedItems} />
 *
 * // Order tracking timeline
 * const orderItems = [
 *   { id: 'ordered', title: 'Order Confirmed', timestamp: '10:30 AM', status: 'success' },
 *   { id: 'processing', title: 'In Production', timestamp: '11:45 AM', status: 'pending' },
 *   { id: 'quality', title: 'Quality Check', timestamp: '2:15 PM', status: 'default' },
 *   { id: 'shipping', title: 'Ready for Shipping', timestamp: '3:00 PM', status: 'warning' }
 * ];
 *
 * <Timeline
 *   items={orderItems}
 *   pending="Out for delivery"
 *   className="border border-orange-300/30 rounded-lg p-6"
 * />
 *
 * // Custom icons and complex content
 * const customItems = [
 *   {
 *     id: 'milestone1',
 *     title: 'Major Milestone',
 *     description: 'A significant achievement in the project',
 *     timestamp: 'Q1 2024',
 *     status: 'success',
 *     icon: <Star className="w-4 h-4 text-yellow-400" />,
 *     children: (
 *       <div className="bg-orange-300/10 p-3 rounded border border-orange-300/30">
 *         <p className="text-sm text-orange-300/80">Additional details and metrics</p>
 *         <div className="flex gap-2 mt-2">
 *           <Badge variant="success" size="sm">+15%</Badge>
 *           <Badge variant="default" size="sm">On Track</Badge>
 *         </div>
 *       </div>
 *     )
 *   }
 * ];
 *
 * <Timeline items={customItems} />
 * ```
 *
 * @returns {JSX.Element} A comprehensive timeline component for displaying chronological events with status indicators
 */
export const Timeline: React.FC<TimelineProps> = ({
  items,
  mode = "left",
  pending = false,
  reverse = false,
  className = "",
  maxHeight,
}) => {
  const displayItems = reverse ? [...items].reverse() : items;

  const getStatusIcon = (status: TimelineItemStatus) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-black" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-black" />;
      case "error":
        return <XCircle className="w-4 h-4 text-black" />;
      case "pending":
        return <Clock className="w-4 h-4 text-black" />;
      default:
        return <div className="w-3 h-3 rounded-full bg-black" />;
    }
  };

  const getItemPosition = (_index: number, _item: TimelineItem) => {
    if (mode === "right") {
      return "right";
    }
    return "left";
  };

  const baseClasses = `
    relative
    ${className}
  `;

  const containerClasses = `
    relative
    ${maxHeight ? `max-h-[${maxHeight}px] overflow-y-auto` : ""}
  `;

  const itemClasses = (position: "left" | "right") => `
    relative flex gap-4 mb-6 last:mb-0
    ${position === "right" ? "flex-row-reverse" : ""}
  `;

  const contentClasses = (position: "left" | "right") => `
    flex-1 ${position === "right" ? "text-right" : ""}
  `;

  return (
    <div className={baseClasses}>
      <div className={containerClasses}>
        {displayItems.map((item, index) => {
          const position = getItemPosition(index, item);
          const isLast = index === displayItems.length - 1;

          return (
            <div key={item.id} className={itemClasses(position)}>
              {/* Timeline line */}
              {!isLast && (
                <div
                  className="absolute top-6 left-3 w-0.5 bg-orange-300/30"
                  style={{ height: "calc(100% + 1.5rem)" }}
                />
              )}

              {/* Timeline dot */}
              <div className="relative z-10 flex-shrink-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    item.status === "success"
                      ? "bg-green-400"
                      : item.status === "error"
                      ? "bg-red-400"
                      : item.status === "pending"
                      ? "bg-orange-300"
                      : "bg-orange-300 border-2 border-orange-300"
                  }`}
                >
                  {item.icon || getStatusIcon(item.status || "default")}
                </div>
              </div>

              {/* Content */}
              <div className={contentClasses(position)}>
                <div className="space-y-2">
                  {/* Title and timestamp row */}
                  <div
                    className={`flex items-center gap-3 ${
                      position === "right" ? "justify-end" : ""
                    }`}
                  >
                    <h3 className="font-sans font-medium text-orange-300 text-base">
                      {item.title}
                    </h3>
                    {item.timestamp && (
                      <Badge variant="default" size="sm">
                        {item.timestamp}
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  {item.description && (
                    <p className="font-sans text-orange-300/80 text-sm leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  {/* Custom children content */}
                  {item.children && <div className="mt-3">{item.children}</div>}
                </div>
              </div>
            </div>
          );
        })}

        {/* Pending item */}
        {pending && (
          <div className="relative flex gap-4">
            <div className="relative z-10 flex-shrink-0">
              <div className="w-6 h-6 rounded-full bg-orange-300/50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-black" />
              </div>
            </div>

            <div className="flex-1">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-sans font-medium text-orange-300/60 text-base">
                    {typeof pending === "string" ? pending : "In Progress..."}
                  </h3>
                  <Badge variant="default" size="sm">
                    Pending
                  </Badge>
                </div>
                {typeof pending !== "string" && pending}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
