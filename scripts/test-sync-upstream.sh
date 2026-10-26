#!/usr/bin/env bash
# Local dry run of .github/workflows/sync-upstream.yml, with no act, Docker or network, and nothing pushed
# anywhere real. It pulls the workflow's script out of the YAML and runs it against throwaway repos:
#   upstream.git  stands in for github.com/honeynjam/pantry (releases are tags)
#   origin.git    stands in for a self-hoster's copy made by the Deploy button (its own first commit)
# A stub `gh` answers the API calls and records `gh pr create`. Needs bash, git and ruby (for YAML).
#
#   bash scripts/test-sync-upstream.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW="$ROOT/.github/workflows/sync-upstream.yml"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

pass() { printf '  \033[32m✔\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✖ %s\033[0m\n' "$*"; exit 1; }
section() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# --- The workflow ---------------------------------------------------------------------------------
ruby -ryaml -e '
  wf = YAML.load_file(ARGV[0])
  job = wf.fetch("jobs").fetch("sync")
  File.write(ARGV[1], job.fetch("if"))
  File.write(ARGV[2], job.fetch("steps").map { |s| s["run"] }.compact.join("\n"))
  triggers = wf["on"] || wf[true] # YAML 1.1 reads the bare key `on` as true
  File.write(ARGV[3], triggers.keys.sort.join(","))
' "$WORKFLOW" "$work/job-if" "$work/sync.sh" "$work/triggers"

section "Workflow file"
[[ "$(cat "$work/triggers")" == "schedule,workflow_dispatch" ]] && pass "triggers: workflow_dispatch + schedule" \
  || fail "triggers are $(cat "$work/triggers")"
[[ "$(cat "$work/job-if")" == "github.repository != 'honeynjam/pantry'" ]] && pass "job skipped in honeynjam/pantry (job if)" \
  || fail "unexpected job if: $(cat "$work/job-if")"
grep -q "gh pr merge\|--auto" "$work/sync.sh" && fail "the script must never merge" || pass "never merges (no gh pr merge / --auto)"

# --- Sandbox: git config, gh stub ------------------------------------------------------------------
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$work/gitconfig"
git config --global user.name "Test" && git config --global user.email "test@example.com"
git config --global init.defaultBranch main
git config --global advice.detachedHead false
# The workflow fetches https://github.com/honeynjam/pantry.git; point that at the local stand-in.
git config --global url."$work/upstream.git".insteadOf "https://github.com/honeynjam/pantry.git"

mkdir -p "$work/bin" "$work/gh-state/prs"
cat >"$work/bin/gh" <<'STUB'
#!/usr/bin/env bash
# Minimal gh stand-in for the calls sync-upstream.yml makes.
state="$GH_STUB_STATE"
case "$1 $2" in
  "api repos/"*)
    if [[ "$2" == */releases/latest ]]; then
      [[ -s "$state/latest" ]] && cat "$state/latest" && exit 0
      echo "gh: Not Found (HTTP 404)" >&2; exit 1
    fi
    echo main ;;
  "pr list")
    head=""; while [[ $# -gt 0 ]]; do [[ "$1" == --head ]] && head="$2"; shift; done
    marker="$state/prs/${head//\//__}"
    [[ -f "$marker" ]] && cat "$marker"
    exit 0 ;;
  "pr create")
    shift 2; head=""; base=""; title=""; body=""
    while [[ $# -gt 0 ]]; do
      case "$1" in --head) head="$2";; --base) base="$2";; --title) title="$2";; --body-file) body="$2";; esac; shift
    done
    { echo "base=$base head=$head title=$title"; cat "$body"; echo "---"; } >>"$state/created.log"
    echo "OPEN https://github.com/$GITHUB_REPOSITORY/pull/1" >"$state/prs/${head//\//__}"
    echo "https://github.com/$GITHUB_REPOSITORY/pull/1" ;;
  *) echo "gh stub: unexpected call: $*" >&2; exit 1 ;;
esac
STUB
chmod +x "$work/bin/gh"

# --- Repos ----------------------------------------------------------------------------------------
# Upstream: v0.1.0, then v0.2.0 (changes a file, adds one, deletes one, touches a workflow).
git init -q "$work/upstream-src"
(
  cd "$work/upstream-src"
  mkdir -p .github/workflows apps
  printf 'Pantry\n' >README.md
  printf 'web v1\n' >apps/web.txt
  printf 'old\n' >apps/legacy.txt
  printf 'ci v1\n' >.github/workflows/ci.yml
  git add -A && git commit -qm "Pantry 0.1.0" && git tag v0.1.0
  printf 'web v2\n' >apps/web.txt
  printf 'desktop\n' >apps/desktop.txt
  git rm -q apps/legacy.txt
  printf 'ci v2\n' >.github/workflows/ci.yml
  git add -A && git commit -qm "Pantry 0.2.0" && git tag v0.2.0
)
git clone -q --bare "$work/upstream-src" "$work/upstream.git"

# Self-hoster's copy: v0.1.0's files in a fresh repo with its own first commit (what Vercel's clone does).
git init -q "$work/copy-src"
(cd "$work/upstream-src" && git archive v0.1.0) | tar -x -C "$work/copy-src"
(cd "$work/copy-src" && git add -A && git commit -qm "Initial commit")
git clone -q --bare "$work/copy-src" "$work/origin.git"

