import { TOTAL_MS, getTimerSnapshot, formatTime } from './timer-core.mjs';

const STORAGE_KEY = 'stream-presentation-timer-v1';
const $ = (id) => document.getElementById(id);
const elements = {
  totalTime: $('totalTime'), streamTime: $('streamTime'), streamName: $('streamName'),
  totalProgress: $('totalProgress'), streamProgress: $('streamProgress'),
  totalPercent: $('totalPercent'), streamCaption: $('streamCaption'),
  streamFraction: $('streamFraction'),
  startButton: $('startButton'), pauseButton: $('pauseButton'), resetButton: $('resetButton'),
  announcement: $('announcement'),
};

const defaultState = () => ({ phase: 'idle', accumulatedMs: 0, startedAt: null, lastElapsed: 0 });
let state = defaultState();
let previousStream = 0;
let tickHandle;

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved && ['running', 'paused', 'finished'].includes(saved.phase) && Number.isFinite(saved.accumulatedMs)) {
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
  return Math.min(TOTAL_MS, state.lastElapsed);
}

function render() {
  const snap = getTimerSnapshot(elapsedNow());
  if (snap.finished && state.phase === 'running') {
    state = { phase: 'finished', accumulatedMs: TOTAL_MS, startedAt: null, lastElapsed: TOTAL_MS };
    persist();
  }
  if (state.phase === 'running' && snap.streamIndex !== previousStream) {
    elements.announcement.textContent = `Stream ${snap.streamIndex + 1} 开始`; 
  }
  if (snap.finished && previousStream !== 4) {
    elements.announcement.textContent = '全部四组发言时间结束';
  }
  previousStream = snap.finished ? 4 : snap.streamIndex;

  elements.totalTime.textContent = formatTime(snap.totalRemaining);
  elements.streamTime.textContent = formatTime(snap.streamRemaining);
  elements.streamName.textContent = `STREAM ${snap.streamIndex + 1}`;
  elements.streamTime.classList.toggle('warning', state.phase !== 'idle' && snap.streamRemaining <= 15_000);
  elements.streamTime.classList.toggle('critical', state.phase === 'running' && !snap.finished && snap.streamRemaining <= 5_000);
  elements.totalProgress.style.width = `${snap.totalProgress * 100}%`;
  elements.streamProgress.style.width = `${snap.streamProgress * 100}%`;
  elements.totalPercent.textContent = `${Math.floor(snap.totalProgress * 100)}%`;
  elements.streamFraction.textContent = `0${snap.streamIndex + 1} / 04`;
  elements.streamCaption.textContent = snap.finished ? 'Finished' : state.phase === 'paused' ? 'Paused' : state.phase === 'running' ? 'Speaking' : 'Ready';
  elements.startButton.textContent = state.phase === 'paused' ? 'Resume' : state.phase === 'finished' ? 'Restart' : 'Start';
  elements.startButton.disabled = state.phase === 'running';
  elements.pauseButton.disabled = state.phase !== 'running';
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
  previousStream = getTimerSnapshot(state.accumulatedMs).streamIndex;
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
elements.resetButton.addEventListener('click', () => {
  state = defaultState();
  previousStream = 0;
  persist();
  render();
  scheduleTick();
});
document.addEventListener('visibilitychange', () => { render(); scheduleTick(); });
window.addEventListener('pageshow', () => { render(); scheduleTick(); });
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  try { state = JSON.parse(event.newValue) || defaultState(); previousStream = getTimerSnapshot(elapsedNow()).streamIndex; render(); scheduleTick(); } catch { /* Ignore malformed external state. */ }
});
render();
scheduleTick();
