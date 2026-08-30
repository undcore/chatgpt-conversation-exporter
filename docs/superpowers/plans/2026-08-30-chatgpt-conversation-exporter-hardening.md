# ChatGPT Conversation Exporter Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve export fidelity, branch coverage, runtime feedback, automated verification, and public-repository hygiene without adding runtime dependencies.

**Architecture:** Keep one self-contained browser entrypoint. Add small internal functions for local date formatting, branch discovery, safe content rendering, status toasts, and timeout-aware fetching. Keep the Node build script dependency-free and make CI prove that the checked-in bookmarklet matches the source.

**Tech Stack:** Browser Fetch API, AbortController, Blob/download APIs, Node.js 18+, `node:test`, GitHub Actions.

## Global Constraints

- Keep all working files under `D:\chatgpt-conversation-exporter`.
- Do not export or commit conversation content, cookies, tokens, or personal project data.
- Do not send conversation data to any third-party origin.
- Preserve internal Markdown and code-block blank lines.
- Keep active-branch export available and make it the default.
- Use local calendar dates rather than UTC date strings.
- Remove internal `docs/superpowers/` files from the final public tree.

---

### Task 1: Harden the browser exporter

**Files:**
- Modify: `src/chatgpt-export-to-markdown.js`
- Test: `test/build.test.mjs`

- [ ] **Step 1: Add local date and lossless text helpers**

Replace the UTC-only date formatting with `formatLocalDate(date)`, using `getFullYear()`, `getMonth() + 1`, and `getDate()`. Replace trimming/collapsing of message bodies with line-ending normalization only. Use `text.trim().length > 0` only to decide whether a message has content, then preserve the original normalized body.

- [ ] **Step 2: Add safe visible-part rendering**

Keep string and `{ text }` parts. Return placeholders for image, file, audio, and video parts. Return `[Unsupported content omitted]` for an unrecognized object that represents visible content, but never include raw asset pointers, internal IDs, or URLs from unknown objects.

- [ ] **Step 3: Add timeout and non-blocking status**

Use `AbortController` with a 60-second `window.setTimeout`. Clear the timer in `finally`. Convert aborts to `Timed out while loading the conversation.` and other network failures to `Could not load the conversation.`. Add a short status element with a fixed exporter ID, text-only content, and automatic removal after four seconds. Use it for loading, success, and errors instead of `window.alert`.

- [ ] **Step 4: Add active/all-branch selection**

Build child lists from each mapping node's `parent` field. Keep the current parent walk for active mode. For all mode, traverse every root-to-leaf path with a visited set and a 1000-branch maximum. Ask once with `window.confirm`: OK means active branch only; Cancel means all branches. Serialize all-branch output under `## Branch N` headings while retaining `### User` and `### Assistant` message headings.

- [ ] **Step 5: Preserve Markdown structure**

Join sections with exactly two line breaks, do not collapse internal repeated newlines, normalize CRLF to LF, remove only final excess line endings, and append one final LF. Use the local date in both the document header and filename.

- [ ] **Step 6: Add behavior tests**

Extend the VM fixture to stub `confirm`, `AbortController`, local `Date`, and the status DOM. Assert active-branch ordering, all-branch headings, hidden/tool exclusion, untouched repeated blank lines, local date output, attachment placeholders, timeout errors, HTTP errors, malformed JSON, missing nodes, and cycle detection.

- [ ] **Step 7: Run the focused suite**

```text
npm test
```

Expected result: every test passes.

### Task 2: Strengthen build, CI, and release support

**Files:**
- Modify: `package.json`
- Modify: `scripts/build-bookmarklet.mjs`
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Make the build validate generated syntax**

Keep `buildBookmarklet(source)` deterministic. Add a `node:vm` syntax check in tests for the generated body after removing `javascript:`. Reject source containing line comments before flattening, so a future `//` comment cannot comment out the rest of the bookmarklet.

- [ ] **Step 2: Strengthen `npm run check`**

Make the check run `npm run build`, `node --check src/chatgpt-export-to-markdown.js`, `node --check scripts/build-bookmarklet.mjs`, `npm test`, `git diff --check`, and `git diff --exit-code -- dist/chatgpt-export-to-markdown.bookmarklet.txt` in that order.

- [ ] **Step 3: Use a Node version matrix in CI**

Run the check on Node 18, 20, and 22 with `actions/checkout@v4`, `actions/setup-node@v4`, and `permissions: contents: read`.

- [ ] **Step 4: Add tag-triggered release workflow**

On tags matching `v*`, check out the repository, set up Node 20, run `npm run build`, and use `gh release create "$GITHUB_REF_NAME" dist/chatgpt-export-to-markdown.bookmarklet.txt --generate-notes` with `GH_TOKEN: ${{ github.token }}` and `contents: write`.

- [ ] **Step 5: Bump the package version and commit**

Set `package.json` version to `0.2.0`, run `npm run check`, and commit the exporter/build/CI/release changes with:
```text
git add package.json scripts src test .github/workflows
git commit -m "feat: harden conversation export"
```

### Task 3: Improve public repository documentation and hygiene

**Files:**
- Modify: `README.md`
- Create: `SECURITY.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Modify: `LICENSE` only if needed for formatting
- Delete: `docs/superpowers/`

- [ ] **Step 1: Update README**

Document the active-branch/all-branches choice, local download behavior, attachment placeholders, timeout, release artifact, unofficial endpoint limitation, no third-party upload, non-affiliation with OpenAI, and responsibility for exported content. Keep the prose short and ordinary.

- [ ] **Step 2: Add security reporting guidance**

Tell reporters not to include conversation exports, cookies, access tokens, or screenshots containing private data. Direct security reports to GitHub private vulnerability reporting when available.

- [ ] **Step 3: Add a privacy-aware bug template**

Ask for browser, ChatGPT page type, error text, and exporter version. Explicitly warn users not to attach conversation content or credentials.

- [ ] **Step 4: Remove internal planning documents from the public tree**

Delete only `docs/superpowers/specs/` and `docs/superpowers/plans/` from the working tree. Do not rewrite public Git history or force-push existing commits.

- [ ] **Step 5: Commit public-surface cleanup**

```text
git add README.md SECURITY.md .github/ISSUE_TEMPLATE docs/superpowers
git commit -m "docs: polish public repository surface"
```

### Task 4: Final verification and v0.2.0 publication

**Files:**
- Create: Git tag `v0.2.0`

- [ ] **Step 1: Run the final local gate**

```text
npm run check
git diff --check
git status --short --branch
git ls-files
```

Confirm the working tree is clean, `docs/superpowers/` is absent from the tracked tree, the generated bookmarklet is synchronized, and no private content is present.

- [ ] **Step 2: Push the branch**

```text
git push origin main
```

- [ ] **Step 3: Create and push the release tag**

```text
git tag -a v0.2.0 -m "v0.2.0"
git push origin v0.2.0
```

- [ ] **Step 4: Verify GitHub Actions and the release asset**

Confirm the Node matrix is green and the release workflow attaches `chatgpt-export-to-markdown.bookmarklet.txt`. Report local tests, CI status, release URL, final commit, and the unverified boundary that no live private ChatGPT conversation was exported during testing.
