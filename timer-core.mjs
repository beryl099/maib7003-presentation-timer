export const STREAM_MS = 150_000;
export const TOTAL_MS = STREAM_MS * 4;

export function getTimerSnapshot(elapsedMs) {
  const elapsed = Math.min(TOTAL_MS, Math.max(0, elapsedMs));
  const finished = elapsed >= TOTAL_MS;
  const streamIndex = finished ? 3 : Math.floor(elapsed / STREAM_MS);
  const streamElapsed = finished ? STREAM_MS : elapsed - streamIndex * STREAM_MS;
  return {
    elapsed,
    finished,
    streamIndex,
    totalRemaining: TOTAL_MS - elapsed,
    streamRemaining: STREAM_MS - streamElapsed,
    totalProgress: elapsed / TOTAL_MS,
    streamProgress: streamElapsed / STREAM_MS,
  };
}

export function formatTime(milliseconds) {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
