export const STREAM_COUNT = 4;
export const STREAM_MS = 150_000;
export const TOTAL_MS = STREAM_MS * STREAM_COUNT;

export function allocateRemainingTime(elapsedMs, completedStreamIndex) {
  const streamsLeft = STREAM_COUNT - completedStreamIndex - 1;
  if (streamsLeft <= 0) return 0;
  return Math.max(0, TOTAL_MS - Math.max(0, elapsedMs)) / streamsLeft;
}

export function getTimerSnapshot(elapsedMs, streamIndex = 0, streamStartedAtMs = 0, streamBudgetMs = STREAM_MS) {
  const elapsed = Math.max(0, elapsedMs);
  const streamElapsed = Math.max(0, elapsed - streamStartedAtMs);
  const streamRemaining = streamBudgetMs - streamElapsed;
  return {
    elapsed, streamIndex, streamElapsed, streamRemaining, streamBudgetMs,
    totalRemaining: Math.max(0, TOTAL_MS - elapsed),
    totalProgress: Math.min(1, elapsed / TOTAL_MS),
    streamProgress: streamBudgetMs > 0 ? Math.min(1, streamElapsed / streamBudgetMs) : 1,
  };
}

export function formatTime(milliseconds) {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function formatStreamTime(milliseconds) {
  return milliseconds < 0 ? `+${formatTime(-milliseconds)}` : formatTime(milliseconds);
}
