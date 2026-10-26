# Security

Please **don't** open a public issue for a vulnerability.

## Reporting a vulnerability

Report it privately through GitHub Security Advisories:
[open a private report](https://github.com/Honeynjam/pantry/security/advisories/new).

Include:

- The Pantry version you're running: `serverVersion` from `GET https://<your-app>/api/instance`, or the commit
  if you run from source.
- How it's deployed: Vercel + Convex (the Deploy button), local dev, or the Mac app (with its version).
- What an attacker can do, and the steps to reproduce it. A proof of concept helps, but keep it minimal.

We aim to reply within **3 business days**, with a first assessment and a rough timeline for a fix. Pantry has a
tiny maintainer team, so a fix can take longer than that; we'll keep you posted. Once it's fixed and released, we'll
publish an advisory and, if you'd like, credit you.

## Safe harbour

If you act in good faith and follow this policy, we won't take legal action against you or ask anyone else to.
That means: test only against an instance you run yourself, don't access or change other people's data, don't
degrade anyone's service, and give us a reasonable time to fix the problem before you disclose it.

## Scope

In scope: the code in this repository, which includes the web app, the Convex backend, the MCP server, the Mac
app, the Deploy button setup and the GitHub workflows we ship (such as Sync upstream).

Every Pantry instance is self-hosted: its owner runs it in their own Vercel and Convex accounts, and we have no
access to it. A problem with how one instance is configured or operated (a leaked secret, an old version, a
dashboard setting) is for its owner to fix. Vulnerabilities in Vercel, Convex or GitHub themselves belong with
those vendors.

## Things to know about the threat model

- **An MCP token can read and write the whole workspace.** It acts as the person who created it: an agent holding
  it can read every project and issue, and create, edit and move issues and comments. Treat tokens like passwords,
  give each agent its own, and revoke any that leak. Pantry stores only a SHA-256 hash of each token.
- Sign-up is invite-only after the owner creates the workspace. An invite link works once, for one email address,
  for 7 days.
- Anyone who can push to your instance's repository, or who holds its `CONVEX_DEPLOY_KEY`, can change the code your
  instance runs. Review update PRs from Sync upstream before you merge them.
