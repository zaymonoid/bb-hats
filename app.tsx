// bb-plugin-hats — a sidebar footer button that switches to the next hat, and a
// settings section to create, rename, re-icon, and fill hats with projects.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ComponentType, SVGProps } from "react";
import { definePluginApp, useRealtime } from "@get-bb/plugin-sdk/app";
import * as Popover from "@radix-ui/react-popover";
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

// The host's settings pages use this for captions under a heading.
const caption = "text-xs leading-snug text-subtle-foreground/75";
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const iconButton = `inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 ${focusRing}`;
const textButton = `inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm disabled:pointer-events-none disabled:opacity-50 ${focusRing}`;

/** "book-open" reads as "Book open" in a tooltip. */
function iconTitle(name: HatIcon): string {
  const words = name.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function IconPicker({
  hatName,
  value,
  onPick,
}: {
  hatName: string;
  value: HatIcon;
  onPick: (icon: HatIcon) => void;
}) {
  const [open, setOpen] = useState(false);
  const Current = ICONS[value];
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Change icon"
          aria-label={`Change ${hatName} icon`}
          className={`${iconButton} border border-border text-foreground`}
        >
          <Current className="size-4" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          // The portal renders outside the plugin's mount, so it needs the
          // plugin scope for this build's classes to apply.
          data-bb-plugin="hats"
          data-bb-plugin-root=""
          className="z-50 grid grid-cols-6 gap-1 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-md"
        >
          {HAT_ICONS.map((name) => {
            const Icon = ICONS[name];
            return (
              <button
                key={name}
                type="button"
                title={iconTitle(name)}
                aria-label={name}
                aria-pressed={name === value}
                onClick={() => {
                  setOpen(false);
                  if (name !== value) onPick(name);
                }}
                className={`${iconButton} ${name === value ? "bg-accent text-foreground" : ""}`}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function HatRow({
  hat,
  projectCount,
  worn,
  first,
  last,
  focusName,
}: {
  hat: HatsState["hats"][number];
  projectCount: number;
  worn: boolean;
  first: boolean;
  last: boolean;
  /** Focus and select the name, for a hat that was just added. */
  focusName: boolean;
}) {
  const [name, setName] = useState(hat.name);
  const [confirming, setConfirming] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  // Escape blurs the input, and that blur must not save the abandoned text.
  const discardEdit = useRef(false);
  useEffect(() => setName(hat.name), [hat.name]);
  useEffect(() => {
    if (!focusName) return;
    nameInput.current?.focus();
    nameInput.current?.select();
  }, [focusName]);
  const commitName = () => {
    const next = name.trim();
    const discard = discardEdit.current;
    discardEdit.current = false;
    if (discard || next === "" || next === hat.name) {
      setName(hat.name);
      return;
    }
    call("update", { id: hat.id, name: next }).catch((cause) => {
      setName(hat.name);
      reportError(cause);
    });
  };
  return (
    <li className="flex items-center gap-1 px-2 py-1.5">
      <IconPicker
        hatName={hat.name}
        value={hat.icon}
        onPick={(icon) => call("update", { id: hat.id, icon }).catch(reportError)}
      />
      <input
        ref={nameInput}
        value={name}
        maxLength={40}
        aria-label="Hat name"
        onChange={(event) => setName(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            // Stop here, or the host closes Settings on Escape.
            event.stopPropagation();
            discardEdit.current = true;
            event.currentTarget.blur();
          }
        }}
        className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm font-medium hover:border-border focus:border-ring focus:outline-none"
      />
      {confirming ? (
        <div
          className="flex items-center gap-1"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setConfirming(false);
            }
          }}
        >
          <span className="px-1 text-sm text-muted-foreground">Delete this hat?</span>
          <button
            type="button"
            autoFocus
            className={`${textButton} text-muted-foreground hover:bg-accent hover:text-foreground`}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${textButton} text-destructive hover:bg-destructive/10`}
            onClick={() => call("remove", { id: hat.id }).catch(reportError)}
          >
            Delete
          </button>
        </div>
      ) : (
        <>
          <span className="hidden whitespace-nowrap px-1 text-xs tabular-nums text-subtle-foreground/75 sm:inline">
            {projectCount === 1 ? "1 project" : `${projectCount} projects`}
          </span>
          <div className="flex w-16 shrink-0 justify-end">
            {worn ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-foreground">
                Current
              </span>
            ) : (
              <button
                type="button"
                className={`h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground ${focusRing}`}
                onClick={() => call("wear", { id: hat.id }).catch(reportError)}
              >
                Switch
              </button>
            )}
          </div>
          <button
            type="button"
            className={iconButton}
            title="Move up"
            aria-label={`Move ${hat.name} up`}
            disabled={first}
            onClick={() => call("move", { id: hat.id, offset: -1 }).catch(reportError)}
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            className={iconButton}
            title="Move down"
            aria-label={`Move ${hat.name} down`}
            disabled={last}
            onClick={() => call("move", { id: hat.id, offset: 1 }).catch(reportError)}
          >
            <ChevronDown className="size-4" />
          </button>
          <button
            type="button"
            className={`${iconButton} hover:bg-destructive/10 hover:text-destructive`}
            title="Delete hat"
            aria-label={`Delete ${hat.name}`}
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-4" />
          </button>
        </>
      )}
    </li>
  );
}

function ProjectMatrix({ state }: { state: HatsState }) {
  const claimed = new Set(state.hats.flatMap((hat) => hat.projectIds));
  if (state.projects.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
        No projects yet. Projects you add to bb appear here.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-muted-foreground">
            <th className="w-full px-3 py-2 text-left align-bottom text-xs font-normal">
              Project
            </th>
            {state.hats.map((hat) => {
              const Icon = ICONS[hat.icon];
              return (
                <th key={hat.id} className="min-w-16 px-2 py-2 font-normal" title={hat.name}>
                  <div className="flex flex-col items-center gap-1">
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
            <tr key={project.id} className="hover:bg-muted/40">
              <td className="w-full min-w-44 max-w-0 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="truncate" title={project.name}>
                    {project.name}
                  </span>
                  {claimed.has(project.id) ? null : (
                    <span
                      className="shrink-0 rounded-full border border-border px-1.5 text-[11px] leading-4 text-muted-foreground"
                      title="In no hat, so it always shows"
                    >
                      every hat
                    </span>
                  )}
                </div>
              </td>
              {state.hats.map((hat) => (
                <td key={hat.id} className="p-0">
                  <label className="flex cursor-pointer items-center justify-center px-2 py-2">
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
                  </label>
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
  const [addedId, setAddedId] = useState<string | null>(null);
  const addHat = useCallback(async () => {
    if (state === null || adding) return;
    setAdding(true);
    const before = new Set(state.hats.map((hat) => hat.id));
    const taken = new Set(state.hats.map((hat) => hat.name.toLowerCase()));
    let name = "New hat";
    for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `New hat ${n}`;
    try {
      const next = await call("create", { name, icon: "star" });
      setAddedId(next.hats.find((hat) => !before.has(hat.id))?.id ?? null);
    } catch (cause) {
      reportError(cause);
    } finally {
      setAdding(false);
    }
  }, [state, adding]);

  if (state === null) {
    return <p className="text-sm text-muted-foreground">Loading hats…</p>;
  }
  const projectIds = new Set(state.projects.map((project) => project.id));
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        {state.hats.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No hats yet. Add one, then choose its projects.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {state.hats.map((hat, index) => (
              <HatRow
                key={hat.id}
                hat={hat}
                projectCount={hat.projectIds.filter((id) => projectIds.has(id)).length}
                worn={hat.id === state.activeId}
                first={index === 0}
                last={index === state.hats.length - 1}
                focusName={hat.id === addedId}
              />
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            disabled={adding}
            onClick={addHat}
            className={`${textButton} border border-border hover:bg-accent`}
          >
            <Plus className="size-4" />
            Add hat
          </button>
          {state.activeId === null ? (
            state.hats.length === 0 ? null : (
              <span className="text-sm text-muted-foreground">
                All projects are showing.
              </span>
            )
          ) : (
            <button
              type="button"
              onClick={() => call("wear", { id: null }).catch(reportError)}
              className={`${textButton} text-muted-foreground hover:bg-accent hover:text-foreground`}
            >
              Show all projects
            </button>
          )}
        </div>
        {state.hats.length < 2 ? null : (
          <p className={caption}>
            The sidebar's footer button cycles through hats in this order.
          </p>
        )}
      </section>
      {state.hats.length === 0 ? null : (
        <section className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">Projects</h3>
            <p className={caption}>
              Switching to a hat hides the projects that only other hats include.
              A project in no hat shows in every hat.
            </p>
          </div>
          <ProjectMatrix state={state} />
        </section>
      )}
    </div>
  );
}

// ---- Registration ---------------------------------------------------------

export default definePluginApp((app) => {
  app.experimental_icons.register({ name: "hats/worn", component: FooterIcon });
  app.experimental_sidebarFooter.register({
    kind: "action",
    id: "next-hat",
    label: "Cycle hats",
    icon: "hats/worn",
    onActivate: async () => {
      try {
        const state = await call("next");
        const worn = state.hats.find((hat) => hat.id === state.activeId);
        toast(worn === undefined ? "Showing all projects" : `Switched to ${worn.name}`);
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
