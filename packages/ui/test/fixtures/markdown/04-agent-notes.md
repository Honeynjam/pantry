## Summary

Moved the issue to **In Review** after the tests passed.

### Changes

- `packages/backend/convex/invites.ts`: hash the token with SHA-256 before lookup
- `packages/app/src/screens/sign-up.tsx`: read `?invite=` and accept after sign-up
- Added tests for expired, revoked, wrong-email and reused tokens

### Test run

```
✓ convex/invites.test.ts (14 tests) 412ms
Test Files  1 passed (1)
```

| Check | Result |
|---|---|
| typecheck | ✅ pass |
| lint | ✅ pass |

**Next:** the owner should try the link in a private window.

<details>
<summary>Full log</summary>

Nothing else to report.
</details>
