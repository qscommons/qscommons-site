// Builds the static site into out/: each page in src/pages is wrapped in the shared head, nav and
// footer from src/partials, and assets/ is copied beside it. Paths in the sources are written from the
// site root as {{root}}assets/..., and {{root}} becomes the page's relative way back to it, so the
// site works at a domain's root or under a project path on GitHub Pages.

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = "out";
const read = (f) => readFileSync(f, "utf8");
const partial = (name) => read(`src/partials/${name}.html`);

// A page's source starts with a block of `key: value` lines between <!--- and --->.
function frontMatter(src, file) {
  const m = src.match(/^<!---\n([\s\S]*?)\n--->\n/);
  if (!m) throw new Error(`${file}: missing the <!--- ... ---> header`);
  const data = Object.fromEntries(
    m[1].split("\n").filter(Boolean).map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
  for (const k of ["title", "description", "path", "current"]) {
    if (!(k in data)) throw new Error(`${file}: header needs ${k}`);
  }
  return [data, src.slice(m[0].length)];
}

// ---- the projects, from src/data/projects.json (one entry per project) ----
const { projects } = JSON.parse(read("src/data/projects.json"));
const featured = projects.find((p) => p.featured) || projects[0];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// A kit `code` fragment (assets/ui/code) holding plain lines, one of them marked.
function codeFragment({ file, lang = "PY", chip = "", lines, mark, hint }) {
  const body = lines
    .map((l, i) => `<span class="ui-code__ln${i + 1 === mark ? " is-mark" : ""}" data-n="${i + 1}">${l.startsWith("#") ? `<span class="c">${esc(l)}</span>` : esc(l)}</span>`)
    .join("\n");
  return `<div class="ui ui-panel ui-code" data-ui="code">
  <div class="ui-code__tabs"><span class="ui-code__tab is-on"><i class="ui-code__lang">${esc(lang)}</i>${esc(file)}</span><span class="ui-spacer"></span>${chip ? `<span class="ui-chip ui-chip--plain ui-code__chip" data-code-chip>${esc(chip)}</span>` : ""}</div>
  <pre class="ui-code__pre"><code>${body}</code></pre>
  ${hint ? `<div class="ui-code__hint" data-code-hint><span class="ui-dot"></span><span data-code-text>${esc(hint)}</span></div>` : ""}
</div>`;
}

// The nav's Projects menu: the first two link groups across all projects, then the featured release card.
function projectsMenu() {
  const groups = projects.flatMap((p) => p.menu || []).slice(0, 2);
  const cols = groups.map((g) => `<div class="menu-col span-3">
  <p class="t-label">${esc(g.label)}</p>
  ${g.links.map((l) => `<a href="${l.href}">${esc(l.label)}<span>${esc(l.note)}</span></a>`).join("\n  ")}
</div>`);
  const r = featured.release;
  const card = r ? `<a class="menu-card span-3 start-10" href="${r.href}">
  <div class="panel"><div class="stage stage--fade-br"><div class="at-corner" style="--ax:24px;--ay:24px">
${codeFragment({ file: r.file, chip: featured.version, lines: r.lines, mark: r.mark, hint: r.hint })}
  </div></div></div>
  <span class="t-card">${esc(r.title)}</span>
  <span class="t-small muted">${esc(r.note)}</span>
</a>` : "";
  return [...cols, card].join("\n");
}

// The footer's Projects column: the list page, then each project's source.
function projectsFooter() {
  return [`<li><a href="{{root}}projects/">All projects</a></li>`,
    ...projects.map((p) => `<li><a href="${(p.links.find((l) => l.label === "Source") || p.links[0]).href}">${esc(p.name)}</a></li>`)].join("");
}

// One card per project for the Projects page's catalog.
function projectCards() {
  return projects.map((p) => `<article class="card card--row span-6 m-nolift" id="${esc(p.id)}">
  <div class="project__head"><h3>${esc(p.name)}</h3><span class="tag">${esc(p.status)}${p.version ? ` · ${esc(p.version)}` : ""}</span></div>
  <p>${esc(p.tagline)} ${esc(p.summary)}</p>
  <p class="project-links">${p.links.map((l) => `<a class="link" href="${l.href}">${esc(l.label)}</a>`).join(" ")}</p>
  <div class="panel panel--flush">
    <div class="stage stage--fade-b"><div class="at-rise fit" style="--fit-max:400px;--ax:max(32px, 50% - 200px);--ay:32px;--ay-sm:20px">
${codeFragment({ ...p.example, hint: p.example.note })}
    </div></div>
  </div>
</article>`).join("\n");
}

const generated = { "projects-menu": projectsMenu(), "projects-footer": projectsFooter(), "project-cards": projectCards() };

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync("assets", path.join(OUT, "assets"), { recursive: true });
for (const f of readdirSync("public")) cpSync(path.join("public", f), path.join(OUT, f), { recursive: true });

for (const file of readdirSync("src/pages").filter((f) => f.endsWith(".html"))) {
  const [meta, body] = frontMatter(read(`src/pages/${file}`), file);
  const depth = meta.path.split("/").filter(Boolean).length;
  const root = depth ? "../".repeat(depth) : "./";
  const nav = partial("nav").replace(
    `data-page="${meta.current}"`,
    `data-page="${meta.current}" aria-current="page"`,
  );
  let html = [partial("head"), nav, body, partial("footer")].join("\n");
  for (const [k, v] of Object.entries(generated)) html = html.replaceAll(`{{${k}}}`, v);
  html = html
    .replaceAll("{{title}}", meta.title)
    .replaceAll("{{description}}", meta.description)
    .replaceAll("{{extra-head}}", meta.head ? meta.head.split(" ; ").join("\n") : "")
    .replaceAll("{{root}}", root);
  const left = html.match(/\{\{[a-z-]+\}\}/);
  if (left) throw new Error(`${file}: ${left[0]} was never filled`);
  const dir = path.join(OUT, meta.path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), html);
}
console.log("built out/");
