# ChatGPT Conversation Exporter

Export a ChatGPT conversation to a Markdown file from your browser.

This is a small bookmarklet and browser script. It runs locally in the page you are viewing and does not use a separate service. It is not affiliated with or endorsed by OpenAI.

## Use the bookmarklet

1. Open [`dist/chatgpt-export-to-markdown.bookmarklet.txt`](dist/chatgpt-export-to-markdown.bookmarklet.txt) and copy the entire line.
2. Create a new browser bookmark and paste the line into the bookmark URL field.
3. Open a ChatGPT conversation while signed in.
4. Click the bookmark. Choose the active branch or all branches, then your browser will download a Markdown file.

Keep the `javascript:` prefix when pasting the bookmarklet. If the browser removes it, type it back into the bookmark URL.

## Use the readable script

Open [`src/chatgpt-export-to-markdown.js`](src/chatgpt-export-to-markdown.js), copy its contents, and run it in the browser console while a ChatGPT conversation is open. This is useful when you want to inspect or modify the script.

## Build from source

Node.js 18 or newer is required for development. There are no third-party dependencies.

```bash
npm run build
npm test
```

`npm run build` writes the checked-in bookmarklet to `dist/chatgpt-export-to-markdown.bookmarklet.txt`. `npm run check` also checks JavaScript syntax, tests, whitespace, and whether the generated bookmarklet is up to date.

## Releases

Tagged releases include the ready-to-copy bookmarklet as a download. The source file remains available in the repository for inspection and local changes.

## What it exports

The exporter requests the current conversation from ChatGPT and writes visible user and assistant messages in order. When prompted, OK exports the active branch and Cancel exports every root-to-leaf branch. Markdown, fenced code blocks, and internal blank lines are kept as text.

Image, file, audio, and video attachments are represented by a short placeholder. Unknown structured content is marked as omitted. The attachments themselves are not downloaded.

## Privacy

The script runs in your browser and uses your existing signed-in ChatGPT session. It requests data from ChatGPT's same-origin conversation endpoint and does not send the conversation to a third-party service. The Markdown file is created locally by your browser.

Only run it on conversations you are allowed to access. You are responsible for the content you export and where you store or share it. Review the source before using it if your environment has additional security requirements.

## Limitations

- ChatGPT's conversation endpoint is not a public, stable API. A change to ChatGPT may break the exporter.
- The active-branch mode follows the currently selected branch. The all-branches mode exports every root-to-leaf branch, subject to a safety limit of 1,000 branches.
- Some internal message types and attachments cannot be reproduced; they are represented by placeholders or omitted.
- Requests time out after 60 seconds.
- The tool does not upload, publish, or delete anything.

## Troubleshooting

If the exporter reports that it cannot find a conversation, run it from an open ChatGPT conversation rather than the home page. If ChatGPT returns an HTTP error, refresh the page and confirm that you are signed in. A slow request ends with a timeout message instead of waiting indefinitely.

If the script stops working after a ChatGPT update, open an issue with the error message and the ChatGPT page type. Do not attach a private conversation.

## Contributing

Keep the browser script self-contained and the generated bookmarklet in sync. Run `npm run check` before opening a pull request. Do not include conversation exports, cookies, or access tokens in issues or pull requests.

## License

MIT
