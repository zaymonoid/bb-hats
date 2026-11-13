---
name: hats
description: Switch the bb sidebar between named sets of projects ("hats"), or create, rename, re-icon, delete, and fill hats, with the `bb hats` CLI.
---

# Hats

A hat is a name, an icon, and a set of projects. A project can be in any
number of hats. Wearing a hat hides every project that another hat claims and
the worn hat does not; a project in no hat shows whichever hat is worn. The
sidebar footer button wears the next hat in order, and the plugin's settings
page edits hats and their projects.

| Command | Effect |
| --- | --- |
| `bb hats status [--json]` | Show hats, their projects, and the worn hat (`*`). |
| `bb hats wear <hat\|none>` | Wear a hat; `none` shows every project. |
| `bb hats next` | Wear the next hat in order. |
| `bb hats create <name> [icon]` | Create a hat (icon defaults to `star`). |
| `bb hats rename <hat> <new name>` | Rename a hat. |
| `bb hats icon <hat> <icon>` | Change a hat's icon; `bb hats icons` lists them. |
| `bb hats delete <hat>` | Delete a hat. |
| `bb hats add <hat> <project>` | Add a project to a hat. |
| `bb hats remove <hat> <project>` | Remove a project from a hat. |

Hats and projects match by id, exact name, or a unique part of a name. Quote
names with spaces.

Each change rewrites every `project:` entry in the thread list's
`hiddenGroups` preference; hidden sections and machines are kept.
