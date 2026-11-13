# AGENTS.md

Hats is a bb plugin that switches the sidebar between named sets of projects.
See README.md for what it does.

## Layout

- `server.ts`: hats storage, the `hiddenGroups` writes, RPC, and the `bb hats` CLI.
- `app.tsx`: the sidebar footer button and the settings page.
- `icon-names.ts`: the icons a hat can use, shared by server and app.
- `skills/hats/SKILL.md`: agent docs for the CLI. Update it with any CLI change.
- `PLUGIN_OVERVIEW.md`: the marketplace long-form description.
- `docs/*.gif`: the README recordings.
- `media/`: scripts for the demo bb instance, screenshots, and recordings.

## Develop

```sh
npm run typecheck
bb plugin build .
bb plugin reload hats
```

Version control is jj, colocated with git. The remote uses SSH
(`git@github.com:zaymonoid/bb-hats.git`).

## Release

1. Bump `version` in `package.json` and commit.
2. Tag and push: `git tag -a vX.Y.Z -m "Release vX.Y.Z" <commit>`, then
   `jj git push --bookmark main` and `git push origin vX.Y.Z`.
3. The marketplace entry tracks `^0.1.0`, so a `0.1.x` tag needs no
   marketplace change. A new minor or major range, or any change to the
   name, description, icon, overview, or screenshots, needs a marketplace PR
   (entry in `zaymonoid/marketplace`, branch per change, PR to
   `get-bb/marketplace`).

**If the release changes any plugin copy or UI, update the media before you
publish it.** That means the README GIFs in `docs/`, the marketplace
screenshots and WebPs, and `PLUGIN_OVERVIEW.md` if the copy there is now
wrong. Copy includes labels, toasts, the settings page text, and the plugin
name and description. Stale images in the store are a bug.

## Demo bb for screenshots

Never capture your real bb: it shows real projects, threads, machine names,
and account emails. Use the throwaway instance instead.

```sh
media/demo-up.sh          # start; seeds on first run (about 30s)
media/demo-down.sh        # stop, keep data
media/demo-down.sh --wipe # stop and delete, so the next demo-up reseeds
```

- It runs at http://127.0.0.1:39886 (daemon on 39887), with data in
  `/tmp/bb-hats-demo`. Override with `HATS_DEMO_PORT` and `HATS_DEMO_ROOT`.
- It uses the bb-app bundled in `/Applications/bb.app`. Set `BB_APP` to
  another `bb-app.js` if bb lives elsewhere.
- The seed renames the machine to "Demo Mac" and creates ten dummy git
  projects in three hats: Day job, Home, and Side quests. It also creates
  twelve threads with fun titles and wears Day job.
- Each seeded thread runs one Haiku turn ("reply ok") on the Claude Code
  account signed in on this machine. The cost is tiny. Set
  `HATS_DEMO_THREADS=0` to skip threads; projects then show "No threads".
- The script installs this checkout as a path plugin. After code changes,
  rebuild and run `BB_SERVER_URL=http://127.0.0.1:39886 bb plugin reload hats`.
- To use the bb CLI against the demo, set
  `BB_SERVER_URL=http://127.0.0.1:39886` and unset `BB_PROJECT_ID` and
  `BB_THREAD_ID`.
- The first page load shows onboarding, which lists the signed-in agent
  accounts and their emails. The capture scripts click "Skip setup"; never
  capture that screen.

## Screenshots and recordings

Capture at an 800px-wide viewport with a device scale factor of 2. bb switches
to its mobile layout below about 768px. The output is 1600px wide, which
meets the marketplace minimum of 1200px.

The capture scripts are Playwright functions for the Playwright MCP
`browser_run_code_unsafe` tool, called with `filename`. The tool only reads
files inside the current thread's workspace, so run them from a thread whose
workspace is this repo, or copy `media/capture-*.js` into the workspace first.
Output lands in `media-out/` under that workspace; the repo ignores it.

| Script | Output |
| --- | --- |
| `media/capture-stills.js` | `sidebar-day-job.png`, `settings.png` |
| `media/capture-switching.js` | `switching-<ts>/` frames: the footer button rotating three hats |
| `media/capture-configuring.js` | `configuring-<ts>/` frames: add a hat, name it Gym, pick dumbbell, tick two projects |

After `capture-configuring.js`, delete the hat it made:
`BB_SERVER_URL=http://127.0.0.1:39886 bb hats delete Gym`.

**The capture scripts drive the UI through selectors and labels**, such as the
footer button's test id, `aria-label`s like "Change Gym icon" and
"Space Yoga in Gym", the "Add hat" button, and the seeded hat and project
names. A UI or copy change can break a script or leave a recording showing
the old flow. Update the scripts with the change, then check the frames.

Turn frames into a README GIF and a marketplace WebP:

```sh
python3 media/make.py media-out/switching-<ts> switching
python3 media/make.py media-out/configuring-<ts> configuring 1500
```

`make.py` times frames from their file modification times and holds the last
frame (default 1200 ms). It writes `<name>.gif` at 800px and an animated
`<name>.webp` at 1200px. It needs `ffmpeg` and `img2webp`
(`brew install ffmpeg webp`). The marketplace accepts PNG, JPEG, and WebP but
not GIF.

Before you use the output, look at a few frames. For example:

```sh
ffmpeg -i media-out/switching.gif -vf "select='eq(n\,5)+eq(n\,50)',scale=500:-1,tile=2x1" -frames:v 1 check.png
```

Then copy the files into place:

- `docs/switching.gif` and `docs/configuring.gif` for the README.
- `screenshots/hats/` in the marketplace repo: `switching.webp`,
  `configuring.webp`, `sidebar-day-job.png`, and `settings.png`. Keep each file
  under 2 MiB, and list every file in `entries/hats.json`; the build rejects
  unreferenced screenshots.
