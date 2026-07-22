# Working on FilaMind Screen

FilaMind Screen is a native touch app for the printer's own display: a Vue 3 single-page app inside
a Tauri 2 shell, shipped as a prebuilt **arm64 `.deb`**. There is no app backend — the webview talks
straight to Moonraker over its WebSocket and mirrors live state into a small shared store.

The app is **experimental** and says so in its README. It targets panels from roughly 3 inches
upward, and the reference device is an 800×480 panel on an arm64 host with little RAM. That
constraint is why the app is never built on the printer.

## The rule that costs the most time

**The frontend is baked into the `.deb`.** Editing source does not change what the printer displays.
To see a change on the device you must cut a release and run `deploy/install-native.sh`. Almost
every "my fix didn't work on the device" traces back to this.

## No lineage claims

The shipped frontend must not name the touch and web UIs that were studied while building this app,
and nothing anywhere may present FilaMind Screen as derived from, ported from, inspired by, or a
fork of another project. Describe what this app does, not what it was learned from. This applies to
commit messages, PR bodies and issue comments as much as to code.

`frontend/scripts/check-no-external-refs.sh` enforces the mechanical part in CI. Read it before
assuming what it covers:

- It scans the **shipped frontend surface only** — `src`, `index.html`, `vite.config.ts`,
  `package.json`, `env.d.ts` — and has caught hardcoded names in **test fixtures**, so test data
  counts.
- It deliberately does **not** scan `deploy/` or `scripts/`. That layer names the touchscreen
  service this app takes over from and restores on uninstall, which is managing a service, not
  claiming descent from it. Widening the guard's scope would break that integration and must be a
  deliberate decision.
- Klipper and Moonraker are the platform and are always allowed. So is naming ecosystem projects the
  software genuinely integrates with, and GPL attribution for vendored code.

## Platform traps

- **`click` is dead on WebKitGTK touch.** Interactive controls — on-screen keyboard keys in
  particular — must use `@pointerdown.prevent`.
- **Scoped `:global(...)` selectors collapse under minification.** A rule like
  `:global(:root[data-x]) .child { … }` inside a scoped block can be minified into a bare selector
  applied to `<html>`. This has shipped two separate production bugs: an RTL `scaleX` failure, and a
  whole-page opacity drop that users read as a faded screen. Keep such rules in `main.css` as plain
  globals. A vitest guard exists — do not delete it.
- **`IntersectionObserver` never fires in the packaged webview.** Lazy loading silently loads
  nothing; use bounded-concurrency eager fetching instead.
- **The panel blanks on `brightness=0`, not on `bl_power`.** A udev `MODE="0666"` rule does not
  chmod sysfs *attributes* — an explicit `RUN+=chmod` is needed.
- The side rail is at its practical limit on 800×480; the next system-level panel needs a grouping,
  not another tab.

## Before you push

```bash
cd frontend
npm run lint && npm run type-check && npm test && npm run i18n:keydiff && npm run format:check && npm run build
```

CI additionally runs the no-external-references guard and a native-shell compile. The committed
`frontend/dist` is the canonical bundle; CI rebuilds it if it drifts, and that rebuild commit carries
`[skip ci]` — which can both mask a failing check and skip `release.yml` on a tag. Verify with
`gh run list --branch <b> --json workflowName,conclusion`, and publish by hand with
`gh release create` if the release workflow was skipped.

## Shipping

Every shipped PR bumps the version and adds a CHANGELOG entry, then pushes a `vX.Y.Z` tag.
Documentation moves in the same PR. Work consolidates into `main`, merged manually once green with
`gh pr merge --rebase --delete-branch`.

Fix forward: do not revert to an older release or branch away from a problem — find the cause and
fix it on the current state.

## Rules

- Commit messages, PR bodies and issue comments are purely technical English, with no team-chat
  content.
- Only the three maintainers listed in the README may appear as commit authors. No
  `Co-Authored-By`, no tool-attribution trailers.
- Never close a user's issue; reply as a human maintainer and leave it open until they confirm.
- Never hand an end user a shell command.

## When you finish work here — update the team repo

FilaMind's working state lives in the private `filamind-app/filamind-internal` repo: the handbook,
the research corpus, and the handoff that records what shipped and what is still open. Several
sessions work on FilaMind in parallel, on different machines and at different times, and that repo
is how they stay in agreement about what is true.

**Updating it is part of finishing a piece of work, not an optional extra.** A later session cannot
reconstruct what you knew. Work is not finished when the code ships; it is finished when that repo
says the code shipped.

If you do not have it (it is private — you need access to the `filamind-app` account):

```bash
git clone https://github.com/filamind-app/filamind-internal.git
```

`handbook/sync-protocol.md` in that repo is the full contract. The short version:

- **`git pull --ff-only` first.** Assume those files are newer than your memory of them.
- **Verify before you record.** Check `gh release list`, `gh issue list`, `gh pr list` and
  `git log origin/main` rather than writing down what you remember. If a file there contradicts
  reality, fix it and say so in the commit — a wrong state table is worse than a missing one,
  because the next session acts on it.
- **Released something** → a changelog line and the new version in the newest file in `handoffs/`.
- **Answered, fixed or closed an issue** → update its row in that handoff's open-items table, saying
  exactly what is now being waited on and by whom.
- **Learned something the hard way** → a numbered rule in `handbook/rules.md` **with the cost
  attached**, or a trap in `handbook/ci-and-release.md` if it is mechanical.
- **Ended a stretch of work, or handing over** → write a **new dated handoff**; never edit an old one
  to make it current.
- **Never invent state.** If you did not check whether CI passed, write "not verified", not a guess.

Do not record work in progress, an unmerged PR you are still iterating on, or an intention. That repo
records what is true, not what is planned.
