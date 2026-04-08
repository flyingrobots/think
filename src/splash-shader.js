const { min, max, sin, cos, floor, sqrt, round } = Math;

const DENSITY = '#Wabc:+-. ';
const COLORS = [
  [237, 85, 93],   // #ed555d
  [255, 252, 201], // #fffcc9
  [65, 183, 151],  // #41b797
  [237, 161, 38],  // #eda126
  [123, 87, 112],  // #7b5770
];
export const BG = [45, 25, 34]; // #2d1922
const STROKE = [255, 252, 201]; // #fffcc9

function mapRange(value, inMin, inMax, outMin, outMax) {
  return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}

function len(x, y) {
  return sqrt(x * x + y * y);
}

function clamp(v, lo, hi) {
  return max(lo, min(hi, v));
}

function lerp(a, b, t) {
  return round(a + (b - a) * t);
}

// --- Logo mask & distance field ---

export function buildLogoMask(logoText, cols, rows) {
  const logoLines = logoText.split('\n');
  const logoHeight = logoLines.length;
  const logoWidth = max(...logoLines.map((l) => l.length));

  const offsetY = max(0, floor((rows - logoHeight - 3) / 2));
  const offsetX = max(0, floor((cols - logoWidth) / 2));

  // Boolean mask: true where logo has visible braille
  const mask = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      const ly = y - offsetY;
      const lx = x - offsetX;
      if (ly >= 0 && ly < logoHeight && lx >= 0 && lx < logoLines[ly].length) {
        const cp = logoLines[ly].codePointAt(lx);
        row.push(cp > 0x2800 && cp <= 0x28FF);
      } else {
        row.push(false);
      }
    }
    mask.push(row);
  }

  return { mask, offsetX, offsetY, logoLines, logoHeight, logoWidth };
}

export function buildDistanceField(mask, cols, rows) {
  const FADE_RADIUS = 20;
  const dist = [];

  // Collect all logo cells for distance computation
  const sources = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (mask[y][x]) {
        sources.push([x, y]);
      }
    }
  }

  // Multi-source BFS for approximate distance (Chebyshev)
  const INF = cols + rows;
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      if (mask[y][x]) {
        row.push(0);
      } else {
        row.push(INF);
      }
    }
    dist.push(row);
  }

  // Two-pass distance transform (Chebyshev approximation)
  // Forward pass
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (y > 0) {
        dist[y][x] = min(dist[y][x], dist[y - 1][x] + 1);
      }
      if (x > 0) {
        dist[y][x] = min(dist[y][x], dist[y][x - 1] + 1);
      }
      if (y > 0 && x > 0) {
        dist[y][x] = min(dist[y][x], dist[y - 1][x - 1] + 1);
      }
      if (y > 0 && x < cols - 1) {
        dist[y][x] = min(dist[y][x], dist[y - 1][x + 1] + 1);
      }
    }
  }
  // Backward pass
  for (let y = rows - 1; y >= 0; y--) {
    for (let x = cols - 1; x >= 0; x--) {
      if (y < rows - 1) {
        dist[y][x] = min(dist[y][x], dist[y + 1][x] + 1);
      }
      if (x < cols - 1) {
        dist[y][x] = min(dist[y][x], dist[y][x + 1] + 1);
      }
      if (y < rows - 1 && x < cols - 1) {
        dist[y][x] = min(dist[y][x], dist[y + 1][x + 1] + 1);
      }
      if (y < rows - 1 && x > 0) {
        dist[y][x] = min(dist[y][x], dist[y + 1][x - 1] + 1);
      }
    }
  }

  // Normalize to [0, 1] alpha: 1 at logo, 0 at FADE_RADIUS+
  const alpha = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      row.push(1.0 - clamp(dist[y][x] / FADE_RADIUS, 0, 1));
    }
    alpha.push(row);
  }

  return alpha;
}

// --- Shader ---

