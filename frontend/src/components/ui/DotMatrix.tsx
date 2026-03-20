import React, { useEffect, useRef, useMemo } from "react";

// ─── Algorithm types ──────────────────────────────────────────────────────────

interface Cell {
  opacity: number;
  data?: Record<string, unknown>;
}

interface AlgorithmContext {
  time: number;
  deltaTime: number;
  cols: number;
  rows: number;
  mouse: { x: number; y: number } | null;
}

export type DotMatrixAlgorithm = (grid: Cell[][], ctx: AlgorithmContext) => Cell[][];

// ─── Algorithms ───────────────────────────────────────────────────────────────

export const pulsingWaveAlgorithm: DotMatrixAlgorithm = (grid, { deltaTime }) =>
  grid.map((row) =>
    row.map((cell) => {
      const phase = ((cell.data?.phase as number | undefined) ?? Math.random() * Math.PI * 2) + deltaTime;
      return { opacity: 0.15 + Math.sin(phase) * 0.2, data: { phase: phase % (Math.PI * 2) } };
    })
  );

export const gameOfLifeAlgorithm: DotMatrixAlgorithm = (grid, { rows, cols, time, deltaTime }) => {
  if (time < 0.05) {
    return grid.map((row) =>
      row.map(() => {
        const alive = Math.random() > 0.7;
        return { opacity: alive ? 0.55 : 0, data: { alive } };
      })
    );
  }

  const updateInterval = 0.12;
  const shouldUpdate = Math.floor(time / updateInterval) !== Math.floor((time - deltaTime) / updateInterval);
  if (!shouldUpdate) {
    return grid;
  }

  return grid.map((row, y) =>
    row.map((cell, x) => {
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) { continue; }
          const ny = (y + dy + rows) % rows;
          const nx = (x + dx + cols) % cols;
          if (grid[ny][nx].data?.alive) { neighbors++; }
        }
      }
      const alive = cell.data?.alive as boolean | undefined;
      const newAlive = alive ? (neighbors === 2 || neighbors === 3) : neighbors === 3;
      return { opacity: newAlive ? 0.55 : 0, data: { alive: newAlive } };
    })
  );
};

export const mouseRippleAlgorithm: DotMatrixAlgorithm = (grid, { mouse, deltaTime }) =>
  grid.map((row, y) =>
    row.map((cell, x) => {
      let newOpacity = Math.max(0, ((cell.data?.rippleOpacity as number | undefined) ?? 0) - deltaTime * 1.5);
      if (mouse) {
        const cellSize = 9;
        const dx = x - Math.floor(mouse.x / cellSize);
        const dy = y - Math.floor(mouse.y / cellSize);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 12) { newOpacity = Math.max(newOpacity, (1 - dist / 12) * 0.6); }
      }
      return { opacity: newOpacity, data: { rippleOpacity: newOpacity } };
    })
  );

export const flowingWaveAlgorithm: DotMatrixAlgorithm = (grid, { time, cols, rows }) =>
  grid.map((row, y) =>
    row.map((_cell, x) => {
      const wx = Math.sin((x / cols) * Math.PI * 3 + time * 1.2) * 0.5 + 0.5;
      const wy = Math.cos((y / rows) * Math.PI * 3 + time * 0.8) * 0.5 + 0.5;
      return { opacity: ((wx + wy) / 2) * 0.45 };
    })
  );

export const ALL_ALGORITHMS: DotMatrixAlgorithm[] = [
  pulsingWaveAlgorithm,
  gameOfLifeAlgorithm,
  mouseRippleAlgorithm,
  flowingWaveAlgorithm,
];

// ─── Component ────────────────────────────────────────────────────────────────

interface DotMatrixProps {
  algorithm?: DotMatrixAlgorithm;
  dotSize?: number;
  spacing?: number;
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const DotMatrix: React.FC<DotMatrixProps> = ({
  algorithm,
  dotSize = 6,
  spacing = 6,
  speed = 0.4,
  className = "",
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    grid: [] as Cell[][],
    lastTime: 0,
    startTime: 0,
    mouse: null as { x: number; y: number } | null,
    rafId: 0,
  });

  // Pick a random algorithm once on mount if none provided
  const resolvedAlgorithm = useMemo(
    () => algorithm ?? ALL_ALGORITHMS[Math.floor(Math.random() * ALL_ALGORITHMS.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) { return; }

    const ctx = canvas.getContext("2d");
    if (!ctx) { return; }

    const state = stateRef.current;
    const step = dotSize + spacing;

    const initGrid = (cols: number, rows: number) => {
      state.grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({ opacity: 0 }))
      );
    };

    const resizeCanvas = () => {
      const { width, height } = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.floor(width / step);
      const rows = Math.floor(height / step);
      initGrid(cols, rows);
    };

    const draw = () => {
      const { width, height } = container.getBoundingClientRect();
      const cols = Math.floor(width / step);
      const rows = Math.floor(height / step);
      const offsetX = (width - cols * step) / 2;
      const offsetY = (height - rows * step) / 2;

      // Get current accent color from CSS vars for dot color
      const style = getComputedStyle(document.documentElement);
      const h = style.getPropertyValue("--accent-h").trim() || "38";
      const s = style.getPropertyValue("--accent-s").trim() || "90%";

      ctx.clearRect(0, 0, width, height);
      for (let y = 0; y < rows && y < state.grid.length; y++) {
        for (let x = 0; x < cols && x < (state.grid[y]?.length ?? 0); x++) {
          const op = Math.max(0, Math.min(1, state.grid[y][x].opacity));
          if (op < 0.02) { continue; }
          ctx.fillStyle = `hsl(${h} ${s} 62% / ${op})`;
          ctx.fillRect(offsetX + x * step, offsetY + y * step, dotSize, dotSize);
        }
      }
    };

    const animate = (ts: number) => {
      const { width, height } = container.getBoundingClientRect();
      const cols = Math.floor(width / step);
      const rows = Math.floor(height / step);

      // If the container has no size yet, spin until it does — then reinitialise
      // so time-gated algorithms (e.g. gameOfLife) get a clean start.
      if (cols === 0 || rows === 0) {
        state.rafId = requestAnimationFrame(animate);
        return;
      }

      if (state.startTime === 0) {
        // First frame with real dimensions: size the canvas and reset timing
        resizeCanvas();
        state.startTime = ts;
        state.lastTime = ts;
      }

      const dt = Math.min((ts - state.lastTime) / 1000, 0.1) * speed;
      const t = (ts - state.startTime) / 1000;
      state.lastTime = ts;

      // Grow grid if the window got bigger
      while (state.grid.length < rows) {
        state.grid.push(Array.from({ length: cols }, () => ({ opacity: 0 })));
      }
      for (const row of state.grid) {
        while (row.length < cols) { row.push({ opacity: 0 }); }
      }

      state.grid = resolvedAlgorithm(state.grid, { time: t, deltaTime: dt, cols, rows, mouse: state.mouse });
      draw();
      state.rafId = requestAnimationFrame(animate);
    };

    // Don't call resizeCanvas() here — animate() handles first-frame init
    // after the element has real dimensions.

    const ro = new ResizeObserver(() => {
      resizeCanvas();
      // Reset startTime so algorithms get a fresh t=0 after resize
      state.startTime = 0;
    });
    ro.observe(container);

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      state.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onMouseLeave = () => { state.mouse = null; };
    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);

    state.startTime = 0;
    state.rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(state.rafId);
      ro.disconnect();
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [resolvedAlgorithm, dotSize, spacing, speed]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0, imageRendering: "pixelated" }}
      />
    </div>
  );
};
