# bb-plugin-hats

Switch the bb sidebar between named sets of projects.

- **Footer button:** wears the next hat. Its icon is the worn hat's icon.
- **Settings page:** add, rename, reorder, and delete hats, pick an icon, and
  tick which projects each hat holds. A project can be in several hats.
- **CLI:** `bb hats status | wear | next | create | rename | icon | delete | add | remove | icons`.

Wearing a hat hides projects that other hats claim and the worn hat does not.
Projects in no hat show in every hat. New installs start with empty Work and
Personal hats, so nothing is hidden until you assign projects.

It works by rewriting the `project:` entries of the thread list's
`hiddenGroups` preference; other hidden groups are kept.
