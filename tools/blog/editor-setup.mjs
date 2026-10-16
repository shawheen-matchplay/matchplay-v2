#!/usr/bin/env node
/* Set (or change) the blog editor's password and GitHub token.

   The editor (blog-editor.html) publishes by committing to this repo, so it
   needs a GitHub token. The token is stored in the page encrypted with a
   password you choose (AES-GCM, key from PBKDF2-SHA256), and only that
   password unlocks it. Share the password, never the token.

   1. Make a fine-grained token at https://github.com/settings/personal-access-tokens/new
        Repository access: only this repository
        Permissions:       Contents → Read and write   (nothing else)
        Expiration:        your call; rerun this script with a new token when it lapses
   2. From the repo root:  node tools/blog/editor-setup.mjs
   3. Commit and push blog-editor.html.

   Use a long password (four or more random words): the encrypted token is in
   a public file, so the password is what keeps it safe. To revoke access,
   delete the token on GitHub; to change the password, rerun this script.

   Needs Node 18 or later. */

import { webcrypto as crypto } from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PAGE = path.join(ROOT, "blog-editor.html");
const ITERATIONS = 600000;
const BRANCH = "main";

function ask(question, hidden) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Echo the prompt, swallow the keystrokes.
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(question); };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

function repoFromRemote() {
  const url = execSync("git remote get-url origin", { cwd: ROOT }).toString().trim();
  const m = url.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
  if (!m) throw new Error("origin isn't a GitHub remote: " + url);
  return { owner: m[1], repo: m[2] };
}

const b64 = (bytes) => Buffer.from(bytes).toString("base64");

async function encrypt(payload, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
  return { v: 1, iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(data)) };
}

async function main() {
  const { owner, repo } = repoFromRemote();
  console.log(`Blog editor setup for ${owner}/${repo} (branch ${BRANCH}).\n`);

  const token = await ask("GitHub token (hidden): ", true);
  if (!token) throw new Error("No token given.");
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/tools/blog/posts?ref=${BRANCH}`, {
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" }
  });
  if (!res.ok) throw new Error(`That token can't read ${owner}/${repo} (GitHub said ${res.status}). Check its repository access.`);
  console.log("Token can read the repo. (Write access is checked on the first publish.)\n");

  const password = await ask("Editor password (hidden, 12+ characters): ", true);
  if (password.length < 12) throw new Error("Use at least 12 characters; four random words is ideal.");
  if ((await ask("Same password again: ", true)) !== password) throw new Error("The passwords didn't match.");

  const vault = await encrypt({ token, owner, repo, branch: BRANCH }, password);
  const page = fs.readFileSync(PAGE, "utf8");
  const marker = /\/\* VAULT:start \*\/[\s\S]*?\/\* VAULT:end \*\//;
  if (!marker.test(page)) throw new Error("Couldn't find the VAULT markers in blog-editor.html.");
  fs.writeFileSync(PAGE, page.replace(marker, `/* VAULT:start */ var VAULT = ${JSON.stringify(vault)}; /* VAULT:end */`));

  console.log("\nDone. blog-editor.html now opens with that password.");
  console.log("Commit and push it:  git add blog-editor.html && git commit -m \"Blog editor: set password\" && git push");
}

main().catch((err) => { console.error("\n" + err.message); process.exit(1); });
