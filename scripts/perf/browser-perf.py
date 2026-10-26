"""Browser perf run for Pantry (docs/IMPROVEMENTS.md): load, J/K, palette, live updates, board, issue page.

Run it against a `next build --profile --no-mangling` build (React's profiling build with readable
component names) served by `next start`, on a local backend seeded with scripts/perf/devSeed.ts.
Needs Python Playwright (Chromium) and a signed-in storage state.

    python3 scripts/perf/browser-perf.py http://localhost:3340 owner-state.json [--cpu 4] [--json out.json]

Render counts come from a stub React DevTools hook: after each commit it walks the fibers that were
part of that render and counts every function component that actually ran (React's PerformedWork
flag), by name. Latency is the Event Timing API's duration for the key press (input delay +
handlers + rendering until the next paint), so it includes React's work for that key.
"""
import json
import statistics
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = sys.argv[1]
STATE = sys.argv[2]
CPU = float(sys.argv[sys.argv.index("--cpu") + 1]) if "--cpu" in sys.argv else 4.0
OUT = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None

HOOK = """
(() => {
  const counts = {}; let commits = 0;
  const isComponent = (tag) => tag === 0 || tag === 1 || tag === 11 || tag === 14 || tag === 15;
  const nameOf = (f) => { const t = f.type; if (!t) return '?'; const inner = t.type || t.render || t;
    return t.displayName || inner.displayName || inner.name || t.name || 'Anonymous'; };
  function visit(root) {
    const stack = [root];
    while (stack.length) {
      const f = stack.pop(); const prev = f.alternate;
      if (isComponent(f.tag) && (prev === null || (f.flags & 1) === 1)) { const n = nameOf(f); counts[n] = (counts[n] || 0) + 1; }
      if (prev === null || f.child !== prev.child) { let c = f.child; while (c) { stack.push(c); c = c.sibling; } }
    }
  }
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(), supportsFiber: true, isDisabled: false, checkDCE() {},
    inject(r) { const id = this.renderers.size + 1; this.renderers.set(id, r); return id; },
    onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id, root) { commits++; try { visit(root.current); } catch (e) {} },
  };
  window.__renders = { take() { const out = { commits, counts: { ...counts } }; for (const k in counts) delete counts[k]; commits = 0; return out; } };
  window.__events = [];
  new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__events.push({ name: e.name, duration: e.duration, start: e.startTime }); })
    .observe({ type: 'event', durationThreshold: 16, buffered: true });
  window.__longtasks = 0;
  new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__longtasks += e.duration; }).observe({ type: 'longtask', buffered: true });
})();
"""

ROW_COMPONENTS = ("IssueRow", "IssueCard", "BoardCard", "Card")


def convex(*args):
    return subprocess.run(["npx", "convex", *args], cwd=ROOT / "packages/backend", capture_output=True, text=True, check=True).stdout


def owner_identity():
    members = [json.loads(line) for line in convex("data", "members", "--format", "jsonl").splitlines() if line.startswith("{")]
    owner = next(m for m in members if m["role"] == "owner")
    return json.dumps({"subject": owner["userId"]})


def summary(renders, names=None):
    counts = renders["counts"]
    total = sum(counts.values())
    top = sorted(counts.items(), key=lambda kv: -kv[1])[:40]
    rows = {name: counts.get(name, 0) for name in (names or ROW_COMPONENTS) if counts.get(name)}
    return {"commits": renders["commits"], "components": total, "rows": rows, "top": top}


