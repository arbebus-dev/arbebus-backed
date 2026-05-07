import { colors } from "./colors";
import { radius } from "./radius";
import { shadows } from "./shadows";
import { spacing } from "./spacing";
import { typography } from "./typography";

export { colors, gradients } from "./colors";
export { radius } from "./radius";
export { shadows } from "./shadows";
export { spacing } from "./spacing";
export { typography } from "./typography";

export const design = {
  colors,
  radius,
  shadows,
  spacing,
  typography,
} as const;
