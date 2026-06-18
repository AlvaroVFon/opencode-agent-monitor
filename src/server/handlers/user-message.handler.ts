import { Role } from "../enums";
import { Handler } from "../handler.interface";
import type { MessageUpdatedProps } from "../types";

export class UserMessageHandler implements Handler<MessageUpdatedProps> {
  constructor(private readonly currentAgent: Map<string, string>) {}

  handle(properties: MessageUpdatedProps): void {
    const msg = properties.info;

    if (msg.role !== Role.USER) return;

    this.currentAgent.set(msg.sessionID, msg.agent);
  }
}
