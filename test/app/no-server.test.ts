/**
 * Browser-only guard test.
 *
 * Asserts that:
 * 1. package.json contains none of the forbidden server/HTTP deps
 *    (axios, axios-cache-interceptor, undici, @nozbe/microfuzz)
 * 2. src/ contains no forbidden server imports (fetch(), axios, node: protocol, 'http')
 */

import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

// ── 1. package.json check ─────────────────────────────────────────────────────

const pkg = JSON.parse(
  readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const FORBIDDEN_RUNTIME_DEPS = [
  "axios",
  "axios-cache-interceptor",
  "undici",
  "@nozbe/microfuzz",
];

describe("package.json — no forbidden server deps", () => {
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  for (const dep of FORBIDDEN_RUNTIME_DEPS) {
    it(`must not contain "${dep}"`, () => {
      expect(Object.keys(allDeps)).not.toContain(dep);
    });
  }
});

// ── 2. src/ source scan ───────────────────────────────────────────────────────

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

const srcDir = join(REPO_ROOT, "src");
const srcFiles = collectTsFiles(srcDir);

// Patterns that indicate server-side or HTTP code
const FORBIDDEN_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "fetch() call", re: /\bfetch\s*\(/ },
  { label: "axios import/usage", re: /\baxios\b/ },
  { label: "node: protocol import", re: /from ['"]node:/ },
  { label: "'http' import", re: /from ['"]http['"]/ },
  {
    label: "server adapter middleware",
    re: /middleware\/(node|express|aws-lambda|azure-swa|bun|deno|cloudflare-pages|firebase|netlify-edge|vercel-edge)/,
  },
  { label: "createQwikCity server", re: /createQwikCity/ },
  { label: "node-fetch import", re: /from ['"]node-fetch['"]/ },
  { label: "got import", re: /from ['"]got['"]/ },
  { label: "superagent import", re: /from ['"]superagent['"]/ },
  { label: "full URL import (https://)", re: /from ['"]https:\/\// },
  { label: "full URL import (http://)", re: /from ['"]http:\/\// },
  { label: "'https' import", re: /from ['"]https['"]/ },
];

describe("src/ — no server/HTTP imports", () => {
  for (const { label, re } of FORBIDDEN_PATTERNS) {
    it(`must not contain ${label}`, () => {
      const hits: string[] = [];
      for (const file of srcFiles) {
        const content = readFileSync(file, "utf8");
        if (re.test(content)) {
          hits.push(file.replace(REPO_ROOT, ""));
        }
      }
      expect(hits, `Files containing ${label}`).toHaveLength(0);
    });
  }
});
