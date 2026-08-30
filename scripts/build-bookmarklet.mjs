import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = path.resolve(scriptDirectory, "..");
const sourcePath = path.join(repositoryDirectory, "src", "chatgpt-export-to-markdown.js");
const outputDirectory = path.join(repositoryDirectory, "dist");
const outputPath = path.join(outputDirectory, "chatgpt-export-to-markdown.bookmarklet.txt");

export function buildBookmarklet(source) {
  const normalizedSource = source.replace(/\r\n?/g, "\n").trim();
  const singleLineSource = normalizedSource.replace(/\n/g, " ");
  return "javascript:" + singleLineSource + "\n";
}

export async function writeBookmarklet() {
  const source = await readFile(sourcePath, "utf8");
  const bookmarklet = buildBookmarklet(source);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, bookmarklet, "utf8");
  process.stdout.write("Wrote dist/chatgpt-export-to-markdown.bookmarklet.txt\n");
}

const currentScriptPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const moduleScriptPath = fileURLToPath(import.meta.url);

if (currentScriptPath === moduleScriptPath) {
  await writeBookmarklet();
}
