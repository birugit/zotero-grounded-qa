/**
 * theme — light/dark palette for the plugin's dialog windows.
 *
 * The browser/idea windows build their UI with inline styles, which override any
 * injected stylesheet, so theming has to be applied inline. This resolves a
 * palette from the OS/Zotero colour scheme so the windows look native in both
 * light and dark mode instead of forcing light backgrounds.
 */

export interface Palette {
  bg: string; // window/root background
  panel: string; // cards, raised surfaces
  text: string; // primary text
  sub: string; // secondary/meta text
  border: string; // separators, control borders
  inputBg: string; // text inputs / selects
  btnBg: string; // buttons
  hover: string; // row/card hover
  accent: string; // links / active
  chipBg: string; // tag chip background
  chipBorder: string;
  linkChipBg: string; // linked-idea chip background
  linkChipBorder: string;
  colorScheme: "light" | "dark";
}

const LIGHT: Palette = {
  bg: "#ffffff",
  panel: "#ffffff",
  text: "#111111",
  sub: "#777777",
  border: "#cccccc",
  inputBg: "#ffffff",
  btnBg: "#f5f5f5",
  hover: "#f7f9ff",
  accent: "#0055aa",
  chipBg: "#eeeeff",
  chipBorder: "#ccccdd",
  linkChipBg: "#eeffee",
  linkChipBorder: "#ccddcc",
  colorScheme: "light",
};

const DARK: Palette = {
  bg: "#292a2d",
  panel: "#333437",
  text: "#e8e8e8",
  sub: "#a0a0a0",
  border: "#555659",
  inputBg: "#3a3b3e",
  btnBg: "#45474b",
  hover: "#3a3f4a",
  accent: "#6ea8fe",
  chipBg: "#33384a",
  chipBorder: "#454a5e",
  linkChipBg: "#2e3d33",
  linkChipBorder: "#3f5546",
  colorScheme: "dark",
};

/** Resolve the palette for a dialog document from its colour scheme. */
export function getTheme(doc: Document): Palette {
  try {
    const win = doc.defaultView as any;
    if (win?.matchMedia?.("(prefers-color-scheme: dark)")?.matches) return DARK;
  } catch {
    /* fall through to light */
  }
  return LIGHT;
}
