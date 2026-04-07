const { min, sin, cos, floor, sqrt } = Math;

const DENSITY = '#Wabc:+-. ';
const COLORS = [
  [198, 0, 108],  // deeppink
  [0, 0, 0],      // black
  [196, 0, 0],    // red
  [0, 0, 196],    // blue
  [208, 128, 0],  // orange
  [226, 226, 0],  // yellow
];

function map(value, inMin, inMax, outMin, outMax) {
  return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}

function length(x, y) {
  return sqrt(x * x + y * y);
}

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

        const ang = -t + length(sx - 0.5, sy - 0.5);
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
      c = map(sin(c * 0.5), -1, 1, 0, 1);

      const charIndex = floor(c * (DENSITY.length - 1));
      const colorIndex = floor(c * (COLORS.length - 1));

      row.push({ char: DENSITY[charIndex], color: COLORS[colorIndex] });
    }
    grid.push(row);
  }

  return grid;
}

export function compositeAndRender(grid, logoText, cols, rows) {
  const logoLines = logoText.split('\n');
  const logoHeight = logoLines.length;
  const logoWidth = Math.max(...logoLines.map((l) => l.length));

  const offsetY = Math.max(0, floor((rows - logoHeight - 3) / 2));
  const offsetX = Math.max(0, floor((cols - logoWidth) / 2));

  const promptText = 'Press [ Enter ]';
  const promptY = offsetY + logoHeight + 1;
  const promptX = Math.max(0, floor((cols - promptText.length) / 2));

  const output = [];
  let lastR = -1;
  let lastG = -1;
  let lastB = -1;

  for (let y = 0; y < rows; y++) {
    let line = '';
    const logoLineIndex = y - offsetY;
    const logoLine = (logoLineIndex >= 0 && logoLineIndex < logoHeight)
      ? logoLines[logoLineIndex]
      : null;

    for (let x = 0; x < cols; x++) {
      // Check if logo covers this cell
      if (logoLine) {
        const lx = x - offsetX;
        if (lx >= 0 && lx < logoLine.length) {
          const ch = logoLine[lx];
          const cp = ch.codePointAt(0);
          // Non-blank braille overrides shader
          if (cp > 0x2800 && cp <= 0x28FF) {
            line += '\x1b[38;2;255;255;255m';
            line += ch;
            lastR = 255;
            lastG = 255;
            lastB = 255;
            continue;
          }
        }
      }

      // Check if prompt covers this cell
      if (y === promptY) {
        const px = x - promptX;
        if (px >= 0 && px < promptText.length) {
          line += '\x1b[38;2;100;100;100m';
          line += promptText[px];
          lastR = 100;
          lastG = 100;
          lastB = 100;
          continue;
        }
      }

      // Shader cell
      const cell = grid[y]?.[x];
      if (cell) {
        const [r, g, b] = cell.color;
        if (r !== lastR || g !== lastG || b !== lastB) {
          line += `\x1b[38;2;${r};${g};${b}m`;
          lastR = r;
          lastG = g;
          lastB = b;
        }
        line += cell.char;
      } else {
        line += ' ';
      }
    }
    output.push(line);
  }

  return `${output.join('\n')}\x1b[0m`;
}
