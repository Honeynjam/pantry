/**
 * fetch that always gives up after `timeoutMs`, while still honouring the caller's own signal.
 * better-fetch's `timeout` option is skipped whenever a signal is passed, and Better Auth's session
 * fetch always passes one, so the bound has to live here.
 */
export function fetchWithTimeout(timeoutMs: number, baseFetch: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        controller.abort(
          new DOMException(`Request timed out after ${timeoutMs}ms`, "TimeoutError"),
        ),
      timeoutMs,
    );
    const callerSignal = init?.signal;
    const onCallerAbort = () => controller.abort(callerSignal?.reason);
    if (callerSignal) {
      if (callerSignal.aborted) onCallerAbort();
      else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }
    return baseFetch(input, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    });
  };
}
