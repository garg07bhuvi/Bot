import type { BackendStatus, Business, SettingsForm } from "@/lib/types";

/**
 * Base URL of the agent backend. Override per environment with
 * NEXT_PUBLIC_API_BASE in .env.local — the localhost default only works in dev.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function fetchStatus(signal?: AbortSignal): Promise<BackendStatus> {
  const res = await fetch(`${API_BASE}/api/status`, { signal });
  if (!res.ok) throw new Error(`Status request failed: ${res.status}`);
  return res.json();
}

export async function fetchBusinesses(signal?: AbortSignal): Promise<Business[]> {
  const res = await fetch(`${API_BASE}/api/businesses`, { signal });
  if (!res.ok) throw new Error(`Businesses request failed: ${res.status}`);
  const data = await res.json();
  return data.businesses ?? [];
}

/** URL for the agent's server-sent-events stream. */
export function searchStreamUrl(query: string): string {
  return `${API_BASE}/api/search?query=${encodeURIComponent(query)}`;
}

/** Sends only the fields the user actually filled in, so blanks keep current values. */
export async function saveSettings(form: SettingsForm): Promise<void> {
  const payload = Object.fromEntries(
    Object.entries(form).filter(([, value]) => value !== "")
  );

  const res = await fetch(`${API_BASE}/api/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Settings request failed: ${res.status}`);
}
