"""Time to content on a fresh page load, per screen (docs/IMPROVEMENTS.md).

Each sample is a full navigation from about:blank (JS from the browser cache, a new Convex socket and
session), timed until the screen's content is on screen. Median of N per screen, at the given CPU
throttling rates. With --cold, every sample starts with an empty HTTP cache on an emulated network
(40 ms RTT, 1.5 MB/s down: a decent 4G or a slow office line), which is what a first visit costs.

    python3 scripts/perf/page-ready.py http://localhost:3340 owner-state.json [--runs 5] [--cpu 1,4] [--cold] [--only my] [--json out.json]
"""
import json
import statistics
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1]
STATE = sys.argv[2]
RUNS = int(sys.argv[sys.argv.index("--runs") + 1]) if "--runs" in sys.argv else 5
RATES = [float(x) for x in (sys.argv[sys.argv.index("--cpu") + 1] if "--cpu" in sys.argv else "1,4").split(",")]
OUT = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None
COLD = "--cold" in sys.argv
ONLY = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None

SCREENS = [
    ("list /spaces/PAN", "/spaces/PAN", "[data-issue-id]", True),
    ("board /spaces/PAN/board", "/spaces/PAN/board", "[data-issue-id]", True),
    ("issue /issues/PAN-1200", "/issues/PAN-1200", "[data-slot=markdown-editor] .ProseMirror", True),
    ("my issues /my-issues", "/my-issues", "[data-issue-id]", True),
    ("sign-in /sign-in (signed out)", "/sign-in", "#sign-in-email", False),
]


def main():
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        signed_in = browser.new_context(storage_state=STATE, viewport={"width": 1440, "height": 900})
        signed_out = browser.new_context(viewport={"width": 1440, "height": 900})
        for rate in RATES:
            for label, path, selector, auth in SCREENS:
                if ONLY and ONLY not in label:
                    continue
                context = signed_in if auth else signed_out
                page = context.new_page()
                cdp = context.new_cdp_session(page)
                cdp.send("Emulation.setCPUThrottlingRate", {"rate": rate})
                page.goto(BASE + path)  # warm the HTTP cache once
                page.wait_for_selector(selector, timeout=60000)
                if COLD:
                    cdp.send("Network.enable")
                    cdp.send(
                        "Network.emulateNetworkConditions",
                        {"offline": False, "latency": 40, "downloadThroughput": 1.5 * 1024 * 1024, "uploadThroughput": 750 * 1024},
                    )
                samples = []
                for _ in range(RUNS):
                    page.goto("about:blank")
                    if COLD:
                        cdp.send("Network.clearBrowserCache")
                    start = time.time()
                    page.goto(BASE + path)
                    page.wait_for_selector(selector, timeout=60000)
                    samples.append(round((time.time() - start) * 1000))
                results[f"{label} @{rate:g}x{' cold' if COLD else ''}"] = {"medianMs": statistics.median(samples), "samples": samples}
                page.close()
        browser.close()
    for key, value in results.items():
        print(f"{key:44} {value['medianMs']:>7} ms  {value['samples']}")
    if OUT:
        with open(OUT, "w") as handle:
            json.dump(results, handle, indent=2)


if __name__ == "__main__":
    main()
