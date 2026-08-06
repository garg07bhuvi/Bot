"use client";

import { useState, type FormEvent } from "react";
import { saveSettings } from "@/lib/api";
import type { SettingsForm } from "@/lib/types";

export function SettingsModal({
  initialForm,
  onClose,
  onSaved,
}: {
  initialForm: SettingsForm;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<SettingsForm>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveSettings(form);
      await onSaved();
      onClose();
    } catch (err) {
      console.error("Error saving settings:", err);
      setError("Failed to save settings. Check that the backend is running.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="bg-[var(--card)] border border-[var(--border)] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div>
            <h3 id="settings-title" className="text-base font-bold text-[var(--foreground)]">
              Agent Settings
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Configure search provider and credentials
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs text-[var(--foreground)]">
          <div className="space-y-1">
            <label htmlFor="openrouter-key" className="block text-[var(--muted-foreground)] font-semibold">
              OpenRouter API Key
            </label>
            <input
              id="openrouter-key"
              type="password"
              value={form.openrouter_api_key}
              onChange={(e) => update({ openrouter_api_key: e.target.value })}
              placeholder="Paste OPENROUTER_API_KEY (leave blank to keep current)"
              className="w-full bg-[var(--background)] px-3 py-2 rounded-lg border border-[var(--border)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="mongo-uri" className="block text-[var(--muted-foreground)] font-semibold">
              MongoDB URI
            </label>
            <input
              id="mongo-uri"
              type="text"
              value={form.mongodb_uri}
              onChange={(e) => update({ mongodb_uri: e.target.value })}
              placeholder="mongodb://localhost:27017 (leave blank to keep current)"
              className="w-full bg-[var(--background)] px-3 py-2 rounded-lg border border-[var(--border)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="provider" className="block text-[var(--muted-foreground)] font-semibold">
              Default Search Provider
            </label>
            <select
              id="provider"
              value={form.search_provider}
              onChange={(e) => update({ search_provider: e.target.value })}
              className="w-full bg-[var(--background)] px-3 py-2 rounded-lg border border-[var(--border)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
            >
              <option value="google">Google Places API (Official, Default)</option>
              <option value="osm">OpenStreetMap (Free, no setup)</option>
              <option value="maps_scraper">Google Maps Extractor (Local desktop app required)</option>
              <option value="serper">Serper Maps API (Key required)</option>
            </select>
          </div>

          {form.search_provider === "google" && (
            <div className="space-y-1">
              <label htmlFor="places-key" className="block text-[var(--muted-foreground)] font-semibold">
                Google Places API Key
              </label>
              <input
                id="places-key"
                type="password"
                value={form.google_places_api_key}
                onChange={(e) => update({ google_places_api_key: e.target.value })}
                placeholder="Paste GOOGLE_PLACES_API_KEY"
                className="w-full bg-[var(--background)] px-3 py-2 rounded-lg border border-[var(--border)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
          )}

          {form.search_provider === "serper" && (
            <div className="space-y-1">
              <label htmlFor="serper-key" className="block text-[var(--muted-foreground)] font-semibold">
                Serper API Key
              </label>
              <input
                id="serper-key"
                type="password"
                value={form.serper_api_key}
                onChange={(e) => update({ serper_api_key: e.target.value })}
                placeholder="Paste SERPER_API_KEY"
                className="w-full bg-[var(--background)] px-3 py-2 rounded-lg border border-[var(--border)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-[var(--destructive)] text-[11px]">
              {error}
            </p>
          )}

          <div className="pt-3 border-t border-[var(--border)] flex space-x-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] text-[var(--foreground)] rounded-lg hover:text-[var(--foreground)] transition duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[var(--primary)] hover:bg-[#a84e35] text-[var(--foreground)] rounded-lg transition duration-200 cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
