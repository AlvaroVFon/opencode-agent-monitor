import type {
  MetricsHandler,
  MetricsRecorder,
} from "../../metrics/metrics-handler.interface";
import type { SessionErrorProps } from "../../types";

export class SessionErrorMetricsHandler implements MetricsHandler<SessionErrorProps> {
  handle(props: SessionErrorProps, recorder: MetricsRecorder): void {
    const sessionID =
      props.sessionID ?? (props as { info?: { id?: string } }).info?.id;
    if (!sessionID) return;

    recorder.recordSessionError(
      sessionID,
      props.error?.name ?? "session_error",
      String(props.error?.data ?? ""),
    );
  }
}
