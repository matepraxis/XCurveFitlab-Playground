/// <reference lib="webworker" />
import { Evolution, type Point, type Settings } from '../engine';

type Request =
  | { type: 'reset'; settings: Settings; points: Point[] }
  | { type: 'start'; speed: number }
  | { type: 'pause' }
  | { type: 'step' };

let evolution: Evolution | null = null;
let playing = false;
let speed = 5;
let timer: ReturnType<typeof setTimeout> | null = null;
let session = 0;

/** Stop a previous run before resetting, stepping, or starting another session. */
function stop(): void {
  playing = false;
  session++;
  if (timer !== null) clearTimeout(timer);
  timer = null;
}
function sendFrame(): void {
  if (!evolution) return;
  const frame = evolution.frame();
  self.postMessage({ type: 'frame', frame });
  if (frame.finished) {
    stop();
    self.postMessage({ type: 'running', running: false });
  }
}
function tick(ownSession: number): void {
  if (!playing || !evolution || session !== ownSession) return;
  evolution.step();
  sendFrame();
  if (playing && ownSession === session) {
    timer = setTimeout(() => tick(ownSession), Math.max(18, 400 / speed));
  }
}
self.onmessage = (event: MessageEvent<Request>) => {
  const msg = event.data;
  try {
    if (msg.type === 'reset') {
      stop();
      evolution = new Evolution(msg.settings, msg.points);
      self.postMessage({ type: 'reset-complete' });
      sendFrame();
      self.postMessage({ type: 'running', running: false });
    } else if (msg.type === 'pause') {
      stop();
      self.postMessage({ type: 'running', running: false });
    } else if (msg.type === 'step') {
      stop();
      if (evolution && !evolution.frame().finished) evolution.step();
      sendFrame();
      self.postMessage({ type: 'running', running: false });
    } else if (msg.type === 'start' && evolution) {
      speed = Number.isFinite(msg.speed) ? Math.max(1, Math.min(30, msg.speed)) : 5;
      if (!playing && !evolution.frame().finished) {
        playing = true;
        const ownSession = ++session;
        self.postMessage({ type: 'running', running: true });
        tick(ownSession);
      }
    }
  } catch (error) {
    stop();
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Error desconocido' });
    self.postMessage({ type: 'running', running: false });
  }
};
