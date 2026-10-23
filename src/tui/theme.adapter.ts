import type { RGBA } from "@opentui/core";
import type { ResolvedTheme } from "@opencode/theme/tui";

export type ThemeColor = RGBA;

/**
 * Host-neutral theme surface used by the panel components.
 *
 * V1 exposed flat tokens (`accent`, `textMuted`, `borderSubtle`), while V2
 * exposes a nested semantic theme. Keeping components on this small interface
 * lets the formatters and components stay independent from either host shape.
 */
export interface PanelTheme {
  readonly text: ThemeColor;
  readonly muted: ThemeColor;
  readonly faint: ThemeColor;
  readonly border: ThemeColor;
  readonly accent: ThemeColor;
  readonly success: ThemeColor;
  readonly warning: ThemeColor;
  readonly info: ThemeColor;
  readonly error: ThemeColor;
  /** Deterministic categorical color for an agent index. */
  categorical(index: number): ThemeColor;
}

/** Mid-tone step used for accents and categorical colors. */
export const HUE_STEP = 500;

export function createV2PanelTheme(theme: ResolvedTheme): PanelTheme {
  const fallback = theme.text.base;
  const categorical = theme.categorical ?? [];

  return {
    text: theme.text.base,
    muted: theme.text.muted,
    faint: theme.text.faint,
    border: theme.border.base,
    accent: theme.hue.accent?.[HUE_STEP] ?? fallback,
    success: theme.text.feedback.success.base,
    warning: theme.text.feedback.warning.base,
    info: theme.text.feedback.info.base,
    error: theme.text.feedback.error.base,
    categorical: (index: number) => {
      if (categorical.length === 0) return fallback;
      const scale = categorical[Math.abs(index) % categorical.length];
      return scale?.[HUE_STEP] ?? fallback;
    },
  };
}
