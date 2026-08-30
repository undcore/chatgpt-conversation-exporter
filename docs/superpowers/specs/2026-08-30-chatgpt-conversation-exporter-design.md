# ChatGPT Conversation Exporter Design

## Goal

Create a small public open-source utility that exports the currently open ChatGPT conversation to a readable Markdown file. The repository must serve both people who want to click a bookmarklet and contributors who want to inspect or change the source.

## Scope

The repository will contain:

- A readable, self-contained browser script that fetches the current conversation from ChatGPT's own same-origin conversation endpoint and reconstructs its message order from the conversation tree.
- A dependency-free Node.js build script that turns the source script into a one-line bookmarklet.
- The generated bookmarklet text file so end users can copy it without installing Node.js.
- A concise README covering installation, usage, privacy, limitations, and troubleshooting.
- A permissive MIT license, a minimal package manifest, a deterministic build check, and a GitHub Actions check.

The repository will not contain exported conversation logs, browser cookies, authentication tokens, personal file paths, or any private project material. It will not be published as an npm package and will not become a browser extension in this version.

## Repository Layout

```text
chatgpt-conversation-exporter/
├─ src/chatgpt-export-to-markdown.js
├─ scripts/build-bookmarklet.mjs
├─ dist/chatgpt-export-to-markdown.bookmarklet.txt
├─ test/build.test.mjs
├─ README.md
├─ LICENSE
├─ package.json
├─ .gitignore
└─ .github/workflows/ci.yml
```

`src/chatgpt-export-to-markdown.js` is the maintained source. It will validate that it is running on a ChatGPT conversation page, derive the conversation identifier from the URL, request the conversation with the user's existing signed-in browser session, follow the selected node's parent links, and serialize supported user/assistant content to Markdown. It will report a visible error when the endpoint, URL, or response shape is unavailable.

`scripts/build-bookmarklet.mjs` will read the source and write a deterministic `javascript:` bookmarklet. The build must not require third-party packages. It will create the destination directory when necessary and end the generated file with a newline.

`dist/chatgpt-export-to-markdown.bookmarklet.txt` is a checked-in convenience artifact. The README will explain that it is generated and can be refreshed with `npm run build`.

## User Flow

1. A user opens a ChatGPT conversation while signed in.
2. The user clicks a bookmark containing the generated `javascript:` URL, or pastes the readable source into the browser console.
3. The script obtains the current conversation identifier from the current URL.
4. The script requests the conversation data from the same ChatGPT origin; it does not send the conversation to a third-party service.
5. The script reconstructs the active branch by following `current_node` and its `parent` links.
6. The script serializes the supported messages, creates a UTF-8 Markdown Blob, and starts a local browser download.
7. The downloaded filename is derived from the conversation title or the first user message and includes a safe date component.

The exporter will keep the implementation intentionally narrow. It will not attempt to render the ChatGPT page, scroll a virtualized message list, scrape visible HTML, or upload the conversation elsewhere.

## Markdown Output

The output will include a title and ordered message sections. User and assistant messages will be labeled consistently, fenced code blocks will remain fenced, and ordinary Markdown will be preserved as far as the source content allows. Empty or unsupported content will be skipped without breaking the rest of the export. The serializer will normalize line endings and ensure the file ends with one newline.

## Privacy and Compatibility

The README will state clearly that the script runs in the user's browser and uses the user's active ChatGPT session. The script will not log or transmit conversation contents to an external server. The endpoint is an undocumented ChatGPT implementation detail, so a future ChatGPT change may require a maintenance update. The tool is intended for personal use on conversations the user is authorized to access.

## Validation

The automated checks will verify:

- the build completes without installing third-party dependencies;
- the generated bookmarklet is deterministic, starts with `javascript:`, contains the exporter entrypoint, and ends with a newline;
- the generated artifact is not accidentally empty;
- `git diff --check` passes for the repository files.

The checks will not claim to be a full browser integration test. The final report will distinguish local build/test results from manual use in a signed-in ChatGPT browser session.

## Documentation Style

`README.md` will use plain, direct open-source documentation: what the tool does, how to install it, how to use it, what it does not do, and how to report breakage. It will avoid personal conversation details, inflated claims, unnecessary project history, and wording that calls attention to how the documentation was produced.
