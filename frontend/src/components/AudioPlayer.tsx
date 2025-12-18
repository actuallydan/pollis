import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
} from "lucide-react";

/**
 * Props for the AudioPlayer component.
 * @interface AudioPlayerProps
 */
interface AudioPlayerProps {
  /** The source URL of the audio file to play */
  src: string;
  /** Optional title to display above the audio player */
  title?: string;
  /** Additional CSS classes to apply to the audio player container */
  className?: string;
  /** Whether the audio should start playing automatically when loaded */
  autoPlay?: boolean;
  /** Whether the audio should loop when it reaches the end */
  loop?: boolean;
  /** How the audio should be preloaded: 'none', 'metadata', or 'auto' */
  preload?: "none" | "metadata" | "auto";
}

/**
 * A comprehensive audio player component with full playback controls and visual feedback.
 *
 * The AudioPlayer component provides a complete audio playback experience including:
 * - Play/pause functionality with visual state indication
 * - Progress bar with seek capability
 * - Volume control with mute toggle
 * - Skip forward/backward buttons (10 seconds)
 * - Time display showing current position and total duration
 * - Loading states and accessibility features
 * - Customizable styling through className prop
 *
 * @component
 * @param {AudioPlayerProps} props - The props for the AudioPlayer component
 * @param {string} props.src - The source URL of the audio file to play
 * @param {string} [props.title] - Optional title to display above the audio player
 * @param {string} [props.className] - Additional CSS classes to apply to the audio player container
 * @param {boolean} [props.autoPlay=false] - Whether the audio should start playing automatically when loaded
 * @param {boolean} [props.loop=false] - Whether the audio should loop when it reaches the end
 * @param {'none' | 'metadata' | 'auto'} [props.preload='metadata'] - How the audio should be preloaded
 *
 * @example
 * ```tsx
 * // Basic usage
 * <AudioPlayer src="/audio/song.mp3" />
 *
 * // With title and custom styling
 * <AudioPlayer
 *   src="/audio/podcast.mp3"
 *   title="Weekly Tech News"
 *   className="my-custom-class"
 *   autoPlay={false}
 *   loop={true}
 *   preload="auto"
 * />
 * ```
 *
 * @returns {JSX.Element} A fully functional audio player with controls and visual feedback
 */
export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  title,
  className = "",
  autoPlay = false,
  loop = false,
  preload = "metadata",
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    audioRef.current.volume = newVolume;
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const skipBackward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, currentTime - 10);
  };

  const skipForward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.min(duration, currentTime + 10);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const baseClasses = `
    w-full p-4 border-2 border-orange-300/50 rounded-md bg-black
    ${className}
  `;

  const buttonClasses = `
    p-2 text-orange-300 hover:bg-orange-300/10 rounded transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const sliderClasses = `
    w-full h-2 bg-orange-300/20 rounded-lg appearance-none cursor-pointer
    focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
    [&::-webkit-slider-thumb]:bg-orange-300 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
    [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-orange-300
    [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer
  `;

  return (
    <div className={baseClasses}>
      <audio
        ref={audioRef}
        src={src}
        autoPlay={autoPlay}
        loop={loop}
        preload={preload}
      />

      {title && (
        <div className="mb-3">
          <h3 className="font-sans font-medium text-orange-300 text-sm truncate">
            {title}
          </h3>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-4">
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
        <div className="flex justify-between text-xs text-orange-300/80 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={skipBackward}
            disabled={isLoading}
            className={buttonClasses}
            aria-label="Skip backward 10 seconds"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            disabled={isLoading}
            className={`${buttonClasses} p-3`}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={skipForward}
            disabled={isLoading}
            className={buttonClasses}
            aria-label="Skip forward 10 seconds"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            disabled={isLoading}
            className={buttonClasses}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className={`${sliderClasses} w-20`}
            disabled={isLoading}
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
};