export GH_STUB_STATE="$work/gh-state" GH_TOKEN=dummy UPSTREAM_REPO=honeynjam/pantry
run_workflow() { # run_workflow <repo> <dry_run> [tag] → output in $work/out
  rm -rf "$work/checkout"
  git clone -q "$work/origin.git" "$work/checkout" # actions/checkout with fetch-depth: 0
  (
    cd "$work/checkout"
    GITHUB_REPOSITORY="$1" DRY_RUN="$2" REQUESTED_TAG="${3:-}" PATH="$work/bin:$PATH" \
      bash --noprofile --norc -eo pipefail "$work/sync.sh"
  ) >"$work/out" 2>&1 || { cat "$work/out"; fail "workflow script failed"; }
  sed 's/^/    │ /' "$work/out"
}
branches() { git --git-dir="$work/origin.git" for-each-ref --format='%(refname:short)' refs/heads; }

# --- Scenarios ------------------------------------------------------------------------------------
section "1. In honeynjam/pantry itself (script guard, case-insensitive)"
printf 'v0.2.0' >"$work/gh-state/latest"
run_workflow Honeynjam/pantry false
grep -q "nothing to sync" "$work/out" && [[ "$(branches)" == "main" ]] && [[ ! -f "$work/gh-state/created.log" ]] \
  && pass "does nothing: no branch, no PR" || fail "acted in the upstream repo"

section "2. No release published yet"
: >"$work/gh-state/latest"
run_workflow kris/my-pantry false
grep -q "no published release yet" "$work/out" && [[ "$(branches)" == "main" ]] && pass "exits quietly" || fail "expected a no-release notice"

section "3. Dry run in a Deploy-button copy (unrelated history), latest release v0.2.0"
printf 'v0.2.0' >"$work/gh-state/latest"
run_workflow kris/my-pantry true
grep -q "Dry run: would push sync-upstream/v0.2.0 and open a PR into main (first-update)" "$work/out" \
  && pass "would open the PR for v0.2.0" || fail "dry run didn't report the PR"
[[ "$(branches)" == "main" ]] && [[ ! -f "$work/gh-state/created.log" ]] && pass "dry run pushed nothing, opened nothing" \
  || fail "dry run changed something"

section "4. Real run (local stand-ins): opens the PR"
run_workflow kris/my-pantry false
branches | grep -qx "sync-upstream/v0.2.0" && pass "pushed branch sync-upstream/v0.2.0 to the copy" || fail "no branch"
grep -q "base=main head=sync-upstream/v0.2.0 title=Update Pantry to v0.2.0" "$work/gh-state/created.log" \
  && pass "gh pr create: base main, head sync-upstream/v0.2.0, title \"Update Pantry to v0.2.0\"" || fail "PR not created"
echo "    PR body:"; sed -n '2,/^---$/p' "$work/gh-state/created.log" | sed '$d' | sed 's/^/    │ /'
g() { git --git-dir="$work/origin.git" "$@"; }
[[ "$(g rev-parse 'sync-upstream/v0.2.0^{tree}')" == "$(git --git-dir="$work/upstream.git" rev-parse 'v0.2.0^{tree}')" ]] \
  && pass "branch has exactly v0.2.0's files (legacy.txt removed, desktop.txt added)" || fail "branch tree differs from v0.2.0"
[[ "$(g rev-list --parents -n1 sync-upstream/v0.2.0 | wc -w | tr -d ' ')" == "3" ]] && g merge-base --is-ancestor main sync-upstream/v0.2.0 \
  && pass "commit has both histories as parents; PR diff is against main" || fail "parents wrong"
g log --format='%s' main | grep -q "Update Pantry" && fail "main changed: something merged" || pass "main untouched (no auto-merge)"

section "5. Run again while that PR exists"
cp "$work/gh-state/created.log" "$work/created.before"
run_workflow kris/my-pantry false
grep -q "already a PR for Pantry v0.2.0" "$work/out" && cmp -s "$work/gh-state/created.log" "$work/created.before" \
  && pass "no second PR" || fail "opened a duplicate PR"

section "6. Owner merges the PR, customises the app, then upstream releases v0.3.0"
git clone -q "$work/origin.git" "$work/owner"
(
  cd "$work/owner"
  git merge -q --no-ff origin/sync-upstream/v0.2.0 -m "Merge pull request #1 from sync-upstream/v0.2.0"
  printf 'Pantry\n\nOur team tracker.\n' >README.md
  git commit -qam "Our own README"
  git push -q origin main
)
(
  cd "$work/upstream-src"
  printf 'web v3\n' >apps/web.txt
  git commit -qam "Pantry 0.3.0" && git tag v0.3.0
  git push -q "$work/upstream.git" main v0.3.0
)
printf 'v0.3.0' >"$work/gh-state/latest"
run_workflow kris/my-pantry false
grep -q "merge, branch sync-upstream/v0.3.0" "$work/out" && pass "now a normal merge (histories are linked)" || fail "expected merge mode"
(
  cd "$work/owner" && git fetch -q origin
  git merge -q --no-ff origin/sync-upstream/v0.3.0 -m "Merge pull request #2" 2>/dev/null
) && grep -q "Our team tracker" "$work/owner/README.md" && grep -q "web v3" "$work/owner/apps/web.txt" \
  && pass "merging the PR is clean and keeps the owner's README change" || fail "merge conflicted or lost changes"
(cd "$work/owner" && git push -q origin main)

section "7. Up to date"
run_workflow kris/my-pantry false
grep -q "already includes Pantry v0.3.0" "$work/out" && pass "nothing to do" || fail "expected up-to-date notice"

section "8. Manual run for a specific tag"
run_workflow kris/my-pantry true v0.2.0
grep -q "already includes Pantry v0.2.0" "$work/out" && pass "respects the tag input" || fail "tag input ignored"

printf '\n\033[32mAll sync-upstream checks passed.\033[0m\n'
