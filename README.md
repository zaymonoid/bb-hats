# bb-plugin-hats

Switch the bb sidebar between Work and Personal project groups.

- Sidebar footer briefcase button: toggle the mode.
- `bb hats status | toggle | work | personal`
- `bb hats assign <project> <work|personal|both>`

Each switch rewrites the `project:` entries of the thread list's
`hiddenGroups` preference. Groups and the current mode live in the plugin's
own storage; the initial groups are seeded in `server.ts`.
