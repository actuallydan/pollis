import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Checkbox } from "./Checkbox";

/**
 * Represents a single option in the select dropdown.
 * @interface SelectOption
 */
interface SelectOption {
  /** The value of the option (used internally) */
  value: string;
  /** The display label for the option */
  label: string;
  /** Whether this option is disabled and cannot be selected */
  disabled?: boolean;
}

/**
 * Props for the Select component.
 * @interface SelectProps
 */
interface SelectProps {
  /** The label text displayed above the select input */
  label: string;
  /** The currently selected value(s) - string for single select, string[] for multiselect */
  value: string | string[];
  /** Callback function called when the selection changes */
  onChange: (value: string | string[]) => void;
  /** Array of options to display in the dropdown */
  options: SelectOption[];
  /** Placeholder text displayed when no option is selected */
  placeholder?: string;
  /** Optional descriptive text displayed below the select input */
  description?: string;
  /** Error message to display below the select input */
  error?: string;
  /** Whether the select input is disabled and cannot be interacted with */
  disabled?: boolean;
  /** Whether the select input is required (shows required indicator) */
  required?: boolean;
  /** Additional CSS classes to apply to the select container */
  className?: string;
  /** Whether to show a clear button to reset the selection */
  allowClear?: boolean;
  /** Whether to enable search functionality within the dropdown */
  searchable?: boolean;
  /** Whether to allow multiple selections */
  multiselect?: boolean;
  /** Unique identifier for the select input element */
  id?: string;
}

/**
 * A comprehensive select component with advanced features including search, multiselect, and accessibility.
 *
 * The Select component provides a powerful dropdown selection interface with:
 * - Single and multiple selection modes
 * - Searchable dropdown with real-time filtering
 * - Clear selection functionality
 * - Customizable options with disabled state support
 * - Keyboard navigation and accessibility features
 * - Error handling and validation states
 * - Required field indication
 * - Customizable styling and descriptions
 * - Responsive design with proper focus management
 * - Dropdown positioning and click-outside handling
 * - Visual feedback for selected states
 *
 * This component is ideal for forms, settings panels, and any interface where
 * users need to select from a list of options with advanced interaction features.
 *
 * @component
 * @param {SelectProps} props - The props for the Select component
 * @param {string} props.label - The label text displayed above the select input
 * @param {string | string[]} props.value - The currently selected value(s)
 * @param {(value: string | string[]) => void} props.onChange - Callback function called when selection changes
 * @param {SelectOption[]} props.options - Array of options to display in the dropdown
 * @param {string} [props.placeholder='Select an option...'] - Placeholder text when no option is selected
 * @param {string} [props.description] - Optional descriptive text displayed below the input
 * @param {string} [props.error] - Error message to display below the input
 * @param {boolean} [props.disabled=false] - Whether the select input is disabled
 * @param {boolean} [props.required=false] - Whether the select input is required
 * @param {string} [props.className] - Additional CSS classes to apply to the container
 * @param {boolean} [props.allowClear=false] - Whether to show a clear button
 * @param {boolean} [props.searchable=true] - Whether to enable search functionality
 * @param {boolean} [props.multiselect=false] - Whether to allow multiple selections
 * @param {string} [props.id] - Unique identifier for the select input
 *
 * @example
 * ```tsx
 * // Basic single select
 * <Select
 *   label="Country"
 *   value={selectedCountry}
 *   onChange={setSelectedCountry}
 *   options={countryOptions}
 * />
 *
 * // Multiselect with search and clear
 * <Select
 *   label="Skills"
 *   value={selectedSkills}
 *   onChange={setSelectedSkills}
 *   options={skillOptions}
 *   multiselect={true}
 *   searchable={true}
 *   allowClear={true}
 *   placeholder="Select your skills..."
 * />
 *
 * // With validation and description
 * <Select
 *   label="Category"
 *   value={selectedCategory}
 *   onChange={setSelectedCategory}
 *   options={categoryOptions}
 *   required={true}
 *   description="Please select a category for your content"
 *   error={categoryError}
 * />
 *
 * // Disabled state
 * <Select
 *   label="Theme"
 *   value={selectedTheme}
 *   onChange={setSelectedTheme}
 *   options={themeOptions}
 *   disabled={true}
 *   description="Theme selection is currently unavailable"
 * />
 *
 * // Custom options with disabled state
 * const options = [
 *   { value: 'basic', label: 'Basic Plan', disabled: false },
 *   { value: 'pro', label: 'Pro Plan', disabled: false },
 *   { value: 'enterprise', label: 'Enterprise Plan', disabled: true }
 * ];
 *
 * <Select
 *   label="Plan"
 *   value={selectedPlan}
 *   onChange={setSelectedPlan}
 *   options={options}
 *   description="Choose your subscription plan"
 * />
 * ```
 *
 * @returns {JSX.Element} A comprehensive select component with dropdown, search, and selection features
 */