def main():
    results = {"cpuThrottle": CPU}
    identity = owner_identity()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(storage_state=STATE, viewport={"width": 1440, "height": 900})
        context.add_init_script(HOOK)
        page = context.new_page()
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        cdp = context.new_cdp_session(page)
        cdp.send("Network.enable")
        ws = {"bytes": 0, "frames": 0}

        def on_frame(event):
            ws["bytes"] += len(event["response"]["payloadData"])
            ws["frames"] += 1

        cdp.on("Network.webSocketFrameReceived", on_frame)

        def throttle(rate):
            cdp.send("Emulation.setCPUThrottlingRate", {"rate": rate})

        def load(path, ready_selector, label):
            throttle(CPU)
            ws["bytes"] = 0
            start = time.time()
            page.goto(BASE + path)
            page.wait_for_selector(ready_selector, timeout=60000)
            page.wait_for_timeout(1500)  # let the subscriptions settle
            timing = page.evaluate(
                """(sel) => {
                const nav = performance.getEntriesByType('navigation')[0];
                const js = performance.getEntriesByType('resource').filter(r => r.name.endsWith('.js'));
                return { rows: document.querySelectorAll(sel).length, domContentLoaded: nav.domContentLoadedEventEnd,
                  jsKB: Math.round(js.reduce((s, r) => s + r.decodedBodySize, 0) / 1024),
                  jsTransferKB: Math.round(js.reduce((s, r) => s + r.transferSize, 0) / 1024),
                  longTaskMs: Math.round(window.__longtasks) };
            }""",
                ready_selector,
            )
            renders = page.evaluate("window.__renders.take()")
            results[label] = {
                **timing,
                "readyMs": round((time.time() - start) * 1000) - 1500,
                "wsKB": round(ws["bytes"] / 1024),
                "renders": summary(renders),
            }
            page.evaluate("window.__events.length = 0; window.__longtasks = 0")
            return results[label]

        def presses(key, count, label, settle=120):
            page.evaluate("window.__renders.take(); window.__events.length = 0")
            per = []
            for _ in range(count):
                page.keyboard.press(key)
                page.wait_for_timeout(settle)
            page.wait_for_timeout(300)
            renders = page.evaluate("window.__renders.take()")
            events = page.evaluate("window.__events.filter(e => e.name === 'keydown' || e.name === 'keyup' || e.name === 'keypress')")
            durations = [e["duration"] for e in events if e["name"] == "keydown"]
            rows = summary(renders)["rows"]
            results[label] = {
                "presses": count,
                "keydownMs": {"median": statistics.median(durations) if durations else "<16", "max": max(durations) if durations else "<16", "over16": len(durations)},
                "rowRendersPerPress": {k: round(v / count, 1) for k, v in rows.items()},
                "componentsPerPress": round(sum(renders["counts"].values()) / count),
            }
            return results[label]

        # ---- List: load, J/K, palette, a live update from someone else ----
        load("/spaces/PAN", "[data-issue-id]", "list.load")
        page.locator("[data-issue-id]").first.wait_for()
        page.mouse.move(5, 5)
        presses("j", 10, "list.j")
        presses("k", 5, "list.k")
        presses("x", 3, "list.x", settle=200)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        page.evaluate("window.__renders.take(); window.__events.length = 0")
        t0 = time.time()
        page.keyboard.press("Meta+k")
        page.wait_for_selector("[cmdk-root]", timeout=10000)
        visible_ms = round((time.time() - t0) * 1000)
        page.wait_for_timeout(500)
        events = page.evaluate("window.__events.filter(e => e.name === 'keydown')")
        renders = page.evaluate("window.__renders.take()")
        results["palette.open"] = {
            "visibleMs": visible_ms,
            "keydownMs": max([e["duration"] for e in events], default="<16"),
            "renders": summary(renders),
        }
        page.keyboard.type("board", delay=60)
        page.wait_for_timeout(800)
        events = page.evaluate("window.__events.filter(e => e.name === 'keydown')")
        results["palette.type"] = {"keydownMs.max": max([e["duration"] for e in events], default="<16")}
        page.keyboard.press("Escape")
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)

        # Someone else changes one issue in this space: what re-renders, and how much comes over the socket.
        issues = json.loads(convex("run", "--identity", identity, "issues:listBySpace", json.dumps({"spaceId": spaces()["PAN"]})))
        target = next(i for i in issues if i["statusCategory"] in ("unstarted", "started"))
        page.evaluate("window.__renders.take()")
        ws["bytes"] = 0
        ws["frames"] = 0
        convex("run", "--identity", identity, "issues:update", json.dumps({"issueId": target["_id"], "priority": 1 if target["priority"] != 1 else 2}))
        page.wait_for_timeout(2500)
        renders = page.evaluate("window.__renders.take()")
        results["list.remoteUpdate"] = {"wsKB": round(ws["bytes"] / 1024, 1), "wsFrames": ws["frames"], "renders": summary(renders)}
        convex("run", "--identity", identity, "issues:update", json.dumps({"issueId": target["_id"], "priority": target["priority"]}))
        page.wait_for_timeout(1500)

        # Someone (an agent, say) creates an issue in another space: only WEB's counter changes.
        page.evaluate("window.__renders.take()")
        ws["bytes"] = 0
        ws["frames"] = 0
        created = json.loads(convex("run", "--identity", identity, "issues:create", json.dumps({"spaceId": spaces()["WEB"], "title": "Perf probe elsewhere"})))
        page.wait_for_timeout(2500)
        renders = page.evaluate("window.__renders.take()")
        results["list.remoteCreateElsewhere"] = {"wsKB": round(ws["bytes"] / 1024, 1), "wsFrames": ws["frames"], "renders": summary(renders)}
        convex("run", "--identity", identity, "issues:remove", json.dumps({"issueId": created["issueId"]}))
        page.wait_for_timeout(1500)

        # An optimistic local change: priority via the row's picker is a mouse flow; use the P quick edit.
        page.keyboard.press("j")
        page.wait_for_timeout(200)
        page.evaluate("window.__renders.take(); window.__events.length = 0")
        ws["bytes"] = 0
        page.keyboard.press("p")
        page.wait_for_selector("[cmdk-root]", timeout=5000)
        page.wait_for_timeout(200)
        page.keyboard.press("ArrowDown")
        page.keyboard.press("Enter")
        page.wait_for_timeout(2000)
        renders = page.evaluate("window.__renders.take()")
        events = page.evaluate("window.__events.filter(e => e.name === 'keydown')")
        results["list.quickEditPriority"] = {
            "keydownMs.max": max([e["duration"] for e in events], default="<16"),
            "wsKB": round(ws["bytes"] / 1024, 1),
            "renders": summary(renders),
        }

        # ---- Board ----
        load("/spaces/PAN/board", "[data-issue-id]", "board.load")
        page.mouse.move(5, 5)
        presses("j", 10, "board.j")

        # ---- Issue page ----
        load("/issues/PAN-1200", "[data-slot=markdown-editor]", "issue.load")
        presses("j", 1, "issue.noop")  # nothing bound; baseline for idle cost

        # ---- My issues ----
        load("/my-issues", "[data-issue-id]", "mine.load")

        # ---- Sign-in (signed out context: first-load JS of an auth page) ----
        anon = browser.new_context()
        anon_page = anon.new_page()
        start = time.time()
        anon_page.goto(BASE + "/sign-in")
        anon_page.wait_for_selector("#sign-in-email", timeout=30000)
        js = anon_page.evaluate(
            "Math.round(performance.getEntriesByType('resource').filter(r => r.name.endsWith('.js')).reduce((s, r) => s + r.decodedBodySize, 0) / 1024)"
        )
        results["signin.load"] = {"readyMs": round((time.time() - start) * 1000), "jsKB": js}
        anon.close()

        results["consoleErrors"] = errors
        browser.close()
    print(json.dumps(results, indent=2))
    if OUT:
        Path(OUT).write_text(json.dumps(results, indent=2))


_spaces = None


def spaces():
    global _spaces
    if _spaces is None:
        rows = [json.loads(line) for line in convex("data", "spaces", "--format", "jsonl").splitlines() if line.startswith("{")]
        _spaces = {row["key"]: row["_id"] for row in rows}
    return _spaces


if __name__ == "__main__":
    main()
