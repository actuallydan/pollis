import React from "react";

/**
 * Props for the RangeSlider component.
 * @interface RangeSliderProps
 */
interface RangeSliderProps {
  /** The label text displayed above the range slider */
  label: string;
  /** The current value of the range slider */
  value: number;
  /** Callback function called when the slider value changes */
  onChange: (value: number) => void;
  /** The minimum value of the range slider */
  min?: number;
  /** The maximum value of the range slider */
  max?: number;
  /** The step increment for the slider value */
  step?: number;
  /** Whether the range slider is disabled and cannot be interacted with */
  disabled?: boolean;
  /** Additional CSS classes to apply to the range slider container */
  className?: string;
  /** Unique identifier for the range slider input element */
  id?: string;
  /** Optional descriptive text displayed below the slider */
  description?: string;
}

/**
 * A customizable range slider component with visual feedback and accessibility features.
 *
 * The RangeSlider component provides a user-friendly interface for selecting numeric values:
 * - Visual range slider with custom styling and orange theme
 * - Real-time value display in the label
 * - Customizable min, max, and step values
 * - Visual progress indicator showing current value position
 * - Focus management with visible focus rings
 * - Disabled state handling with proper visual feedback
 * - Smooth transitions and hover effects
 * - Comprehensive accessibility features
 * - Responsive design with proper spacing and typography
 * - Cross-browser compatibility for slider thumb styling
 *
 * This component is ideal for settings, preferences, volume controls, and any
 * interface where users need to select a value within a defined range.
 *
 * @component
 * @param {RangeSliderProps} props - The props for the RangeSlider component
 * @param {string} props.label - The label text displayed above the range slider
 * @param {number} props.value - The current value of the range slider
 * @param {(value: number) => void} props.onChange - Callback function called when the slider value changes
 * @param {number} [props.min=0] - The minimum value of the range slider
 * @param {number} [props.max=100] - The maximum value of the range slider
 * @param {number} [props.step=1] - The step increment for the slider value
 * @param {boolean} [props.disabled=false] - Whether the range slider is disabled
 * @param {string} [props.className] - Additional CSS classes to apply to the container
 * @param {string} [props.id] - Unique identifier for the range slider input
 * @param {string} [props.description] - Optional descriptive text displayed below the slider
 *
 * @example
 * ```tsx
 * // Basic usage with default range (0-100)
 * <RangeSlider
 *   label="Volume"
 *   value={volume}
 *   onChange={setVolume}
 * />
 *
 * // Custom range with step increments
 * <RangeSlider
 *   label="Brightness"
 *   value={brightness}
 *   onChange={setBrightness}
 *   min={0}
 *   max={255}
 *   step={5}
 * />
 *
 * // With description and custom styling
 * <RangeSlider
 *   label="Temperature"
 *   value={temperature}
 *   onChange={setTemperature}
 *   min={-10}
 *   max={40}
 *   step={0.5}
 *   description="Set your preferred room temperature in Celsius"
 *   className="my-6"
 * />
 *
 * // Disabled state
 * <RangeSlider
 *   label="Sensitivity"
 *   value={sensitivity}
 *   onChange={setSensitivity}
 *   min={1}
 *   max={10}
 *   disabled={true}
 *   description="Sensitivity adjustment is currently unavailable"
 * />
 *
 * // Percentage slider
 * <RangeSlider
 *   label="Progress"
 *   value={progress}
 *   onChange={setProgress}
 *   min={0}
 *   max={100}
 *   step={1}
 *   description="Track your completion progress"
 * />
 *
 * // Audio controls
 * <div className="space-y-4">
 *   <RangeSlider
 *     label="Bass"
 *     value={bassLevel}
 *     onChange={setBassLevel}
 *     min={-20}
 *     max={20}
 *     step={1}
 *   />
 *   <RangeSlider
 *     label="Treble"
 *     value={trebleLevel}
 *     onChange={setTrebleLevel}
 *     min={-20}
 *     max={20}
 *     step={1}
 *   />
 * </div>
 * ```
 *
 * @returns {JSX.Element} A range slider component with visual feedback and value display
 */
export const RangeSlider: React.FC<RangeSliderProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className = "",
  id,
  description,
}) => {
  const inputId = id || `slider-${Math.random().toString(36).substring(2, 9)}`;
  const descriptionId = description ? `${inputId}-description` : undefined;

  const baseClasses = `
    relative w-full
  `;

  const labelClasses = `
    block text-sm font-sans font-medium text-orange-300 mb-2
  `;

  const sliderClasses = `
    w-full h-2 rounded-md appearance-none cursor-pointer
    bg-black border-2 border-orange-300/50
    focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-all duration-200
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-300 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-orange-300 [&::-webkit-slider-thumb]:cursor-pointer
    [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-orange-300 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-orange-300 [&::-moz-range-thumb]:cursor-pointer
  `;

  const descriptionClasses = `
    mt-1 text-sm font-sans text-orange-300/80
  `;

  const valueDisplayClasses = `
    inline-block ml-2 px-2 py-1 rounded-md
    bg-orange-300/10 border-2 border-orange-300/20
    text-base font-mono text-orange-300 tracking-wider font-bold
  `;

  return (
    <div className={`${baseClasses} ${className}`}>
      <label htmlFor={inputId} className={labelClasses}>
        {label}
        <span className={valueDisplayClasses}>{value}</span>
      </label>

      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        aria-describedby={descriptionId}
        className={sliderClasses}
        style={{
          background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${
            ((value - min) / (max - min)) * 100
          }%, transparent ${
            ((value - min) / (max - min)) * 100
          }%, transparent 100%)`,
        }}
      />

      {description && (
        <p id={descriptionId} className={descriptionClasses}>
          {description}
        </p>
      )}
    </div>
  );
};
