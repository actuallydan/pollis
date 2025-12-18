import React, { useState, useRef, useEffect } from "react";
import { useButton } from "@react-aria/button";
import { useOverlay, DismissButton } from "@react-aria/overlays";
import {
  CalendarDate,
  getLocalTimeZone,
  today,
  parseDate,
} from "@internationalized/date";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Represents a date range with start and end dates.
 * @interface DateRange
 */
interface DateRange {
  /** The start date of the range (inclusive) */
  start: Date | null;
  /** The end date of the range (inclusive) */
  end: Date | null;
}

/**
 * Props for the DateRangePicker component.
 * @interface DateRangePickerProps
 */
interface DateRangePickerProps {
  /** The label text displayed above the date range picker input */
  label: string;
  /** The currently selected date range value */
  value?: DateRange;
  /** Callback function called when a date range is selected or cleared */
  onChange?: (range: DateRange) => void;
  /** Placeholder text displayed when no date range is selected */
  placeholder?: string;
  /** Optional descriptive text displayed below the input */
  description?: string;
  /** Error message to display below the input */
  error?: string;
  /** Whether the date range picker is disabled and cannot be interacted with */
  disabled?: boolean;
  /** Whether the date range picker is required (shows required indicator) */
  required?: boolean;
  /** Additional CSS classes to apply to the date range picker container */
  className?: string;
  /** Unique identifier for the date range picker input element */
  id?: string;
}

/**
 * A comprehensive date range picker component with dual calendar overlay and accessibility features.
 *
 * The DateRangePicker component provides a user-friendly interface for selecting date ranges:
 * - Input field that displays the selected date range
 * - Dual calendar overlay showing two months side by side
 * - Visual range selection with start and end date indicators
 * - Automatic date ordering (start date before end date)
 * - Keyboard navigation and screen reader support
 * - Error handling and validation states
 * - Required field indication
 * - Customizable styling and descriptions
 * - Responsive design with proper focus management
 *
 * @component
 * @param {DateRangePickerProps} props - The props for the DateRangePicker component
 * @param {string} props.label - The label text displayed above the date range picker input
 * @param {DateRange} [props.value] - The currently selected date range value
 * @param {(range: DateRange) => void} [props.onChange] - Callback function called when a date range is selected
 * @param {string} [props.placeholder='Select date range...'] - Placeholder text displayed when no range is selected
 * @param {string} [props.description] - Optional descriptive text displayed below the input
 * @param {string} [props.error] - Error message to display below the input
 * @param {boolean} [props.disabled=false] - Whether the date range picker is disabled
 * @param {boolean} [props.required=false] - Whether the date range picker is required
 * @param {string} [props.className] - Additional CSS classes to apply to the container
 * @param {string} [props.id] - Unique identifier for the date range picker input
 *
 * @example
 * ```tsx
 * // Basic usage
 * <DateRangePicker
 *   label="Select Date Range"
 *   value={dateRange}
 *   onChange={setDateRange}
 * />
 *
 * // With validation and description
 * <DateRangePicker
 *   label="Event Period"
 *   value={eventPeriod}
 *   onChange={setEventPeriod}
 *   description="Select the start and end dates for your event"
 *   required={true}
 *   error={dateRangeError}
 * />
 *
 * // Disabled state
 * <DateRangePicker
 *   label="Booking Period"
 *   value={bookingPeriod}
 *   onChange={setBookingPeriod}
 *   disabled={true}
 *   description="Date selection is currently unavailable"
 * />
 * ```
 *
 * @returns {JSX.Element} A date range picker component with dual calendar overlay and input field
 */
