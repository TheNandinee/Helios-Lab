export const maxDuration = 30;

export async function POST(req: Request) {
  let sketch: unknown;
  try {
    ({ sketch } = await req.json());
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof sketch !== "string" || sketch.length === 0 || sketch.length > 100_000) {
    return Response.json({ error: "Sketch must be a non-empty string under 100 KB" }, { status: 400 });
  }

  const started = Date.now();
  try {
    const res = await fetch("https://hexi.wokwi.com/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sketch }),
    });
    if (!res.ok) {
      return Response.json({ error: `Build server returned ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as { hex?: string; stdout?: string; stderr?: string };
    return Response.json({ ...data, buildMs: Date.now() - started });
  } catch (err) {
    return Response.json(
      { error: `Build server unreachable: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}