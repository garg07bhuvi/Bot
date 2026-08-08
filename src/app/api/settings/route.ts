import type { NextRequest } from "next/server";
import { saveSettings } from "@/lib/store";

export async function POST(request: NextRequest) {
  const patch = await request.json();
  await saveSettings(patch);
  return Response.json({ ok: true });
}
