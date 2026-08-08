import type { BackendStatus, Business, SettingsForm } from "@/lib/types";

export async function fetchStatus(signal?: AbortSignal): Promise<BackendStatus> {
  const res = await fetch("/api/status", { signal });
  if (!res.ok) throw new Error(`Status request failed: ${res.status}`);
  return res.json();
}

export async function fetchBusinesses(signal?: AbortSignal): Promise<Business[]> {
  const res = await fetch("/api/businesses", { signal });
  if (!res.ok) throw new Error(`Businesses request failed: ${res.status}`);
  const data = await res.json();
  return data.businesses ?? [];
}

/** URL for the agent's server-sent-events stream. */
export function searchStreamUrl(query: string): string {
  return `/api/search?query=${encodeURIComponent(query)}`;
}

/** Sends only the fields the user actually filled in, so blanks keep current values. */
export async function saveSettings(form: SettingsForm): Promise<void> {
  const payload = Object.fromEntries(
    Object.entries(form).filter(([, value]) => value !== "")
  );

  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Settings request failed: ${res.status}`);
}
