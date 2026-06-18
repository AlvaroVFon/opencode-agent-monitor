export interface Handler<T = unknown> {
  handle(properties: T): void;
}
