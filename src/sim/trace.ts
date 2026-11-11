const CAPACITY = 4096;

export class PinTrace {
  private t = new Float64Array(CAPACITY);
  private v = new Float32Array(CAPACITY);
  private head = 0;
  count = 0;

  push(time: number, value: number) {
    this.t[this.head] = time;
    this.v[this.head] = value;
    this.head = (this.head + 1) % CAPACITY;
    if (this.count < CAPACITY) this.count++;
  }
  timeAt(i: number) { return this.t[(this.head - this.count + i + CAPACITY) % CAPACITY]; }
  valueAt(i: number) { return this.v[(this.head - this.count + i + CAPACITY) % CAPACITY]; }
}

export class TraceStore {
  private pins = new Map<string, PinTrace>();
  now = 0;

  record(pin: string, value: number, time: number) {
    let tr = this.pins.get(pin);
    if (!tr) { tr = new PinTrace(); this.pins.set(pin, tr); }
    tr.push(time, value);
    if (time > this.now) this.now = time;
  }
  get(pin: string) { return this.pins.get(pin); }
  setNow(t: number) { this.now = t; }
  clear() { this.pins.clear(); this.now = 0; }
}

/** Simulation time (seconds of simulated CPU time) */
export const simTrace = new TraceStore();
/** Wall-clock time (performance.now()/1000) for data arriving from Firebase */
export const cloudTrace = new TraceStore();