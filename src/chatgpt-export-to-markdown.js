(() => {
  "use strict";

  const EXPORTER_NAME = "ChatGPT Conversation Exporter";
  const CHATGPT_HOSTS = new Set(["chatgpt.com", "www.chatgpt.com", "chat.openai.com"]);
  const FETCH_TIMEOUT_MS = 60000;
  const MAX_BRANCHES = 1000;
  const STATUS_ELEMENT_ID = "chatgpt-conversation-exporter-status";
  let statusRemovalTimer = 0;

  function normalizeLineEndings(value) {
    return String(value).replace(/\r\n?/g, "\n");
  }

  function formatLocalDate(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function getConversationId(locationValue) {
    const currentUrl = new URL(locationValue);
    if (!CHATGPT_HOSTS.has(currentUrl.hostname)) {
      throw new Error("Open a ChatGPT conversation before running the exporter.");
    }

    const pathParts = currentUrl.pathname.split("/").filter(Boolean);
    const conversationIndex = pathParts.lastIndexOf("c");
    const conversationId = conversationIndex >= 0 ? pathParts[conversationIndex + 1] : "";
    if (!conversationId) {
      throw new Error("The current page does not contain a ChatGPT conversation ID.");
    }

    return decodeURIComponent(conversationId);
  }

  async function fetchConversation(conversationId) {
    const endpoint = "/backend-api/conversation/" + encodeURIComponent(conversationId);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;

    try {
      response = await fetch(endpoint, {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("Timed out while loading the conversation.");
      }
      throw new Error("Could not load the conversation.");
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error("ChatGPT returned HTTP " + response.status + ".");
    }

    try {
      return await response.json();
    } catch {
      throw new Error("ChatGPT returned invalid conversation data.");
    }
  }

  function renderPart(part) {
    if (typeof part === "string") {
      return part;
    }
    if (part && typeof part.text === "string") {
      return part.text;
    }
    if (part?.content_type === "image_asset_pointer") {
      return "[Image attachment omitted]";
    }
    if (part?.content_type === "file" || part?.content_type === "file_citation") {
      return "[File attachment omitted]";
    }
    if (part?.content_type === "audio") {
      return "[Audio attachment omitted]";
    }
    if (part?.content_type === "video") {
      return "[Video attachment omitted]";
    }
    if (part && typeof part === "object") {
      return "[Unsupported content omitted]";
    }
    return "";
  }

  function getMessageText(message) {
    const parts = message?.content?.parts;
    let rawText = "";
    if (Array.isArray(parts)) {
      rawText = parts.map(renderPart).join("\n");
    } else if (typeof message?.content?.text === "string") {
      rawText = message.content.text;
    }

    return normalizeLineEndings(rawText);
  }

  function getVisibleMessage(node) {
    const message = node?.message;
    const role = message?.author?.role;
    const metadata = message?.metadata;
    const isHidden = metadata?.is_visually_hidden_from_conversation === true || metadata?.is_hidden === true;
    if (isHidden || (role !== "user" && role !== "assistant")) {
      return null;
    }

    const text = getMessageText(message);
    return text.trim().length > 0 ? { role, text } : null;
  }

  function getMapping(conversation) {
    const mapping = conversation?.mapping;
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
      throw new Error("The conversation response has an unsupported shape.");
    }
    return mapping;
  }

  function getActiveBranch(conversation) {
    const mapping = getMapping(conversation);
    const currentNodeId = conversation?.current_node;
    if (!currentNodeId) {
      throw new Error("The conversation response has no active node.");
    }

    const messages = [];
    const visitedNodeIds = new Set();
    let nodeId = currentNodeId;

    while (nodeId) {
      if (visitedNodeIds.has(nodeId)) {
        throw new Error("The conversation tree contains a cycle.");
      }
      visitedNodeIds.add(nodeId);

      const node = mapping[nodeId];
      if (!node) {
        throw new Error("The active conversation branch is incomplete.");
      }

      const message = getVisibleMessage(node);
      if (message) {
        messages.push(message);
      }
      nodeId = node.parent;
    }

    return messages.reverse();
  }

  function getChildIdsByParent(mapping) {
    const childIdsByParent = new Map();
    const mappingIds = Object.keys(mapping);

    mappingIds.forEach((nodeId) => {
      const parentId = mapping[nodeId]?.parent;
      if (parentId === null || parentId === undefined || parentId === "") {
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(mapping, parentId)) {
        throw new Error("The conversation tree contains a missing parent node.");
      }
      if (!childIdsByParent.has(parentId)) {
        childIdsByParent.set(parentId, []);
      }
      childIdsByParent.get(parentId).push(nodeId);
    });

    return childIdsByParent;
  }

  function getAllBranches(conversation) {
    const mapping = getMapping(conversation);
    const childIdsByParent = getChildIdsByParent(mapping);
    const roots = Object.keys(mapping).filter((nodeId) => {
      const parentId = mapping[nodeId]?.parent;
      return parentId === null || parentId === undefined || parentId === "";
    });
    if (roots.length === 0) {
      throw new Error("The conversation tree has no root node.");
    }

    const branches = [];
    const visitedNodeIds = new Set();

    function visit(nodeId, messages, pathNodeIds) {
      if (pathNodeIds.has(nodeId)) {
        throw new Error("The conversation tree contains a cycle.");
      }
      const node = mapping[nodeId];
      if (!node) {
        throw new Error("The conversation tree is incomplete.");
      }

      const nextPathNodeIds = new Set(pathNodeIds);
      nextPathNodeIds.add(nodeId);
      visitedNodeIds.add(nodeId);
      const message = getVisibleMessage(node);
      const nextMessages = message ? messages.concat(message) : messages;
      const childIds = childIdsByParent.get(nodeId) || [];

      if (childIds.length === 0) {
        if (nextMessages.length > 0) {
          branches.push(nextMessages);
        }
        if (branches.length > MAX_BRANCHES) {
          throw new Error("The conversation has too many branches to export safely.");
        }
        return;
      }

      childIds.forEach((childId) => visit(childId, nextMessages, nextPathNodeIds));
    }

    roots.forEach((rootId) => visit(rootId, [], new Set()));
    if (visitedNodeIds.size !== Object.keys(mapping).length) {
      throw new Error("The conversation tree contains a disconnected or cyclic node.");
    }

    return branches;
  }

  function chooseExportMode() {
    if (typeof window.confirm !== "function") {
      return "active";
    }
    const activeOnly = window.confirm("Export the active branch only?\n\nOK: active branch\nCancel: every branch");
    return activeOnly ? "active" : "all";
  }

  function getTitle(conversation, messages) {
    const conversationTitle = typeof conversation?.title === "string"
      ? normalizeLineEndings(conversation.title).trim().replace(/\s+/g, " ")
      : "";
    if (conversationTitle) {
      return conversationTitle;
    }

    const firstUserMessage = messages.find((message) => message.role === "user");
    const firstLine = firstUserMessage?.text.split("\n")[0]?.trim() || "";
    return firstLine || "ChatGPT conversation";
  }

  function makeFilename(title, currentDate, mode) {
    const safeTitle = title
      .normalize("NFKC")
      .replace(/[<>:\"/\\|?*\u0000-\u001F]/g, "")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .trim()
      .slice(0, 80) || "chatgpt-conversation";
    const branchSuffix = mode === "all" ? "-all-branches" : "";
    return safeTitle + branchSuffix + "-" + formatLocalDate(currentDate) + ".md";
  }

  function buildMessageSection(message, headingLevel) {
    const label = message.role === "user" ? "User" : "Assistant";
    return headingLevel + " " + label + "\n\n" + message.text;
  }

  function buildMarkdown(title, messageGroups, currentDate, mode) {
    const sections = [
      "# " + title,
      "Exported from ChatGPT on " + formatLocalDate(currentDate) + "."
    ];

    if (mode === "active") {
      messageGroups[0].forEach((message) => sections.push(buildMessageSection(message, "##")));
    } else {
      messageGroups.forEach((messages, index) => {
        const branchSections = ["## Branch " + (index + 1)];
        messages.forEach((message) => branchSections.push(buildMessageSection(message, "###")));
        sections.push(branchSections.join("\n\n"));
      });
    }

    return normalizeLineEndings(sections.join("\n\n")).replace(/\n+$/g, "") + "\n";
  }

  function showStatus(message, kind) {
    const statusText = EXPORTER_NAME + ": " + message;
    if (kind === "error") {
      console.error(statusText);
    } else {
      console.info(statusText);
    }

    if (typeof document === "undefined" || !document.body) {
      return;
    }

    let statusElement = document.getElementById(STATUS_ELEMENT_ID);
    if (!statusElement) {
      statusElement = document.createElement("div");
      statusElement.id = STATUS_ELEMENT_ID;
      statusElement.style.position = "fixed";
      statusElement.style.right = "16px";
      statusElement.style.bottom = "16px";
      statusElement.style.zIndex = "2147483647";
      statusElement.style.maxWidth = "min(420px, calc(100vw - 32px))";
      statusElement.style.padding = "10px 14px";
      statusElement.style.borderRadius = "8px";
      statusElement.style.background = "#202123";
      statusElement.style.color = "#ffffff";
      statusElement.style.font = "14px/1.4 system-ui, sans-serif";
      document.body.appendChild(statusElement);
    }

    statusElement.textContent = statusText;
    statusElement.style.background = kind === "error" ? "#8b1e1e" : "#202123";
    if (statusRemovalTimer) {
      window.clearTimeout(statusRemovalTimer);
    }
    statusRemovalTimer = window.setTimeout(() => {
      statusElement.remove();
      statusRemovalTimer = 0;
    }, 4000);
  }

  function downloadMarkdown(markdown, filename) {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const downloadLink = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    downloadLink.href = objectUrl;
    downloadLink.download = filename;
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function reportError(error) {
    const message = error instanceof Error ? error.message : "Unknown exporter error.";
    showStatus(message, "error");
  }

  async function run() {
    const mode = chooseExportMode();
    showStatus("Loading conversation...", "info");
    const conversationId = getConversationId(window.location.href);
    const conversation = await fetchConversation(conversationId);
    const messageGroups = mode === "active" ? [getActiveBranch(conversation)] : getAllBranches(conversation);
    if (messageGroups.length === 0 || messageGroups.every((messages) => messages.length === 0)) {
      throw new Error("No visible user or assistant messages were found.");
    }

    const currentDate = new Date();
    const title = getTitle(conversation, messageGroups[0]);
    const markdown = buildMarkdown(title, messageGroups, currentDate, mode);
    const filename = makeFilename(title, currentDate, mode);
    downloadMarkdown(markdown, filename);
    const messageCount = messageGroups.reduce((count, messages) => count + messages.length, 0);
    showStatus("Downloaded " + filename + " (" + messageCount + " messages).", "success");
  }

  run().catch(reportError);
})();
