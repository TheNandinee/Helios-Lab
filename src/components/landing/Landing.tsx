import Link from "next/link";
import { Familjen_Grotesk, B612_Mono } from "next/font/google";
import HeroBoard from "./HeroBoard";

const display = Familjen_Grotesk({ subsets: ["latin"] });
const mono = B612_Mono({ subsets: ["latin"], weight: ["400", "700"] });

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7DD3FC]";

const BOARDS = [
  {
    name: "8051",
    chip: "AT89S52",
    does: "Write assembly, step through it one instruction at a time, and watch ACC, PSW and the ports change.",
    runs: "Runs on our own 8051 core in your browser, with timers and interrupts.",
  },
  {
    name: "Arduino Uno",
    chip: "ATmega328P",
    does: "Write C++ sketches with Serial, PWM and push buttons, then probe any pin on the oscilloscope.",
    runs: "Compiled in the cloud, then executed in your browser by avr8js.",
  },
  {
    name: "ESP32",
    chip: "Xtensa dual-core",
    does: "Read a potentiometer, join Wi-Fi and push live sensor readings into the cloud.",
    runs: "Runs in an embedded Wokwi simulator and streams to Firebase.",
  },
  {
    name: "Jetson Nano",
    chip: "Edge AI",
    does: "Tune an object-detection pipeline and watch bounding boxes, FPS and inference time.",
    runs: "A simulated TensorRT pipeline on a synthetic camera feed.",
  },
];

const STEPS = [
  { title: "Place parts", text: "Drop boards, LEDs and buttons on the 3D bench and wire each part to a pin." },
  { title: "Write firmware", text: "Code in the built-in editor, with highlighting for C++, 8051 assembly and Python." },
  { title: "Run and probe", text: "Press Run. LEDs light up, the serial monitor talks, and the oscilloscope shows every edge." },
  { title: "Save and submit", text: "Projects save to your account. Submit one and your instructor sees it on their dashboard." },
];

const CLOUD = [
  {
    title: "Scales with the class",
    text: "Each student's simulation runs on their own device. Vercel and Firebase only carry the sync, so adding students doesn't mean adding servers.",
  },
  {
    title: "Live sync",
    text: "Pin changes stream through Firebase Realtime Database, built to stay under 150 ms. Instructors can open a room and the class follows their bench and camera.",
  },
  {
    title: "Roles that hold",
    text: "Students, instructors and admins get different access, enforced by Firebase security rules rather than by the page. Students can't grade their own work.",
  },
  {
    title: "Keeps working offline",
    text: "Drafts save on your device and cached firmware still runs if the connection drops. If 3D rendering fails, the bench switches to a 2D schematic.",
  },
];

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="10" fill="none" stroke="#38BDF8" strokeWidth="3" />
      <circle cx="13" cy="13" r="4.5" fill="#FF4D3D" />
    </svg>
  );
}

