/**
 * Parses raw PTY output into structured, pino-style log entries.
 *
 * Each entry contains:
 *   text — ANSI-stripped plaintext (for humans / LLMs)
 *   kind — semantic classification (content | prompt | spinner | control | empty)
 *   raw  — original bytes (for terminal replay)
 *   meta — extracted signals (byte count, ansi presence, line count)
 */

/**
 * Comprehensive ANSI/VT escape stripper.
 * Covers: CSI (including DEC private ?), OSC, SS2/SS3, DCS, and simple two-byte
 * sequences like \x1b= \x1b> \x1b(B etc.
 */
// eslint-disable-next-line no-control-regex
const ANSI_RE = new RegExp(
  [
    "\\x1b\\[[0-9;?]*[A-Za-z]",     // CSI sequences (includes ?-prefixed like \x1b[?2026h)
    "\\x1b\\][^\\x07\\x1b]*(?:\\x07|\\x1b\\\\)", // OSC sequences (BEL or ST terminated)
    "\\x1b[PX^_][^\\x07\\x1b]*(?:\\x07|\\x1b\\\\)", // DCS, SOS, PM, APC
    "\\x1b[()AB012]",               // Character set selection
    "\\x1b[NOcMEHD7-9=>]",          // SS2, SS3, RIS, NEL, RI, HTS, DECSC, DECRC, etc.
    "\\x9b[0-9;?]*[A-Za-z]",        // 8-bit CSI
  ].join("|"),
  "g",
);

/** Matches common CLI spinner frames */
const SPINNER_RE = /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏✳✶✻✽✢⣾⣽⣻⢿⡿⣟⣯⣷⠂⠐◐◑◒◓]/;

/** Matches prompt markers at line start */
const PROMPT_RE = /^\s*[❯$%>]\s/;

/** Carriage-return overwrites (spinner redraws) — keep only text after last CR.
 *  \r\r\n and \r\n are normal line endings, not overwrites. */
const CR_OVERWRITE_RE = /^.*\r(?!\r?\n)/gm;

export type ChunkKind = "content" | "prompt" | "spinner" | "control" | "empty";

export interface ParsedChunk {
  ts: string;
  text: string;
  kind: ChunkKind;
  type: "output";
  raw: string;
  meta: {
    bytes: number;
    hasAnsi: boolean;
    lines: number;
  };
}

export function stripAnsi(input: string): string {
  return input.replace(ANSI_RE, "");
}

/** Collapse carriage-return overwrites to keep only final content per line */
function collapseOverwrites(input: string): string {
  return input.replace(CR_OVERWRITE_RE, "");
}

/** Collapse \r\n into \n, then squash runs of 3+ blank lines into 2 */
function normalizeNewlines(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function classify(text: string): ChunkKind {
  const trimmed = text.trim();
  if (!trimmed) return "empty";
  if (SPINNER_RE.test(trimmed) && trimmed.length < 20) return "spinner";
  if (PROMPT_RE.test(trimmed)) return "prompt";
  if (!/[^\s\r\n\t]/.test(trimmed)) return "control";
  return "content";
}

export function parsePtyChunk(raw: string): ParsedChunk {
  const hasAnsi = ANSI_RE.test(raw);
  ANSI_RE.lastIndex = 0;

  const stripped = stripAnsi(raw);
  const collapsed = collapseOverwrites(stripped);
  const text = normalizeNewlines(collapsed).trim();
  const kind = classify(text);
  const lines = text ? text.split("\n").length : 0;

  return {
    ts: new Date().toISOString(),
    text,
    kind,
    type: "output",
    raw,
    meta: {
      bytes: Buffer.byteLength(raw),
      hasAnsi,
      lines,
    },
  };
}
