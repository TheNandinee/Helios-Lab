// Helios Lab – two-pass 8051 assembler
export interface AsmError { line: number; message: string; }
export interface AsmResult { image: Uint8Array; size: number; errors: AsmError[]; lineForAddr: Map<number, number>; }

const SFR_ADDR: Record<string, number> = {
  P0: 0x80, SP: 0x81, DPL: 0x82, DPH: 0x83, PCON: 0x87, TCON: 0x88, TMOD: 0x89,
  TL0: 0x8a, TL1: 0x8b, TH0: 0x8c, TH1: 0x8d, P1: 0x90, SCON: 0x98, SBUF: 0x99,
  P2: 0xa0, IE: 0xa8, P3: 0xb0, IP: 0xb8, PSW: 0xd0, ACC: 0xe0, B: 0xf0,
};
const BIT_ADDR: Record<string, number> = {
  IT0: 0x88, IE0: 0x89, IT1: 0x8a, IE1: 0x8b, TR0: 0x8c, TF0: 0x8d, TR1: 0x8e, TF1: 0x8f,
  RI: 0x98, TI: 0x99, EX0: 0xa8, ET0: 0xa9, EX1: 0xaa, ET1: 0xab, ES: 0xac, EA: 0xaf,
  P: 0xd0, OV: 0xd2, RS0: 0xd3, RS1: 0xd4, F0: 0xd5, AC: 0xd6, CY: 0xd7,
};

type Operand =
  | { k: "A" | "C" | "AB" | "DPTR" | "@A+DPTR" | "@A+PC" }
  | { k: "R" | "@R"; n: number }
  | { k: "#" | "x"; t: string };

function parseNumber(raw: string): number | null {
  const t = raw.trim();
  if (/^'.'$/.test(t)) return t.charCodeAt(1);
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t.slice(2), 16);
  if (/^[0-9][0-9a-f]*h$/i.test(t)) return parseInt(t.slice(0, -1), 16);
  if (/^[01]+b$/i.test(t)) return parseInt(t.slice(0, -1), 2);
  if (/^[0-9]+d?$/i.test(t)) return parseInt(t, 10);
  return null;
}

function stripComment(line: string): string {
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === q) q = null; }
    else if (ch === "'" || ch === '"') q = ch;
    else if (ch === ";") return line.slice(0, i);
  }
  return line;
}

