import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { buildBookmarklet } from "../scripts/build-bookmarklet.mjs";

const source = await readFile(new URL("../src/chatgpt-export-to-markdown.js", import.meta.url), "utf8");

function jsonResponse(value) {
  return {
    ok: true,
    status: 200,
    async json() { return value; }
  };
}

function createHarness({
  locationHref = "https://chatgpt.com/c/conversation-123",
  confirmValue = true,
  response = jsonResponse({ title: "Test", current_node: "root", mapping: { root: { parent: null } } }),
  fetchImpl,
  triggerTimeout = false
} = {}) {
  const objectUrls = new Map();
  const logs = { errors: [], infos: [] };
  const alerts = [];
  const timers = [];
  let downloadedBlob;
  let downloadedFilename;
  let statusElement;
  let objectUrlCounter = 0;

  const anchor = {
    style: {},
    click() {
      downloadedFilename = this.download;
      downloadedBlob = objectUrls.get(this.href);
    },
    remove() {}
  };
  const statusElementTemplate = {
    id: "",
    style: {},
    textContent: "",
    remove() { this.removed = true; }
  };

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
  TestURL.revokeObjectURL = () => {};

  class TestAbortController {
    constructor() {
      this.signal = { aborted: false, onabort: null };
    }
    abort() {
      this.signal.aborted = true;
      if (this.signal.onabort) this.signal.onabort();
    }
  }

  class FixedDate {
    getFullYear() { return 2026; }
    getMonth() { return 7; }
    getDate() { return 31; }
  }

  const document = {
    body: { appendChild(element) { statusElement = element; } },
    createElement(tagName) {
      if (tagName === "a") return anchor;
      statusElement = statusElementTemplate;
      return statusElement;
    },
    getElementById(id) {
      return statusElement?.id === id ? statusElement : null;
    }
  };

  let timerId = 0;
  const window = {
    alert(message) { alerts.push(message); },
    confirm() { return confirmValue; },
    location: { href: locationHref },
    clearTimeout(id) { timers.push({ id, cleared: true }); },
    setTimeout(callback, delay) {
      timerId += 1;
      timers.push({ id: timerId, delay });
      if (triggerTimeout && delay === 60000) queueMicrotask(callback);
      return timerId;
    }
  };

  const fetchFunction = fetchImpl || (async (endpoint, options) => {
    assert.equal(endpoint, "/backend-api/conversation/conversation-123");
    assert.equal(options.credentials, "include");
    assert.ok(options.signal);
    return response;
  });
  const context = {
    AbortController: TestAbortController,
    Blob: TestBlob,
    Date: FixedDate,
    URL: TestURL,
    console: {
      error(message) { logs.errors.push(message); },
      info(message) { logs.infos.push(message); }
    },
    document,
    fetch: fetchFunction,
    window
  };

  return {
    context,
    state() {
      return {
        alerts,
        errors: logs.errors,
        filename: downloadedFilename,
        infos: logs.infos,
        status: statusElement?.textContent || "",
        text: downloadedBlob?.text || ""
      };
    }
  };
}

async function runHarness(options) {
  const harness = createHarness(options);
  vm.runInNewContext(source, harness.context);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  return harness.state();
}

test("buildBookmarklet creates a single-line javascript URL", () => {
  const result = buildBookmarklet("(() => {\n  console.log('ok');\n})();\n");
  assert.match(result, /^javascript:\(\(\) => \{   console\.log\('ok'\); \}\)\(\);\n$/);
  assert.equal(result.slice(0, -1).includes("\n"), false);
});

