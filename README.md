# ChatGPT Conversation Exporter

Export the active branch of a ChatGPT conversation to a Markdown file from your browser.

This is a small bookmarklet and browser script. It runs locally in the page you are viewing and does not use a separate service.

## Use the bookmarklet

1. Open [`dist/chatgpt-export-to-markdown.bookmarklet.txt`](dist/chatgpt-export-to-markdown.bookmarklet.txt) and copy the entire line.
2. Create a new browser bookmark and paste the line into the bookmark URL field.
3. Open a ChatGPT conversation while signed in.
4. Click the bookmark. Your browser will download a Markdown file.

Keep the `javascript:` prefix when pasting the bookmarklet. If the browser removes it, type it back into the bookmark URL.

## Use the readable script

Open [`src/chatgpt-export-to-markdown.js`](src/chatgpt-export-to-markdown.js), copy its contents, and run it in the browser console while a ChatGPT conversation is open. This is useful when you want to inspect or modify the script.

## Build from source

Node.js 18 or newer is required for development. There are no third-party dependencies.

```bash
npm run build
npm test
```

`npm run build` writes the checked-in bookmarklet to `dist/chatgpt-export-to-markdown.bookmarklet.txt`.

## What it exports

The exporter requests the current conversation from ChatGPT, follows the active conversation branch, and writes visible user and assistant messages in order. Markdown and fenced code blocks are kept as text.

Image and file attachments are represented by a short placeholder. The attachments themselves are not downloaded.

## Privacy

The script runs in your browser and uses your existing signed-in ChatGPT session. It requests data from ChatGPT's same-origin conversation endpoint and does not send the conversation to a third-party service. The Markdown file is created locally by your browser.

Only run it on conversations you are allowed to access. Review the source before using it if your environment has additional security requirements.

## Limitations

- ChatGPT's conversation endpoint is not a public, stable API. A change to ChatGPT may break the exporter.
- The export follows the currently selected branch rather than every alternate branch.
- Unsupported internal message types are not included.
- The tool does not upload, publish, or delete anything.

## Troubleshooting

If the exporter reports that it cannot find a conversation, run it from an open ChatGPT conversation rather than the home page. If ChatGPT returns an HTTP error, refresh the page and confirm that you are signed in.

If the script stops working after a ChatGPT update, open an issue with the error message and the ChatGPT page type. Do not attach a private conversation.

## Contributing

Keep the browser script self-contained and the generated bookmarklet in sync. Run `npm run check` before opening a pull request.

## License

MIT
