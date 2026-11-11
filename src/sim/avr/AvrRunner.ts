import {
  CPU, avrInstruction, AVRTimer, timer0Config, timer1Config, timer2Config,
  AVRIOPort, portBConfig, portCConfig, portDConfig, AVRUSART, usart0Config, PinState,
} from "avr8js";

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

    // Arduino Uno mapping: PORTD = D0–D7, PORTB = D8–D13, PORTC = A0–A5
    const banks: { port: AVRIOPort; name: (i: number) => string; count: number }[] = [
      { port: new AVRIOPort(cpu, portDConfig), name: (i) => `D${i}`, count: 8 },
      { port: new AVRIOPort(cpu, portBConfig), name: (i) => `D${i + 8}`, count: 6 },
      { port: new AVRIOPort(cpu, portCConfig), name: (i) => `A${i}`, count: 6 },
    ];
    for (const { port, name, count } of banks) {
      const last = new Array<number>(count).fill(-1);
      port.addListener(() => {
        for (let i = 0; i < count; i++) {
          const v = port.pinState(i) === PinState.High ? 1 : 0;
          if (v !== last[i]) { last[i] = v; this.pending[name(i)] = v; }
        }
      });
    }

    const usart = new AVRUSART(cpu, usart0Config, FREQ_HZ);
    usart.onByteTransmit = (b: number) => { this.serialBuf += String.fromCharCode(b); };

    this.cpu = cpu;
    this.running = true;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private loop = () => {
    const cpu = this.cpu;
    if (!this.running || !cpu) return;
    const target = cpu.cycles + CYCLES_PER_FRAME;
    while (cpu.cycles < target) {
      avrInstruction(cpu);
      cpu.tick();
    }
    if (Object.keys(this.pending).length) { this.onPins?.(this.pending); this.pending = {}; }
    if (this.serialBuf) { this.onSerial?.(this.serialBuf); this.serialBuf = ""; }
    this.raf = requestAnimationFrame(this.loop);
  };
}