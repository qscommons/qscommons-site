# qscommons-site

The website for [qscommons](https://github.com/qscommons): what the organisation is for, the projects it maintains and how to contribute.

Plain static HTML, built by a small script. The design system, motion and checks come from the taste-skill kit in `assets/` (copied unchanged; never edit those files). The Motion library's browser build is in `assets/vendor/motion.js`.

## Layout

```text
src/pages/        one HTML file per page; a <!--- ---> header gives its title, description and path
src/partials/     head, nav and footer, shared by every page
src/data/         projects.json: every qscommons project
public/           site.css (page CSS: only what sits inside a visual), site.js, favicon.svg
assets/           the taste-skill kit (system, UI fragments, effects, moments) and icons
build.mjs         composes src/ into out/
```

## Adding a project

Add an entry to [src/data/projects.json](src/data/projects.json). The build turns it into:

- a card on `/projects/` (name, status, tagline, links, and its example as a code window),
- its link groups in the nav's Projects menu (the first two groups across all projects),
- its source link in the footer.

`featured: true` marks the project the nav's release card shows. The home page's hero and app window
show qsengine by hand; when another project leads, rewrite those two sections in `src/pages/index.html`.

## Build and preview

```bash
npm install
npm run build          # writes out/
npm run serve          # builds, then serves out/ on http://localhost:4174
```

Pushing to main publishes `out/` to GitHub Pages through [the workflow](.github/workflows/site.yml).
