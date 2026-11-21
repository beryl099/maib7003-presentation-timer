import { STREAM_COUNT, STREAM_MS, allocateRemainingTime, getTimerSnapshot, formatTime, formatStreamTime } from './timer-core.mjs';

const STORAGE_KEY = 'stream-presentation-timer-v2';
const $ = (id) => document.getElementById(id);
const elements = {
  totalTime: $('totalTime'), streamTime: $('streamTime'), streamName: $('streamName'),
  streamAllocation: $('streamAllocation'),
  totalProgress: $('totalProgress'), streamProgress: $('streamProgress'),
  totalPercent: $('totalPercent'), streamCaption: $('streamCaption'),
  streamFraction: $('streamFraction'), handoffNote: $('handoffNote'),
  startButton: $('startButton'), pauseButton: $('pauseButton'), resetButton: $('resetButton'),
  endStreamButton: $('endStreamButton'), announcement: $('announcement'),
};

const defaultState = () => ({
  phase: 'idle', accumulatedMs: 0, startedAt: null, lastElapsed: 0,
  streamIndex: 0, streamStartedAtMs: 0, streamBudgetMs: STREAM_MS,
  actualDurations: [],
});
let state = defaultState();
let tickHandle;

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved && ['running', 'paused', 'finished'].includes(saved.phase)
    && Number.isFinite(saved.accumulatedMs)
    && Number.isInteger(saved.streamIndex) && saved.streamIndex >= 0 && saved.streamIndex < STREAM_COUNT
    && Number.isFinite(saved.streamStartedAtMs) && Number.isFinite(saved.streamBudgetMs)
    && Array.isArray(saved.actualDurations)) {
    state = { ...defaultState(), ...saved };
    if (state.phase === 'running' && !Number.isFinite(state.startedAt)) state = defaultState();
  }
} catch { /* Storage may be unavailable; the timer still works. */ }

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Optional persistence. */ }
}

function elapsedNow() {
  if (state.phase !== 'running') return state.accumulatedMs;
  const computed = state.accumulatedMs + Math.max(0, Date.now() - state.startedAt);
  state.lastElapsed = Math.max(state.lastElapsed || 0, computed);
  return state.lastElapsed;
}

function render() {
  const snap = getTimerSnapshot(elapsedNow(), state.streamIndex, state.streamStartedAtMs, state.streamBudgetMs);
  const finished = state.phase === 'finished';
  elements.totalTime.textContent = formatTime(snap.totalRemaining);
  elements.streamTime.textContent = formatStreamTime(snap.streamRemaining);
  elements.streamName.textContent = `STREAM ${snap.streamIndex + 1}`;
  elements.streamAllocation.textContent = `${formatTime(snap.streamBudgetMs)} / STREAM`;
  elements.streamTime.classList.toggle('warning', !finished && state.phase !== 'idle' && snap.streamRemaining <= 15_000);
  elements.streamTime.classList.toggle('critical', !finished && state.phase === 'running' && snap.streamRemaining <= 5_000);
  elements.totalProgress.style.width = `${snap.totalProgress * 100}%`;
  elements.streamProgress.style.width = `${snap.streamProgress * 100}%`;
  elements.totalPercent.textContent = `${Math.floor(snap.totalProgress * 100)}%`;
  elements.streamFraction.textContent = `0${snap.streamIndex + 1} / 04`;
  elements.streamCaption.textContent = finished ? 'Finished' : state.phase === 'paused' ? 'Paused'
    : snap.streamRemaining < 0 ? 'Overtime' : state.phase === 'running' ? 'Speaking' : 'Ready';
  elements.startButton.textContent = state.phase === 'paused' ? 'Resume' : finished ? 'Restart' : 'Start';
  elements.startButton.disabled = state.phase === 'running';
  elements.pauseButton.disabled = state.phase !== 'running';
  elements.endStreamButton.disabled = state.phase === 'idle' || finished;
  elements.endStreamButton.textContent = snap.streamIndex === STREAM_COUNT - 1 ? 'Finish Stream 4' : `End Stream ${snap.streamIndex + 1}`;

  const lastIndex = state.actualDurations.length - 1;
  if (lastIndex >= 0) {
    const actual = formatTime(Math.round(state.actualDurations[lastIndex] / 1000) * 1000);
    elements.handoffNote.textContent = finished
      ? `Stream 4 actual: ${actual}`
      : `Stream ${lastIndex + 1} actual: ${actual} · Remaining streams: ${formatTime(snap.streamBudgetMs)} each`;
  } else {
    elements.handoffNote.textContent = 'Tap End Stream when the speaker actually finishes.';
  }
}

function scheduleTick() {
  clearTimeout(tickHandle);
  if (state.phase !== 'running') return;
  const untilNextSecond = 1000 - (elapsedNow() % 1000);
  tickHandle = setTimeout(() => { render(); scheduleTick(); }, Math.max(10, untilNextSecond));
}

elements.startButton.addEventListener('click', () => {
  if (state.phase === 'finished') state = defaultState();
  if (state.phase === 'running') return;
  state.startedAt = Date.now();
  state.phase = 'running';
  persist();
  render();
  scheduleTick();
});
elements.pauseButton.addEventListener('click', () => {
  if (state.phase !== 'running') return;
  state.accumulatedMs = elapsedNow();
  state.startedAt = null;
  state.phase = 'paused';
  persist();
  render();
  scheduleTick();
});
elements.endStreamButton.addEventListener('click', () => {
  if (state.phase === 'idle' || state.phase === 'finished') return;
  const at = elapsedNow();
  const completedIndex = state.streamIndex;
  state.actualDurations.push(Math.max(0, at - state.streamStartedAtMs));
  if (completedIndex === STREAM_COUNT - 1) {
    state.accumulatedMs = at;
    state.startedAt = null;
    state.phase = 'finished';
    elements.announcement.textContent = 'All four streams finished.';
  } else {
    state.streamIndex += 1;
    state.streamStartedAtMs = at;
    state.streamBudgetMs = allocateRemainingTime(at, completedIndex);
    elements.announcement.textContent = `Stream ${state.streamIndex + 1} starts with ${formatTime(state.streamBudgetMs)}.`;
  }
  persist();
  render();
  scheduleTick();
});
elements.resetButton.addEventListener('click', () => {
  state = defaultState();
  elements.announcement.textContent = '';
  persist();
  render();
  scheduleTick();
});
document.addEventListener('visibilitychange', () => { render(); scheduleTick(); });
window.addEventListener('pageshow', () => { render(); scheduleTick(); });
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  try {
    const saved = JSON.parse(event.newValue);
    state = saved && Number.isInteger(saved.streamIndex) ? saved : defaultState();
    render();
    scheduleTick();
  } catch { /* Ignore malformed external state. */ }
});
render();
scheduleTick();
