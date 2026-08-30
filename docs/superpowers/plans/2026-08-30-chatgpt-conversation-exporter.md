# ChatGPT Conversation Exporter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a small open-source browser utility that exports the active ChatGPT conversation branch to Markdown and builds a copyable bookmarklet from readable source.

**Architecture:** Keep the browser entrypoint self-contained in `src/chatgpt-export-to-markdown.js` so it can be pasted into the console. Keep the bookmarklet builder in `scripts/build-bookmarklet.mjs`; it converts the readable source into one line and writes the checked-in artifact under `dist/`. Use Node's built-in test runner and a minimal GitHub Actions workflow.

**Tech Stack:** Browser Fetch API, Blob/download APIs, Node.js 18+, `node:test`, GitHub Actions.

## Global Constraints

- Store all repository files under `D:\chatgpt-conversation-exporter`.
- Do not include conversations, cookies, tokens, private paths, or personal project material.
- Do not use third-party runtime or build dependencies.
- Export only visible user and assistant messages on the active parent-linked branch.
- Use the same-origin ChatGPT endpoint with the user's existing browser session.
- Commit the generated bookmarklet together with its readable source.

---

### Task 1: Create the package and bookmarklet pipeline

**Files:**
- Create: `package.json`
- Create: `scripts/build-bookmarklet.mjs`
- Create: `dist/chatgpt-export-to-markdown.bookmarklet.txt`

**Interfaces:**
- `npm run build` reads `src/chatgpt-export-to-markdown.js` and writes the generated bookmarklet.
- `buildBookmarklet(source)` is exported for deterministic tests.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "chatgpt-conversation-exporter",
  "version": "0.1.0",
  "description": "Export the active ChatGPT conversation branch to Markdown from your browser.",
  "private": true,
  "type": "module",
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "node scripts/build-bookmarklet.mjs",
    "test": "node --test",
    "check": "npm run build && npm test"
  }
}
```

- [ ] **Step 2: Create `scripts/build-bookmarklet.mjs`**

Implement `buildBookmarklet(source)` by normalizing CRLF to LF, trimming the source, replacing source line breaks with spaces, and returning `javascript:${singleLine}\n`. Export the function and `writeBookmarklet()`. The CLI must read `src/chatgpt-export-to-markdown.js`, create `dist/`, and write `dist/chatgpt-export-to-markdown.bookmarklet.txt` as UTF-8. Guard the CLI with an `import.meta.url` versus `process.argv[1]` check so importing the module does not write files.

The implementation must use only `node:fs/promises`, `node:path`, and `node:url`, and must print `Wrote dist/chatgpt-export-to-markdown.bookmarklet.txt` on success.

- [ ] **Step 3: Commit the pipeline files after the source entrypoint is added**

```text
npm run build
git add package.json scripts/build-bookmarklet.mjs dist/chatgpt-export-to-markdown.bookmarklet.txt
git commit -m "build: add bookmarklet pipeline"
```

### Task 2: Implement the self-contained browser exporter

**Files:**
- Create: `src/chatgpt-export-to-markdown.js`

**Interfaces:**
- The file is an immediately invoked script with no imports.
- Internal functions are `getConversationId`, `fetchConversation`, `getActiveBranch`, `getMessageText`, `getTitle`, `makeFilename`, `buildMarkdown`, `downloadMarkdown`, `reportError`, and `run`.

- [ ] **Step 1: Implement page validation and retrieval**

Use `new URL(window.location.href)`, accept only `chatgpt.com`, `www.chatgpt.com`, and `chat.openai.com`, and read the segment after the last `c` path segment so `/g/<custom-gpt>/c/<id>` works. Fetch `/backend-api/conversation/<encoded-id>` with `{ credentials: "include", headers: { Accept: "application/json" } }`. Throw readable errors for a non-ChatGPT page, missing ID, non-2xx response, or invalid JSON.

- [ ] **Step 2: Implement active-branch reconstruction**

Read `conversation.mapping` and `conversation.current_node`. Follow `node.parent` until null, keep a `Set` of visited IDs, throw on cycles or missing nodes, reverse the collected messages, and keep only non-hidden `user` and `assistant` messages. Read string parts directly, object parts with a `text` field as text, represent image parts as `[Image attachment omitted]`, represent file parts as `[File attachment omitted]`, and ignore other unsupported parts.

- [ ] **Step 3: Implement Markdown and filename generation**

Use `conversation.title` when non-empty and otherwise the first line of the first user message. Sanitize filenames by Unicode NFKC normalization, removing Windows-invalid characters and control characters, collapsing whitespace, limiting the title to 80 characters, and appending the current local export date as `YYYY-MM-DD.md`. Build Markdown with one `#` title, an export date line, and `## User` or `## Assistant` sections. Normalize CRLF to LF and end with exactly one newline.

