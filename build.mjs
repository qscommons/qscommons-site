// Builds the static site into out/: each page in src/pages is wrapped in the shared head, nav and
// footer from src/partials (as is each article in src/articles/*.mdx), and assets/ is copied beside it. Paths in the sources are written from the
// site root as {{root}}assets/..., and {{root}} becomes the page's relative way back to it, so the
// site works at a domain's root or under a project path on GitHub Pages.

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "preact/jsx-runtime";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";

const OUT = "out";
const read = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n"); // Windows checkouts get CRLF
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
// A release's title defaults to "<name> <version>", so a new version is one change: `version` in projects.json.
for (const p of projects) if (p.release && !p.release.title) p.release.title = `${p.name} ${p.version}`;
// {{version:<id>}} anywhere in a page or partial becomes that project's current version.
const versionTokens = Object.fromEntries(projects.map((p) => [`version:${p.id}`, p.version]));
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

// One screen per project on the Projects page: the words on the left, its example as a code window on
// the lit ground on the right (sections-library.md, split-text-left).
function projectSections() {
  return projects.map((p) => `<section class="section" id="${esc(p.id)}" style="--hm: 2" aria-labelledby="${esc(p.id)}-h">
    <div class="wrap">
      <div class="grid grid--top fill">
        <div class="span-5 stack-6">
          <p class="t-label project__status">${esc(p.status)}${p.version ? ` · version ${esc(p.version)}` : ""}</p>
          <h2 id="${esc(p.id)}-h">${esc(p.heading || p.name)}</h2>
          <p class="t-lead">${esc(p.summary)}</p>
          <p class="project__facts">${(p.facts || []).map(esc).join(" · ")}</p>
          <p class="project-links">${p.page ? `<a class="btn btn--primary" href="${p.page}">More on ${esc(p.name)}</a> ` : ""}${p.start ?`<a class="btn btn--secondary" href="${p.start.href}">${esc(p.start.label)}</a> ` : ""}${p.links.map((l) => `<a class="link" href="${l.href}">${esc(l.label)}</a>`).join(" ")}</p>
        </div>
        <div class="frame frame--split frame--lit frame--fill span-6 start-7">
          <div class="stage stage--fade-b"><div class="at-rise fit" style="--fit-max:440px;--ax:max(40px, 50% - 220px);--ay:56px;--ay-sm:24px">
${codeFragment({ ...p.example, hint: p.example.note })}
          </div></div>
        </div>
      </div>
    </div>
  </section>`).join("\n\n");
}

