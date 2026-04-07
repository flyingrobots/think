const ANSI_FALLBACK = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

export function styleTitle(ctx, text) {
  if (ctx) {
    return ctx.style.styled(ctx.semantic('accent'), ctx.style.bold(text));
  }
  return `${ANSI_FALLBACK.bold}${ANSI_FALLBACK.cyan}${text}${ANSI_FALLBACK.reset}`;
}

export function styleSection(ctx, text) {
  if (ctx) {
    return ctx.style.styled(ctx.ui('sectionHeader'), ctx.style.bold(text));
  }
  return `${ANSI_FALLBACK.bold}${ANSI_FALLBACK.yellow}${text}${ANSI_FALLBACK.reset}`;
}

export function styleDim(ctx, text) {
  if (ctx) {
    return ctx.style.styled(ctx.semantic('muted'), text);
  }
  return `${ANSI_FALLBACK.dim}${text}${ANSI_FALLBACK.reset}`;
}
