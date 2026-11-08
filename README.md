# qscommons-site

The website for [qscommons](https://github.com/qscommons): what the organisation is for, and the projects it maintains.

Four pages (home, About, Projects, Get involved), built with Next.js as a static export. Lists such as the projects, principles and ways to help live in [app/content.js](app/content.js); each page's text is in its `page.jsx` under [app/](app/). Styles are in [app/globals.css](app/globals.css).

```bash
npm install
npm run dev      # local preview
npm run build    # static site in out/
```

Pushing to main publishes the site to GitHub Pages through [the workflow](.github/workflows/site.yml).