// The home page's project cards: one per project, linking to its own page (or its screen on /projects/).
function projectCards() {
  const card = (p) => `<a class="project-card" href="${p.page || `{{root}}projects/#${esc(p.id)}`}">
  <p class="t-label project__status">${esc(p.status)}${p.version ? ` · version ${esc(p.version)}` : ""}</p>
  <h3>${esc(p.name)}</h3>
  <p>${esc(p.tagline)}</p>
  <p class="muted">${(p.facts || []).map(esc).join(" · ")}</p>
  ${p.install ? `<code>$ ${esc(p.install)}</code>` : ""}
  <span class="project-card__go">More on ${esc(p.name)} →</span>
</a>`;
  // the open slot: what qscommons wants to hold next
  const open = `<a class="project-card project-card--open" href="{{root}}projects/#join">
  <p class="t-label muted">Open</p>
  <h3>Your project next</h3>
  <p>A tool, a learning site, a hardware guide or a piece of research. Propose it, and it joins once it meets the standard.</p>
  <span class="project-card__go">How a project joins →</span>
</a>`;
  return `<div class="project-list">${projects.map(card).join("\n")}\n${open}</div>`;
}

// ---- the maintainers, from src/data/maintainers.json (one entry per person) ----
const { maintainers } = JSON.parse(read("src/data/maintainers.json"));
const NUMBERS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const count = (n) => NUMBERS[n] || String(n);
// "kaiwave, who started ...": each person linked to their GitHub, an email only when one is given
function maintainersList() {
  const one = (m) => {
    const name = `<a class="link" href="https://github.com/${esc(m.github)}">${esc(m.nickname)}</a>`;
    const mail = m.email ? ` (<a class="link" href="mailto:${esc(m.email)}">${esc(m.email)}</a>)` : "";
    return `${name}${mail}${m.role ? `, ${esc(m.role)}` : ""}`;
  };
  const items = maintainers.map(one);
  return items.length > 1 ? `${items.slice(0, -1).join("; ")}; and ${items.at(-1)}` : items[0] || "";
}
const n = maintainers.length;

const generated = {
  ...versionTokens,
  "projects-menu": projectsMenu(),
  "projects-footer": projectsFooter(),
  "project-sections": projectSections(),
  "project-cards": projectCards(),
  // {{example:<id>}}: that project's example as a code window
  ...Object.fromEntries(projects.map((p) => [`example:${p.id}`, codeFragment({ ...p.example, hint: p.example.note })])),
  "featured-start-label": esc(featured.start ? featured.start.label : featured.name),
  "featured-start-href": featured.start ? featured.start.href : `{{root}}projects/#${featured.id}`,
  "featured-release": esc(featured.release ? `${featured.release.title} is out` : featured.name),
  "featured-release-href": featured.release ? featured.release.href : `{{root}}projects/#${featured.id}`,
  // "One maintainer today: kaiwave, who started ..."
  "maintainers-line": `${count(n)} maintainer${n === 1 ? "" : "s"} today: ${maintainersList()}.`,
  // "One maintainer runs it today."
  "maintainers-sentence": `${count(n)} maintainer${n === 1 ? " runs" : "s run"} it today.`,
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync("assets", path.join(OUT, "assets"), { recursive: true });
for (const f of readdirSync("public")) cpSync(path.join("public", f), path.join(OUT, f), { recursive: true });

// ---- the articles, from src/articles/<slug>.mdx: each exports `meta` ({ title, description, date, author })
// and becomes /articles/<slug>/; /articles/ lists them, newest first ----
async function articles() {
  const dir = "src/articles";
  const list = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".mdx"))) {
    const mod = await evaluate(read(path.join(dir, file)), { ...runtime, baseUrl: pathToFileURL(path.resolve(dir, file)).href });
    const m = mod.meta || {};
    for (const k of ["title", "description", "date", "author"]) if (!m[k]) throw new Error(`${file}: meta needs ${k}`);
    // site links written from the root (/projects/) follow {{root}}, like every page's
    const html = renderToString(h(mod.default, {})).replace(/(href|src)="\/(?!\/)/g, '$1="{{root}}');
    list.push({ ...m, slug: file.replace(/\.mdx$/, ""), html });
  }
  return list.sort((a, b) => b.date.localeCompare(a.date));
}
const longDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function articlePage(a) {
  return [{ title: `${esc(a.title)} · qscommons`, description: esc(a.description), path: `/articles/${a.slug}/`, current: "articles" },
    `  <article class="section section--fit article" aria-labelledby="article-h">
    <div class="wrap"><div class="article__col">
      <p class="t-label muted article__crumb"><a href="{{root}}articles/">Articles</a> · <time datetime="${esc(a.date)}">${longDate(a.date)}</time></p>
      <h1 id="article-h">${esc(a.title)}</h1>
      <p class="article__by">By ${esc(a.author)}</p>
      <div class="prose">
${a.html}
      </div>
    </div></div>
  </article>`];
}

function articlesIndex(list) {
  const items = list.map((a) => `<a class="article-item" href="{{root}}articles/${a.slug}/">
  <time class="t-label muted" datetime="${esc(a.date)}">${longDate(a.date)}</time>
  <h2>${esc(a.title)}</h2>
  <p>${esc(a.description)}</p>
  <span class="muted">By ${esc(a.author)}</span>
</a>`).join("\n");
  return [{ title: "Articles · qscommons", description: "Writing from the people behind qscommons: why it exists, what is being built, and what is being learned along the way.", path: "/articles/", current: "articles" },
    `  <section class="section section--fit" aria-labelledby="articles-h">
    <div class="wrap"><div class="article__col">
      <h1 id="articles-h">Articles</h1>
      <p class="t-lead muted">Writing from the people behind qscommons.</p>
      <div class="article-list">
${items}
      </div>
    </div></div>
  </section>`];
}

const pages = readdirSync("src/pages").filter((f) => f.endsWith(".html")).map((file) => [file, ...frontMatter(read(`src/pages/${file}`), file)]);
const posts = await articles();
pages.push(["articles", ...articlesIndex(posts)], ...posts.map((a) => [`${a.slug}.mdx`, ...articlePage(a)]));

for (const [file, meta, body] of pages) {
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
  const left = html.match(/\{\{[a-z:-]+\}\}/);
  if (left) throw new Error(`${file}: ${left[0]} was never filled`);
  const dir = path.join(OUT, meta.path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), html);
}
console.log("built out/");
