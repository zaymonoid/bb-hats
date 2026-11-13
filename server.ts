// bb-plugin-hats — switch the sidebar between named sets of projects.
//
// A hat is a name, an icon, and a set of projects; a project can be in any
// number of hats. Wearing a hat hides every project that some other hat claims
// but this one does not, by writing the thread list's `hiddenGroups`
// preference. A project in no hat shows whichever hat you wear.
import { randomUUID } from "node:crypto";
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { HAT_ICONS } from "./icon-names";

const hatSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.enum(HAT_ICONS),
  projectIds: z.array(z.string()),
});
export type Hat = z.infer<typeof hatSchema>;

const storeSchema = z.object({
  hats: z.array(hatSchema),
  activeId: z.string().nullable(),
});
type Store = z.infer<typeof storeSchema>;

const projectSchema = z.object({ id: z.string(), name: z.string() });
export type Project = z.infer<typeof projectSchema>;

const stateSchema = storeSchema.extend({ projects: z.array(projectSchema) });
export type HatsState = z.infer<typeof stateSchema>;

const nameSchema = z.string().trim().min(1).max(40);

export const rpcContract = defineRpcContract({
  state: { input: z.null(), output: stateSchema },
  wear: { input: z.object({ id: z.string().nullable() }), output: stateSchema },
  next: { input: z.null(), output: stateSchema },
  create: {
    input: z.object({ name: nameSchema, icon: z.enum(HAT_ICONS) }),
    output: stateSchema,
  },
  update: {
    input: z.object({
      id: z.string(),
      name: nameSchema.optional(),
      icon: z.enum(HAT_ICONS).optional(),
    }),
    output: stateSchema,
  },
  remove: { input: z.object({ id: z.string() }), output: stateSchema },
  move: {
    input: z.object({ id: z.string(), offset: z.union([z.literal(-1), z.literal(1)]) }),
    output: stateSchema,
  },
  set_member: {
    input: z.object({ hatId: z.string(), projectId: z.string(), member: z.boolean() }),
    output: stateSchema,
  },
});

const STORE_KEY = "store";
const THREAD_LIST = "thread-list";
const PROJECT_PREFIX = "project:";

const DEFAULT_STORE: Store = {
  hats: [
    { id: "work", name: "Work", icon: "briefcase", projectIds: [] },
    { id: "personal", name: "Personal", icon: "user", projectIds: [] },
  ],
  activeId: null,
};

class HatsError extends Error {}

