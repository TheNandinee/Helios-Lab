import { I8051 } from "./core";

// 12 MHz crystal, 12 clocks per machine cycle, 60 frames per second
const CYCLES_PER_FRAME = Math.round(12_000_000 / 12 / 60);

export class Runner8051 {
  readonly cpu = new I8051();
  onPins?: (changes: Record<string, number>) => void;
  onHalt?: (message: string) => void;

  private raf = 0;
  private running = false;
  private latch = [0xff, 0xff, 0xff, 0xff];
  private pending: Record<string, number> = {};

  constructor() {
    this.cpu.onPortWrite = (port, value) => {
      const old = this.latch[port];
      if (old === value) return;
      this.latch[port] = value;
      const diff = old ^ value;
      for (let b = 0; b < 8; b++) {
        if (diff & (1 << b)) this.pending[`P${port}.${b}`] = (value >> b) & 1;
      }
    };
  }

  start(image: Uint8Array) {
    this.stop();
    this.cpu.reset();
    this.cpu.code.set(image);
    this.latch = [0xff, 0xff, 0xff, 0xff];

    // After reset, every port pin reads 1
    const initial: Record<string, number> = {};
    for (let p = 0; p < 4; p++) for (let b = 0; b < 8; b++) initial[`P${p}.${b}`] = 1;
    this.onPins?.(initial);

    this.running = true;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private loop = () => {
    if (!this.running) return;
    const target = this.cpu.cycles + CYCLES_PER_FRAME;
    while (this.cpu.cycles < target && !this.cpu.halted) this.cpu.step();

    if (Object.keys(this.pending).length) {
      this.onPins?.(this.pending);
      this.pending = {};
    }
    if (this.cpu.halted) {
      this.running = false;
      this.onHalt?.(this.cpu.error ?? "CPU halted");
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };
}