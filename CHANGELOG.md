# Changelog

All notable changes to Pantry are listed here, newest first.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Pantry uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). The version is the one `GET /api/instance` reports as
`serverVersion`.

## [Unreleased]

## [0.1.0] - Unreleased

<!-- TODO(release): replace "Unreleased" in the heading above with the release date (YYYY-MM-DD) before tagging
v0.1.0, and delete this comment. The release workflow refuses a section without a date. -->

The first release. Pantry runs on your own Vercel and Convex accounts, for one to three people. The MCP server for
your agents and the Mac app are not in this release yet.

### Added

- **Deploy your own** with the "Deploy with Vercel" button. Vercel copies the repo into your GitHub account, the
  Convex integration creates your backend, and one build deploys both. Only production deploys run: preview builds
  are skipped, so they never touch your data. If the build stops (for example, Root Directory isn't `apps/web`),
  its message says how to fix it.
- **Setup screen.** On a new instance you create your account and workspace and become its owner. From then on
  sign-up is invite-only. If the deploy couldn't set the auth secret, the screen shows the one command that fixes
  it.
- **Invites.** The owner creates an invite link for an email address in Settings → Members and sends it themselves
  (nothing is emailed). A link works once, for that address, for 7 days, and can be revoked. The sign-up page
  pre-fills the invited email, and says so plainly when a link has expired, been revoked or already been used.
- **Projects**, each with a short key for its issues (`PAN-1`, `PAN-2`, …), a Markdown context doc for your agents
  to read, and archiving. Every project gets a felt-card pantry avatar (toast, a jam jar, a cookie…) picked at
  random; change it when you create the project or later in its settings.
- **Issues** with a title, Markdown description, status, priority, assignee, labels, due date and comments.
  Sub-issues go one level deep and always stay in their parent's project. Each issue keeps a timeline of every
  change.
- **List and board views.** The list groups a project's issues by status. On the board you drag cards between and
  within columns, with the mouse or the keyboard. Changes show up for everyone in the workspace straight away,
  without a reload.
- **Labels and statuses.** Add, rename, recolour and delete labels. The six default statuses (Backlog, Todo,
  In Progress, In Review, Done, Canceled) can be renamed, recoloured and reordered.
- **A Markdown editor that keeps your agents' Markdown as written.** Tables, HTML, task lists and links survive a
  round trip, and blocks you don't edit are saved exactly as they were.
- **Light and dark mode**, or follow the system setting.
- **Updates for your instance.** Your copy includes a "Sync upstream" workflow that opens a pull request in your
  repo for each new Pantry release, every Monday or when you run it. Merging the PR deploys the update; the workflow
  never merges by itself. See [Updating your instance](README.md#updating-your-instance).
- **Push to instance** (optional, off by default). If you develop in one repo and deploy from another, this
  workflow pushes `main` to the repo your instance deploys from after CI passes.
- **`GET /api/instance`**, a quick health check: your instance's name, Convex URLs, server version, the oldest Mac
  app it supports, and whether the auth secret is still missing.

[Unreleased]: https://github.com/honeynjam/pantry/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/honeynjam/pantry/releases/tag/v0.1.0
