/**
 * src/constants/design.js
 *
 * Single source of truth for the HabitBoard design system.
 * Every screen should import from here instead of defining ad-hoc values.
 *
 * Rules enforced:
 *  - 8pt spacing grid (all values multiples of 8)
 *  - 4 border-radius stops only
 *  - 2 shadow levels only
 *  - Strict type scale (display / heading / body / caption)
 */

// ── Typography ─────────────────────────────────────────────────────────────────
export const TYPE = {
  /** Screen titles, hero numbers */
  display: {
    fontSize:      24,
    fontWeight:    '700',
    letterSpacing: -0.5,
    lineHeight:    32,
  },
  /** Section headers, card titles */
  heading: {
    fontSize:      18,
    fontWeight:    '600',
    letterSpacing: -0.3,
    lineHeight:    26,
  },
  /** Body text, list items */
  body: {
    fontSize:      15,
    fontWeight:    '400',
    letterSpacing:  0,
    lineHeight:    22,
  },
  /** Labels, timestamps, secondary info */
  caption: {
    fontSize:      12,
    fontWeight:    '400',
    letterSpacing:  0.2,
    lineHeight:    18,
  },
  /** Stat numbers — identical weight/size to body but explicitly named */
  stat: {
    fontSize:      32,
    fontWeight:    '700',
    letterSpacing: -1,
    lineHeight:    40,
  },
};

// ── 8pt Spacing grid ──────────────────────────────────────────────────────────
export const SPACE = {
  xs:  8,
  sm:  16,
  md:  24,
  lg:  32,
  xl:  40,
  xxl: 48,
};

// ── Border radii (4 stops only) ───────────────────────────────────────────────
export const RADIUS = {
  sm:   8,
  md:   12,
  lg:   16,
  pill: 999,
};

// ── Shadows (2 levels only) ───────────────────────────────────────────────────
export const SHADOW = {
  /** Cards, rows — barely perceptible lift */
  card: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius:  3,
    elevation:     2,
  },
  /** Modals, action sheets — clearly elevated */
  elevated: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius:  12,
    elevation:     8,
  },
};

// ── Button styles ─────────────────────────────────────────────────────────────
// Use these as base StyleSheet objects merged with your screen's primary color.
export const BTN = {
  /** Primary: solid fill, no gradient */
  primary: {
    borderRadius:    RADIUS.md,
    paddingVertical: SPACE.sm,
    alignItems:      'center',
    justifyContent:  'center',
  },
  /** Secondary: outline, transparent fill */
  secondary: {
    borderRadius:    RADIUS.md,
    paddingVertical: SPACE.sm,
    borderWidth:     1.5,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'transparent',
  },
  /** Destructive: red, solid fill */
  destructive: {
    borderRadius:    RADIUS.md,
    paddingVertical: SPACE.sm,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#EF4444',
  },
  label: {
    fontSize:   15,
    fontWeight: '600',
    letterSpacing: 0,
  },
};

// ── Card base ─────────────────────────────────────────────────────────────────
export const CARD = {
  base: {
    borderRadius: RADIUS.lg,
    padding:      SPACE.sm,   // 16px — standardised
    ...SHADOW.card,
  },
};
