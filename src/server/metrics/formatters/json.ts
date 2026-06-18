import type { MetricsSnapshot } from "../../../shared/metrics.types";

export function formatJson(snap: MetricsSnapshot): string {
  return JSON.stringify(
    snap,
    (_key, value) => {
      if (typeof value === "number" && !Number.isFinite(value)) return 0;
      return value;
    },
    2,
  );
}
