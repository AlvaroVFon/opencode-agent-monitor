export type GetAgent = (sessionID: string) => string;

export interface Handler<T = unknown> {
  handle(properties: T, getAgent?: GetAgent): void;
}
