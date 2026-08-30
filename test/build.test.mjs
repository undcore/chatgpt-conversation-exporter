import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { buildBookmarklet } from "../scripts/build-bookmarklet.mjs";

const source = await readFile(new URL("../src/chatgpt-export-to-markdown.js", import.meta.url), "utf8");

test("buildBookmarklet creates a single-line javascript URL", () => {
  const result = buildBookmarklet("(() => {\n  console.log('ok');\n})();\n");
  assert.match(result, /^javascript:\(\(\) => \{   console\.log\('ok'\); \}\)\(\);\n$/);
  assert.equal(result.slice(0, -1).includes("\n"), false);
});

test("bookmarklet generation is deterministic for the exporter source", () => {
  const first = buildBookmarklet(source);
  const second = buildBookmarklet(source);
  assert.equal(first, second);
  assert.ok(first.startsWith("javascript:"));
  assert.ok(first.includes("ChatGPT Conversation Exporter"));
  assert.equal(first.endsWith("\n"), true);
  assert.ok(first.length > 1000);
});

test("source keeps the exporter local to the current ChatGPT session", () => {
  assert.match(source, /credentials:\s*["']include["']/);
  assert.match(source, /backend-api\/conversation/);
  assert.doesNotMatch(source, /https?:\/\/(?!chatgpt\.com|www\.chatgpt\.com|chat\.openai\.com)/);
});

test("browser entrypoint exports the active branch in order", async () => {
  let downloadedBlob;
  let downloadedFilename;
  const alerts = [];
  const anchor = {
    style: {},
    click() {
      downloadedFilename = this.download;
      downloadedBlob = objectUrls.get(this.href);
    },
    remove() {}
  };
  const objectUrls = new Map();
  let objectUrlCounter = 0;
  class TestBlob {
    constructor(parts) {
      this.text = parts.join("");
    }
  }
  class TestURL extends URL {}
  TestURL.createObjectURL = (blob) => {
    const objectUrl = "blob:test-" + objectUrlCounter;
    objectUrlCounter += 1;
    objectUrls.set(objectUrl, blob);
    return objectUrl;
  };
  TestURL.revokeObjectURL = (objectUrl) => {
    objectUrls.delete(objectUrl);
  };

  const response = {
    ok: true,
    status: 200,
    async json() {
      return {
        title: "Test / Conversation",
        current_node: "assistant-2",
        mapping: {
          root: { parent: null },
          "user-1": { parent: "root", message: { author: { role: "user" }, content: { parts: ["first"] } } },
          "assistant-1": { parent: "user-1", message: { author: { role: "assistant" }, content: { parts: ["answer"] } } },
          hidden: {
            parent: "assistant-1",
            message: {
              author: { role: "assistant" },
              metadata: { is_visually_hidden_from_conversation: true },
              content: { parts: ["hidden"] }
            }
          },
          "user-2": {
            parent: "hidden",
            message: {
              author: { role: "user" },
              content: { parts: ["follow-up", { content_type: "image_asset_pointer" }] }
            }
          },
          tool: { parent: "user-2", message: { author: { role: "tool" }, content: { parts: ["not exported"] } } },
          "assistant-2": { parent: "tool", message: { author: { role: "assistant" }, content: { parts: ["final"] } } }
        }
      };
    }
  };

  const context = {
    Blob: TestBlob,
    URL: TestURL,
    console: { error() {}, info() {} },
    document: {
      body: { appendChild() {} },
      createElement() { return anchor; }
    },
    fetch: async (endpoint, options) => {
      assert.equal(endpoint, "/backend-api/conversation/conversation-123");
      assert.equal(options.credentials, "include");
      return response;
    },
    window: {
      alert(message) { alerts.push(message); },
      location: { href: "https://chatgpt.com/g/g-p-test/c/conversation-123" },
      setTimeout(callback) { callback(); }
    }
  };

  vm.runInNewContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(alerts, []);
  assert.match(downloadedFilename, /^Test Conversation-\d{4}-\d{2}-\d{2}\.md$/);
  assert.match(downloadedBlob.text, /## User\n\nfirst/);
  assert.match(downloadedBlob.text, /## Assistant\n\nanswer/);
  assert.match(downloadedBlob.text, /follow-up\n\[Image attachment omitted\]/);
  assert.match(downloadedBlob.text, /## Assistant\n\nfinal/);
  assert.doesNotMatch(downloadedBlob.text, /hidden|not exported/);
});
