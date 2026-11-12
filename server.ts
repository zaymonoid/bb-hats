// bb-plugin-hats — switch the sidebar between Work and Personal.
//
// Each mode hides the other mode's projects by writing the thread list's
// `hiddenGroups` preference. A project in neither group shows in both modes.
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

const modeSchema = z.enum(["work", "personal"]);
export type Mode = z.infer<typeof modeSchema>;

const groupsSchema = z.object({
  work: z.array(z.string()),
  personal: z.array(z.string()),
});
type Groups = z.infer<typeof groupsSchema>;

const stateSchema = z.object({
  mode: modeSchema.nullable(),
  groups: groupsSchema,
});

export const rpcContract = defineRpcContract({
  state: { input: z.null(), output: stateSchema },
  toggle: { input: z.null(), output: z.object({ mode: modeSchema }) },
  set_mode: {
    input: z.object({ mode: modeSchema }),
    output: z.object({ mode: modeSchema }),
  },
});

/** The sidebar as it stood on 2026-11-12; used until the groups are edited. */
const SEED_GROUPS: Groups = {
  work: [
    "proj_pbtxi96w5n", // 📋 Signup
    "proj_kdpkfeeh2h", // OPS
    "proj_j6npwgpans", // utilityon-entsuite-commops
    "proj_qr25reqbqi", // utilityon-property-portal
    "proj_a84srp4ac5", // UtilityOn
    "proj_6yggd6pu49", // marketing
  ],
  personal: [
    "proj_scjxdpttk8", // Records and Invoices
    "proj_qhs2dhik2z", // 🫳 grippify
    "proj_p6ib6pmhpm", // katha
    "proj_aqz2shsxaj", // bb-kata-tracker
    "proj_qiiesspvkc", // kitbag
    "proj_jfvx7a7uej", // pocket-book
    "proj_g4m7tp7gvd", // 💍 Wedding
    "proj_qmc5fqqreh", // iosevka
  ],
};

const THREAD_LIST = "thread-list";
const PROJECT_PREFIX = "project:";
const OTHER: Record<Mode, Mode> = { work: "personal", personal: "work" };

export default async function plugin(bb: BbPluginApi) {
  async function readGroups(): Promise<Groups> {
    const stored = groupsSchema.safeParse(await bb.storage.kv.get("groups"));
    return stored.success ? stored.data : SEED_GROUPS;
  }
  async function readMode(): Promise<Mode | null> {
    const stored = modeSchema.safeParse(await bb.storage.kv.get("mode"));
    return stored.success ? stored.data : null;
  }

  /** Hide the other mode's projects, keeping any non-project hidden groups. */
  async function applyMode(mode: Mode, groups: Groups): Promise<void> {
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
    const hidden = groups[OTHER[mode]].map((id) => `${PROJECT_PREFIX}${id}`);
    await bb.sdk.plugins.callRpc({
      pluginId: THREAD_LIST,
      method: "setPreference",
      input: { key: "hiddenGroups", value: [...kept, ...hidden] },
      outputSchema: z.unknown(),
    });
  }

  async function setMode(mode: Mode): Promise<Mode> {
    await applyMode(mode, await readGroups());
    await bb.storage.kv.set("mode", mode);
    bb.realtime.publish("mode-changed", { mode });
    return mode;
  }
  async function toggle(): Promise<Mode> {
    const current = await readMode();
    return setMode(current === null ? "work" : OTHER[current]);
  }

  bb.rpc.register(rpcContract, {
    state: async () => ({ mode: await readMode(), groups: await readGroups() }),
    toggle: async () => ({ mode: await toggle() }),
    set_mode: async ({ mode }) => ({ mode: await setMode(mode) }),
  });

  type Project = { id: string; name: string };
  async function listProjects(): Promise<Project[]> {
    const projects = await bb.sdk.projects.list({ includePersonal: true });
    return projects.map(({ id, name }) => ({ id, name }));
  }
  function findProject(projects: Project[], query: string): Project | null {
    const needle = query.toLowerCase();
    const exact = projects.filter(
      (project) => project.id === query || project.name.toLowerCase() === needle,
    );
    if (exact.length === 1) return exact[0] ?? null;
    const partial = projects.filter((project) =>
      project.name.toLowerCase().includes(needle),
    );
    return partial.length === 1 ? (partial[0] ?? null) : null;
  }

  const usage = [
    "Usage:",
    "  bb hats status [--json]",
    "  bb hats toggle",
    "  bb hats work | personal",
    "  bb hats assign <project name or id> <work|personal|both>",
  ].join("\n");

  bb.cli.register({
    name: "hats",
    summary: "Switch the sidebar between Work and Personal project groups",
    commands: [
      {
        name: "status",
        summary: "Show the current mode and each project's group",
        usage: "bb hats status [--json]",
      },
      {
        name: "toggle",
        summary: "Switch to the other mode",
        usage: "bb hats toggle",
      },
      {
        name: "work",
        summary: "Show work projects and hide personal ones",
        usage: "bb hats work",
      },
      {
        name: "personal",
        summary: "Show personal projects and hide work ones",
        usage: "bb hats personal",
      },
      {
        name: "assign",
        summary: "Put a project in work, personal, or both modes",
        usage: "bb hats assign <project name or id> <work|personal|both>",
      },
    ],
    async run(argv) {
      const json = argv.includes("--json");
      const [command, ...args] = argv.filter((arg) => arg !== "--json");
      switch (command) {
        case undefined:
        case "help":
        case "--help":
          return { exitCode: 0, stdout: usage };
        case "status": {
          const [mode, groups, projects] = await Promise.all([
            readMode(),
            readGroups(),
            listProjects(),
          ]);
          const rows = projects.map((project) => ({
            ...project,
            group: groups.work.includes(project.id)
              ? "work"
              : groups.personal.includes(project.id)
                ? "personal"
                : "both",
          }));
          if (json) {
            return { exitCode: 0, stdout: JSON.stringify({ mode, projects: rows }) };
          }
          const lines = rows.map(
            (row) => `${row.group.padEnd(9)} ${row.id}  ${row.name}`,
          );
          return {
            exitCode: 0,
            stdout: [`Mode: ${mode ?? "not set"}`, ...lines].join("\n"),
          };
        }
        case "toggle":
          return { exitCode: 0, stdout: `Mode: ${await toggle()}` };
        case "work":
        case "personal":
          return { exitCode: 0, stdout: `Mode: ${await setMode(command)}` };
        case "assign": {
          const group = args.at(-1);
          const query = args.slice(0, -1).join(" ").trim();
          if (query === "" || !["work", "personal", "both"].includes(group ?? "")) {
            break;
          }
          const project = findProject(await listProjects(), query);
          if (project === null) {
            return {
              exitCode: 1,
              stderr: `No single project matches "${query}". Run "bb hats status" to see names and ids.`,
            };
          }
          const current = await readGroups();
          const groups: Groups = {
            work: current.work.filter((id) => id !== project.id),
            personal: current.personal.filter((id) => id !== project.id),
          };
          if (group === "work" || group === "personal") {
            groups[group].push(project.id);
          }
          await bb.storage.kv.set("groups", groups);
          const mode = await readMode();
          if (mode !== null) await applyMode(mode, groups);
          return { exitCode: 0, stdout: `${project.name}: ${group}` };
        }
      }
      return { exitCode: 1, stderr: usage };
    },
  });
}
