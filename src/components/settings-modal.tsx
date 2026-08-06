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
        className="bg-[#121214] border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <h3 id="settings-title" className="text-base font-bold text-white">
              Agent Settings
            </h3>
            <p className="text-xs text-zinc-500">
              Configure search provider and credentials
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-zinc-500 hover:text-white"
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

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs text-zinc-300">
          <div className="space-y-1">
            <label htmlFor="gemini-key" className="block text-zinc-400 font-semibold">
              Gemini API Key
            </label>
            <input
              id="gemini-key"
              type="password"
              value={form.gemini_api_key}
              onChange={(e) => update({ gemini_api_key: e.target.value })}
              placeholder="Paste GEMINI_API_KEY (leave blank to keep current)"
              className="w-full bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="mongo-uri" className="block text-zinc-400 font-semibold">
              MongoDB URI
            </label>
            <input
              id="mongo-uri"
              type="text"
              value={form.mongodb_uri}
              onChange={(e) => update({ mongodb_uri: e.target.value })}
              placeholder="mongodb://localhost:27017 (leave blank to keep current)"
              className="w-full bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="provider" className="block text-zinc-400 font-semibold">
              Default Search Provider
            </label>
            <select
              id="provider"
              value={form.search_provider}
              onChange={(e) => update({ search_provider: e.target.value })}
              className="w-full bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="bing">Bing Search Scraper (Free, Default)</option>
              <option value="google">Google Places API (Key required)</option>
              <option value="serper">Serper Maps API (Key required)</option>
            </select>
          </div>

          {form.search_provider === "google" && (
            <div className="space-y-1">
              <label htmlFor="places-key" className="block text-zinc-400 font-semibold">
                Google Places API Key
              </label>
              <input
                id="places-key"
                type="password"
                value={form.google_places_api_key}
                onChange={(e) => update({ google_places_api_key: e.target.value })}
                placeholder="Paste GOOGLE_PLACES_API_KEY"
                className="w-full bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-purple-500"
              />
            </div>
          )}

          {form.search_provider === "serper" && (
            <div className="space-y-1">
              <label htmlFor="serper-key" className="block text-zinc-400 font-semibold">
                Serper API Key
              </label>
              <input
                id="serper-key"
                type="password"
                value={form.serper_api_key}
                onChange={(e) => update({ serper_api_key: e.target.value })}
                placeholder="Paste SERPER_API_KEY"
                className="w-full bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-purple-500"
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-rose-400 text-[11px]">
              {error}
            </p>
          )}

          <div className="pt-3 border-t border-zinc-800 flex space-x-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg hover:text-white transition duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition duration-200 cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
