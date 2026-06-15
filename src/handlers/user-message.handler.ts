import { Role } from "../enums";
import { Handler } from "../handler.interface";
import type { MessageUpdatedProps } from "../types";

export class UserMessageHandler implements Handler {
  constructor(private readonly currentAgent: Map<string, string>) {}

  handle(properties: unknown): void {
    const msg = (properties as MessageUpdatedProps).info;

    if (msg.role !== Role.USER) return;

    this.currentAgent.set(msg.sessionID, msg.agent);
  }
}
