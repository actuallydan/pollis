import React, { useEffect, useRef } from "react";

interface DotMatrixProps {
  /** Width of the dot matrix in dots */
  width?: number;
  /** Height of the dot matrix in dots */
  height?: number;
  /** Size of each dot in pixels */
  dotSize?: number;
  /** Spacing between dots in pixels */
  spacing?: number;
  /** Animation speed multiplier (higher = faster) */
  speed?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Animated dot matrix component with terminal-style aesthetic
 * Creates a grid of dots with varying opacity that animates smoothly
 * Optimized for performance using requestAnimationFrame
 */
export const DotMatrix: React.FC<DotMatrixProps> = ({
  width = 60,
  height = 30,
  dotSize = 3,
  spacing = 5,
  speed = 1,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const phasesRef = useRef<number[][]>([]);
  const timeRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize phases dynamically - will be resized as needed
  const ensurePhasesSize = (rows: number, cols: number) => {
    // Expand phases array if needed
    while (phasesRef.current.length < rows) {
      phasesRef.current.push([]);
    }

    for (let y = 0; y < rows; y++) {
      if (!phasesRef.current[y]) {
        phasesRef.current[y] = [];
      }
      while (phasesRef.current[y].length < cols) {
        phasesRef.current[y].push(Math.random() * Math.PI * 2);
      }
    }
  };

  // Setup canvas and animation
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Get device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;

    // Calculate dimensions and setup canvas
    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      const displayWidth = Math.max(rect.width, 100);
      const displayHeight = Math.max(rect.height, 100);

      // Set actual canvas size accounting for device pixel ratio
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;

      // Reset transform and scale context to match device pixel ratio
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      // Set CSS size to match display size
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
    };

    updateCanvasSize();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });
    resizeObserver.observe(container);

    // Animation loop using requestAnimationFrame for smooth performance
    const animate = (timestamp: number) => {
      if (timeRef.current === 0) {
        timeRef.current = timestamp;
      }

      const deltaTime = timestamp - timeRef.current;
      timeRef.current = timestamp;

      // Get container dimensions
      const containerWidth = Math.max(container.clientWidth, 100);
      const containerHeight = Math.max(container.clientHeight, 100);

      // Clear canvas
      ctx.clearRect(0, 0, containerWidth, containerHeight);

      // Calculate dot dimensions - larger dots for terminal pixel look
      // Fixed size dots with minimal spacing for grid-like appearance
      const calculatedDotSize = 6; // Larger dots like terminal pixels
      const calculatedSpacing = 2; // Minimal spacing for grid effect
      const totalDotWidth = calculatedDotSize + calculatedSpacing;

      // Calculate grid dimensions dynamically based on container size
      // No limits - fully responsive
      const cols = Math.floor(containerWidth / totalDotWidth);
      const rows = Math.floor(containerHeight / totalDotWidth);

      // Ensure phases array is large enough
      ensurePhasesSize(rows, cols);

      // Center the grid
      const offsetX =
        (containerWidth - (cols * totalDotWidth - calculatedSpacing)) / 2;
      const offsetY =
        (containerHeight - (rows * totalDotWidth - calculatedSpacing)) / 2;

      // Animation speed: faster animation
      const phaseIncrement = (deltaTime / 1000) * speed * 1.0;

      // Draw dots with animated opacity
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          // Get and update phase for this dot
          let currentPhase = phasesRef.current[y][x];
          if (currentPhase === undefined) {
            currentPhase = Math.random() * Math.PI * 2;
            phasesRef.current[y][x] = currentPhase;
          }

          // Update phase
          currentPhase += phaseIncrement;
          // Wrap around to prevent overflow
          if (currentPhase > Math.PI * 2) {
            currentPhase -= Math.PI * 2;
          }
          phasesRef.current[y][x] = currentPhase;

          // Calculate opacity using sine wave for smooth pulsing
          // Range: 0.1 to 0.5 for more visible animation
          const opacity = 0.2 + Math.sin(currentPhase) * 0.3;

          const posX = offsetX + x * totalDotWidth + calculatedDotSize / 2;
          const posY = offsetY + y * totalDotWidth + calculatedDotSize / 2;

          // Use orange-300 color with animated opacity
          // Draw as square/rounded square for terminal pixel look
          ctx.fillStyle = `rgba(253, 186, 116, ${opacity})`;
          ctx.fillRect(
            posX - calculatedDotSize / 2,
            posY - calculatedDotSize / 2,
            calculatedDotSize,
            calculatedDotSize
          );
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      resizeObserver.disconnect();
      timeRef.current = 0;
    };
  }, [width, height, dotSize, spacing, speed]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          imageRendering: "crisp-edges",
          display: "block",
        }}
      />
    </div>
  );
};
