export class DurationFormatter {
  format(ms: number): string {
    if (ms < 1_000) {
      return `${Math.round(ms)}ms`;
    }
    if (ms < 60_000) {
      return `${(ms / 1_000).toFixed(1)}s`;
    }
    const totalSeconds = Math.floor(ms / 1_000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) {
      return `${minutes}m${seconds}s`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h${remainingMinutes}m`;
  }
}

export const durationFormatter = new DurationFormatter();
