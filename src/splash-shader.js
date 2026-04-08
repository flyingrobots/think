import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { min, max, sin, cos, floor, sqrt, round } = Math;

const DENSITY = '#Wabc:+-. ';
const BASE_COLORS = [
  [237, 85, 93],   // #ed555d
  [255, 252, 201], // #fffcc9
  [65, 183, 151],  // #41b797
  [237, 161, 38],  // #eda126
  [123, 87, 112],  // #7b5770
];
export const BG = [45, 25, 34]; // #2d1922
const STROKE = [255, 252, 201]; // #fffcc9
const DIM_STROKE = [140, 138, 110];

const VERSION = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')
).version;

// --- Math ---

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

function hueShift(rgb, angle) {
  const cosA = cos(angle);
  const sinA = sin(angle);
  const [r, g, b] = rgb;
  return [
    clamp(round(r * (0.299 + 0.701 * cosA + 0.168 * sinA) + g * (0.587 - 0.587 * cosA + 0.330 * sinA) + b * (0.114 - 0.114 * cosA - 0.497 * sinA)), 0, 255),
    clamp(round(r * (0.299 - 0.299 * cosA - 0.328 * sinA) + g * (0.587 + 0.413 * cosA + 0.035 * sinA) + b * (0.114 - 0.114 * cosA + 0.292 * sinA)), 0, 255),
    clamp(round(r * (0.299 - 0.300 * cosA + 1.250 * sinA) + g * (0.587 - 0.588 * cosA - 1.050 * sinA) + b * (0.114 + 0.886 * cosA - 0.203 * sinA)), 0, 255),
  ];
}

// --- Logo mask & distance field ---

export function buildLogoMask(logoText, cols, rows) {
  const logoLines = logoText.split('\n');
  const logoHeight = logoLines.length;
  const logoWidth = max(...logoLines.map((l) => l.length));

  const offsetY = max(0, floor((rows - logoHeight - 6) / 2));
  const offsetX = max(0, floor((cols - logoWidth) / 2));

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

export function buildInteriorMask(mask, cols, rows) {
  // Flood-fill from edges to find exterior cells.
  // Interior = empty cells NOT reachable from outside and NOT on the braille outline.
  const exterior = [];
  for (let y = 0; y < rows; y++) {
    exterior.push(new Uint8Array(cols));
  }

  const queue = [];
  // Seed from all edge cells that aren't braille
  for (let x = 0; x < cols; x++) {
    if (!mask[0][x]) { exterior[0][x] = 1; queue.push([x, 0]); }
    if (!mask[rows - 1][x]) { exterior[rows - 1][x] = 1; queue.push([x, rows - 1]); }
  }
  for (let y = 1; y < rows - 1; y++) {
    if (!mask[y][0]) { exterior[y][0] = 1; queue.push([0, y]); }
    if (!mask[y][cols - 1]) { exterior[y][cols - 1] = 1; queue.push([cols - 1, y]); }
  }

  // BFS flood
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !exterior[ny][nx] && !mask[ny][nx]) {
        exterior[ny][nx] = 1;
        queue.push([nx, ny]);
      }
    }
  }

  // Interior = not braille outline AND not exterior
  const interior = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      row.push(!mask[y][x] && !exterior[y][x]);
    }
    interior.push(row);
  }

  return interior;
}

export function buildDistanceFromOutline(mask, cols, rows) {
  const INF = cols + rows;
  const dist = [];

  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      row.push(mask[y][x] ? 0 : INF);
    }
    dist.push(row);
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (y > 0) { dist[y][x] = min(dist[y][x], dist[y - 1][x] + 1); }
      if (x > 0) { dist[y][x] = min(dist[y][x], dist[y][x - 1] + 1); }
      if (y > 0 && x > 0) { dist[y][x] = min(dist[y][x], dist[y - 1][x - 1] + 1); }
      if (y > 0 && x < cols - 1) { dist[y][x] = min(dist[y][x], dist[y - 1][x + 1] + 1); }
    }
  }
  for (let y = rows - 1; y >= 0; y--) {
    for (let x = cols - 1; x >= 0; x--) {
      if (y < rows - 1) { dist[y][x] = min(dist[y][x], dist[y + 1][x] + 1); }
      if (x < cols - 1) { dist[y][x] = min(dist[y][x], dist[y][x + 1] + 1); }
      if (y < rows - 1 && x < cols - 1) { dist[y][x] = min(dist[y][x], dist[y + 1][x + 1] + 1); }
      if (y < rows - 1 && x > 0) { dist[y][x] = min(dist[y][x], dist[y + 1][x - 1] + 1); }
    }
  }

  return dist;
}

