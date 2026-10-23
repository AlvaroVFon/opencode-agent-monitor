import { resolve } from "node:path";

export type LocationFilterMode = "auto" | "all" | "match";

type LocatedEvent = { location?: { directory?: string } };

/**
 * OpenCode V2 can instantiate a plugin once per location while the event
 * stream may be shared. Writing the same session twice would corrupt metrics,
 * so events that declare a location are kept only by the instance that owns
 * that directory.
 *
 * Mode semantics:
 * - `auto` (default): filter events that carry a location, accept the rest.
 * - `match`: like `auto`, but drop events without a location too.
 * - `all`: disable filtering (useful when the host already scopes the stream).
 */
export class LocationFilter {
  private readonly directory: string | undefined;
  private readonly mode: LocationFilterMode;

  constructor(locationDirectory: string | undefined, mode?: unknown) {
    this.directory = locationDirectory ? resolve(locationDirectory) : undefined;
    this.mode = LocationFilter.isMode(mode) ? mode : "auto";
  }

  matches(event: LocatedEvent): boolean {
    if (this.mode === "all" || this.directory === undefined) return true;

    const eventDirectory = event.location?.directory;
    if (!eventDirectory) return this.mode === "auto";

    return resolve(eventDirectory) === this.directory;
  }

  private static isMode(value: unknown): value is LocationFilterMode {
    return value === "auto" || value === "all" || value === "match";
  }
}
