// ───────────────────────────────────────────────────────────────────────────
// Custom hand-drawn icon set 🌸 — soft pastel glyphs that replace the section
// emoji so the whole dashboard feels bespoke and cohesive (same family as the
// tulip favicon). Each is a self-contained inline SVG that inherits text sizing
// via `em`, so it lines up with the heading it sits beside. Decorative only.
//
// Palette (from zones.ts / index.css): pink #ffb6d5 · deep-pink #ff9ec5/#ff89bb
// lavender #c9b6ff/#b6a2f0 · mint #7fd0ab · butter #ffe08f/#ffd27a · masc-blue
// #9fbce8 (used ONLY for the "fell out of register" dip — honoring the strict
// color convention: blue = masculine register, and a register crash *is* that).

type IconProps = {
  /** rendered size; defaults to 1.15em so it matches emoji weight in a heading */
  size?: number | string;
  className?: string;
  title?: string;
};

function svgProps(viewBox: string, { size = "1.15em", className, title }: IconProps) {
  return {
    viewBox,
    width: size,
    height: size,
    className,
    role: title ? ("img" as const) : undefined,
    "aria-hidden": title ? undefined : (true as const),
    style: { flex: "0 0 auto", verticalAlign: "-0.18em" as const },
    children: title ? <title>{title}</title> : null,
  };
}

/** 🎀 → a soft pink bow — "this take" */
export function BowIcon(p: IconProps = {}) {
  const { children, ...rest } = svgProps("0 0 64 64", p);
  return (
    <svg {...rest}>
      {children}
      {/* scaled up ~20% so the bow carries enough visual weight in a heading */}
      <g transform="translate(32,32) scale(1.2) translate(-32,-32)">
        <path d="M27 35 L21 53 L31 45 Z" fill="#ff9ec5" />
        <path d="M37 35 L43 53 L33 45 Z" fill="#ff9ec5" />
        <path d="M32 32 C16 15 6 22 8 31 C6 41 16 48 32 32 Z" fill="#ffb6d5" />
        <path d="M32 32 C48 15 58 22 56 31 C58 41 48 48 32 32 Z" fill="#ffb6d5" />
        <ellipse cx="18" cy="27" rx="5" ry="3" fill="#ffffff" opacity="0.5" />
        <ellipse cx="32" cy="33" rx="5.5" ry="6.5" fill="#ff89bb" />
      </g>
    </svg>
  );
}

/** ✨ → a four-point sparkle — resonance / brightness */
export function SparkleIcon(p: IconProps = {}) {
  const { children, ...rest } = svgProps("0 0 64 64", p);
  return (
    <svg {...rest}>
      {children}
      <path d="M30 5 C31.5 24 38 30.5 57 32 C38 33.5 31.5 40 30 59 C28.5 40 22 33.5 3 32 C22 30.5 28.5 24 30 5 Z" fill="#ffb6d5" />
      <ellipse cx="30" cy="32" rx="5" ry="5" fill="#fff3f9" opacity="0.85" />
      <path d="M52 8 C53 15 55 17 61 18 C55 19 53 21 52 28 C51 21 49 19 43 18 C49 17 51 15 52 8 Z" fill="#ffd27a" />
      <path d="M14 45 C15 50 16 51 21 52 C16 53 15 54 14 59 C13 54 12 53 7 52 C12 51 13 50 14 45 Z" fill="#c9b6ff" />
    </svg>
  );
}

/** 🎚️ → a pitch contour that rises (pink, in register) then dips into masc-blue
 *  (fell out of register) — literally the thing this section measures. */
export function ContourIcon(p: IconProps = {}) {
  const { children, ...rest } = svgProps("0 0 64 64", p);
  return (
    <svg {...rest}>
      {children}
      {/* soft pink fill = the "in-register" hill above the floor (adds mass) */}
      <path d="M7 40 C16 40 22 14 32 14 C40 14 42 26 47 29 L47 37 L7 37 Z" fill="#ffd9ea" />
      {/* register floor — the line you fall below */}
      <path d="M7 37 H57" stroke="#cdc6da" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="0.1 7" />
      <path d="M7 40 C16 40 22 14 32 14 C40 14 42 26 47 29" stroke="#ff9ec5" strokeWidth="6.5" fill="none" strokeLinecap="round" />
      <path d="M47 29 C53 31 53 50 59 50" stroke="#9fbce8" strokeWidth="6.5" fill="none" strokeLinecap="round" />
      <circle cx="32" cy="14" r="5.5" fill="#ff89bb" />
      <circle cx="59" cy="50" r="5.5" fill="#7ea3d8" />
    </svg>
  );
}

/** 🔍 → a magnifying glass cradling a little heart — insights for this take */
export function InsightIcon(p: IconProps = {}) {
  const { children, ...rest } = svgProps("0 0 64 64", p);
  return (
    <svg {...rest}>
      {children}
      <path d="M37 38 L52 53" stroke="#b6a2f0" strokeWidth="8" fill="none" strokeLinecap="round" />
      <circle cx="27" cy="27" r="16" fill="#f3eeff" stroke="#b6a2f0" strokeWidth="6" />
      <path d="M27 35 C18 29 18 21 24 21 C26 21 27 23 27 24 C27 23 28 21 30 21 C36 21 36 29 27 35 Z" fill="#ff9ec5" />
    </svg>
  );
}