- [ ] **Step 4: Implement local download and error reporting**

Create a `text/markdown;charset=utf-8` Blob, create a temporary object URL, click a hidden anchor with the safe filename, remove the anchor, and revoke the URL after one second. On failure, log only the error message and show it with `window.alert`; never log or send message contents.

- [ ] **Step 5: Rebuild and commit the exporter**

```text
npm run build
git add src/chatgpt-export-to-markdown.js dist/chatgpt-export-to-markdown.bookmarklet.txt
git commit -m "feat: export ChatGPT conversations to Markdown"
```

### Task 3: Add deterministic tests and CI

**Files:**
- Create: `test/build.test.mjs`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Add tests with `node:test`**

Test that `buildBookmarklet("(() => {\n  console.log('ok');\n})();\n")` returns a `javascript:` URL with no internal newline, that two builds of the exporter source are byte-identical, that the artifact is longer than 1000 characters and contains `ChatGPT Conversation Exporter`, and that the source contains `credentials: "include"` and `/backend-api/conversation` but no third-party HTTP origin.

- [ ] **Step 2: Add `.github/workflows/ci.yml`**

Run `npm run check` on `push` and `pull_request` with `actions/checkout@v4`, `actions/setup-node@v4`, Node 20, and `permissions: contents: read`.

- [ ] **Step 3: Run and commit checks**

```text
npm test
git add test/build.test.mjs .github/workflows/ci.yml
git commit -m "test: verify bookmarklet build"
```

### Task 4: Write public documentation and license

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `.gitignore`

- [ ] **Step 1: Write `README.md`**

Explain what the tool does in one paragraph, then document bookmarklet installation, readable source use, `npm run build`, `npm test`, exported message scope, attachment placeholders, same-origin privacy behavior, undocumented endpoint limitation, active-branch behavior, troubleshooting, contributing, and MIT licensing. Use plain English and avoid personal history, inflated claims, and AI-related meta language.

- [ ] **Step 2: Add MIT license and `.gitignore`**

Use the standard MIT license with `Copyright (c) 2026 Juho Cheng`. Ignore `node_modules/`, `coverage/`, `*.log`, `.DS_Store`, and `Thumbs.db`.

- [ ] **Step 3: Validate and commit documentation**

```text
git diff --check
git status --short
git add README.md LICENSE .gitignore
git commit -m "docs: add open source usage guide"
```

### Task 5: Final local verification and GitHub publication

**Files:**
- Modify: generated bookmarklet only if `npm run check` refreshes it

- [ ] **Step 1: Run the complete local gate**

```text
npm run check
git diff --check
git status --short --branch
git ls-files
```

Expected result: build and tests pass, the diff check is silent, the branch is `main`, and tracked files contain no conversation logs or private data.

- [ ] **Step 2: Create the public repository**

Create `chatgpt-conversation-exporter` under the authenticated GitHub account without generating a second README, license, or gitignore. Use the actual account owner returned by GitHub; never invent it.

- [ ] **Step 3: Add `origin` and push `main`**

```text
git remote add origin https://github.com/<owner>/chatgpt-conversation-exporter.git
git push -u origin main
```

- [ ] **Step 4: Verify publication**

Confirm the public repository shows the README, source, generated bookmarklet, license, and CI workflow. Report the repository URL, final commit, local validation, and any GitHub checks that remain unverified because authentication or hosted CI is unavailable.