export default async function plugin(bb: BbPluginApi) {
  async function listProjects(): Promise<Project[]> {
    const projects = await bb.sdk.projects.list({ includePersonal: true });
    return projects.map(({ id, name }) => ({ id, name }));
  }

  async function readStore(): Promise<Store> {
    const stored = storeSchema.safeParse(await bb.storage.kv.get(STORE_KEY));
    return stored.success ? stored.data : structuredClone(DEFAULT_STORE);
  }

  /** Hide the projects other hats claim and the worn hat does not. */
  async function applyStore(store: Store): Promise<void> {
    const worn = store.hats.find((hat) => hat.id === store.activeId);
    const hidden = new Set<string>();
    if (worn !== undefined) {
      const shown = new Set(worn.projectIds);
      for (const hat of store.hats) {
        for (const id of hat.projectIds) if (!shown.has(id)) hidden.add(id);
      }
    }
    const { preferences } = await bb.sdk.plugins.callRpc({
      pluginId: THREAD_LIST,
      method: "listPreferences",
      input: null,
      outputSchema: z.object({
        preferences: z.object({ hiddenGroups: z.array(z.string()) }),
      }),
    });
    const kept = preferences.hiddenGroups.filter(
      (key) => !key.startsWith(PROJECT_PREFIX),
    );
    await bb.sdk.plugins.callRpc({
      pluginId: THREAD_LIST,
      method: "setPreference",
      input: {
        key: "hiddenGroups",
        value: [...kept, ...[...hidden].map((id) => `${PROJECT_PREFIX}${id}`)],
      },
      outputSchema: z.unknown(),
    });
  }

  /** The store plus the project list, with ids of deleted projects dropped. */
  async function readState(): Promise<HatsState> {
    const [store, projects] = await Promise.all([readStore(), listProjects()]);
    const known = new Set(projects.map((project) => project.id));
    const hats = store.hats.map((hat) => ({
      ...hat,
      projectIds: hat.projectIds.filter((id) => known.has(id)),
    }));
    return { ...store, hats, projects };
  }

  // Serialize writes so quick successive clicks never lose an update.
  let queue: Promise<unknown> = Promise.resolve();
  function mutate(change: (store: Store) => void): Promise<HatsState> {
    const run = queue.then(async () => {
      const { projects: _projects, ...store } = await readState();
      change(store);
      await bb.storage.kv.set(STORE_KEY, store);
      await applyStore(store);
      bb.realtime.publish("changed", { activeId: store.activeId });
      return readState();
    });
    queue = run.catch(() => undefined);
    return run;
  }

  function requireHat(store: Store, id: string): Hat {
    const hat = store.hats.find((candidate) => candidate.id === id);
    if (hat === undefined) throw new HatsError(`No hat with id ${id}`);
    return hat;
  }

  const wear = (id: string | null) =>
    mutate((store) => {
      if (id !== null) requireHat(store, id);
      store.activeId = id;
    });

  const next = () =>
    mutate((store) => {
      if (store.hats.length === 0) throw new HatsError("There are no hats to wear.");
      const index = store.hats.findIndex((hat) => hat.id === store.activeId);
      store.activeId = store.hats[(index + 1) % store.hats.length]?.id ?? null;
    });

  const create = (name: string, icon: Hat["icon"]) =>
    mutate((store) => {
      if (store.hats.some((hat) => hat.name.toLowerCase() === name.toLowerCase())) {
        throw new HatsError(`A hat named "${name}" already exists.`);
      }
      store.hats.push({ id: randomUUID().slice(0, 8), name, icon, projectIds: [] });
    });

  const update = (id: string, patch: { name?: string; icon?: Hat["icon"] }) =>
    mutate((store) => {
      const hat = requireHat(store, id);
      if (patch.name !== undefined) hat.name = patch.name;
      if (patch.icon !== undefined) hat.icon = patch.icon;
    });

  const remove = (id: string) =>
    mutate((store) => {
      requireHat(store, id);
      store.hats = store.hats.filter((hat) => hat.id !== id);
      if (store.activeId === id) store.activeId = null;
    });

  const move = (id: string, offset: -1 | 1) =>
    mutate((store) => {
      const from = store.hats.findIndex((hat) => hat.id === id);
      const to = from + offset;
      if (from === -1 || to < 0 || to >= store.hats.length) return;
      const [hat] = store.hats.splice(from, 1);
      if (hat !== undefined) store.hats.splice(to, 0, hat);
    });

  const setMember = (hatId: string, projectId: string, member: boolean) =>
    mutate((store) => {
      const hat = requireHat(store, hatId);
      const others = hat.projectIds.filter((id) => id !== projectId);
      hat.projectIds = member ? [...others, projectId] : others;
    });

  bb.rpc.register(rpcContract, {
    state: () => readState(),
    wear: ({ id }) => wear(id),
    next: () => next(),
    create: ({ name, icon }) => create(name, icon),
    update: ({ id, name, icon }) => update(id, { name, icon }),
    remove: ({ id }) => remove(id),
    move: ({ id, offset }) => move(id, offset),
    set_member: ({ hatId, projectId, member }) => setMember(hatId, projectId, member),
  });

  // ---- CLI ----------------------------------------------------------------

  /** Match by id, exact name, then unique partial name (case-insensitive). */
  function find<T extends { id: string; name: string }>(
    items: T[],
    query: string,
    kind: string,
  ): T {
    const needle = query.toLowerCase();
    const exact = items.filter(
      (item) => item.id === query || item.name.toLowerCase() === needle,
    );
    const matches =
      exact.length > 0
        ? exact
        : items.filter((item) => item.name.toLowerCase().includes(needle));
    const [match] = matches;
    if (matches.length !== 1 || match === undefined) {
      throw new HatsError(
        `No single ${kind} matches "${query}". Run "bb hats status" to see names.`,
      );
    }
    return match;
  }

  function parseIcon(value: string | undefined): Hat["icon"] {
    const icon = HAT_ICONS.find((candidate) => candidate === value);
    if (icon === undefined) {
      throw new HatsError(`Unknown icon "${value}". Icons: ${HAT_ICONS.join(", ")}`);
    }
    return icon;
  }

  function formatState(state: HatsState): string {
    const lines = state.hats.map((hat) => {
      const worn = hat.id === state.activeId ? "*" : " ";
      const names = hat.projectIds
        .map((id) => state.projects.find((project) => project.id === id)?.name ?? id)
        .join(", ");
      return `${worn} ${hat.name} (${hat.icon}): ${names || "no projects"}`;
    });
    const claimed = new Set(state.hats.flatMap((hat) => hat.projectIds));
    const free = state.projects.filter((project) => !claimed.has(project.id));
    if (free.length > 0) {
      lines.push(`  In every hat: ${free.map((project) => project.name).join(", ")}`);
    }
    if (state.activeId === null) lines.unshift("No hat worn: every project shows.");
    return lines.join("\n");
  }

  const usage = [
    "Usage:",
    "  bb hats status [--json]",
    "  bb hats wear <hat|none>",
    "  bb hats next",
    "  bb hats create <name> [icon]",
    "  bb hats rename <hat> <new name>",
    "  bb hats icon <hat> <icon>",
    "  bb hats delete <hat>",
    "  bb hats add <hat> <project>",
    "  bb hats remove <hat> <project>",
    "  bb hats icons",
  ].join("\n");

  bb.cli.register({
    name: "hats",
    summary: "Switch the sidebar between named sets of projects",
    commands: [
      { name: "status", summary: "Show hats, their projects, and the worn hat", usage: "bb hats status [--json]" },
      { name: "wear", summary: "Wear a hat, or none to show every project", usage: "bb hats wear <hat|none>" },
      { name: "next", summary: "Wear the next hat in order", usage: "bb hats next" },
      { name: "create", summary: "Create a hat", usage: "bb hats create <name> [icon]" },
      { name: "rename", summary: "Rename a hat", usage: "bb hats rename <hat> <new name>" },
      { name: "icon", summary: "Change a hat's icon", usage: "bb hats icon <hat> <icon>" },
      { name: "delete", summary: "Delete a hat", usage: "bb hats delete <hat>" },
      { name: "add", summary: "Add a project to a hat", usage: "bb hats add <hat> <project>" },
      { name: "remove", summary: "Remove a project from a hat", usage: "bb hats remove <hat> <project>" },
      { name: "icons", summary: "List the icons a hat can use", usage: "bb hats icons" },
    ],
    async run(argv) {
      const json = argv.includes("--json");
      const [command, first, ...rest] = argv.filter((arg) => arg !== "--json");
      const restText = rest.join(" ").trim();
      const ok = (state: HatsState) => ({
        exitCode: 0,
        stdout: json ? JSON.stringify(state) : formatState(state),
      });
      try {
        switch (command) {
          case undefined:
          case "status":
            return ok(await readState());
          case "help":
          case "--help":
            return { exitCode: 0, stdout: usage };
          case "icons":
            return { exitCode: 0, stdout: HAT_ICONS.join("\n") };
          case "next":
            return ok(await next());
        }
        if (first === undefined) return { exitCode: 1, stderr: usage };
        const state = await readState();
        switch (command) {
          case "wear":
            return ok(
              await wear(first === "none" ? null : find(state.hats, first, "hat").id),
            );
          case "create": {
            const name = nameSchema.safeParse(first);
            if (!name.success) break;
            return ok(await create(name.data, rest[0] === undefined ? "star" : parseIcon(rest[0])));
          }
          case "delete":
            return ok(await remove(find(state.hats, first, "hat").id));
        }
        if (restText === "") return { exitCode: 1, stderr: usage };
        const hat = find(state.hats, first, "hat");
        switch (command) {
          case "rename": {
            const name = nameSchema.safeParse(restText);
            if (!name.success) break;
            return ok(await update(hat.id, { name: name.data }));
          }
          case "icon":
            return ok(await update(hat.id, { icon: parseIcon(restText) }));
          case "add":
          case "remove": {
            const project = find(state.projects, restText, "project");
            return ok(await setMember(hat.id, project.id, command === "add"));
          }
        }
        return { exitCode: 1, stderr: usage };
      } catch (cause) {
        if (cause instanceof HatsError) return { exitCode: 1, stderr: cause.message };
        throw cause;
      }
    },
  });
}
