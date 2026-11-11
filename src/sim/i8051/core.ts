// Helios Lab – Intel 8051 CPU core (sandboxed in-browser interpreter)
const PORT_SFRS = [0x80, 0x90, 0xa0, 0xb0]; // P0..P3
const GENERIC_LO5_ROWS = new Set([0x00, 0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x90, 0xc0, 0xe0, 0xf0]);

export interface Registers8051 {
  pc: number; a: number; b: number; psw: number; sp: number; dptr: number;
  r: number[]; ports: number[];
}

export class I8051 {
  code = new Uint8Array(0x10000);
  iram = new Uint8Array(256);
  sfr = new Uint8Array(128); // 0x80..0xFF
  pc = 0;
  cycles = 0;
  halted = false;
  error: string | null = null;
  onPortWrite?: (port: number, value: number) => void;
  private lastPc = 0;

  constructor() { this.reset(); }

  reset() {
    this.iram.fill(0);
    this.sfr.fill(0);
    for (const p of PORT_SFRS) this.sfr[p - 0x80] = 0xff;
    this.sfr[0x81 - 0x80] = 0x07; // SP
    this.pc = 0;
    this.cycles = 0;
    this.halted = false;
    this.error = null;
  }

  // ---- registers ----
  get a() { return this.sfr[0x60]; }
  set a(v: number) { this.sfr[0x60] = v & 0xff; }
  get b() { return this.sfr[0x70]; }
  set b(v: number) { this.sfr[0x70] = v & 0xff; }
  get psw() { return this.sfr[0x50]; }
  set psw(v: number) { this.sfr[0x50] = v & 0xff; }
  get sp() { return this.sfr[0x01]; }
  get dptr() { return (this.sfr[0x03] << 8) | this.sfr[0x02]; }
  set dptr(v: number) { this.sfr[0x03] = (v >> 8) & 0xff; this.sfr[0x02] = v & 0xff; }
  get c() { return (this.psw >> 7) & 1; }
  set c(v: number) { this.psw = v ? this.psw | 0x80 : this.psw & 0x7f; }
  set ov(v: number) { this.psw = v ? this.psw | 0x04 : this.psw & ~0x04; }

  private rAddr(n: number) { return ((this.psw >> 3) & 3) * 8 + n; }
  getR(n: number) { return this.iram[this.rAddr(n)]; }

  readDirect(addr: number) { return addr < 0x80 ? this.iram[addr] : this.sfr[addr - 0x80]; }
  writeDirect(addr: number, v: number) {
    v &= 0xff;
    if (addr < 0x80) { this.iram[addr] = v; return; }
    this.sfr[addr - 0x80] = v;
    if (PORT_SFRS.includes(addr)) this.onPortWrite?.((addr - 0x80) >> 4, v);
  }

  private bitLoc(bit: number): [number, number] {
    return bit < 0x80 ? [0x20 + (bit >> 3), bit & 7] : [bit & 0xf8, bit & 7];
  }
  readBit(bit: number) { const [a, i] = this.bitLoc(bit); return (this.readDirect(a) >> i) & 1; }
  writeBit(bit: number, v: number) {
    const [a, i] = this.bitLoc(bit);
    const cur = this.readDirect(a);
    this.writeDirect(a, v ? cur | (1 << i) : cur & ~(1 << i));
  }

  private fetch() { const v = this.code[this.pc]; this.pc = (this.pc + 1) & 0xffff; return v; }
  private rel(off: number) { return (this.pc + ((off << 24) >> 24)) & 0xffff; }
  private push(v: number) { const sp = (this.sfr[0x01] + 1) & 0xff; this.sfr[0x01] = sp; this.iram[sp] = v & 0xff; }
  private pop() { const sp = this.sfr[0x01]; const v = this.iram[sp]; this.sfr[0x01] = (sp - 1) & 0xff; return v; }