function splitOperands(s: string): string[] {
  const out: string[] = [];
  let cur = "", q: string | null = null;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; }
    else if (ch === "'" || ch === '"') { q = ch; cur += ch; }
    else if (ch === ",") { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function classify(raw: string): Operand {
  const t = raw.trim();
  const u = t.toUpperCase().replace(/\s+/g, "");
  if (["A", "C", "AB", "DPTR", "@A+DPTR", "@A+PC"].includes(u)) return { k: u } as Operand;
  let m = /^R([0-7])$/.exec(u);
  if (m) return { k: "R", n: Number(m[1]) };
  m = /^@R([01])$/.exec(u);
  if (m) return { k: "@R", n: Number(m[1]) };
  if (t.startsWith("#")) return { k: "#", t: t.slice(1).trim() };
  return { k: "x", t };
}

class Ctx {
  pass = 1;
  pc = 0;
  labels = new Map<string, number>();
  equs = new Map<string, string>();

  expr(text: string, depth = 0): number {
    if (depth > 16) throw new Error("Recursive EQU definition");
    const tokens = text.replace(/\s+/g, "").split(/([+-])/).filter((x) => x !== "");
    let total = 0, sign = 1;
    for (const tok of tokens) {
      if (tok === "+") continue;
      if (tok === "-") { sign = -sign; continue; }
      total += sign * this.term(tok, depth);
      sign = 1;
    }
    return total;
  }

  private term(tok: string, depth: number): number {
    if (tok === "$") return this.pc;
    const n = parseNumber(tok);
    if (n !== null) return n;
    const u = tok.toUpperCase();
    if (this.labels.has(u)) return this.labels.get(u)!;
    if (this.equs.has(u)) return this.expr(this.equs.get(u)!, depth + 1);
    if (u in SFR_ADDR) return SFR_ADDR[u];
    if (u in BIT_ADDR) return BIT_ADDR[u];
    if (this.pass === 1) return 0;
    throw new Error(`Unknown symbol "${tok}"`);
  }

  byte(text: string): number {
    const v = this.expr(text);
    if (this.pass === 2 && (v < 0 || v > 0xff)) throw new Error(`Address ${text} out of range (0–FFH)`);
    return v & 0xff;
  }
  imm(text: string): number {
    const v = this.expr(text);
    if (this.pass === 2 && (v < -128 || v > 0xff)) throw new Error(`Value ${text} does not fit in 8 bits`);
    return v & 0xff;
  }
  imm16(text: string): number { return this.expr(text) & 0xffff; }
  addr16(text: string): number { return this.expr(text) & 0xffff; }

  bit(text: string, depth = 0): number {
    if (depth > 16) throw new Error("Recursive EQU definition");
    const t = text.trim();
    const u = t.toUpperCase();
    if (this.equs.has(u)) return this.bit(this.equs.get(u)!, depth + 1);
    const m = /^(.+)\.([0-7])$/.exec(t);
    if (m) {
      const base = this.expr(m[1]);
      const n = Number(m[2]);
      if (base >= 0x20 && base <= 0x2f) return (base - 0x20) * 8 + n;
      if (base >= 0x80 && (base & 7) === 0) return base + n;
      if (this.pass === 1) return 0;
      throw new Error(`${m[1]} is not bit-addressable`);
    }
    if (u in BIT_ADDR) return BIT_ADDR[u];
    return this.byte(t);
  }

  rel(text: string, size: number): number {
    const off = this.expr(text) - (this.pc + size);
    if (this.pass === 2 && (off < -128 || off > 127)) {
      throw new Error(`Jump to ${text} is out of range (${off} bytes), use LJMP`);
    }
    return off & 0xff;
  }
}

const ARITH: Record<string, number> = { ADD: 0x20, ADDC: 0x30, ORL: 0x40, ANL: 0x50, XRL: 0x60, SUBB: 0x90 };
const COND_JUMP: Record<string, number> = { JC: 0x40, JNC: 0x50, JZ: 0x60, JNZ: 0x70, SJMP: 0x80 };
const BIT_JUMP: Record<string, number> = { JBC: 0x10, JB: 0x20, JNB: 0x30 };
const IMPLIED: Record<string, number> = { NOP: 0x00, RET: 0x22, RETI: 0x32 };
const ACC_OPS: Record<string, number> = { RR: 0x03, RRC: 0x13, RL: 0x23, RLC: 0x33, SWAP: 0xc4 };
const BIT_C: Record<string, number> = { CLR: 0xc3, SETB: 0xd3, CPL: 0xb3 };
const BIT_X: Record<string, number> = { CLR: 0xc2, SETB: 0xd2, CPL: 0xb2 };

function encode(mn: string, ops: Operand[], c: Ctx): number[] {
  const [a, b, d] = ops;
  const bad = () => new Error(`Invalid operands for ${mn}`);
  const cellCode = (op: Operand, base: number): number[] | null => {
    if (op.k === "R") return [base | 8 | op.n];
    if (op.k === "@R") return [base | 6 | op.n];
    if (op.k === "x") return [base | 5, c.byte(op.t)];
    return null;
  };

  if (mn in IMPLIED) { if (ops.length) throw bad(); return [IMPLIED[mn]]; }
  if (mn in ACC_OPS) { if (a?.k !== "A") throw bad(); return [ACC_OPS[mn]]; }
  if (mn in COND_JUMP) { if (a?.k !== "x") throw bad(); return [COND_JUMP[mn], c.rel(a.t, 2)]; }
  if (mn in BIT_JUMP) {
    if (a?.k !== "x" || b?.k !== "x") throw bad();
    return [BIT_JUMP[mn], c.bit(a.t), c.rel(b.t, 3)];
  }

  if (mn in ARITH) {
    const base = ARITH[mn];
    if (a?.k === "A" && b) {
      if (b.k === "#") return [base | 4, c.imm(b.t)];
      const cell = cellCode(b, base);
      if (cell) return cell;
    }
    if ((mn === "ORL" || mn === "ANL" || mn === "XRL") && a?.k === "x" && b) {
      if (b.k === "A") return [base | 2, c.byte(a.t)];
      if (b.k === "#") return [base | 3, c.byte(a.t), c.imm(b.t)];
    }
    if ((mn === "ORL" || mn === "ANL") && a?.k === "C" && b?.k === "x") {
      if (b.t.startsWith("/")) return [mn === "ORL" ? 0xa0 : 0xb0, c.bit(b.t.slice(1))];
      return [mn === "ORL" ? 0x72 : 0x82, c.bit(b.t)];
    }
    throw bad();
  }

  switch (mn) {
    case "MOV": {
      if (!a || !b) throw bad();
      if (a.k === "A") {
        if (b.k === "#") return [0x74, c.imm(b.t)];
        if (b.k === "R") return [0xe8 | b.n];
        if (b.k === "@R") return [0xe6 | b.n];
        if (b.k === "x") return [0xe5, c.byte(b.t)];
      }
      if (a.k === "R" || a.k === "@R") {
        const lo = a.k === "R" ? 8 | a.n : 6 | a.n;
        if (b.k === "#") return [0x70 | lo, c.imm(b.t)];
        if (b.k === "A") return [0xf0 | lo];
        if (b.k === "x") return [0xa0 | lo, c.byte(b.t)];
      }
      if (a.k === "DPTR" && b.k === "#") { const v = c.imm16(b.t); return [0x90, v >> 8, v & 0xff]; }
      if (a.k === "C" && b.k === "x") return [0xa2, c.bit(b.t)];
      if (a.k === "x") {
        if (b.k === "C") return [0x92, c.bit(a.t)];
        if (b.k === "A") return [0xf5, c.byte(a.t)];
        if (b.k === "#") return [0x75, c.byte(a.t), c.imm(b.t)];
        if (b.k === "R") return [0x88 | b.n, c.byte(a.t)];
        if (b.k === "@R") return [0x86 | b.n, c.byte(a.t)];
        if (b.k === "x") return [0x85, c.byte(b.t), c.byte(a.t)];
      }
      throw bad();
    }
    case "MOVC":
      if (a?.k === "A" && b?.k === "@A+DPTR") return [0x93];
      if (a?.k === "A" && b?.k === "@A+PC") return [0x83];
      throw bad();
    case "INC":
    case "DEC": {
      const base = mn === "INC" ? 0x00 : 0x10;
      if (a?.k === "A") return [base | 4];
      if (a?.k === "DPTR" && mn === "INC") return [0xa3];
      const cell = a ? cellCode(a, base) : null;
      if (cell) return cell;
      throw bad();
    }
    case "CLR":
    case "SETB":
    case "CPL": {
      if (a?.k === "A") {
        if (mn === "CLR") return [0xe4];
        if (mn === "CPL") return [0xf4];
        throw bad();
      }
      if (a?.k === "C") return [BIT_C[mn]];
      if (a?.k === "x") return [BIT_X[mn], c.bit(a.t)];
      throw bad();
    }
    case "MUL":
    case "DIV":
      if (a?.k !== "AB") throw bad();
      return [mn === "MUL" ? 0xa4 : 0x84];
    case "PUSH":
    case "POP":
      if (a?.k !== "x") throw bad();
      return [mn === "PUSH" ? 0xc0 : 0xd0, c.byte(a.t)];
    case "XCH": {
      if (a?.k !== "A" || !b) throw bad();
      const cell = cellCode(b, 0xc0);
      if (cell) return cell;
      throw bad();
    }
    case "DJNZ":
      if (a?.k === "R" && b?.k === "x") return [0xd8 | a.n, c.rel(b.t, 2)];
      if (a?.k === "x" && b?.k === "x") return [0xd5, c.byte(a.t), c.rel(b.t, 3)];
      throw bad();
    case "CJNE": {
      if (!a || !b || d?.k !== "x") throw bad();
      if (a.k === "A" && b.k === "#") return [0xb4, c.imm(b.t), c.rel(d.t, 3)];
      if (a.k === "A" && b.k === "x") return [0xb5, c.byte(b.t), c.rel(d.t, 3)];
      if (a.k === "R" && b.k === "#") return [0xb8 | a.n, c.imm(b.t), c.rel(d.t, 3)];
      if (a.k === "@R" && b.k === "#") return [0xb6 | a.n, c.imm(b.t), c.rel(d.t, 3)];
      throw bad();
    }
    case "LJMP":
    case "JMP":
    case "LCALL":
    case "CALL": {
      if (mn === "JMP" && a?.k === "@A+DPTR") return [0x73];
      if (a?.k !== "x") throw bad();
      const v = c.addr16(a.t);
      return [mn.includes("CALL") ? 0x12 : 0x02, v >> 8, v & 0xff];
    }
    case "AJMP":
    case "ACALL": {
      if (a?.k !== "x") throw bad();
      const v = c.addr16(a.t);
      if (c.pass === 2 && ((c.pc + 2) & 0xf800) !== (v & 0xf800)) {
        throw new Error(`${mn} target is outside the 2 KB page, use L${mn.slice(1)}`);
      }
      return [(((v >> 8) & 7) << 5) | (mn === "AJMP" ? 0x01 : 0x11), v & 0xff];
    }
    default:
      throw new Error(`Unknown instruction "${mn}"`);
  }
}

function dataBytes(mn: string, rest: string, c: Ctx): number[] {
  const out: number[] = [];
  for (const item of splitOperands(rest)) {
    const s = /^(['"])(.*)\1$/.exec(item);
    if (s && mn === "DB") { for (const ch of s[2]) out.push(ch.charCodeAt(0) & 0xff); continue; }
    const v = c.expr(item);
    if (mn === "DB") out.push(v & 0xff);
    else out.push((v >> 8) & 0xff, v & 0xff);
  }
  return out;
}

export function assemble(source: string): AsmResult {
  const lines = source.split(/\r?\n/);
  const c = new Ctx();
  const image = new Uint8Array(0x10000);
  const lineForAddr = new Map<number, number>();
  const pass1Errors: AsmError[] = [];
  let errors: AsmError[] = [];
  let size = 0;

  for (const pass of [1, 2]) {
    c.pass = pass;
    c.pc = 0;
    errors = [];
    image.fill(0);
    lineForAddr.clear();
    size = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineNo = i + 1;
      let text = stripComment(lines[i]).trim();
      if (!text) continue;
      try {
        const lbl = /^([A-Za-z_]\w*):\s*(.*)$/.exec(text);
        if (lbl) {
          const name = lbl[1].toUpperCase();
          if (pass === 1) {
            if (c.labels.has(name)) pass1Errors.push({ line: lineNo, message: `Duplicate label ${name}` });
            c.labels.set(name, c.pc);
          }
          text = lbl[2].trim();
          if (!text) continue;
        }

        const equ = /^([A-Za-z_]\w*)\s+(EQU|BIT|SET)\s+(.+)$/i.exec(text);
        if (equ) {
          if (pass === 1) c.equs.set(equ[1].toUpperCase(), equ[3].trim());
          continue;
        }

        const sp = text.search(/\s/);
        const mn = (sp === -1 ? text : text.slice(0, sp)).toUpperCase();
        const rest = sp === -1 ? "" : text.slice(sp + 1).trim();

        if (mn === "END") break;
        if (mn === "ORG") { c.pc = c.expr(rest) & 0xffff; continue; }

        const bytes = mn === "DB" || mn === "DW"
          ? dataBytes(mn, rest, c)
          : encode(mn, rest ? splitOperands(rest).map(classify) : [], c);

        lineForAddr.set(c.pc, lineNo);
        for (const byte of bytes) { image[c.pc & 0xffff] = byte & 0xff; c.pc++; }
        size = Math.max(size, c.pc);
      } catch (e) {
        if (pass === 2) errors.push({ line: lineNo, message: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  return { image, size, errors: [...pass1Errors, ...errors], lineForAddr };
}