// --- Shader gallery ---

function warpShader(cols, rows, time, colors) {
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
      const colorIndex = floor(c * (colors.length - 1));
      row.push({ char: DENSITY[charIndex], color: colors[colorIndex] });
    }
    grid.push(row);
  }
  return grid;
}

function plasmaShader(cols, rows, time, colors) {
  const t = time * 0.001;
  const grid = [];

  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      const nx = x / cols;
      const ny = y / rows;
      let c = sin(nx * 10 + t);
      c += sin(ny * 8 - t * 0.7);
      c += sin((nx + ny) * 6 + t * 0.5);
      c += sin(len(nx - 0.5, ny - 0.5) * 12 - t * 1.2);
      c = mapRange(sin(c * 0.5), -1, 1, 0, 1);

      const charIndex = floor(c * (DENSITY.length - 1));
      const colorIndex = floor(c * (colors.length - 1));
      row.push({ char: DENSITY[charIndex], color: colors[colorIndex] });
    }
    grid.push(row);
  }
  return grid;
}

function rippleShader(cols, rows, time, colors) {
  const t = time * 0.003;
  const m = min(cols, rows);
  const aspect = cols / rows * 0.5;
  const grid = [];

  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      const nx = (x - cols / 2) / m * aspect;
      const ny = (y - rows / 2) / m;
      const d = len(nx, ny);
      let c = sin(d * 20 - t) * 0.5 + 0.5;
      c *= max(0, 1.0 - d * 1.5);

      const charIndex = floor(c * (DENSITY.length - 1));
      const colorIndex = floor(c * (colors.length - 1));
      row.push({ char: DENSITY[charIndex], color: colors[colorIndex] });
    }
    grid.push(row);
  }
  return grid;
}

function rainShader(cols, rows, time, colors) {
  const RAIN_CHARS = '01.:;+=|~-#@$%&*!?^(){}[]<>/\\';
  const t = time * 0.004;
  const grid = [];

  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      const seed = sin(x * 127.1) * 43758.5453;
      const colSpeed = 0.5 + (seed - floor(seed)) * 1.5;
      const colOffset = (seed * 7.3) - floor(seed * 7.3);
      const yy = (y / rows + t * colSpeed + colOffset) % 1.0;
      const brightness = max(0, 1.0 - yy * 3);

      if (brightness < 0.05) {
        row.push({ char: ' ', color: colors[0] });
      } else {
        const charSeed = floor(sin(x * 43.7 + y * 17.3 + t * 2) * 1000);
        const ch = RAIN_CHARS[((charSeed % RAIN_CHARS.length) + RAIN_CHARS.length) % RAIN_CHARS.length];
        const colorIndex = floor(brightness * (colors.length - 1));
        row.push({ char: ch, color: colors[colorIndex] });
      }
    }
    grid.push(row);
  }
  return grid;
}

function heartbeatShader(cols, rows, time, colors) {
  const t = time * 0.001;
  const m = min(cols, rows);
  const aspect = cols / rows * 0.5;
  const pulse = (sin(t * 3) * 0.5 + 0.5) * 0.4 + 0.6;
  const grid = [];

  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      const nx = (x - cols / 2) / m * aspect;
      const ny = (y - rows / 2) / m;
      const d = len(nx, ny) / pulse;
      const ring = sin(d * 15 - t * 4) * 0.5 + 0.5;
      const c = ring * max(0, 1.0 - d * 2);

      const charIndex = floor(c * (DENSITY.length - 1));
      const colorIndex = floor(c * (colors.length - 1));
      row.push({ char: DENSITY[charIndex], color: colors[colorIndex] });
    }
    grid.push(row);
  }
  return grid;
}

