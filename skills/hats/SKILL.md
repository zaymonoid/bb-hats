---
name: hats
description: Switch the bb sidebar between Work and Personal project groups, or change which group a project belongs to, with the `bb hats` CLI.
---

# Hats

The sidebar footer's briefcase button flips between two modes. Work mode hides
the personal projects; Personal mode hides the work ones. A project in neither
group shows in both.

| Command | Effect |
| --- | --- |
| `bb hats status [--json]` | Show the mode and every project's group. |
| `bb hats toggle` | Switch to the other mode. |
| `bb hats work` / `personal` | Switch to a named mode. |
| `bb hats assign <project> <work\|personal\|both>` | Move a project; accepts a name, part of a name, or an id. |

The plugin replaces every `project:` entry in the thread list's `hiddenGroups`
preference on each switch. Hidden sections and machines are kept.