test("buildBookmarklet rejects line comments and generated code parses", () => {
  assert.throws(() => buildBookmarklet("(() => { // unsafe\n})();"), /line comments/);
  assert.doesNotThrow(() => new vm.Script(buildBookmarklet(source).slice("javascript:".length)));
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

test("active branch preserves message order, whitespace, and local date", async () => {
  const response = jsonResponse({
    title: "Test / Conversation",
    current_node: "assistant-2",
    mapping: {
      root: { parent: null },
      "user-1": { parent: "root", message: { author: { role: "user" }, content: { parts: ["first\n\n\nlast"] } } },
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
          content: { parts: ["follow-up", { content_type: "image_asset_pointer" }, { content_type: "audio" }] }
        }
      },
      tool: { parent: "user-2", message: { author: { role: "tool" }, content: { parts: ["not exported"] } } },
      "assistant-2": { parent: "tool", message: { author: { role: "assistant" }, content: { parts: ["final"] } } }
    }
  });
  const state = await runHarness({ response });

  assert.deepEqual(state.alerts, []);
  assert.match(state.filename, /^Test Conversation-2026-08-31\.md$/);
  assert.match(state.text, /first\n\n\nlast/);
  assert.match(state.text, /follow-up\n\[Image attachment omitted\]\n\[Audio attachment omitted\]/);
  assert.match(state.text, /## Assistant\n\nanswer/);
  assert.match(state.text, /## Assistant\n\nfinal/);
  assert.doesNotMatch(state.text, /hidden|not exported/);
});

test("all-branch mode includes every leaf branch", async () => {
  const response = jsonResponse({
    title: "Branches",
    current_node: "right-a",
    mapping: {
      root: { parent: null },
      user: { parent: "root", message: { author: { role: "user" }, content: { parts: ["start"] } } },
      assistant: { parent: "user", message: { author: { role: "assistant" }, content: { parts: ["choose"] } } },
      "left-u": { parent: "assistant", message: { author: { role: "user" }, content: { parts: ["left"] } } },
      "left-a": { parent: "left-u", message: { author: { role: "assistant" }, content: { parts: ["left final"] } } },
      "right-u": { parent: "assistant", message: { author: { role: "user" }, content: { parts: ["right"] } } },
      "right-a": { parent: "right-u", message: { author: { role: "assistant" }, content: { parts: ["right final"] } } }
    }
  });
  const state = await runHarness({ confirmValue: false, response });

  assert.match(state.filename, /^Branches-all-branches-2026-08-31\.md$/);
  assert.match(state.text, /## Branch 1/);
  assert.match(state.text, /## Branch 2/);
  assert.match(state.text, /left final/);
  assert.match(state.text, /right final/);
  assert.match(state.text, /### User/);
});

test("runtime errors are reported without creating a download", async (t) => {
  await t.test("invalid URL", async () => {
    const state = await runHarness({ locationHref: "https://example.com/c/id" });
    assert.match(state.status, /Open a ChatGPT conversation/);
    assert.equal(state.filename, undefined);
  });

  await t.test("HTTP error", async () => {
    const state = await runHarness({ response: { ok: false, status: 403, async json() {} } });
    assert.match(state.status, /HTTP 403/);
    assert.equal(state.filename, undefined);
  });

  await t.test("malformed JSON", async () => {
    const state = await runHarness({ response: { ok: true, status: 200, async json() { throw new Error("bad"); } } });
    assert.match(state.status, /invalid conversation data/);
  });

  await t.test("missing node", async () => {
    const state = await runHarness({ response: jsonResponse({ current_node: "missing", mapping: { root: { parent: null } } }) });
    assert.match(state.status, /active conversation branch is incomplete/);
  });

  await t.test("cycle", async () => {
    const state = await runHarness({ confirmValue: false, response: jsonResponse({ current_node: "root", mapping: { root: { parent: null }, a: { parent: "b" }, b: { parent: "a" } } }) });
    assert.match(state.status, /disconnected or cyclic/);
  });

  await t.test("timeout", async () => {
    const fetchImpl = async (_endpoint, options) => new Promise((_resolve, reject) => {
      options.signal.onabort = () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      };
    });
    const state = await runHarness({ fetchImpl, triggerTimeout: true });
    assert.match(state.status, /Timed out while loading/);
    assert.equal(state.filename, undefined);
  });
});
