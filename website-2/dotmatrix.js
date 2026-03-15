/**
 * Pure JavaScript implementation of an animated dot matrix
 * Supports customizable algorithms and direct DOM integration
 */
const pulsingWaveAlgorithm = (grid, context) => {
  const { deltaTime, rows, cols } = context;
  const phaseIncrement = deltaTime;
  
  return grid.map((row, y) =>
    row.map((cell, x) => {
      if (cell.data?.phase === undefined) {
        cell.data = { phase: Math.random() * Math.PI * 2 };
      }
      
      let phase = cell.data.phase + phaseIncrement;
      if (phase > Math.PI * 2) phase -= Math.PI * 2;
      
      const opacity = 0.2 + Math.sin(phase) * 0.3;
      return { opacity, data: { phase } };
    })
  );
};

const gameOfLifeAlgorithm = (grid, context) => {
  const { rows, cols, time } = context;
  
  if (time < 0.1) {
    return grid.map((row) =>
      row.map(() => ({
        opacity: Math.random() > 0.7 ? 1 : 0,
        data: { alive: Math.random() > 0.7 },
      }))
    );
  }
  
  const updateInterval = 0.1;
  const shouldUpdate = Math.floor(time / updateInterval) !== Math.floor((time - context.deltaTime) / updateInterval);
  
  if (!shouldUpdate) return grid;
  
  return grid.map((row, y) =>
    row.map((cell, x) => {
      let neighbors = 0;
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const ny = (y + dy + rows) % rows;
          const nx = (x + dx + cols) % cols;
          
          if (grid[ny][nx].data?.alive) neighbors++;
        }
      }
      
      const alive = cell.data?.alive;
      const newAlive = alive ? neighbors === 2 || neighbors === 3 : neighbors === 3;
      
      return { opacity: newAlive ? 1 : 0, data: { alive: newAlive } };
    })
  );
};

const mouseRippleAlgorithm = (grid, context) => {
  const { mouse, cols, rows, deltaTime } = context;
  
  return grid.map((row, y) =>
    row.map((cell, x) => {
      let newOpacity = Math.max(0, cell.data?.rippleOpacity || 0 - deltaTime * 2);
      
      if (mouse) {
        const cellWidth = 8; // dotSize + spacing
        const mouseGridX = Math.floor(mouse.x / cellWidth);
        const mouseGridY = Math.floor(mouse.y / cellWidth);
        
        const dx = x - mouseGridX;
        const dy = y - mouseGridY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 10) {
          newOpacity = Math.max(newOpacity, 1 - distance / 10);
        }
      }
      
      return { opacity: newOpacity, data: { rippleOpacity: newOpacity } };
    })
  );
};

const flowingWaveAlgorithm = (grid, context) => {
  const { time, cols, rows } = context;
  
  return grid.map((row, y) =>
    row.map((cell, x) => {
      const waveX = Math.sin((x / cols) * Math.PI * 2 + time * 2) * 0.5 + 0.5;
      const waveY = Math.cos((y / rows) * Math.PI * 2 + time * 2) * 0.5 + 0.5;
      const opacity = (waveX + waveY) / 2;
      
      return { opacity };
    })
  );
};

/**
 * Creates an animated dot matrix component
 * @param {Object} options - Configuration options
 * @param {Function} options.algorithm - Grid algorithm to use
 * @param {number} [options.dotSize=6] - Size of each dot in pixels
 * @param {number} [options.spacing=2] - Spacing between dots in pixels
 * @param {string} [options.defaultColor="253, 186, 116"] - Default color (RGB)
 * @param {number} [options.speed=1.0] - Animation speed multiplier
 * @param {string} [options.className=""] - Container class name
 * @returns {Object} - { element: DOM element, stop: function to stop animation }
 */
