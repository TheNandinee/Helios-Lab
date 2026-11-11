import { I8051 } from "./core";
import { simTrace } from "@/sim/trace";

const MACHINE_HZ = 1_000_000; // 12 MHz crystal / 12 clocks per machine cycle
const CYCLES_PER_FRAME = Math.round(MACHINE_HZ / 60);

export class Runner8051 {
  readonly cpu = new I8051();
  onPins?: (changes: Record<string, number>) => void;
  onHalt?: (message: string) => void;
  paused = false;

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
      const t = this.cpu.cycles / MACHINE_HZ;
      for (let b = 0; b < 8; b++) {
        if (diff & (1 << b)) {
          const pin = `P${port}.${b}`;
          const v = (value >> b) & 1;
          this.pending[pin] = v;
          simTrace.record(pin, v, t);
        }
      }
    };
  }

  start(image: Uint8Array) {
    this.stop();
    this.cpu.reset();
    this.cpu.code.set(image);
    this.latch = [0xff, 0xff, 0xff, 0xff];
    this.paused = false;

    const initial: Record<string, number> = {};
    for (let p = 0; p < 4; p++) {
      for (let b = 0; b < 8; b++) {
        initial[`P${p}.${b}`] = 1;
        simTrace.record(`P${p}.${b}`, 1, 0);
      }
    }
    this.onPins?.(initial);

    this.running = true;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  pause() { if (this.running) this.paused = true; }
  resume() { if (this.running) this.paused = false; }

  stepOnce() {
    if (!this.running) return;
    this.paused = true;
    this.cpu.step();
    simTrace.setNow(this.cpu.cycles / MACHINE_HZ);
    this.flush();
    if (this.cpu.halted) this.halt();
  }

  setInput(port: number, bit: number, value: number) {
    this.cpu.setInput(port, bit, value);
  }

  private flush() {
    if (Object.keys(this.pending).length) {
      this.onPins?.(this.pending);
      this.pending = {};
    }
  }

  private halt() {
    this.running = false;
    this.onHalt?.(this.cpu.error ?? "CPU halted");
  }

  private loop = () => {
    if (!this.running) return;
    if (!this.paused) {
      const target = this.cpu.cycles + CYCLES_PER_FRAME;
      while (this.cpu.cycles < target && !this.cpu.halted) this.cpu.step();
      simTrace.setNow(this.cpu.cycles / MACHINE_HZ);
    }
    this.flush();
    if (this.cpu.halted) { this.halt(); return; }
    this.raf = requestAnimationFrame(this.loop);
  };
}