export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = "Select date range...",
  description,
  error,
  disabled = false,
  required = false,
  className = "",
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState<CalendarDate | null>(
    value?.start ? parseDate(value.start.toISOString().split("T")[0]) : null
  );
  const [endDate, setEndDate] = useState<CalendarDate | null>(
    value?.end ? parseDate(value.end.toISOString().split("T")[0]) : null
  );
  const [inputValue, setInputValue] = useState<string>(
    value?.start && value?.end
      ? `${value.start.toLocaleDateString()} - ${value.end.toLocaleDateString()}`
      : value?.start
      ? value.start.toLocaleDateString()
      : ""
  );
  const [currentMonth, setCurrentMonth] = useState<CalendarDate>(
    startDate || today(getLocalTimeZone())
  );

  const overlayRef = useRef<HTMLDivElement>(null);

  // Sync input value when value prop changes externally
  useEffect(() => {
    if (value?.start && value?.end) {
      const rangeString = `${value.start.toLocaleDateString()} - ${value.end.toLocaleDateString()}`;
      setInputValue(rangeString);
      setStartDate(parseDate(value.start.toISOString().split("T")[0]));
      setEndDate(parseDate(value.end.toISOString().split("T")[0]));
      setCurrentMonth(parseDate(value.start.toISOString().split("T")[0]));
    } else if (value?.start) {
      setInputValue(value.start.toLocaleDateString());
      setStartDate(parseDate(value.start.toISOString().split("T")[0]));
      setEndDate(null);
      setCurrentMonth(parseDate(value.start.toISOString().split("T")[0]));
    } else if (value === null || (!value?.start && !value?.end)) {
      setInputValue("");
      setStartDate(null);
      setEndDate(null);
    }
  }, [value]);

  // Helper function to parse date from text input
  const parseDateFromText = (text: string): CalendarDate | null => {
    if (!text.trim()) return null;
    
    // Try various date formats
    const formats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // MM-DD-YYYY
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, // MM.DD.YYYY
    ];

    for (const format of formats) {
      const match = text.match(format);
      if (match) {
        try {
          let year: number, month: number, day: number;
          
          if (format === formats[1]) {
            // YYYY-MM-DD format
            year = parseInt(match[1]);
            month = parseInt(match[2]);
            day = parseInt(match[3]);
          } else {
            // MM/DD/YYYY, MM-DD-YYYY, or MM.DD.YYYY format
            month = parseInt(match[1]);
            day = parseInt(match[2]);
            year = parseInt(match[3]);
          }

          // Validate date
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
            const date = new CalendarDate(year, month, day);
            // Check if date is valid by trying to create it
            if (date.year === year && date.month === month && date.day === day) {
              return date;
            }
          }
        } catch (e) {
          // Invalid date, continue to next format
        }
      }
    }

    // Try parseDate directly (handles ISO format)
    try {
      return parseDate(text);
    } catch (e) {
      return null;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputValue(text);
    
    // Try to parse as date range (format: "date1 - date2" or "date1 to date2")
    const rangeSeparators = /[\s-–—]+/;
    const parts = text.split(rangeSeparators).filter(p => p.trim());
    
    if (parts.length >= 2) {
      // Try to parse as range
      const start = parseDateFromText(parts[0].trim());
      const end = parseDateFromText(parts[parts.length - 1].trim());
      
      if (start && end) {
        // Both dates are valid
        if (start.compare(end) <= 0) {
          setStartDate(start);
          setEndDate(end);
          onChange?.({
            start: start.toDate(getLocalTimeZone()),
            end: end.toDate(getLocalTimeZone()),
          });
          setCurrentMonth(start);
        } else {
          // Swap if start > end
          setStartDate(end);
          setEndDate(start);
          onChange?.({
            start: end.toDate(getLocalTimeZone()),
            end: start.toDate(getLocalTimeZone()),
          });
          setCurrentMonth(end);
        }
      } else if (start) {
        // Only start date is valid
        setStartDate(start);
        setEndDate(null);
        setCurrentMonth(start);
      }
      // If neither is valid, keep last valid state
    } else if (parts.length === 1) {
      // Try to parse as single date
      const date = parseDateFromText(parts[0].trim());
      if (date) {
        setStartDate(date);
        setEndDate(null);
        setCurrentMonth(date);
      }
      // If invalid, keep last valid state
    }
    // If empty or invalid, keep last valid state
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, and arrow keys
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (allowedKeys.includes(e.key)) {
      return;
    }
    // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if ((e.key === 'a' || e.key === 'c' || e.key === 'v' || e.key === 'x') && e.ctrlKey) {
      return;
    }
    // Allow numbers (0-9)
    if (/^[0-9]$/.test(e.key)) {
      return;
    }
    // Allow date separators: /, -, ., and space (for range separator)
    if (e.key === '/' || e.key === '-' || e.key === '.' || e.key === ' ') {
      return;
    }
    // Block everything else
    e.preventDefault();
  };

  const handleDateSelect = (date: CalendarDate) => {
    if (!startDate || (startDate && endDate)) {
      // Start new selection
      setStartDate(date);
      setEndDate(null);
      setInputValue(date.toDate(getLocalTimeZone()).toLocaleDateString());
    } else {
      // Complete selection
      if (date.compare(startDate) >= 0) {
        setEndDate(date);
        const rangeString = `${startDate.toDate(getLocalTimeZone()).toLocaleDateString()} - ${date.toDate(getLocalTimeZone()).toLocaleDateString()}`;
        setInputValue(rangeString);
        onChange?.({
          start: startDate.toDate(getLocalTimeZone()),
          end: date.toDate(getLocalTimeZone()),
        });
        setIsOpen(false);
      } else {
        // If selected date is before start date, swap them
        setEndDate(startDate);
        setStartDate(date);
        const rangeString = `${date.toDate(getLocalTimeZone()).toLocaleDateString()} - ${startDate.toDate(getLocalTimeZone()).toLocaleDateString()}`;
        setInputValue(rangeString);
        onChange?.({
          start: date.toDate(getLocalTimeZone()),
          end: startDate.toDate(getLocalTimeZone()),
        });
        setIsOpen(false);
      }
    }
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(currentMonth.subtract({ months: 1 }));
  };

  const handleNextMonth = () => {
    setCurrentMonth(currentMonth.add({ months: 1 }));
  };

  const { overlayProps } = useOverlay(
    {
      isOpen,
      onClose: () => setIsOpen(false),
      shouldCloseOnBlur: true,
      isDismissable: true,
    },
    overlayRef
  );

  const baseClasses = "relative w-full";
  const labelClasses =
    "block text-sm font-sans font-medium text-orange-300 mb-2";
  const descriptionClasses = "mt-1 text-xs font-sans text-orange-300/80";
  const errorClasses = "mt-1 text-xs font-sans text-red-400";
  const overlayClasses = `
    absolute top-full left-0 right-0 z-50 mt-1
    bg-black border-2 border-orange-300/50 rounded-md
    shadow-lg p-4
  `;

  const dateRangePickerId =
    id || `daterangepicker-${Math.random().toString(36).substr(2, 9)}`;
  const descriptionId = description
    ? `${dateRangePickerId}-description`
    : undefined;
  const errorId = error ? `${dateRangePickerId}-error` : undefined;


  return (
    <div className={`${baseClasses} ${className}`}>
      <label htmlFor={dateRangePickerId} className={labelClasses}>
        {label}
        {required && (
          <span className="text-red-400 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      <div className="relative">
        <input
          id={dateRangePickerId}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          className={`
            w-full px-4 py-2 rounded-md
            font-sans text-base
            bg-black text-orange-300
            border-2 border-orange-300/50
            focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            ${error ? "border-red-400" : ""}
          `}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-describedby={
            [descriptionId, errorId].filter(Boolean).join(" ") || undefined
          }
          aria-invalid={!!error}
          onKeyDown={handleKeyDown}
          onClick={(e) => {
            if (!disabled) {
              e.stopPropagation();
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
            }
          }}
          aria-label="Select date range"
        />

        {isOpen && (
          <div {...overlayProps} ref={overlayRef} className={overlayClasses}>
            <DismissButton onDismiss={() => setIsOpen(false)} />
            <div className="flex gap-4">
              <CalendarGrid
                currentMonth={currentMonth}
                startDate={startDate}
                endDate={endDate}
                onDateSelect={handleDateSelect}
                onPreviousMonth={handlePreviousMonth}
                onNextMonth={handleNextMonth}
                onMonthChange={setCurrentMonth}
                title="Start Date"
              />
              <CalendarGrid
                currentMonth={currentMonth.add({ months: 1 })}
                startDate={startDate}
                endDate={endDate}
                onDateSelect={handleDateSelect}
                onPreviousMonth={handleNextMonth}
                onNextMonth={() =>
                  setCurrentMonth(currentMonth.add({ months: 2 }))
                }
                onMonthChange={setCurrentMonth}
                title="End Date"
              />
            </div>
            <DismissButton onDismiss={() => setIsOpen(false)} />
          </div>
        )}
      </div>

      {description && !error && (
        <p id={descriptionId} className={descriptionClasses}>
          {description}
        </p>
      )}

      {error && (
        <p id={errorId} className={errorClasses} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * Props for the CalendarGrid component used in date range selection.
 * @interface CalendarGridProps
 */
interface CalendarGridProps {
  /** The currently displayed month in the calendar */
  currentMonth: CalendarDate;
  /** The start date of the selected range */
  startDate: CalendarDate | null;
  /** The end date of the selected range */
  endDate: CalendarDate | null;
  /** Callback function called when a date is selected */
  onDateSelect: (date: CalendarDate) => void;
  /** Callback function called when navigating to the previous month */
  onPreviousMonth: () => void;
  /** Callback function called when navigating to the next month */
  onNextMonth: () => void;
  /** Callback function called when the month is changed via dropdown */
  onMonthChange: (month: CalendarDate) => void;
  /** Title displayed above the calendar grid */
  title: string;
}

/**
 * Calendar grid component that displays a month view with range selection capabilities.
 *
 * The CalendarGrid component renders a full month calendar with:
 * - Month/year navigation with previous/next buttons
 * - Month and year dropdown selectors
 * - Week day headers
 * - Calendar cells for each day with range selection states
 * - Visual indicators for start date, end date, and range
 * - Proper date calculations and grid layout
 *
 * @component
 * @param {CalendarGridProps} props - The props for the CalendarGrid component
 * @returns {JSX.Element} A calendar grid component with range selection and month navigation
 */
const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentMonth,
  startDate,
  endDate,
  onDateSelect,
  onPreviousMonth,
  onNextMonth,
  onMonthChange,
  title,
}) => {
  const { buttonProps: prevButtonProps } = useButton(
    {
      onPress: onPreviousMonth,
      "aria-label": "Previous month",
    },
    useRef<HTMLButtonElement>(null)
  );

  const { buttonProps: nextButtonProps } = useButton(
    {
      onPress: onNextMonth,
      "aria-label": "Next month",
    },
    useRef<HTMLButtonElement>(null)
  );

  // Generate calendar grid
  const startOfMonth = new CalendarDate(
    currentMonth.year,
    currentMonth.month,
    1
  );
  const endOfMonth = new CalendarDate(
    currentMonth.year,
    currentMonth.month,
    currentMonth.calendar.getDaysInMonth(currentMonth)
  );

  // Get the start of the week for the first day of the month
  const firstDayOfWeek = startOfMonth.toDate(getLocalTimeZone()).getDay();
  const startDateGrid = startOfMonth.subtract({ days: firstDayOfWeek });

  // Get the end of the week for the last day of the month
  const lastDayOfWeek = endOfMonth.toDate(getLocalTimeZone()).getDay();
  const endDateGrid = endOfMonth.add({ days: 6 - lastDayOfWeek });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days: CalendarDate[] = [];

  let current = startDateGrid;
  while (current.compare(endDateGrid) <= 0) {
    days.push(current);
    current = current.add({ days: 1 });
  }

  const isInRange = (date: CalendarDate) => {
    if (!startDate || !endDate) return false;
    return date.compare(startDate) >= 0 && date.compare(endDate) <= 0;
  };

  const isRangeStart = (date: CalendarDate) => {
    return startDate?.compare(date) === 0;
  };

  const isRangeEnd = (date: CalendarDate) => {
    return endDate?.compare(date) === 0;
  };

  return (
    <div className="w-64">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          {...prevButtonProps}
          className="p-2 text-orange-300 hover:bg-orange-300/10 rounded transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center">
          <h2 className="font-sans font-medium text-orange-300 text-sm">
            {title}
          </h2>
          <div className="flex items-center gap-1 mt-1">
            <select
              value={currentMonth.month}
              onChange={(e) => {
                const newMonth = new CalendarDate(
                  currentMonth.year,
                  parseInt(e.target.value),
                  1
                );
                onMonthChange(newMonth);
              }}
              className="bg-black text-orange-300 border border-orange-300/50 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-1 focus:ring-offset-black"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2024, i).toLocaleDateString(undefined, {
                    month: "short",
                  })}
                </option>
              ))}
            </select>
            <select
              value={currentMonth.year}
              onChange={(e) => {
                const newMonth = new CalendarDate(
                  parseInt(e.target.value),
                  currentMonth.month,
                  1
                );
                onMonthChange(newMonth);
              }}
              className="bg-black text-orange-300 border border-orange-300/50 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-1 focus:ring-offset-black"
            >
              {Array.from({ length: 20 }, (_, i) => {
                const year = new Date().getFullYear() - 10 + i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
        <button
          {...nextButtonProps}
          className="p-2 text-orange-300 hover:bg-orange-300/10 rounded transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Week day headers */}
        {weekDays.map((day, index) => (
          <div
            key={index}
            className="text-center text-xs font-sans font-medium text-orange-300/80 py-2"
          >
            {day}
          </div>
        ))}

        {/* Calendar cells */}
        {days.map((date) => (
          <CalendarCell
            key={date.toString()}
            date={date}
            isSelected={isRangeStart(date) || isRangeEnd(date)}
            isInRange={isInRange(date)}
            isCurrentMonth={
              date.compare(startOfMonth) >= 0 && date.compare(endOfMonth) <= 0
            }
            onSelect={() => onDateSelect(date)}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Props for the CalendarCell component used in date range selection.
 * @interface CalendarCellProps
 */
interface CalendarCellProps {
  /** The date represented by this calendar cell */
  date: CalendarDate;
  /** Whether this date is currently selected (start or end of range) */
  isSelected: boolean;
  /** Whether this date falls within the selected range */
  isInRange: boolean;
  /** Whether this date belongs to the current month being displayed */
  isCurrentMonth: boolean;
  /** Callback function called when this date cell is selected */
  onSelect: () => void;
}

/**
 * Individual calendar cell component representing a single day with range selection states.
 *
 * The CalendarCell component renders a clickable date cell with:
 * - Different styling for selected dates (start/end of range)
 * - Visual indicators for dates within the selected range
 * - Different styling for current month vs other month dates
 * - Hover effects and focus management
 * - Proper accessibility attributes
 * - Smooth transitions and visual feedback
 *
 * @component
 * @param {CalendarCellProps} props - The props for the CalendarCell component
 * @returns {JSX.Element} A calendar cell component representing a single day with range states
 */
const CalendarCell: React.FC<CalendarCellProps> = ({
  date,
  isSelected,
  isInRange,
  isCurrentMonth,
  onSelect,
}) => {
  const { buttonProps } = useButton(
    {
      onPress: onSelect,
    },
    useRef<HTMLButtonElement>(null)
  );

  const cellClasses = `
    h-8 w-8 rounded text-sm font-sans
    focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-1 focus:ring-offset-black
    transition-all duration-200
    ${
      isSelected
        ? "bg-orange-300 text-black font-medium"
        : isInRange
        ? "bg-orange-300/20 text-orange-300"
        : isCurrentMonth
        ? "text-orange-300 hover:bg-orange-300/10"
        : "text-orange-300/30"
    }
    cursor-pointer
  `;

  return (
    <div className="text-center">
      <button {...buttonProps} className={cellClasses}>
        {date.day}
      </button>
    </div>
  );
};
