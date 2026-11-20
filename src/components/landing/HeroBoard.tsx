"use client";

import { useEffect, useRef, useState } from "react";
import { B612_Mono } from "next/font/google";
import s from "./landing.module.css";

const mono = B612_Mono({ subsets: ["latin"], weight: ["400", "700"] });

const COPPER = "#38BDF8";
const GOLD = "#7DD3FC";
const SILK = "#EEF1EC";
const MASK = "#0F172A";
const DEEP = "#020617";
const SAMPLES = 64;

// Copper traces, drawn in this order on load
const TRACES = [
  "M48 78 H110 L158 127.5",          // J1 -> U1
  "M48 98 H96 L142 147.5 H158",      // J1 -> U1
  "M90 300 V267.5 H158",             // Y1 -> U1
  "M120 312 H140 L158 287.5",        // Y1 -> U1
  "M312 147.5 H350 L370 127.5 H392", // U1 -> R1
  "M448 127.5 H474",                 // R1 -> D1
  "M494 148 V205",                   // D1 -> GND via
  "M312 267.5 H372 L402 297.5 H444", // U1 -> SW1
  "M496 300 H520 V250",              // SW1 -> GND via
  "M230 300 V340 L250 360 H330",     // decorative bus
  "M260 300 V330 L270 340 H330",
];
const LED_TRACE = "M312 147.5 H350 L370 127.5 H392 M448 127.5 H474";
const VIAS: [number, number][] = [[494, 210], [520, 245], [336, 360], [336, 340], [400, 60], [420, 60]];
const PIN_Y = Array.from({ length: 9 }, (_, i) => 124 + i * 20);

