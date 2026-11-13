# bb-plugin-hats

Switch the bb sidebar between named sets of projects.

> **Your sidebar stays exactly as you arranged it.** Hats never reorders,
> moves, or changes anything in the sidebar. It only hides projects. A hidden
> project keeps its position, its threads, and whether it was collapsed, and
> when you switch back it reappears exactly where it was.

- **Footer button:** wears the next hat. Its icon is the worn hat's icon.
- **Settings page:** add, rename, reorder, and delete hats, pick an icon, and
  tick which projects each hat holds. A project can be in several hats.
- **CLI:** `bb hats status | wear | next | create | rename | icon | delete | add | remove | icons`.

Wearing a hat hides projects that other hats claim and the worn hat does not.
Projects in no hat show in every hat. New installs start with empty Work and
Personal hats, so nothing is hidden until you assign projects.

## How it works

Hats edits a single sidebar setting: bb's list of hidden projects (the
thread list's `hiddenGroups` preference). Each switch replaces the
`project:` entries in that list and leaves everything else alone, including
any sections or machines you hid yourself. bb keeps a hidden project's place
in the sidebar, which is why switching hats never shuffles your layout.

The hat order you set on the settings page is the order the footer button
cycles through. Hats, their projects, and that order live in the plugin's own
storage and survive reloads and restarts.
