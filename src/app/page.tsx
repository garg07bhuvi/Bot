import { Dashboard } from "@/components/dashboard";

/**
 * Server Component. The static branding below renders on the server and is
 * passed into the client dashboard as a prop, so it costs no client JS.
 */
export default function Page() {
  return <Dashboard brand={<Brand />} />;
}

function Brand() {
  return (
    <div className="flex items-center space-x-3">
      <div className="w-10 h-10 rounded-lg bg-[var(--primary)] flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-5 h-5 text-white"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.59 14.37a6 6 0 0 1-8.22-.07m0 0a8.3 8.3 0 0 0-2.28-2.28m7.22 7.22v3.75m0-3.75a1.5 1.5 0 0 1-3 0M3.75 3v1.5m0 0v3.75m0-3.75h3.75M20.25 3v1.5m0 0v3.75m0-3.75h-3.75M3 20.25v-1.5m0 0v-3.75m0 3.75h3.75m13.5 0v-1.5m0 0v-3.75m0 3.75h-3.75"
          />
        </svg>
      </div>
      <div>
        <h1 className="text-xl font-display tracking-tight text-[var(--foreground)] flex items-center">
          AURA
          <span className="text-xs font-sans font-medium bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 rounded ml-2 border border-[var(--primary)]/25">
            Scout Agent
          </span>
        </h1>
        <p className="text-xs text-[var(--muted-foreground)]">
          Autonomous business extraction agent
        </p>
      </div>
    </div>
  );
}
