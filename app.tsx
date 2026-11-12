// bb-plugin-project-modes — a sidebar footer button that flips the sidebar
// between the Work and Personal project groups. Its icon shows the current
// mode: a briefcase for Work, a person for Personal.
import { useEffect, useSyncExternalStore } from "react";
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";

type Mode = "work" | "personal" | null;

const RPC_BASE = "/api/v1/plugins/project-modes/rpc";
const ICON_NAME = "project-modes/mode";
const LABELS = { work: "Work projects", personal: "Personal projects" };

// The footer callback and the icon both live outside this plugin's React
// tree, so the mode is kept in a module store and read over the rpc route.
let currentMode: Mode = null;
const listeners = new Set<() => void>();
function setCurrentMode(mode: Mode): void {
  currentMode = mode;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function parseMode(value: unknown): Mode {
  return value === "work" || value === "personal" ? value : null;
}

async function callRpc(method: "state" | "toggle"): Promise<Mode> {
  const response = await fetch(`${RPC_BASE}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "null",
  });
  const envelope = (await response.json()) as {
    ok?: boolean;
    result?: { mode?: unknown };
    error?: { message?: unknown };
  };
  if (!response.ok || envelope.ok !== true) {
    const message = envelope.error?.message;
    throw new Error(
      typeof message === "string" ? message : `HTTP ${response.status}`,
    );
  }
  return parseMode(envelope.result?.mode);
}

function refreshMode(): void {
  callRpc("state").then(setCurrentMode, () => undefined);
}

function ModeIcon({ className }: { className?: string }) {
  const mode = useSyncExternalStore(subscribe, () => currentMode);
  // Pick up a switch made from the CLI or another window.
  useEffect(() => {
    refreshMode();
    window.addEventListener("focus", refreshMode);
    return () => window.removeEventListener("focus", refreshMode);
  }, []);
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {mode === "personal" ? (
        <>
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </>
      ) : mode === "work" ? (
        <>
          <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          <rect width="20" height="14" x="2" y="6" rx="2" />
        </>
      ) : (
        <>
          <path d="M8 3 4 7l4 4" />
          <path d="M4 7h16" />
          <path d="m16 21 4-4-4-4" />
          <path d="M20 17H4" />
        </>
      )}
    </svg>
  );
}

export default definePluginApp((app) => {
  app.experimental_icons.register({ name: ICON_NAME, component: ModeIcon });
  app.experimental_sidebarFooter.register({
    kind: "action",
    id: "toggle-mode",
    label: "Switch Work / Personal projects",
    icon: ICON_NAME,
    onActivate: async () => {
      try {
        const mode = await callRpc("toggle");
        setCurrentMode(mode);
        if (mode !== null) toast(LABELS[mode]);
      } catch (cause) {
        toast.error(
          `Could not switch projects: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
    },
  });
});
