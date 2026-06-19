export class WindowHelper {
  update(
    timestamp: number,
    currentFirst: number,
    currentLast: number,
  ): { firstSeenAt: number; lastSeenAt: number } {
    return {
      firstSeenAt:
        !currentFirst || timestamp < currentFirst ? timestamp : currentFirst,
      lastSeenAt: timestamp > currentLast ? timestamp : currentLast,
    };
  }

  empty(): { firstSeenAt: number; lastSeenAt: number } {
    return { firstSeenAt: 0, lastSeenAt: 0 };
  }
}

export const windowHelper = new WindowHelper();
