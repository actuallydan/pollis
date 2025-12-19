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
 * Props for the DatePicker component.
 * @interface DatePickerProps
 */
interface DatePickerProps {
  /** The label text displayed above the date picker input */
  label: string;
  /** The currently selected date value */
  value?: Date;
  /** Callback function called when a date is selected or cleared */
  onChange?: (date: Date | null) => void;
  /** Placeholder text displayed when no date is selected */
  placeholder?: string;
  /** Optional descriptive text displayed below the input */
  description?: string;
  /** Error message to display below the input */
  error?: string;
  /** Whether the date picker is disabled and cannot be interacted with */
  disabled?: boolean;
  /** Whether the date picker is required (shows required indicator) */
  required?: boolean;
  /** Additional CSS classes to apply to the date picker container */
  className?: string;
  /** Unique identifier for the date picker input element */
  id?: string;
}

/**
 * A comprehensive date picker component with calendar overlay and accessibility features.
 *
 * The DatePicker component provides a user-friendly interface for selecting dates:
 * - Input field with calendar icon that opens a calendar overlay
 * - Full calendar grid with month/year navigation
 * - Keyboard navigation and screen reader support
 * - Error handling and validation states
 * - Required field indication
 * - Customizable styling and descriptions
 * - Responsive design with proper focus management
 *
 * @component
 * @param {DatePickerProps} props - The props for the DatePicker component
 * @param {string} props.label - The label text displayed above the date picker input
 * @param {Date} [props.value] - The currently selected date value
 * @param {(date: Date | null) => void} [props.onChange] - Callback function called when a date is selected
 * @param {string} [props.placeholder='Select a date...'] - Placeholder text displayed when no date is selected
 * @param {string} [props.description] - Optional descriptive text displayed below the input
 * @param {string} [props.error] - Error message to display below the input
 * @param {boolean} [props.disabled=false] - Whether the date picker is disabled
 * @param {boolean} [props.required=false] - Whether the date picker is required
 * @param {string} [props.className] - Additional CSS classes to apply to the container
 * @param {string} [props.id] - Unique identifier for the date picker input
 *
 * @example
 * ```tsx
 * // Basic usage
 * <DatePicker
 *   label="Select Date"
 *   value={selectedDate}
 *   onChange={setSelectedDate}
 * />
 *
 * // With validation and description
 * <DatePicker
 *   label="Birth Date"
 *   value={birthDate}
 *   onChange={setBirthDate}
 *   description="Please select your date of birth"
 *   required={true}
 *   error={birthDateError}
 * />
 *
 * // Disabled state
 * <DatePicker
 *   label="Event Date"
 *   value={eventDate}
 *   onChange={setEventDate}
 *   disabled={true}
 *   description="Date selection is currently disabled"
 * />
 * ```
 *
 * @returns {JSX.Element} A date picker component with calendar overlay and input field
 */