export default function Landing() {
  return (
    <div className={`${display.className} min-h-screen bg-[#020617] text-[#EEF1EC]`}>
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className={`flex items-center gap-2 text-lg font-semibold ${focus}`}>
          <Logo /> Helios Lab
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#how" className={`hidden text-[#94A3B8] hover:text-white sm:inline ${focus}`}>How it works</a>
          <a href="https://github.com/TheNandinee/Helios-Lab" className={`hidden text-[#94A3B8] hover:text-white sm:inline ${focus}`}>GitHub</a>
          <Link href="/login" className={`text-[#94A3B8] hover:text-white ${focus}`}>Sign in</Link>
          <Link href="/lab" className={`rounded-full bg-[#38BDF8] px-4 py-2 font-semibold text-[#020617] hover:bg-[#7DD3FC] ${focus}`}>
            Open the lab
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-28 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div>
          <h1 className="max-w-[13ch] text-[clamp(2.75rem,6.2vw,5.25rem)] font-semibold leading-[0.98] tracking-[-0.025em]">
            A whole electronics lab, running in your browser.
          </h1>
          <p className="mt-7 max-w-[46ch] text-lg leading-relaxed text-[#A8B3C4]">
            Wire an 8051, Arduino Uno, ESP32 or Jetson Nano on a 3D bench, write the firmware, and watch every pin on a live
            oscilloscope. Your work syncs to the cloud, so the lab is open whenever you are.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/lab" className={`rounded-full bg-[#38BDF8] px-6 py-3 font-semibold text-[#020617] hover:bg-[#7DD3FC] ${focus}`}>
              Open the lab
            </Link>
            <Link href="/login" className={`rounded-full border border-[#334155] px-6 py-3 font-semibold hover:bg-[#0F172A] ${focus}`}>
              Create an account
            </Link>
          </div>
          <p className="mt-6 text-sm text-[#64748B]">No installs and no hardware kit. Try the bench as a guest first.</p>
        </div>
        <HeroBoard />
      </section>

      {/* Boards */}
      <section className="border-t border-[#1E293B] bg-[#0B1222]">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="max-w-[20ch] text-4xl font-semibold leading-tight tracking-[-0.015em]">Four boards, from the classic 8051 to edge AI</h2>
          <div className="mt-12">
            {BOARDS.map((b) => (
              <div key={b.name} className="grid gap-3 border-t border-[#1E293B] py-7 md:grid-cols-[220px_1fr_1fr] md:gap-10">
                <div>
                  <div className="text-2xl font-semibold">{b.name}</div>
                  <div className={`${mono.className} mt-1 text-xs text-[#38BDF8]`}>{b.chip}</div>
                </div>
                <p className="max-w-[44ch] leading-relaxed text-[#CBD5E1]">{b.does}</p>
                <p className="max-w-[44ch] leading-relaxed text-[#8391A7]">{b.runs}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How a session runs (a real sequence, so it's numbered) */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-4xl font-semibold tracking-[-0.015em]">How a lab session runs</h2>
        <ol className="mt-14 grid gap-12 md:grid-cols-4 md:gap-8">
          {STEPS.map((st, i) => (
            <li key={st.title} className="relative border-t-[3px] border-[#38BDF8] pt-8">
              <span className="absolute -top-[11px] left-0 h-5 w-5 rounded-full border-[3px] border-[#7DD3FC] bg-[#020617]" />
              <span className={`${mono.className} text-sm text-[#38BDF8]`}>{i + 1}</span>
              <h3 className="mt-2 text-xl font-semibold">{st.title}</h3>
              <p className="mt-2 max-w-[32ch] leading-relaxed text-[#A8B3C4]">{st.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Cloud */}
      <section className="border-t border-[#1E293B]">
        <div className="mx-auto grid max-w-6xl gap-14 px-6 py-24 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <h2 className="max-w-[14ch] text-4xl font-semibold leading-tight tracking-[-0.015em]">Why it lives in the cloud</h2>
            <p className="mt-5 max-w-[40ch] leading-relaxed text-[#A8B3C4]">
              Physical labs close at 5 pm, kits break, and there are never enough boards. Helios Lab keeps the bench, your code
              and your results online, with Firebase handling sign-in, storage and live data.
            </p>
          </div>
          <dl className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {CLOUD.map((c) => (
              <div key={c.title}>
                <dt className="text-lg font-semibold">{c.title}</dt>
                <dd className="mt-2 leading-relaxed text-[#A8B3C4]">{c.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Instructors */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-[#38BDF8] px-8 py-10 text-[#020617] md:flex-row md:items-center md:px-12">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.01em]">Teaching a lab?</h2>
            <p className="mt-2 max-w-[52ch] text-[#0C4A6E]">
              Create a room, share the six-character code, and walk the whole class through a circuit in real time.
            </p>
          </div>
          <Link href="/lab" className="rounded-full bg-[#020617] px-6 py-3 font-semibold text-[#EEF1EC] hover:bg-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#020617]">
            Open the lab
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#1E293B]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-[#64748B] sm:flex-row sm:justify-between">
          <span>Helios Lab is a student project for embedded systems and IoT courses, released under the MIT license.</span>
          <a href="https://github.com/TheNandinee/Helios-Lab" className={`hover:text-white ${focus}`}>Source on GitHub</a>
        </div>
      </footer>
    </div>
  );
}