const SHADERS = [
  { name: 'warp', fn: warpShader },
  { name: 'plasma', fn: plasmaShader },
  { name: 'ripple', fn: rippleShader },
  { name: 'rain', fn: rainShader },
  { name: 'heartbeat', fn: heartbeatShader },
];

export function getShaderCount() {
  return SHADERS.length;
}

export function getShaderName(index) {
  return SHADERS[index % SHADERS.length].name;
}

export function shaderFrame(cols, rows, time, hueAngle, shaderIndex = 0) {
  const colors = BASE_COLORS.map((c) => hueShift(c, hueAngle));
  const shader = SHADERS[shaderIndex % SHADERS.length];
  return shader.fn(cols, rows, time, colors);
}

// --- Compositing ---

// logoType 'mind': shader masked inside head shape, braille logo on top
// logoType 'text': shader everywhere as background, text logo on top

function buildPromptBox(text) {
  const pad = 2;
  const inner = `${' '.repeat(pad)}${text}${' '.repeat(pad)}`;
  const w = inner.length;
  return {
    lines: [
      `╭${'─'.repeat(w)}╮`,
      `│${inner}│`,
      `╰${'─'.repeat(w)}╯`,
    ],
    width: w + 2,
    height: 3,
  };
}

export function compositeAndRender(grid, logoInfo, interiorMask, distField, cols, rows, logoType, elapsed, fps, transition, shaderName) {
  const { offsetY, logoLines, logoHeight } = logoInfo;

  // transition: null (normal), or { progress: 0→1 }
  // 0→0.6: shader expands outward from head
  // 0.6→1.0: everything fades to black
  const expandProgress = transition ? clamp(transition.progress / 0.6, 0, 1) : 0;
  const fadeToBlack = transition ? clamp((transition.progress - 0.6) / 0.4, 0, 1) : 0;
  const maxDist = transition ? (cols + rows) * 0.5 : 0;
  const expandRadius = expandProgress * maxDist;

  const fadeIn = transition ? 1.0 : clamp(elapsed / 1500, 0, 1);

  // Shader mode: mind logos get masked, text logos get full background
  const shaderMode = logoType === 'mind' ? 'mask' : 'full';

  const promptBox = buildPromptBox('Press [ Enter ]');
  const promptStartY = offsetY + logoHeight + 1;
  const promptStartX = max(0, floor((cols - promptBox.width) / 2));

  const copyright = `Copyright \u00A9 ${new Date().getFullYear()} \u2022 Flying Robots`;
  const copyrightX = max(0, floor((cols - copyright.length) / 2));
  const versionTag = `v${VERSION}`;
  const fpsTag = fps > 0 ? `${fps} fps` : '';
  const shaderLabel = shaderName ? `◀ ${shaderName} ▶` : '';
  const footerY = rows - 1;

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

      // --- Shader name (upper-left, line 0) ---
      if (y === 0 && !transition && shaderLabel.length > 0 && x >= 1 && x < 1 + shaderLabel.length) {
        const si = x - 1;
        if (si >= 0 && si < shaderLabel.length) {
          const dimFg = `\x1b[38;2;${DIM_STROKE[0]};${DIM_STROKE[1]};${DIM_STROKE[2]}m`;
          if (dimFg !== lastFg) { line += dimFg; lastFg = dimFg; }
          line += shaderLabel[si];
          continue;
        }
      }

      // --- Version badge (upper-right, line 0) ---
      if (y === 0 && !transition && x >= cols - versionTag.length - 1 && x < cols - 1) {
        const vi = x - (cols - versionTag.length - 1);
        if (vi >= 0 && vi < versionTag.length) {
          const dimFg = `\x1b[38;2;${DIM_STROKE[0]};${DIM_STROKE[1]};${DIM_STROKE[2]}m`;
          if (dimFg !== lastFg) { line += dimFg; lastFg = dimFg; }
          line += versionTag[vi];
          continue;
        }
      }

      // --- FPS (upper-right, line 1) ---
      if (y === 1 && !transition && fpsTag.length > 0 && x >= cols - fpsTag.length - 1 && x < cols - 1) {
        const fi = x - (cols - fpsTag.length - 1);
        if (fi >= 0 && fi < fpsTag.length) {
          const dimFg = `\x1b[38;2;${DIM_STROKE[0]};${DIM_STROKE[1]};${DIM_STROKE[2]}m`;
          if (dimFg !== lastFg) { line += dimFg; lastFg = dimFg; }
          line += fpsTag[fi];
          continue;
        }
      }

      // --- Footer gutter (centered copyright) ---
      if (y === footerY && !transition) {
        const cx = x - copyrightX;
        if (cx >= 0 && cx < copyright.length) {
          const dimFg = `\x1b[38;2;${DIM_STROKE[0]};${DIM_STROKE[1]};${DIM_STROKE[2]}m`;
          if (dimFg !== lastFg) { line += dimFg; lastFg = dimFg; }
          line += copyright[cx];
          continue;
        }
        line += ' ';
        lastFg = '';
        continue;
      }

      // --- Logo foreground (braille outline) ---
      if (logoLine && !transition) {
        const lx = x - logoInfo.offsetX;
        if (lx >= 0 && lx < logoLine.length) {
          const cp = logoLine.codePointAt(lx);
          if (cp > 0x2800 && cp <= 0x28FF) {
            const lr = lerp(BG[0], STROKE[0], fadeIn);
            const lg = lerp(BG[1], STROKE[1], fadeIn);
            const lb = lerp(BG[2], STROKE[2], fadeIn);
            const strokeFg = `\x1b[38;2;${lr};${lg};${lb}m`;
            if (strokeFg !== lastFg) { line += strokeFg; lastFg = strokeFg; }
            line += logoLine[lx];
            continue;
          }
        }
      }

      // --- Prompt box (solid) ---
      const boxLineIndex = y - promptStartY;
      if (!transition && boxLineIndex >= 0 && boxLineIndex < promptBox.height) {
        const bx = x - promptStartX;
        if (bx >= 0 && bx < promptBox.width) {
          const pr = lerp(BG[0], STROKE[0], fadeIn);
          const pg = lerp(BG[1], STROKE[1], fadeIn);
          const pb = lerp(BG[2], STROKE[2], fadeIn);
          const promptFg = `\x1b[38;2;${pr};${pg};${pb}m`;
          if (promptFg !== lastFg) { line += promptFg; lastFg = promptFg; }
          line += promptBox.lines[boxLineIndex][bx];
          continue;
        }
      }

      // --- Shader cell ---
      const cell = grid[y]?.[x];
      if (!cell) {
        line += ' ';
        continue;
      }

      let cellAlpha;
      if (transition) {
        // During transition: shader expands outward from the head
        const d = distField?.[y]?.[x] ?? 9999;
        cellAlpha = d <= expandRadius ? 1.0 : 0;
        cellAlpha *= (1.0 - fadeToBlack); // fade to black at the end
      } else if (shaderMode === 'mask') {
        cellAlpha = interiorMask?.[y]?.[x] ? 1.0 : 0;
      } else {
        cellAlpha = 1.0;
      }

      cellAlpha *= fadeIn;

      if (cellAlpha <= 0.01) {
        line += ' ';
        lastFg = '';
        continue;
      }

      const [sr, sg, sb] = cell.color;
      const r = lerp(BG[0], sr, cellAlpha);
      const g = lerp(BG[1], sg, cellAlpha);
      const b = lerp(BG[2], sb, cellAlpha);

      const fg = `\x1b[38;2;${r};${g};${b}m`;
      if (fg !== lastFg) { line += fg; lastFg = fg; }
      line += cell.char;
    }
    output.push(line);
  }

  return `${output.join('\n')}\x1b[0m`;
}
