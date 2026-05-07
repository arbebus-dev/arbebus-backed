export const typography = {
  size: {
    // existing Arbebus tokens
    hero: 28,
    title: 20,
    screenTitle: 17,
    section: 11,
    rowTitle: 16,
    card: 16,
    body: 13,
    caption: 12,
    badge: 10,

    // compatibility aliases used by newer UI patches
    xs: 12,
    sm: 13,
    md: 16,
    lg: 20,
    xl: 24,
  },
  lineHeight: {
    // existing Arbebus tokens
    hero: 34,
    title: 25,
    screenTitle: 22,
    section: 14,
    rowTitle: 21,
    card: 21,
    body: 18,
    caption: 16,
    badge: 12,

    // compatibility aliases used by newer UI patches
    xs: 16,
    sm: 18,
    md: 21,
    lg: 25,
    xl: 30,
  },
  weight: {
    regular: '500',
    medium: '700',
    semibold: '700',
    bold: '800',
    black: '900',
  },
} as const;
