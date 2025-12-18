import React, { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";

/**
 * Props for the InlineAudioPlayer component.
 * @interface InlineAudioPlayerProps
 */
interface InlineAudioPlayerProps {
  /** The source URL of the audio file to play */
  src: string;
  /** Optional title to display next to the play button */
  title?: string;
  /** Additional CSS classes to apply to the audio player container */
  className?: string;
  /** Whether the audio should start playing automatically when loaded */
  autoPlay?: boolean;
}

/**
 * A compact, inline audio player component for embedded audio playback.
 *
 * The InlineAudioPlayer component provides a streamlined audio interface designed for
 * inline use within content, featuring:
 * - Compact horizontal layout with play/pause button
 * - Progress bar with seek functionality
 * - Time display showing current position and total duration
 * - Optional title display for audio identification
 * - Loading states and proper error handling
 * - Keyboard navigation and accessibility features
 * - Responsive design that fits within text content
 * - Smooth transitions and hover effects
 *
 * This component is ideal for embedding audio content within articles, blog posts,
 * or any content where a full-featured audio player would be too large.
 *
 * @component
 * @param {InlineAudioPlayerProps} props - The props for the InlineAudioPlayer component
 * @param {string} props.src - The source URL of the audio file to play
 * @param {string} [props.title] - Optional title to display next to the play button
 * @param {string} [props.className] - Additional CSS classes to apply to the container
 * @param {boolean} [props.autoPlay=false] - Whether the audio should start playing automatically
 *
 * @example
 * ```tsx
 * // Basic usage
 * <InlineAudioPlayer src="/audio/podcast-episode.mp3" />
 *
 * // With title and auto-play
 * <InlineAudioPlayer
 *   src="/audio/background-music.mp3"
 *   title="Background Music"
 *   autoPlay={true}
 * />
 *
 * // With custom styling
 * <InlineAudioPlayer
 *   src="/audio/sound-effect.mp3"
 *   title="Sound Effect"
 *   className="my-4 border-2 border-orange-300/50"
 * />
 *
 * // Embedded in content
 * <p>
 *   Listen to this audio clip:
 *   <InlineAudioPlayer
 *     src="/audio/quote.mp3"
 *     title="Quote from John Doe"
 *   />
 *   The audio provides additional context for the discussion.
 * </p>
 * ```
 *
 * @returns {JSX.Element} A compact inline audio player with play controls and progress bar
 */
export const InlineAudioPlayer: React.FC<InlineAudioPlayerProps> = ({
  src,
  title,
  className = "",
  autoPlay = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const baseClasses = `
    flex items-center gap-3 p-2 border border-orange-300/30 rounded-md bg-black
    ${className}
  `;

  const buttonClasses = `
    p-1 text-orange-300 hover:bg-orange-300/10 rounded transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const sliderClasses = `
    flex-1 h-1 bg-orange-300/20 rounded appearance-none cursor-pointer
    focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
    [&::-webkit-slider-thumb]:bg-orange-300 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
    [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-orange-300
    [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer
  `;

  return (
    <div className={baseClasses}>
      <audio ref={audioRef} src={src} autoPlay={autoPlay} />

      <button
        onClick={togglePlay}
        disabled={isLoading}
        className={buttonClasses}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>

      {title && (
        <span className="font-sans text-orange-300 text-sm truncate min-w-0">
          {title}
        </span>
      )}

      <input
        type="range"
        min={0}
        max={duration || 0}
        value={currentTime}
        onChange={handleSeek}
        className={sliderClasses}
        disabled={isLoading}
        aria-label="Seek audio"
      />

      <span className="font-sans text-orange-300/80 text-xs whitespace-nowrap">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
};