export function shaderFrame(cols, rows, time) {
  const t = time * 0.0002;
  const m = min(cols, rows);
  const aspect = cols / rows * 0.5;
  const grid = [];

  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      let sx = 2.0 * (x - cols / 2) / m * aspect;
      let sy = 2.0 * (y - rows / 2) / m;

      for (let i = 0; i < 3; i++) {
        const o = i * 3;
        sx += sin(t * 3 + o);
        sy += cos(t * 2 + o);

        const ang = -t + len(sx - 0.5, sy - 0.5);
        const ca = cos(ang);
        const sa = sin(ang);
        const nx = sx * ca - sy * sa;
        const ny = sx * sa + sy * ca;
        sx = nx;
        sy = ny;
      }

      sx *= 0.6;
      sy *= 0.6;

      const wave = cos(t) * 2.0;
      let c = sin(sx * 3.0 + wave) + sin(sy * 21);
      c = mapRange(sin(c * 0.5), -1, 1, 0, 1);

      const charIndex = floor(c * (DENSITY.length - 1));
      const colorIndex = floor(c * (COLORS.length - 1));

      row.push({ char: DENSITY[charIndex], color: COLORS[colorIndex] });
    }
    grid.push(row);
  }

  return grid;
}

// --- Compositing modes ---

// Mode 1: shader everywhere, logo on top
// Mode 2: shader fades out with distance from logo
// Mode 3: shader only inside the logo mask

export function compositeAndRender(grid, logoInfo, alphaField, cols, rows, mode) {
  const { mask, offsetY, logoLines, logoHeight } = logoInfo;

  const promptText = 'Press [ Enter ]';
  const promptY = offsetY + logoHeight + 1;
  const promptX = max(0, floor((cols - promptText.length) / 2));

  const bgAnsi = `\x1b[48;2;${BG[0]};${BG[1]};${BG[2]}m`;
  const output = [];
  let lastFg = '';

  for (let y = 0; y < rows; y++) {
    let line = bgAnsi;
    const logoLineIndex = y - offsetY;
    const logoLine = (logoLineIndex >= 0 && logoLineIndex < logoHeight)
      ? logoLines[logoLineIndex]
      : null;

    for (let x = 0; x < cols; x++) {
      // Logo foreground: visible braille overrides everything
      if (logoLine) {
        const lx = x - logoInfo.offsetX;
        if (lx >= 0 && lx < logoLine.length) {
          const cp = logoLine.codePointAt(lx);
          if (cp > 0x2800 && cp <= 0x28FF) {
            const strokeFg = `\x1b[38;2;${STROKE[0]};${STROKE[1]};${STROKE[2]}m`;
            if (strokeFg !== lastFg) {
              line += strokeFg;
              lastFg = strokeFg;
            }
            line += logoLine[lx];
            continue;
          }
        }
      }

      // Prompt
      if (y === promptY) {
        const px = x - promptX;
        if (px >= 0 && px < promptText.length) {
          const promptFg = `\x1b[38;2;${STROKE[0]};${STROKE[1]};${STROKE[2]}m`;
          if (promptFg !== lastFg) {
            line += promptFg;
            lastFg = promptFg;
          }
          line += promptText[px];
          continue;
        }
      }

      // Shader cell with mode-dependent visibility
      const cell = grid[y]?.[x];
      if (!cell) {
        line += ' ';
        continue;
      }

      let alpha = 1.0;
      if (mode === 2) {
        alpha = alphaField?.[y]?.[x] ?? 0;
      } else if (mode === 3) {
        alpha = mask[y]?.[x] ? 1.0 : 0;
      }

      if (alpha <= 0.01) {
        line += ' ';
        lastFg = '';
        continue;
      }

      const [sr, sg, sb] = cell.color;
      const r = lerp(BG[0], sr, alpha);
      const g = lerp(BG[1], sg, alpha);
      const b = lerp(BG[2], sb, alpha);

      const fg = `\x1b[38;2;${r};${g};${b}m`;
      if (fg !== lastFg) {
        line += fg;
        lastFg = fg;
      }

      if (alpha < 0.5) {
        // Use sparser density char for faded regions
        const fadedIndex = floor(alpha * 2 * (DENSITY.length - 1));
        line += DENSITY[max(fadedIndex, DENSITY.length - 2)];
      } else {
        line += cell.char;
      }
    }
    output.push(line);
  }

  return `${output.join('\n')}\x1b[0m`;
}