export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  description,
  error,
  disabled = false,
  required = false,
  className = "",
  allowClear = false,
  searchable = true,
  multiselect = false,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOptions = multiselect
    ? options.filter((option) => (value as string[]).includes(option.value))
    : options.filter((option) => option.value === value);
  const selectedOption = selectedOptions[0];

  const filteredOptions =
    searchable && searchValue
      ? options.filter(
          (option) =>
            option.label.toLowerCase().includes(searchValue.toLowerCase()) &&
            !option.disabled
        )
      : options.filter((option) => !option.disabled);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchValue("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        setIsOpen(!isOpen);
        break;
      case "Escape":
        setIsOpen(false);
        setSearchValue("");
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        }
        break;
    }
  };

  const handleSelect = (option: SelectOption) => {
    if (!option.disabled) {
      if (multiselect) {
        const currentValues = value as string[];
        const newValues = currentValues.includes(option.value)
          ? currentValues.filter((v) => v !== option.value)
          : [...currentValues, option.value];
        onChange(newValues);
      } else {
        onChange(option.value);
        setIsOpen(false);
        setSearchValue("");
      }
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(multiselect ? [] : "");
    setIsOpen(false);
    setSearchValue("");
  };

  const baseClasses = `
    relative w-full
  `;

  const triggerClasses = `
    w-full px-4 py-2 rounded-md
    font-sans text-base
    bg-black text-orange-300
    border-2 border-orange-300/50
    focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-all duration-200
    flex items-center justify-between
    cursor-pointer
    ${isFocused ? "border-orange-300" : ""}
    ${error ? "border-red-400" : ""}
  `;

  const labelClasses = `
    block text-sm font-sans font-medium text-orange-300 mb-2
  `;

  const descriptionClasses = `
    mt-1 text-xs font-sans text-orange-300/80
  `;

  const errorClasses = `
    mt-1 text-xs font-sans text-red-400
  `;

  const dropdownClasses = `
    absolute top-full left-0 right-0 z-50 mt-1
    bg-black border-2 border-orange-300/50 rounded-md
    max-h-60 overflow-auto
    shadow-lg
  `;

  const optionClasses = `
    px-4 py-2 font-sans text-orange-300
    hover:bg-orange-300/10 cursor-pointer
    transition-colors duration-200
  `;

  const disabledOptionClasses = `
    px-4 py-2 font-sans text-orange-300/50
    cursor-not-allowed
  `;

  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  const descriptionId = description ? `${selectId}-description` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className={`${baseClasses} ${className}`}>
      <label htmlFor={selectId} className={labelClasses}>
        {label}
        {required && (
          <span className="text-red-400 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      <div ref={selectRef} className="relative">
        <div
          className={triggerClasses}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          tabIndex={disabled ? -1 : 0}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={isOpen ? `${selectId}-listbox` : undefined}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {multiselect ? (
              selectedOptions.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedOptions.map((option) => (
                    <span
                      key={option.value}
                      className="bg-orange-300/20 text-orange-300 px-2 py-1 rounded text-sm"
                    >
                      {option.label}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-orange-300/50 truncate">
                  {placeholder}
                </span>
              )
            ) : selectedOption ? (
              <span className="truncate">{selectedOption.label}</span>
            ) : (
              <span className="text-orange-300/50 truncate">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {allowClear &&
              ((multiselect && (value as string[]).length > 0) ||
                (!multiselect && value)) && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 hover:bg-orange-300/10 rounded transition-colors duration-200"
                  aria-label="Clear selection"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            {isOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>

        {isOpen && (
          <div
            className={dropdownClasses}
            id={`${selectId}-listbox`}
            role="listbox"
          >
            {searchable && (
              <div className="p-2 border-b border-orange-300/30">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search options..."
                  className="w-full px-3 py-1 bg-black text-orange-300 border border-orange-300/50 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
            )}

            <div className="py-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    className={
                      option.disabled ? disabledOptionClasses : optionClasses
                    }
                    onClick={() => handleSelect(option)}
                    role="option"
                    aria-selected={
                      multiselect
                        ? (value as string[]).includes(option.value)
                        : option.value === value
                    }
                  >
                    <div className="flex items-center gap-2">
                      {multiselect && (
                        <Checkbox
                          label=""
                          checked={(value as string[]).includes(option.value)}
                          onChange={() => handleSelect(option)}
                          disabled={option.disabled}
                          className="flex-shrink-0"
                        />
                      )}
                      <span className={multiselect ? "ml-2" : ""}>
                        {option.label}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-2 text-orange-300/50 font-sans text-sm">
                  No options found
                </div>
              )}
            </div>
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
