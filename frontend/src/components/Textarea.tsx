import React, { useState, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Props for the Textarea component.
 * @interface TextareaProps
 */
interface TextareaProps {
  /** The label text displayed above the textarea input */
  label: string;
  /** The current value of the textarea */
  value: string;
  /** Function called when the textarea value changes */
  onChange: (value: string) => void;
  /** Placeholder text displayed when the textarea is empty */
  placeholder?: string;
  /** Optional descriptive text displayed below the textarea */
  description?: string;
  /** Error message to display below the textarea */
  error?: string;
  /** Whether the textarea is disabled and cannot be interacted with */
  disabled?: boolean;
  /** Minimum number of rows to display (default: 3) */
  minRows?: number;
  /** Maximum number of rows to display (default: 10) */
  maxRows?: number;
  /** Additional CSS classes to apply to the textarea container */
  className?: string;
  /** Unique identifier for the textarea input element */
  id?: string;
}

/**
 * A dynamic textarea component with auto-resizing and enhanced visual feedback.
 *
 * The Textarea component provides a sophisticated text input interface with:
 * - Automatic height adjustment based on content
 * - Configurable minimum and maximum row constraints
 * - Visual focus indicator with animated chevron icon
 * - Comprehensive error handling and validation display
 * - Accessible label association and description support
 * - Disabled state handling with proper visual feedback
 * - Customizable styling with orange theme
 * - Smooth transitions and hover effects
 * - Automatic ID generation for accessibility
 * - ARIA attributes for screen reader support
 * - Responsive design with proper spacing and typography
 * - Professional appearance with consistent borders and focus states
 * - Placeholder text support for user guidance
 *
 * This component is ideal for forms, content editors, comment systems,
 * and any interface requiring multi-line text input with dynamic sizing.
 *
 * @component
 * @param {TextareaProps} props - The props for the Textarea component
 * @param {string} props.label - The label text displayed above the textarea input
 * @param {string} props.value - The current value of the textarea
 * @param {(value: string) => void} props.onChange - Function called when the textarea value changes
 * @param {string} [props.placeholder] - Placeholder text displayed when the textarea is empty
 * @param {string} [props.description] - Optional descriptive text displayed below the textarea
 * @param {string} [props.error] - Error message to display below the textarea
 * @param {boolean} [props.disabled=false] - Whether the textarea is disabled
 * @param {number} [props.minRows=3] - Minimum number of rows to display
 * @param {number} [props.maxRows=10] - Maximum number of rows to display
 * @param {string} [props.className] - Additional CSS classes to apply to the container
 * @param {string} [props.id] - Unique identifier for the textarea input
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Textarea
 *   label="Description"
 *   value={description}
 *   onChange={setDescription}
 *   placeholder="Enter your description here..."
 * />
 *
 * // With description and custom sizing
 * <Textarea
 *   label="Bio"
 *   value={bio}
 *   onChange={setBio}
 *   description="Tell us about yourself (optional)"
 *   minRows={4}
 *   maxRows={8}
 *   placeholder="Share your story..."
 * />
 *
 * // With validation error
 * <Textarea
 *   label="Review"
 *   value={review}
 *   onChange={setReview}
 *   error="Review must be at least 10 characters long"
 *   placeholder="Write your review..."
 * />
 *
 * // Disabled state
 * <Textarea
 *   label="Notes"
 *   value={notes}
 *   onChange={setNotes}
 *   disabled={true}
 *   description="Notes are currently read-only"
 * />
 *
 * // Comment form
 * <div className="space-y-4">
 *   <Textarea
 *     label="Comment"
 *     value={comment}
 *     onChange={setComment}
 *     placeholder="Share your thoughts..."
 *     minRows={3}
 *     maxRows={6}
 *     description="Be respectful and constructive"
 *   />
 *   <Button onClick={submitComment}>Post Comment</Button>
 * </div>
 *
 * // Content editor
 * <Textarea
 *   label="Article Content"
 *   value={content}
 *   onChange={setContent}
 *   placeholder="Start writing your article..."
 *   minRows={10}
 *   maxRows={20}
 *   className="my-6"
 *   description="Use markdown formatting for rich text"
 * />
 *
 * // With custom styling
 * <Textarea
 *   label="Custom Textarea"
 *   value={customValue}
 *   onChange={setCustomValue}
 *   className="border-2 border-blue-300 focus:ring-blue-300"
 *   placeholder="Custom styled textarea..."
 * />
 * ```
 *
 * @returns {JSX.Element} A dynamic textarea component with auto-resizing and enhanced visual feedback
 */
export const Textarea: React.FC<TextareaProps> = ({
  label,
  value,
  onChange,
  placeholder,
  description,
  error,
  disabled = false,
  minRows = 3,
  maxRows = 10,
  className = "",
  id,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const lineHeight = parseInt(
        getComputedStyle(textareaRef.current).lineHeight
      );
      const minHeight = lineHeight * minRows;
      const maxHeight = maxRows ? lineHeight * maxRows : scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [value, minRows, maxRows]);

  const baseClasses = `
    relative w-full
  `;

  const textareaClasses = `
    w-full px-4 py-2 rounded-md resize-none
    font-sans text-base
    bg-black text-orange-300
    border-2 border-orange-300/50
    placeholder-orange-300/50
    focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-all duration-200
    ${isFocused ? "pl-6" : ""}
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

  return (
    <div className={`${baseClasses} ${className}`}>
      <label className={labelClasses}>{label}</label>

      <div className="relative">
        {isFocused && !disabled && (
          <ChevronRight className="absolute left-2 top-2 text-orange-300 w-4 h-4" />
        )}

        <textarea
          ref={textareaRef}
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          aria-describedby={
            [descriptionId, errorId].filter(Boolean).join(" ") || undefined
          }
          aria-invalid={!!error}
          className={textareaClasses}
          rows={minRows}
        />
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
