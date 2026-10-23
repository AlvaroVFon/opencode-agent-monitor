export interface Handler<T = unknown> {
  /**
   * Consume one OpenCode event. Handlers are registered for a single event
   * type by the dispatcher, so implementations may assume the shape they
   * declare and narrow defensively only for optional data.
   */
  handle(event: T): void;
}
