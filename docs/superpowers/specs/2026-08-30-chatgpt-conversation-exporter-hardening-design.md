# ChatGPT Conversation Exporter Hardening Design

## Goal

Improve the public utility so it preserves exported Markdown more faithfully, gives useful feedback for long-running requests, supports optional all-branch export, and has a cleaner public repository surface.

## Functional Changes

- Keep active-branch export as the default.
- Ask the user whether to export only the active branch or every leaf branch when the bookmarklet runs.
- Reconstruct every branch from parent links and child relationships with cycle protection and a maximum branch guard.
- Preserve message line endings and internal blank lines. Only normalize line-ending style and the final file terminator.
- Keep safe placeholders for image, file, audio, video, and unknown visible content parts without exposing internal asset pointers.
- Use local calendar dates for filenames and document headers.
- Add a 60-second fetch timeout and a non-blocking status toast for loading, success, and failure.
- Add negative tests for URL validation, HTTP failure, malformed responses, missing nodes, cycles, and branch selection.

## Repository Changes

Remove `docs/superpowers/` from the public tree after implementation because it contains internal planning metadata. Add `SECURITY.md`, a bug-report issue template, a tag-triggered release workflow, and a Node 18/20/22 CI matrix. Make `npm run check` validate JavaScript syntax, tests, whitespace, and that the generated bookmarklet is synchronized with its source.

The release workflow will build the bookmarklet and use the repository's GitHub token to attach `dist/chatgpt-export-to-markdown.bookmarklet.txt` to releases created from `v*` tags. No runtime dependency or npm package publication is introduced.

## Data Flow

The browser entrypoint validates the current ChatGPT host and conversation URL, fetches the conversation using `credentials: include`, reconstructs either the selected active path or all root-to-leaf paths, serializes only visible user and assistant content, and downloads a local Markdown Blob. The script never sends conversation content to an external origin.

## Error Handling

Network timeout, non-2xx response, invalid JSON, unsupported response shape, missing branch nodes, cycles, and empty exports produce a short toast and a console error without dumping conversation content. A failed export must not create a partial file.

## Validation

Node tests will execute the browser entrypoint with a fake Fetch API and DOM, covering active and all-branch output, exact content preservation, local date behavior, attachment placeholders, and failure paths. CI will run the same check on Node 18, 20, and 22 and will fail when `dist/` differs after rebuilding.

## Public Documentation

README will explain both export modes, privacy boundaries, the unofficial endpoint limitation, release downloads, and responsible issue reports. It will state that the project is not affiliated with OpenAI and that users are responsible for the conversations they export.
