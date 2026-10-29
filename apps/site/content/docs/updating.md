The Deploy button copies Pantry into your account rather than forking it, so GitHub has no "Sync fork" button for
it. Your copy includes a **Sync upstream** workflow instead. Every Monday, or whenever you run it, it opens a pull
request in your repo that updates it to the latest Pantry release. **Merging the PR deploys the update.** Nothing
changes until you merge, and the workflow never merges by itself. To skip a release, close its PR; it won't reopen.

## Set it up

1. **One-time setting:** in your repo, Settings → Actions → General → Workflow permissions, turn on **"Allow GitHub
   Actions to create and approve pull requests"**. Without it the workflow pushes its branch but can't open the PR.
2. **Run it now (optional):** Actions → Sync upstream → Run workflow. Leave "tag" empty for the latest release, or
   tick "dry run" to see what it would do without pushing anything.
3. **Review and merge** the "Update Pantry to vX.Y.Z" pull request. See the [changelog](/docs/changelog) for what's
   in it.

## Good to know

- **The first update replaces files.** Your copy and Pantry don't share git history yet, so the first PR takes the
  release's files as they are. If you edited files yourself, those edits show up as removed; put them back on the
  PR branch before merging. After that, updates are normal merges that keep your changes.
- **Releases that change `.github/workflows`.** GitHub won't let the built-in token push workflow changes, and the
  run fails saying so. Create a fine-grained personal access token for this repo only, with _Contents_, _Pull
  requests_ and _Workflows_ set to read and write, save it as the repository secret `SYNC_UPSTREAM_TOKEN`, and run
  the workflow again.
- PRs opened with the built-in token don't trigger other workflows, so CI doesn't run on them. Vercel still deploys
  once you merge.
- GitHub pauses scheduled workflows in repos with no activity for 60 days. Re-enable it on the Actions tab, or run
  it by hand.
- Prefer a real fork? Fork the repo first and import the fork into Vercel. The same workflow works there.
