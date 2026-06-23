// ───────────────────────────────────────────────────────────────────────────
// Emoji → custom-icon registry 🌸
//
// Authors (and the LLM) keep writing literal emoji in prose; <RichText> scans
// text and swaps any emoji listed here for its custom inline component. Emoji
// NOT in this map fall through untouched as the normal unicode glyph, so the
// set can grow one emoji at a time.
//
// To add one: design the icon (use the `visual-iteration` skill — render at
// ~1em on the card bg before shipping), add a component below, and register it
// in EMOJI_MAP keyed by the exact emoji character.

import type { CSSProperties, ReactElement } from "react";

export type EmojiProps = {
  /** rendered size; defaults to 1em so it flows with the surrounding text */
  size?: number | string;
};

// Shared inline-flow styling so every custom emoji sits on the text baseline
// like a real glyph.
const emojiStyle: CSSProperties = { verticalAlign: "-0.12em", flex: "0 0 auto" };

/** 🎯 — a cozy pastel dartboard: concentric pink/white rings with a dart (mint +
 *  butter fletching) landed in the bullseye. A recolored, softened take on the
 *  iOS target emoji. No masc-blue — the lavender shaft is decorative only. */
export function TargetEmoji({ size = "1em" }: EmojiProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="🎯"
      style={emojiStyle}
    >
      {/* bold, few bands + thick white ring so it stays a readable target at ~18px */}
      <circle cx="31" cy="33" r="29" fill="#ff8fc0" />
      <circle cx="31" cy="33" r="29" fill="none" stroke="#ef6ba6" strokeWidth="2" />
      <circle cx="31" cy="33" r="20" fill="#ffffff" />
      <circle cx="31" cy="33" r="11.5" fill="#ff8fc0" />
      <circle cx="31" cy="33" r="5" fill="#ff5c9e" />
      {/* dart — lavender shaft, mint + butter fletching */}
      <path d="M31 33 L54 10" stroke="#a892ec" strokeWidth="6" strokeLinecap="round" />
      <path d="M54 10 L63 6 L58 16 Z" fill="#5fc79f" />
      <path d="M54 10 L50 1 L44 10 Z" fill="#ffc95e" />
      <circle cx="31" cy="33" r="5" fill="#ff5c9e" />
    </svg>
  );
}

// The registry. Keyed by the exact emoji character.
export const EMOJI_MAP: Record<string, (p: EmojiProps) => ReactElement> = {
  "🎯": TargetEmoji,
};