  private add(v: number, carry = 0) {
    const a = this.a; const r = a + v + carry;
    let psw = this.psw & ~(0x80 | 0x40 | 0x04);
    if (r > 0xff) psw |= 0x80;
    if ((a & 0x0f) + (v & 0x0f) + carry > 0x0f) psw |= 0x40;
    if ((~(a ^ v) & (a ^ r) & 0x80) !== 0) psw |= 0x04;
    this.psw = psw; this.a = r;
  }
  private subb(v: number) {
    const a = this.a; const c = this.c; const r = a - v - c;
    let psw = this.psw & ~(0x80 | 0x40 | 0x04);
    if (r < 0) psw |= 0x80;
    if ((a & 0x0f) - (v & 0x0f) - c < 0) psw |= 0x40;
    if (((a ^ v) & (a ^ r) & 0x80) !== 0) psw |= 0x04;
    this.psw = psw; this.a = r;
  }

  private unsupported(op: number): number {
    this.halted = true;
    this.error = `Unsupported opcode 0x${op.toString(16).toUpperCase().padStart(2, "0")} at address 0x${this.lastPc.toString(16).toUpperCase().padStart(4, "0")}`;
    return 0;
  }

  step(): number {
    if (this.halted) return 0;
    this.lastPc = this.pc;
    const op = this.fetch();
    const lo = op & 0x0f, hi = op & 0xf0;
    let cyc: number;

    if ((op & 0x1f) === 0x01 || (op & 0x1f) === 0x11) {
      // AJMP / ACALL (11-bit address)
      const low = this.fetch();
      const target = (this.pc & 0xf800) | ((op >> 5) << 8) | low;
      if ((op & 0x1f) === 0x11) { this.push(this.pc & 0xff); this.push(this.pc >> 8); }
      this.pc = target;
      cyc = 2;
    } else if (lo >= 6 || (lo === 5 && GENERIC_LO5_ROWS.has(hi))) {
      cyc = this.execCell(op, hi, lo);
    } else {
      cyc = this.execSpecial(op);
    }

    // parity flag
    let a = this.a, p = 0;
    while (a) { p ^= a & 1; a >>= 1; }
    this.psw = (this.psw & 0xfe) | p;

    this.cycles += cyc;
    return cyc;
  }

  // Instructions whose operand is Rn, @Ri, or a direct address
  private execCell(op: number, hi: number, lo: number): number {
    const isDir = lo === 5;
    const addr = lo >= 8 ? this.rAddr(lo - 8) : lo >= 6 ? this.getR(lo - 6) : this.fetch();
    const rd = () => (isDir ? this.readDirect(addr) : this.iram[addr]);
    const wr = (v: number) => { if (isDir) this.writeDirect(addr, v); else this.iram[addr] = v & 0xff; };

    switch (hi) {
      case 0x00: wr(rd() + 1); return 1;                     // INC
      case 0x10: wr(rd() - 1); return 1;                     // DEC
      case 0x20: this.add(rd()); return 1;                   // ADD A,
      case 0x30: this.add(rd(), this.c); return 1;           // ADDC A,
      case 0x40: this.a = this.a | rd(); return 1;           // ORL A,
      case 0x50: this.a = this.a & rd(); return 1;           // ANL A,
      case 0x60: this.a = this.a ^ rd(); return 1;           // XRL A,
      case 0x70: wr(this.fetch()); return 1;                 // MOV cell,#data
      case 0x80: { const d = this.fetch(); this.writeDirect(d, rd()); return 2; } // MOV dir,cell
      case 0x90: this.subb(rd()); return 1;                  // SUBB A,
      case 0xa0: { const d = this.fetch(); wr(this.readDirect(d)); return 2; }   // MOV cell,dir
      case 0xb0: {                                           // CJNE cell,#data,rel
        const imm = this.fetch(); const off = this.fetch(); const v = rd();
        this.c = v < imm ? 1 : 0;
        if (v !== imm) this.pc = this.rel(off);
        return 2;
      }
      case 0xc0: { const t = rd(); wr(this.a); this.a = t; return 1; } // XCH A,
      case 0xd0: {                                           // DJNZ Rn,rel
        if (lo < 8) return this.unsupported(op);
        const off = this.fetch(); const v = (rd() - 1) & 0xff; wr(v);
        if (v !== 0) this.pc = this.rel(off);
        return 2;
      }
      case 0xe0: this.a = rd(); return 1;                    // MOV A,cell
      case 0xf0: wr(this.a); return 1;                       // MOV cell,A
    }
    return this.unsupported(op);
  }

