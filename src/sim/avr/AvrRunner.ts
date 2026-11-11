import {
  CPU, avrInstruction, AVRTimer, timer0Config, timer1Config, timer2Config,
  AVRIOPort, portBConfig, portCConfig, portDConfig, AVRUSART, usart0Config, PinState,
} from "avr8js";
import { simTrace } from "@/sim/trace";

const FREQ_HZ = 16_000_000;
const CYCLES_PER_FRAME = FREQ_HZ / 60;

function loadHex(source: string, target: Uint8Array) {
  for (const line of source.split("\n")) {
    if (line[0] === ":" && line.substring(7, 9) === "00") {
      const bytes = parseInt(line.substring(1, 3), 16);
      const addr = parseInt(line.substring(3, 7), 16);
      for (let i = 0; i < bytes; i++) {
        target[addr + i] = parseInt(line.substring(9 + i * 2, 11 + i * 2), 16);
      }
    }
  }
}

export class AvrRunner {
  onPins?: (changes: Record<string, number>) => void;
  onSerial?: (text: string) => void;

  private cpu: CPU | null = null;
  private ports: { b: AVRIOPort; c: AVRIOPort; d: AVRIOPort } | null = null;
  private raf = 0;
  private running = false;
  private pending: Record<string, number> = {};
  private serialBuf = "";

  start(hex: string) {
    this.stop();
    const program = new Uint16Array(0x8000);
    loadHex(hex, new Uint8Array(program.buffer));
    const cpu = new CPU(program);

    new AVRTimer(cpu, timer0Config);
    new AVRTimer(cpu, timer1Config);
    new AVRTimer(cpu, timer2Config);

    const d = new AVRIOPort(cpu, portDConfig);
    const b = new AVRIOPort(cpu, portBConfig);
    const c = new AVRIOPort(cpu, portCConfig);
    const banks: { port: AVRIOPort; name: (i: number) => string; count: number }[] = [
      { port: d, name: (i) => `D${i}`, count: 8 },
      { port: b, name: (i) => `D${i + 8}`, count: 6 },
      { port: c, name: (i) => `A${i}`, count: 6 },
    ];
    for (const { port, name, count } of banks) {
      const last = new Array<number>(count).fill(-1);
      port.addListener(() => {
        for (let i = 0; i < count; i++) {
          const st = port.pinState(i);
          if (st === PinState.Input || st === PinState.InputPullUp) continue; // inputs are reported by the controller
          const v = st === PinState.High ? 1 : 0;
          if (v !== last[i]) {
            last[i] = v;
            this.pending[name(i)] = v;
            simTrace.record(name(i), v, cpu.cycles / FREQ_HZ);
          }
        }
      });
    }

    const usart = new AVRUSART(cpu, usart0Config, FREQ_HZ);
    usart.onByteTransmit = (byte: number) => { this.serialBuf += String.fromCharCode(byte); };

    this.cpu = cpu;
    this.ports = { b, c, d };
    this.running = true;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Drive an input pin from outside (buttons). high = true means 5 V */
  setInput(pin: string, high: boolean) {
    const m = /^([DA])(\d+)$/.exec(pin);
    if (!m || !this.ports) return;
    const n = Number(m[2]);
    if (m[1] === "A") this.ports.c.setPin(n, high);
    else if (n < 8) this.ports.d.setPin(n, high);
    else this.ports.b.setPin(n - 8, high);
  }

  private loop = () => {
    const cpu = this.cpu;
    if (!this.running || !cpu) return;
    const target = cpu.cycles + CYCLES_PER_FRAME;
    while (cpu.cycles < target) {
      avrInstruction(cpu);
      cpu.tick();
    }
    simTrace.setNow(cpu.cycles / FREQ_HZ);
    if (Object.keys(this.pending).length) { this.onPins?.(this.pending); this.pending = {}; }
    if (this.serialBuf) { this.onSerial?.(this.serialBuf); this.serialBuf = ""; }
    this.raf = requestAnimationFrame(this.loop);
  };
}