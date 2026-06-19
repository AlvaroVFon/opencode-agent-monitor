import type {
  MetricsHandler,
  MetricsRecorder,
} from "../../metrics/metrics-handler.interface";
import type { SessionCreatedProps } from "../../types";

export class SessionCreatedMetricsHandler implements MetricsHandler<SessionCreatedProps> {
  handle(props: SessionCreatedProps, recorder: MetricsRecorder): void {
    const sessionID = (props as { info?: { id?: string } }).info?.id;
    if (!sessionID) return;

    recorder.recordSessionCreated(sessionID);
  }
}