function createDotMatrix (options) {
  // Default options
  const {
    algorithm,
    dotSize = 6,
    spacing = 2,
    defaultColor = "253, 186, 116",
    speed = 1.0,
    className = "",
  } = options;

  // Create container element
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.overflow = 'hidden';
  container.style.zIndex = '1000';
  container.className = className;

  // Create canvas element
  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.imageRendering = 'crisp-edges';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  // Animation state
  let grid = [];
  let lastTime = 0;
  let startTime = 0;
  let mouse = null;
  let animationFrameId = null;

  // Initialize grid with container dimensions
  const initializeGrid = () => {
    const containerRect = container.getBoundingClientRect();
    const containerWidth = Math.max(containerRect.width, 100);
    const containerHeight = Math.max(containerRect.height, 100);
    
    const totalDotWidth = dotSize + spacing;
    const cols = Math.floor(containerWidth / totalDotWidth);
    const rows = Math.floor(containerHeight / totalDotWidth);
    
    grid = [];
    for (let y = 0; y < rows; y++) {
      grid[y] = [];
      for (let x = 0; x < cols; x++) {
        grid[y][x] = { opacity: 0, color: defaultColor, data: null };
      }
    }
  };

  // Draw grid to canvas
  const drawGrid = () => {
    const containerRect = container.getBoundingClientRect();
    const containerWidth = Math.max(containerRect.width, 100);
    const containerHeight = Math.max(containerRect.height, 100);
    const totalDotWidth = dotSize + spacing;
    const cols = Math.floor(containerWidth / totalDotWidth);
    const rows = Math.floor(containerHeight / totalDotWidth);
    
    // Calculate positioning
    const offsetX = (containerWidth - (cols * totalDotWidth - spacing)) / 2;
    const offsetY = (containerHeight - (rows * totalDotWidth - spacing)) / 2;
    
    // Draw dots
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, containerWidth, containerHeight);
    
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = grid[y][x];
        const posX = offsetX + x * totalDotWidth + dotSize / 2;
        const posY = offsetY + y * totalDotWidth + dotSize / 2;
        
        const color = cell.color || defaultColor;
        const opacity = Math.max(0, Math.min(1, cell.opacity));
        
        ctx.fillStyle = `rgba(${color}, ${opacity})`;
        ctx.fillRect(
          posX - dotSize / 2,
          posY - dotSize / 2,
          dotSize,
          dotSize
        );
      }
    }
  };

  // Animation loop
  const animate = (timestamp) => {
    if (startTime === 0) {
      startTime = timestamp;
      lastTime = timestamp;
    }
    
    const deltaTime = (timestamp - lastTime) / 1000;
    const time = (timestamp - startTime) / 1000;
    lastTime = timestamp;
    
    const containerRect = container.getBoundingClientRect();
    const containerWidth = Math.max(containerRect.width, 100);
    const containerHeight = Math.max(containerRect.height, 100);
    
    // Update grid
    const context = {
      time,
      deltaTime: deltaTime * speed,
      speed,
      cols: Math.floor(containerWidth / (dotSize + spacing)),
      rows: Math.floor(containerHeight / (dotSize + spacing)),
      mouse,
    };
    
    grid = algorithm(grid, context);
    
    // Draw updated grid
    drawGrid();
    
    animationFrameId = requestAnimationFrame(animate);
  };

  // Handle mouse events
  const handleMouseMove = (e) => {
    const containerRect = container.getBoundingClientRect();
    mouse = {
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top
    };
  };

  const handleMouseLeave = () => {
    mouse = null;
  };

  // Handle resize events
  const handleResize = () => {
    initializeGrid();
    drawGrid();
  };

  // Initialize canvas
  const initCanvas = () => {
    const containerRect = container.getBoundingClientRect();
    const containerWidth = Math.max(containerRect.width, 100);
    const containerHeight = Math.max(containerRect.height, 100);
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    
    // Scale context
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    
    // Initial grid setup
    initializeGrid();
  };

  // Set up event listeners
  container.addEventListener('mousemove', handleMouseMove);
  container.addEventListener('mouseleave', handleMouseLeave);
  window.addEventListener('resize', handleResize);
  
  // Resize observer for smoother resizing
  const resizeObserver = new ResizeObserver(() => {
    drawGrid();
  });
  resizeObserver.observe(container);

  // Start animation
  initCanvas();
  startTime = performance.now();
  lastTime = startTime;
  animationFrameId = requestAnimationFrame(animate);

  // Cleanup function
  const stop = () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    container.removeEventListener('mousemove', handleMouseMove);
    container.removeEventListener('mouseleave', handleMouseLeave);
    window.removeEventListener('resize', handleResize);
    resizeObserver.disconnect();
  };

  return { element: container, stop };
};

// Usage example:
// const { element, stop } = createDotMatrix({
//   algorithm: pulsingWaveAlgorithm,
//   dotSize: 6,
//   spacing: 2,
//   defaultColor: "253, 186, 116",
//   speed: 1.0
// });
//
// document.body.appendChild(element);
// // To stop when needed:
// stop();
