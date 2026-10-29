The Deploy button copies Pantry into your account rather than forking it, so GitHub has no "Sync fork" button for
it. Your copy includes a **Sync upstream** workflow instead. Every Monday, or whenever you run it, it opens a pull
request in your repo that updates it to the latest Pantry release. **Merging the PR deploys the update.** Nothing
changes until you merge, unless you turn on [automatic updates](#automatic-updates-opt-in). To skip a release,
close its PR; it won't reopen.

## Set it up

1. **One-time setting:** in your repo, Settings → Actions → General → Workflow permissions, turn on **"Allow GitHub
   Actions to create and approve pull requests"**. Without it the workflow pushes its branch but can't open the PR.
   If the repo belongs to a GitHub organisation, the checkbox stays greyed out until an organisation owner allows
   it in the organisation's Settings → Actions → General → Workflow permissions.
2. **Run it now (optional):** Actions → Sync upstream → Run workflow. Leave "tag" empty for the latest release, or
   tick "dry run" to see what it would do without pushing anything.
3. **Review and merge** the "Update Pantry to vX.Y.Z" pull request. See the [changelog](/docs/changelog) for what's
   in it.

## Good to know

- **The first update replaces files.** Your copy and Pantry don't share git history yet, so the first PR takes the
  release's files as they are. If you edited files yourself, those edits show up as removed; put them back on the
  PR branch before merging. After that, updates are normal merges that keep your changes.
- **Some releases ask for a review.** When a release needs it (for example, one that moves data), its PR says
  "Review before merging" at the top. Read the release notes before you merge.
- **Releases that change `.github/workflows`.** GitHub won't let the built-in token push workflow changes, and the
  run fails saying so. Create a fine-grained personal access token for this repo only, with _Contents_, _Pull
  requests_ and _Workflows_ set to read and write, save it as the repository secret `SYNC_UPSTREAM_TOKEN`, and run
  the workflow again.
- PRs opened with the built-in token don't trigger other workflows, so CI doesn't run on them. With
  `SYNC_UPSTREAM_TOKEN` set, CI runs on them like on any PR. Vercel deploys once you merge either way.
- GitHub pauses scheduled workflows in repos with no activity for 60 days. Re-enable it on the Actions tab, or run
  it by hand.
- Prefer a real fork? Fork the repo first and import the fork into Vercel. The same workflow works there.

## Automatic updates (opt-in)

Turn this on and ordinary updates merge, and so deploy, by themselves. Sync upstream still opens the PR every
Monday, then turns on GitHub's auto-merge for it. It **never** auto-merges:

- the first update of your copy (it replaces files wholesale, so review that one yourself);
- a release the Pantry maintainers marked for review (its PR says why);
- a PR that conflicts with changes you made in your repo.

Those stay open for you. Updates merge with a merge commit, never a squash, so the next one merges cleanly.

All in your repo on GitHub:

1. **Settings → General → Pull Requests:** turn on **Allow auto-merge**, and keep **Allow merge commits** on.
2. **Settings → Actions → General → Workflow permissions:** "Read and write permissions", and **Allow GitHub Actions
   to create and approve pull requests**.
3. **A token, so CI runs on the update PR.** Create the fine-grained token described above and save it as the
   secret `SYNC_UPSTREAM_TOKEN`. Without it, CI never runs on the PR, so "after CI passes" would wait forever.
4. **Pick when it merges:**
   - **After CI passes (recommended).** Settings → Rules → Rulesets → New branch ruleset, target the default branch,
     turn on **Require status checks to pass** and add the check **Typecheck, lint, test, build**. The PR merges
     itself once CI is green; if CI fails, it stays open and nothing deploys.
   - **Straight away.** With no required checks, the PR merges as soon as it opens and Vercel deploys at once.
     Quicker, but a broken release reaches your instance untested.
   - Rules that also require an approving review make every PR wait for you, which is the same as leaving
     automatic updates off.
5. **Settings → Secrets and variables → Actions → Variables:** add the repository variable `SYNC_AUTO_MERGE` with
   the value `true`.

To check the setup, run Sync upstream with "dry run" ticked: the log says whether it would turn on auto-merge, and
why not if it wouldn't. If GitHub refuses, the workflow comments on the PR with the setting to change and leaves it
open. To stop one update, click "Disable auto-merge" on its PR or close it. To turn the feature off, delete the
variable or set it to `false`.

## When an update doesn't deploy

The Vercel build pushes the new Convex functions and then runs the data migration. If the migration fails, the new
backend is live while Vercel keeps serving the previous web app. The **Watch update deploys** workflow catches
this: after an update PR merges, it watches the production deploy for the merge commit. If the deploy fails, or
hasn't finished after 30 minutes, it opens an issue "Pantry vX.Y.Z didn't deploy" with the link to the Vercel build
and [how to fix it](docs/MIGRATIONS.md#if-it-fails).

It's on by default and uses only the built-in token. Set the repository variable `PANTRY_DEPLOY_WATCH` to `false` to
turn it off, or `PANTRY_DEPLOY_WATCH_MINUTES` to change the time limit. A failed deploy is always caught. The
30-minute timeout only starts when the merge itself can start workflows: a merge by you or by `SYNC_UPSTREAM_TOKEN`,
not one by the built-in token. To check an update by hand, run Actions → Watch update deploys.
