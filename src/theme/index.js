export const colors = {
  bg: {
    base: '#0B0F17',
    surface: '#131825',
    elevated: '#1B2030',
    inset: '#080B11',
  },
  border: {
    subtle: '#1F2433',
    default: '#2A3142',
    strong: '#3D4458',
  },
  text: {
    primary: '#F1F4FA',
    secondary: '#9CA3B5',
    tertiary: '#5C657A',
    disabled: '#3D4458',
    inverse: '#0B0F17',
  },
  accent: {
    default: '#5B8DEF',
    hover: '#7AA3F5',
    muted: '#1A2B4D',
    on: '#FFFFFF',
  },
  signal: {
    positive: '#4ADE80',
    negative: '#F87171',
    neutral: '#94A3B8',
    warning: '#FBBF24',
    info: '#5B8DEF',
  },
};

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
};

export const font = {
  sans: 'Inter_400Regular',
  sansMed: 'Inter_500Medium',
  sansBold: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMed: 'JetBrainsMono_500Medium',
};

// ios-aligned scale (body=17 baseline). mono variants get tabular-nums for column alignment.
const TNUM = { fontVariant: ['tabular-nums'] };

export const text = {
  displayLg: { fontFamily: font.sansBold, fontSize: 34, lineHeight: 41 },
  displaySm: { fontFamily: font.sansBold, fontSize: 28, lineHeight: 34 },
  title:     { fontFamily: font.sansBold, fontSize: 22, lineHeight: 28 },
  headline:  { fontFamily: font.sansBold, fontSize: 17, lineHeight: 22 },
  body:      { fontFamily: font.sans,     fontSize: 17, lineHeight: 24 },
  callout:   { fontFamily: font.sansMed,  fontSize: 15, lineHeight: 20 },
  subhead:   { fontFamily: font.sans,     fontSize: 14, lineHeight: 20 },
  footnote:  { fontFamily: font.sans,     fontSize: 13, lineHeight: 18 },
  caption:   { fontFamily: font.sans,     fontSize: 12, lineHeight: 16 },
  micro:     { fontFamily: font.sansMed,  fontSize: 10, lineHeight: 14 },

  displayLgMono: { fontFamily: font.monoMed, fontSize: 34, lineHeight: 41, ...TNUM },
  headlineMono:  { fontFamily: font.monoMed, fontSize: 17, lineHeight: 22, ...TNUM },
  bodyMono:      { fontFamily: font.mono,    fontSize: 17, lineHeight: 24, ...TNUM },
  calloutMono:   { fontFamily: font.monoMed, fontSize: 15, lineHeight: 20, ...TNUM },
  subheadMono:   { fontFamily: font.mono,    fontSize: 14, lineHeight: 20, ...TNUM },
  footnoteMono:  { fontFamily: font.mono,    fontSize: 13, lineHeight: 18, ...TNUM },
};

export const motion = {
  fast:    { duration: 120 },
  default: { duration: 200 },
  slow:    { duration: 320 },
};
