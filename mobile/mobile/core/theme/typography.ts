import { colors, radius, spacing, typography } from '@/core/design';

export const T = {
  hero: typography.size.title,
  title: typography.size.section,
  section: typography.size.card,
  card: typography.size.card - 1,
  route: typography.size.card,
  stop: typography.size.body - 1,
  body: typography.size.body - 1,
  caption: typography.size.caption - 1,
  badge: typography.size.badge,
  tiny: 9,
  cta: typography.size.card - 1,
} as const;

export const LINE_HEIGHT = {
  hero: typography.lineHeight.title,
  title: typography.lineHeight.section,
  section: typography.lineHeight.card,
  card: typography.lineHeight.body + 1,
  route: typography.lineHeight.card,
  stop: typography.lineHeight.body - 1,
  body: typography.lineHeight.body - 1,
  caption: typography.lineHeight.caption - 1,
  badge: typography.lineHeight.badge,
  tiny: 11,
  cta: typography.lineHeight.body,
} as const;

export const FONT_WEIGHT = {
  regular: typography.weight.regular,
  medium: typography.weight.medium,
  bold: typography.weight.bold,
  black: typography.weight.black,
} as const;

export const UI = {
  radiusS: radius.sm,
  radiusM: radius.md,
  radiusL: radius.lg,
  radiusXL: radius.xl,
  gapXS: spacing.xxs,
  gapS: spacing.xs,
  gapM: spacing.sm,
  gapL: spacing.md,
  padS: spacing.xs + 2,
  padM: spacing.sm + 1,
  padL: spacing.md - 1,
  padXL: spacing.lg - 2,
} as const;

export const COLORS = {
  green: colors.accent,
  greenDark: colors.accentDark,
  blue: colors.blue,
  bg: 'rgba(5, 9, 20, 0.93)',
  card: 'rgba(25, 32, 46, 0.93)',
  cardSoft: colors.surfaceSoft,
  soft: colors.surfaceMuted,
  line: colors.border,
  text: colors.text,
  textDark: colors.textInverse,
  muted: colors.muted,
  dim: colors.dim,
  danger: colors.danger,
  warning: colors.warning,
} as const;
