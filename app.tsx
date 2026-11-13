// bb-plugin-hats — a sidebar footer button that wears the next hat, and a
// settings section to create, rename, re-icon, and fill hats with projects.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { ComponentType, SVGProps } from "react";
import { definePluginApp, useRealtime } from "@get-bb/plugin-sdk/app";
import {
  Baby,
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  ChevronDown,
  ChevronUp,
  Coffee,
  Code,
  Dumbbell,
  FlaskConical,
  Gamepad2,
  Globe,
  GraduationCap,
  Hammer,
  Heart,
  House,
  Layers,
  Leaf,
  Moon,
  Mountain,
  Music,
  Palette,
  PawPrint,
  Plane,
  Plus,
  Rocket,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  Trash2,
  User,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { HatIcon } from "./icon-names";
import { HAT_ICONS } from "./icon-names";
import type { HatsState } from "./server";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const ICONS: Record<HatIcon, IconComponent> = {
  briefcase: Briefcase,
  user: User,
  house: House,
  heart: Heart,
  star: Star,
  sparkles: Sparkles,
  code: Code,
  rocket: Rocket,
  coffee: Coffee,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  dumbbell: Dumbbell,
  music: Music,
  palette: Palette,
  gamepad: Gamepad2,
  camera: Camera,
  plane: Plane,
  mountain: Mountain,
  leaf: Leaf,
  "paw-print": PawPrint,
  baby: Baby,
  wallet: Wallet,
  "shopping-bag": ShoppingBag,
  building: Building2,
  flask: FlaskConical,
  hammer: Hammer,
  globe: Globe,
  sun: Sun,
  moon: Moon,
  zap: Zap,
};

// ---- State shared by the footer button and the settings section ----------

// The footer callback and the footer icon run outside any plugin component,
// so state lives in a module store fed by the rpc route.
let current: HatsState | null = null;
const listeners = new Set<() => void>();
function publish(state: HatsState): HatsState {
  current = state;
  for (const listener of listeners) listener();
  return state;
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function useHats(): HatsState | null {
  return useSyncExternalStore(subscribe, () => current);
}

async function call(method: string, input: unknown = null): Promise<HatsState> {
  const response = await fetch(`/api/v1/plugins/hats/rpc/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const envelope = (await response.json()) as {
    ok?: boolean;
    result?: HatsState;
    error?: { message?: unknown };
  };
  if (!response.ok || envelope.ok !== true || envelope.result === undefined) {
    const message = envelope.error?.message;
    throw new Error(typeof message === "string" ? message : `HTTP ${response.status}`);
  }
  return publish(envelope.result);
}

function refresh(): void {
  call("state").catch(() => undefined);
}

function reportError(cause: unknown): void {
  toast.error(cause instanceof Error ? cause.message : String(cause));
}

/** Refetch on mount and on window focus. */
function useFreshHats(): HatsState | null {
  const state = useHats();
  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  return state;
}

/**
 * Also refetch whenever the server says so. SDK hooks only work inside slot
 * components, so the footer icon cannot use this; while the settings section
 * is open it keeps the shared store, and so the icon, current.
 */
function useLiveHats(): HatsState | null {
  useRealtime("changed", refresh);
  return useFreshHats();
}

// ---- Footer ---------------------------------------------------------------

function FooterIcon({ className }: { className?: string }) {
  const state = useFreshHats();
  const worn = state?.hats.find((hat) => hat.id === state.activeId);
  const Icon = worn === undefined ? Layers : ICONS[worn.icon];
  return <Icon className={className} aria-hidden="true" />;
}

// ---- Settings -------------------------------------------------------------

const iconButton =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

function IconPicker({
  value,
  onPick,
}: {
  value: HatIcon;
  onPick: (icon: HatIcon) => void;
}) {
  return (
    <div className="grid grid-cols-10 gap-1 rounded-md border border-border bg-background p-2">
      {HAT_ICONS.map((name) => {
        const Icon = ICONS[name];
        return (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={name === value}
            onClick={() => onPick(name)}
            className={`${iconButton} ${name === value ? "bg-accent text-foreground" : ""}`}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

function HatRow({
  hat,
  worn,
  first,
  last,
}: {
  hat: HatsState["hats"][number];
  worn: boolean;
  first: boolean;
  last: boolean;
}) {
  const [name, setName] = useState(hat.name);
  const [picking, setPicking] = useState(false);
  useEffect(() => setName(hat.name), [hat.name]);
  const Icon = ICONS[hat.icon];
  const commitName = () => {
    const next = name.trim();
    if (next === "" || next === hat.name) {
      setName(hat.name);
      return;
    }
    call("update", { id: hat.id, name: next }).catch((cause) => {
      setName(hat.name);
      reportError(cause);
    });
  };
  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`${iconButton} border border-border text-foreground`}
          aria-label={`Change ${hat.name} icon`}
          aria-expanded={picking}
          onClick={() => setPicking((open) => !open)}
        >
          <Icon className="size-4" />
        </button>
        <input
          value={name}
          maxLength={40}
          aria-label="Hat name"
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setName(hat.name);
              event.currentTarget.blur();
            }
          }}
          className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm hover:border-border focus:border-border focus:outline-none"
        />
        {worn ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-foreground">
            Wearing
          </span>
        ) : (
          <button
            type="button"
            className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => call("wear", { id: hat.id }).catch(reportError)}
          >
            Wear
          </button>
        )}
        <button
          type="button"
          className={iconButton}
          aria-label={`Move ${hat.name} up`}
          disabled={first}
          onClick={() => call("move", { id: hat.id, offset: -1 }).catch(reportError)}
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          type="button"
          className={iconButton}
          aria-label={`Move ${hat.name} down`}
          disabled={last}
          onClick={() => call("move", { id: hat.id, offset: 1 }).catch(reportError)}
        >
          <ChevronDown className="size-4" />
        </button>
        <button
          type="button"
          className={`${iconButton} hover:text-destructive`}
          aria-label={`Delete ${hat.name}`}
          onClick={() => {
            if (window.confirm(`Delete the ${hat.name} hat?`)) {
              call("remove", { id: hat.id }).catch(reportError);
            }
          }}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {picking ? (
        <div className="mt-2 pl-10">
          <IconPicker
            value={hat.icon}
            onPick={(icon) => {
              setPicking(false);
              call("update", { id: hat.id, icon }).catch(reportError);
            }}
          />
        </div>
      ) : null}
    </li>
  );
}

function ProjectMatrix({ state }: { state: HatsState }) {
  const claimed = new Set(state.hats.flatMap((hat) => hat.projectIds));
  if (state.hats.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="px-3 py-2 text-left font-normal">Project</th>
            {state.hats.map((hat) => {
              const Icon = ICONS[hat.icon];
              return (
                <th key={hat.id} className="px-2 py-2 font-normal" title={hat.name}>
                  <div className="flex flex-col items-center gap-0.5">
                    <Icon className="size-4" aria-hidden="true" />
                    <span className="max-w-20 truncate text-xs">{hat.name}</span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {state.projects.map((project) => (
            <tr key={project.id}>
              <td className="px-3 py-1.5">
                <span className="truncate">{project.name}</span>
                {claimed.has(project.id) ? null : (
                  <span className="ml-2 text-xs text-muted-foreground">every hat</span>
                )}
              </td>
              {state.hats.map((hat) => (
                <td key={hat.id} className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer accent-primary"
                    aria-label={`${project.name} in ${hat.name}`}
                    checked={hat.projectIds.includes(project.id)}
                    onChange={(event) =>
                      call("set_member", {
                        hatId: hat.id,
                        projectId: project.id,
                        member: event.target.checked,
                      }).catch(reportError)
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HatsSettings() {
  const state = useLiveHats();
  const [adding, setAdding] = useState(false);
  const addHat = useCallback(async () => {
    if (state === null || adding) return;
    setAdding(true);
    const taken = new Set(state.hats.map((hat) => hat.name.toLowerCase()));
    let name = "New hat";
    for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `New hat ${n}`;
    try {
      await call("create", { name, icon: "star" });
    } catch (cause) {
      reportError(cause);
    } finally {
      setAdding(false);
    }
  }, [state, adding]);

  if (state === null) {
    return <p className="text-sm text-muted-foreground">Loading hats…</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <ul className="divide-y divide-border">
          {state.hats.map((hat, index) => (
            <HatRow
              key={hat.id}
              hat={hat}
              worn={hat.id === state.activeId}
              first={index === 0}
              last={index === state.hats.length - 1}
            />
          ))}
        </ul>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            disabled={adding}
            onClick={addHat}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm hover:bg-accent disabled:opacity-50"
          >
            <Plus className="size-4" />
            Add hat
          </button>
          {state.activeId === null ? null : (
            <button
              type="button"
              onClick={() => call("wear", { id: null }).catch(reportError)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Take off hat (show every project)
            </button>
          )}
        </div>
      </div>
      <ProjectMatrix state={state} />
      <p className="text-xs text-muted-foreground">
        Wearing a hat hides projects that other hats claim. A project in no hat
        shows in every hat. The footer button wears the next hat in this order.
      </p>
    </div>
  );
}

// ---- Registration ---------------------------------------------------------

export default definePluginApp((app) => {
  app.experimental_icons.register({ name: "hats/worn", component: FooterIcon });
  app.experimental_sidebarFooter.register({
    kind: "action",
    id: "next-hat",
    label: "Switch hat",
    icon: "hats/worn",
    onActivate: async () => {
      try {
        const state = await call("next");
        const worn = state.hats.find((hat) => hat.id === state.activeId);
        toast(worn === undefined ? "Showing every project" : `Wearing ${worn.name}`);
      } catch (cause) {
        reportError(cause);
      }
    },
  });
  app.slots.settingsSection({
    id: "hats",
    title: "Hats",
    description: "Name sets of projects and switch the sidebar between them.",
    component: HatsSettings,
  });
});