/** 📈 → a soft rising line chart with a sparkle at the peak — trends over time */
export function TrendsIcon(p: IconProps = {}) {
  const { children, ...rest } = svgProps("0 0 64 64", p);
  return (
    <svg {...rest}>
      {children}
      <path d="M9 52 H56" stroke="#e7ddef" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M11 45 L24 35 L38 40 L52 17" stroke="#ff9ec5" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="11" cy="45" r="4" fill="#c9b6ff" />
      <circle cx="24" cy="35" r="4" fill="#ff89bb" />
      <circle cx="38" cy="40" r="4" fill="#c9b6ff" />
      <circle cx="52" cy="17" r="5.5" fill="#ff89bb" />
      <path d="M52 6 l1.4 4 4 1.4 -4 1.4 -1.4 4 -1.4 -4 -4 -1.4 4 -1.4 z" fill="#ffd27a" />
    </svg>
  );
}

/** 📖 → a little stack of recording cards — all recordings */
export function CardsIcon(p: IconProps = {}) {
  const { children, ...rest } = svgProps("0 0 64 64", p);
  return (
    <svg {...rest}>
      {children}
      <rect x="25" y="13" width="29" height="23" rx="5" fill="#cdbcff" />
      <rect x="16" y="19" width="31" height="25" rx="5.5" fill="#ffc2dd" stroke="#fffafd" strokeWidth="2.5" />
      <rect x="8" y="26" width="35" height="28" rx="6" fill="#ffffff" stroke="#ffd9ea" strokeWidth="2.5" />
      <rect x="14" y="33" width="19" height="3.6" rx="1.8" fill="#ff9ec5" />
      <rect x="14" y="40" width="12" height="3.6" rx="1.8" fill="#c9b6ff" />
      <circle cx="37" cy="47" r="4.2" fill="#7fd0ab" />
    </svg>
  );
}

/** 💡 → a cozy lightbulb with a heart filament — "what do these mean?" */
export function BulbIcon(p: IconProps = {}) {
  const { children, ...rest } = svgProps("0 0 64 64", p);
  return (
    <svg {...rest}>
      {children}
      <g stroke="#ffce6e" strokeWidth="3" strokeLinecap="round">
        <path d="M32 3 V8" />
        <path d="M8 13 L12 16" />
        <path d="M56 13 L52 16" />
      </g>
      <path d="M32 8 C19 8 11 18 11 28 C11 34 14.5 37.5 17.5 41 C19.5 43.2 20 44.2 20 46 L44 46 C44 44.2 44.5 43.2 46.5 41 C49.5 37.5 53 34 53 28 C53 18 45 8 32 8 Z" fill="#ffe08f" />
      <path d="M32 33 C25 28 25 22 30 22 C31.6 22 32 23.6 32 24.5 C32 23.6 32.4 22 34 22 C39 22 39 28 32 33 Z" fill="#ff9ec5" />
      <rect x="25" y="46" width="14" height="5" rx="2" fill="#c9b6ff" />
      <rect x="27.5" y="51" width="9" height="4" rx="2" fill="#b6a2f0" />
    </svg>
  );
}

/** 🌷 → the Voice Garden tulip (matches the favicon) — hero mark */
export function TulipIcon(p: IconProps = {}) {
  // viewBox cropped tight to the flower's bounding box (centered on it) so the
  // bloom fills the icon instead of floating small in a 512² field.
  const { children, ...rest } = svgProps("88 132 336 336", { size: "1.15em", ...p });
  return (
    <svg {...rest}>
      {children}
      <defs>
        <linearGradient id="tulipPetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc8df" />
          <stop offset="1" stopColor="#ff92be" />
        </linearGradient>
        <linearGradient id="tulipLeaf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a6e0bd" />
          <stop offset="1" stopColor="#79c797" />
        </linearGradient>
      </defs>
      <g transform="translate(0,-6) translate(256,300) scale(1.1) translate(-256,-300)">
        <path d="M256 454 C256 394 256 350 256 302" stroke="url(#tulipLeaf)" strokeWidth="24" fill="none" strokeLinecap="round" />
        <path d="M256 412 C178 408 138 350 142 290 C220 296 260 342 256 412 Z" fill="url(#tulipLeaf)" />
        <path d="M256 396 C334 392 374 336 370 286 C292 292 252 330 256 396 Z" fill="#8aceA4" />
        <path d="M256 314 C186 314 152 256 152 204 C152 154 196 146 256 206 C316 146 360 154 360 204 C360 256 326 314 256 314 Z" fill="url(#tulipPetal)" />
        <path d="M256 314 C230 314 204 256 204 194 C204 146 238 146 256 190 C274 146 308 146 308 194 C308 256 282 314 256 314 Z" fill="#ffb6d5" />
        <path d="M206 208 C210 250 230 294 256 310" stroke="#ff89bb" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.45" />
        <path d="M306 208 C302 250 282 294 256 310" stroke="#ff89bb" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.45" />
        <ellipse cx="218" cy="204" rx="15" ry="21" fill="#ffffff" opacity="0.5" />
      </g>
    </svg>
  );
}
