// ───────────────────────────────────────────────────────────────────────────
// <RichText> — renders prose, swapping any emoji registered in EMOJI_MAP for a
// custom inline icon. Unregistered emoji pass through as their unicode glyph.
//
// It recurses through React children and only rewrites *string* leaves, so it's
// safe to wrap arbitrary JSX (bold tags, links, nested elements all survive).
//
//   <RichText>You nailed it 🎯</RichText>           // literal emoji in JSX
//   <RichText>{recording.note}</RichText>            // emoji inside a data string
//
// It's baked into the shared prose components (InsightCard, Drill), so emoji
// authored anywhere inside those convert automatically — authors just type the
// emoji and never touch this file.

import { cloneElement, isValidElement, Fragment } from "react";
import type { Key, ReactElement, ReactNode } from "react";
import { EMOJI_MAP } from "./emojiMap";

const KEYS = Object.keys(EMOJI_MAP);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// One regex matching any registered emoji. `u` so multi-codepoint emoji are
// handled correctly; `g` so we can walk every match in a string.
const EMOJI_RE = KEYS.length
  ? new RegExp(KEYS.map(escapeRegExp).join("|"), "gu")
  : null;

function splitText(text: string): ReactNode[] {
  if (!EMOJI_RE) return [text];
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(text.slice(last, idx));
    const Comp = EMOJI_MAP[m[0]];
    parts.push(<Comp key={`emoji-${idx}`} />);
    last = idx + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function transform(node: ReactNode, key?: Key): ReactNode {
  if (typeof node === "string") {
    return <Fragment key={key}>{splitText(node)}</Fragment>;
  }
  if (Array.isArray(node)) {
    return node.map((child, i) => transform(child, i));
  }
  if (isValidElement(node)) {
    const el = node as ReactElement<{ children?: ReactNode }>;
    if (el.props.children != null) {
      return cloneElement(
        el,
        { key: el.key ?? key },
        transform(el.props.children),
      );
    }
    return node;
  }
  // numbers, booleans, null, undefined, and anything else: leave as-is
  return node;
}

export function RichText({ children }: { children: ReactNode }) {
  return <>{transform(children)}</>;
}
