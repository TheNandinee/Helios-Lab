import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-5xl font-bold tracking-tight">
        Helios <span className="text-sky-400">Lab</span>
      </h1>
      <p className="max-w-xl text-slate-400">
        A cloud-native 3D virtual laboratory for embedded systems and IoT: from the 8051
        to NVIDIA Jetson, right in your browser.
      </p>
      <div className="flex gap-4">
        <Link href="/login" className="rounded-lg bg-sky-500 px-6 py-3 font-semibold text-slate-950 hover:bg-sky-400">
          Sign in
        </Link>
        <Link href="/lab" className="rounded-lg border border-slate-600 px-6 py-3 hover:bg-slate-800">
          Try demo bench
        </Link>
      </div>
    </main>
  );
}