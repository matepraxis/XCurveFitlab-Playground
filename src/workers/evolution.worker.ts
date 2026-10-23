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

function sendFrame(): void {
  if (!evolution) return;
  const frame = evolution.frame();
  self.postMessage({ type: 'frame', frame });
  if (frame.finished) {
    playing = false;
    self.postMessage({ type: 'running', running: false });
  }
}
function tick(): void {
  if (!playing || !evolution) return;
  evolution.step();
  sendFrame();
  if (playing) setTimeout(tick, Math.max(18, 400 / speed));
}
self.onmessage = (event: MessageEvent<Request>) => {
  const msg = event.data;
  try {
    if (msg.type === 'reset') {
      playing = false;
      evolution = new Evolution(msg.settings, msg.points);
      self.postMessage({ type: 'reset-complete' });
      sendFrame();
      self.postMessage({ type: 'running', running: false });
    } else if (msg.type === 'pause') {
      playing = false;
      self.postMessage({ type: 'running', running: false });
    } else if (msg.type === 'step') {
      playing = false;
      if (evolution) evolution.step();
      sendFrame();
      self.postMessage({ type: 'running', running: false });
    } else if (msg.type === 'start' && evolution && !playing) {
      if (evolution.frame().finished) return;
      playing = true;
      speed = msg.speed;
      self.postMessage({ type: 'running', running: true });
      tick();
    } else if (msg.type === 'start') {
      speed = msg.speed;
    }
  } catch (error) {
    playing = false;
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Error desconocido' });
  }
};