export default function HeroBoard() {
  const [powered, setPowered] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [led, setLed] = useState(false);
  const [history, setHistory] = useState<number[]>(() => Array(SAMPLES).fill(0));
  const pressedRef = useRef(false);

  // Power on once the traces have finished routing
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => {
      setReduced(prefersReduced);
      setPowered(true);
    }, prefersReduced ? 0 : 1700);
    return () => clearTimeout(t);
  }, []);

  // "Firmware": blink every 500 ms, the button forces the LED on, the probe samples the pin
  useEffect(() => {
    if (!powered) return;
    let n = 0;
    const id = setInterval(() => {
      n++;
      const on = pressedRef.current || (!reduced && Math.floor(n / 5) % 2 === 0);
      setLed(on);
      setHistory((h) => [...h.slice(1), on ? 1 : 0]);
    }, 100);
    return () => clearInterval(id);
  }, [powered, reduced]);

  const press = (down: boolean) => {
    pressedRef.current = down;
    setPressed(down);
    if (down && powered) setLed(true);
  };

  // Square-wave polyline for the probe
  const step = 560 / (SAMPLES - 1);
  const points: string[] = [];
  history.forEach((v, i) => {
    const y = v ? 12 : 46;
    if (i > 0) points.push(`${(i * step).toFixed(1)},${history[i - 1] ? 12 : 46}`);
    points.push(`${(i * step).toFixed(1)},${y}`);
  });

  return (
    <div className="w-full">
      <svg
        viewBox="0 0 560 400"
        className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
        role="img"
        aria-label="A circuit board with a microcontroller, a resistor, an LED and a push button"
      >
        <defs>
          <radialGradient id="ledGlow">
            <stop offset="0%" stopColor="#FF6A4D" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#FF4D3D" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FF4D3D" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Board */}
        <rect x="8" y="8" width="544" height="384" rx="22" fill={MASK} stroke="#1E293B" strokeWidth="2" />
        {[[34, 34], [526, 34], [34, 366], [526, 366]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="9" fill={DEEP} stroke={GOLD} strokeWidth="4" />
        ))}

        {/* Copper traces */}
        <g fill="none" stroke={COPPER} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          {TRACES.map((d, i) => (
            <path key={d} d={d} pathLength={1} className={s.trace} style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </g>
        {led && (
          <path d={LED_TRACE} pathLength={1} className={s.flow} fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
        )}
        {VIAS.map(([x, y]) => (
          <circle key={`v${x}-${y}`} cx={x} cy={y} r="5" fill={DEEP} stroke={GOLD} strokeWidth="3" />
        ))}

        {/* J1: USB connector */}
        <rect x="8" y="60" width="40" height="56" rx="3" fill="#A7ADA9" />
        <rect x="14" y="70" width="28" height="36" rx="2" fill="#6E7470" />

        {/* U1: microcontroller */}
        {PIN_Y.map((y) => (
          <g key={y} fill={GOLD}>
            <rect x="158" y={y} width="12" height="7" />
            <rect x="300" y={y} width="12" height="7" />
          </g>
        ))}
        <rect x="170" y="110" width="130" height="190" rx="4" fill="#151917" />
        <path d="M225 110 A10 10 0 0 0 245 110" fill={MASK} />
        <text x="235" y="205" transform="rotate(-90 235 205)" textAnchor="middle" fontSize="15" fill="#7A8780" className={mono.className}>
          AT89S52
        </text>

        {/* R1: resistor */}
        <rect x="392" y="122" width="10" height="11" fill={GOLD} />
        <rect x="438" y="122" width="10" height="11" fill={GOLD} />
        <rect x="402" y="119" width="36" height="17" rx="2" fill="#1B1D1A" />

        {/* D1: LED */}
        <circle cx="494" cy="128" r="46" fill="url(#ledGlow)" className={s.glow} opacity={led ? 1 : 0} />
        <circle cx="494" cy="128" r="13" fill={led ? "#FF4D3D" : "#4A1712"} />
        <circle cx="489" cy="123" r="4" fill="#FFFFFF" opacity={led ? 0.7 : 0.15} />

        {/* Y1: 12 MHz crystal */}
        <rect x="60" y="300" width="60" height="24" rx="12" fill="#B9BDB5" />

        {/* SW1: push button (interactive) */}
        <g
          className={s.sw}
          role="button"
          tabIndex={0}
          aria-label="Hold SW1 to light the LED"
          aria-pressed={pressed}
          onPointerDown={() => press(true)}
          onPointerUp={() => press(false)}
          onPointerLeave={() => press(false)}
          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); press(true); } }}
          onKeyUp={() => press(false)}
        >
          <rect className={s.ring} x="436" y="266" width="68" height="68" rx="10" fill="none" stroke={GOLD} strokeWidth="2" />
          {[[444, 274], [490, 274], [444, 320], [490, 320]].map(([x, y]) => (
            <rect key={`p${x}-${y}`} x={x} y={y} width="6" height="6" fill={GOLD} />
          ))}
          <rect x="446" y="276" width="48" height="48" rx="6" fill="#20262A" />
          <circle cx="470" cy="300" r={pressed ? 13 : 15} fill={pressed ? "#8E9794" : "#C7CDCA"} />
        </g>

        {/* Silkscreen */}
        <g className={`${s.silk} ${mono.className}`} fill={SILK} fontSize="12">
          <rect x="150" y="100" width="170" height="210" fill="none" stroke={SILK} strokeWidth="1.5" />
          <text x="150" y="93">U1</text>
          <text x="52" y="56">J1</text>
          <text x="404" y="111">R1  220</text>
          <circle cx="494" cy="128" r="20" fill="none" stroke={SILK} strokeWidth="1.5" />
          <text x="474" y="96">D1</text>
          <text x="60" y="344">Y1 12MHz</text>
          <text x="440" y="356">SW1</text>
          <text x="40" y="384" fontSize="11" opacity="0.7">Helios Lab rev 1.0</text>
        </g>
      </svg>

      {/* Logic probe on D1 */}
      <div className="mt-4 rounded-xl border border-[#1E293B] bg-[#01040F] px-4 pb-3 pt-2">
        <div className={`${mono.className} mb-1 flex justify-between text-[11px] text-[#64748B]`}>
          <span>Probe on D1</span>
          <span>{led ? "HIGH  5.00 V" : "LOW   0.00 V"}</span>
        </div>
        <svg viewBox="0 0 560 58" className="h-14 w-full" preserveAspectRatio="none" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line key={i} x1={i * 70} x2={i * 70} y1="0" y2="58" stroke="#1E293B" strokeWidth="1" />
          ))}
          <polyline points={points.join(" ")} fill="none" stroke={GOLD} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className="mt-3 text-sm text-[#94A3B8]">Hold SW1 to light D1, the same way the push-button example works in the lab.</p>
    </div>
  );
}