  private execSpecial(op: number): number {
    switch (op) {
      case 0x00: return 1; // NOP
      case 0x02: { const h = this.fetch(), l = this.fetch(); this.pc = (h << 8) | l; return 2; } // LJMP
      case 0x12: { const h = this.fetch(), l = this.fetch(); this.push(this.pc & 0xff); this.push(this.pc >> 8); this.pc = (h << 8) | l; return 2; } // LCALL
      case 0x22: case 0x32: { const h = this.pop(); const l = this.pop(); this.pc = (h << 8) | l; return 2; } // RET/RETI

      case 0x03: { const a = this.a; this.a = (a >> 1) | ((a & 1) << 7); return 1; } // RR
      case 0x13: { const a = this.a; const c = a & 1; this.a = (a >> 1) | (this.c << 7); this.c = c; return 1; } // RRC
      case 0x23: { const a = this.a; this.a = (a << 1) | (a >> 7); return 1; } // RL
      case 0x33: { const a = this.a; const c = a >> 7; this.a = (a << 1) | this.c; this.c = c; return 1; } // RLC
      case 0x04: this.a = this.a + 1; return 1;
      case 0x14: this.a = this.a - 1; return 1;

      case 0x24: this.add(this.fetch()); return 1;
      case 0x34: this.add(this.fetch(), this.c); return 1;
      case 0x44: this.a = this.a | this.fetch(); return 1;
      case 0x54: this.a = this.a & this.fetch(); return 1;
      case 0x64: this.a = this.a ^ this.fetch(); return 1;
      case 0x94: this.subb(this.fetch()); return 1;

      case 0x42: { const d = this.fetch(); this.writeDirect(d, this.readDirect(d) | this.a); return 1; }
      case 0x43: { const d = this.fetch(); const v = this.fetch(); this.writeDirect(d, this.readDirect(d) | v); return 2; }
      case 0x52: { const d = this.fetch(); this.writeDirect(d, this.readDirect(d) & this.a); return 1; }
      case 0x53: { const d = this.fetch(); const v = this.fetch(); this.writeDirect(d, this.readDirect(d) & v); return 2; }
      case 0x62: { const d = this.fetch(); this.writeDirect(d, this.readDirect(d) ^ this.a); return 1; }
      case 0x63: { const d = this.fetch(); const v = this.fetch(); this.writeDirect(d, this.readDirect(d) ^ v); return 2; }

      case 0x72: { const b = this.fetch(); this.c = this.c | this.readBit(b); return 2; }        // ORL C,bit
      case 0x82: { const b = this.fetch(); this.c = this.c & this.readBit(b); return 2; }        // ANL C,bit
      case 0xa0: { const b = this.fetch(); this.c = this.c | (this.readBit(b) ^ 1); return 2; }  // ORL C,/bit
      case 0xb0: { const b = this.fetch(); this.c = this.c & (this.readBit(b) ^ 1); return 2; }  // ANL C,/bit
      case 0xa2: this.c = this.readBit(this.fetch()); return 1;                                  // MOV C,bit
      case 0x92: this.writeBit(this.fetch(), this.c); return 2;                                  // MOV bit,C

      case 0x74: this.a = this.fetch(); return 1;
      case 0x75: { const d = this.fetch(); this.writeDirect(d, this.fetch()); return 2; }
      case 0x85: { const src = this.fetch(); const dst = this.fetch(); this.writeDirect(dst, this.readDirect(src)); return 2; }
      case 0x90: { const h = this.fetch(), l = this.fetch(); this.dptr = (h << 8) | l; return 2; }
      case 0xa3: this.dptr = (this.dptr + 1) & 0xffff; return 2;
      case 0x93: this.a = this.code[(this.dptr + this.a) & 0xffff]; return 2;  // MOVC A,@A+DPTR
      case 0x83: this.a = this.code[(this.pc + this.a) & 0xffff]; return 2;    // MOVC A,@A+PC
      case 0x73: this.pc = (this.dptr + this.a) & 0xffff; return 2;            // JMP @A+DPTR

      case 0x80: { const off = this.fetch(); this.pc = this.rel(off); return 2; } // SJMP
      case 0x40: case 0x50: case 0x60: case 0x70: {                               // JC JNC JZ JNZ
        const off = this.fetch();
        const take = op === 0x40 ? this.c === 1 : op === 0x50 ? this.c === 0 : op === 0x60 ? this.a === 0 : this.a !== 0;
        if (take) this.pc = this.rel(off);
        return 2;
      }
      case 0x10: case 0x20: case 0x30: {                                          // JBC JB JNB
        const b = this.fetch(); const off = this.fetch(); const v = this.readBit(b);
        const take = op === 0x30 ? v === 0 : v === 1;
        if (take) { if (op === 0x10) this.writeBit(b, 0); this.pc = this.rel(off); }
        return 2;
      }
      case 0xb4: { const imm = this.fetch(); const off = this.fetch(); this.c = this.a < imm ? 1 : 0; if (this.a !== imm) this.pc = this.rel(off); return 2; }
      case 0xb5: { const d = this.fetch(); const off = this.fetch(); const v = this.readDirect(d); this.c = this.a < v ? 1 : 0; if (this.a !== v) this.pc = this.rel(off); return 2; }
      case 0xd5: { const d = this.fetch(); const off = this.fetch(); const v = (this.readDirect(d) - 1) & 0xff; this.writeDirect(d, v); if (v !== 0) this.pc = this.rel(off); return 2; }

      case 0xa4: { const r = this.a * this.b; this.a = r; this.b = r >> 8; this.c = 0; this.ov = r > 0xff ? 1 : 0; return 4; } // MUL AB
      case 0x84: {                                                                                                         // DIV AB
        const a = this.a, b = this.b; this.c = 0;
        if (b === 0) this.ov = 1;
        else { this.a = Math.floor(a / b); this.b = a % b; this.ov = 0; }
        return 4;
      }
      case 0xc0: this.push(this.readDirect(this.fetch())); return 2;   // PUSH
      case 0xd0: this.writeDirect(this.fetch(), this.pop()); return 2; // POP

      case 0xc2: this.writeBit(this.fetch(), 0); return 1;             // CLR bit
      case 0xd2: this.writeBit(this.fetch(), 1); return 1;             // SETB bit
      case 0xb2: { const b = this.fetch(); this.writeBit(b, this.readBit(b) ^ 1); return 1; } // CPL bit
      case 0xc3: this.c = 0; return 1;
      case 0xd3: this.c = 1; return 1;
      case 0xb3: this.c = this.c ^ 1; return 1;
      case 0xc4: { const a = this.a; this.a = (a << 4) | (a >> 4); return 1; } // SWAP A
      case 0xe4: this.a = 0; return 1;    // CLR A
      case 0xf4: this.a = ~this.a; return 1; // CPL A
      default: return this.unsupported(op);
    }
  }

  registers(): Registers8051 {
    return {
      pc: this.pc, a: this.a, b: this.b, psw: this.psw, sp: this.sp, dptr: this.dptr,
      r: Array.from({ length: 8 }, (_, i) => this.getR(i)),
      ports: PORT_SFRS.map((p) => this.sfr[p - 0x80]),
    };
  }
}