export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = "Select a date...",
  description,
  error,
  disabled = false,
  required = false,
  className = "",
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<CalendarDate | null>(
    value ? parseDate(value.toISOString().split("T")[0]) : null
  );
  const [inputValue, setInputValue] = useState<string>(
    value
      ? value.toLocaleDateString()
      : ""
  );
  const [currentMonth, setCurrentMonth] = useState<CalendarDate>(
    selectedDate || today(getLocalTimeZone())
  );

  const overlayRef = useRef<HTMLDivElement>(null);

  // Sync input value when value prop changes externally
  useEffect(() => {
    if (value) {
      const dateString = value.toLocaleDateString();
      setInputValue(dateString);
      const parsed = parseDate(value.toISOString().split("T")[0]);
      setSelectedDate(parsed);
      setCurrentMonth(parsed);
    } else if (value === null) {
      setInputValue("");
      setSelectedDate(null);
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
    
    const parsedDate = parseDateFromText(text);
    if (parsedDate) {
      setSelectedDate(parsedDate);
      onChange?.(parsedDate.toDate(getLocalTimeZone()));
      setCurrentMonth(parsedDate);
    }
    // If invalid, keep the last valid state (don't update selectedDate)
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
    // Allow date separators: /, -, .
    if (e.key === '/' || e.key === '-' || e.key === '.') {
      return;
    }
    // Block everything else
    e.preventDefault();
  };

  const handleDateSelect = (date: CalendarDate) => {
    setSelectedDate(date);
    const dateString = date.toDate(getLocalTimeZone()).toLocaleDateString();
    setInputValue(dateString);
    onChange?.(date.toDate(getLocalTimeZone()));
    setIsOpen(false);
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

  const datePickerId =
    id || `datepicker-${Math.random().toString(36).substr(2, 9)}`;
  const descriptionId = description ? `${datePickerId}-description` : undefined;
  const errorId = error ? `${datePickerId}-error` : undefined;

  return (
    <div className={`${baseClasses} ${className}`}>
      <label htmlFor={datePickerId} className={labelClasses}>
        {label}
        {required && (
          <span className="text-red-400 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      <div className="relative">
        <input
          id={datePickerId}
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
          aria-label="Select date"
        />

        {isOpen && (
          <div {...overlayProps} ref={overlayRef} className={overlayClasses}>
            <DismissButton onDismiss={() => setIsOpen(false)} />
            <CalendarGrid
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              onPreviousMonth={handlePreviousMonth}
              onNextMonth={handleNextMonth}
              onMonthChange={setCurrentMonth}
            />
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
 * Props for the CalendarGrid component.
 * @interface CalendarGridProps
 */
interface CalendarGridProps {
  /** The currently displayed month in the calendar */
  currentMonth: CalendarDate;
  /** The currently selected date */
  selectedDate: CalendarDate | null;
  /** Callback function called when a date is selected */
  onDateSelect: (date: CalendarDate) => void;
  /** Callback function called when navigating to the previous month */
  onPreviousMonth: () => void;
  /** Callback function called when navigating to the next month */
  onNextMonth: () => void;
  /** Callback function called when the month is changed via dropdown */
  onMonthChange: (month: CalendarDate) => void;
}

/**
 * Calendar grid component that displays a month view with navigation controls.
 *
 * The CalendarGrid component renders a full month calendar with:
 * - Month/year navigation with previous/next buttons
 * - Month and year dropdown selectors
 * - Week day headers
 * - Calendar cells for each day
 * - Proper date calculations and grid layout
 *
 * @component
 * @param {CalendarGridProps} props - The props for the CalendarGrid component
 * @returns {JSX.Element} A calendar grid component with month navigation and day cells
 */
const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentMonth,
  selectedDate,
  onDateSelect,
  onPreviousMonth,
  onNextMonth,
  onMonthChange,
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
  const startDate = startOfMonth.subtract({ days: firstDayOfWeek });

  // Get the end of the week for the last day of the month
  const lastDayOfWeek = endOfMonth.toDate(getLocalTimeZone()).getDay();
  const endDate = endOfMonth.add({ days: 6 - lastDayOfWeek });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days: CalendarDate[] = [];

  let current = startDate;
  while (current.compare(endDate) <= 0) {
    days.push(current);
    current = current.add({ days: 1 });
  }

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
        <div className="flex items-center gap-2">
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
            className="bg-black text-orange-300 border border-orange-300/50 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-1 focus:ring-offset-black"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2024, i).toLocaleDateString(undefined, {
                  month: "long",
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
            className="bg-black text-orange-300 border border-orange-300/50 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-1 focus:ring-offset-black"
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
            isSelected={selectedDate?.compare(date) === 0}
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
 * Props for the CalendarCell component.
 * @interface CalendarCellProps
 */
interface CalendarCellProps {
  /** The date represented by this calendar cell */
  date: CalendarDate;
  /** Whether this date is currently selected */
  isSelected: boolean;
  /** Whether this date belongs to the current month being displayed */
  isCurrentMonth: boolean;
  /** Callback function called when this date cell is selected */
  onSelect: () => void;
}

/**
 * Individual calendar cell component representing a single day.
 *
 * The CalendarCell component renders a clickable date cell with:
 * - Different styling for selected, current month, and other month dates
 * - Hover effects and focus management
 * - Proper accessibility attributes
 * - Smooth transitions and visual feedback
 *
 * @component
 * @param {CalendarCellProps} props - The props for the CalendarCell component
 * @returns {JSX.Element} A calendar cell component representing a single day
 */
const CalendarCell: React.FC<CalendarCellProps> = ({
  date,
  isSelected,
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
