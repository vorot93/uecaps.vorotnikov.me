# NSG UE-Capability Viewer

A fully static, **browser-only** viewer for NSG UE capability messages. Paste raw NSG text into the textarea, click Parse, and the app decodes the capability information entirely in-browser — no backend, no server, no network requests at runtime. The parsed result is encoded into the URL fragment (`#…`) so you can share a direct link to any decoded view.

## What it does

- Accepts NSG `UECapabilityInformation` / RAT-container text pasted directly into the browser.
- Parses the input in-browser using the bundled parser (no upload, no server call).
- Renders LTE bands, NR bands, LTE-CA combos, EN-DC combos, NR-CA combos, NR-DC combos, and RAT capabilities in a tabbed multi-view.
- Encodes the input into a DEFLATE-compressed, base32-encoded URL fragment — shareable links that contain all the data client-side.
- On page load, reads the fragment and restores the previous view automatically.

All dynamic rendering is client-side JavaScript. The static build output (`dist/`) is plain HTML + JS — no SSR server is required or used.

## Build

```sh
pnpm install
pnpm build
```

Output is written to `dist/`. Open `dist/index.html` locally or serve the directory with any static file server.

## Deploy to GitHub Pages

The repository includes `.github/workflows/deploy.yml` which:

1. Triggers on push to `main` or `master` (and via `workflow_dispatch`).
2. Installs dependencies with `pnpm install --frozen-lockfile`.
3. Runs `pnpm build` to produce the static `dist/` output.
4. Uploads `dist/` as a GitHub Pages artifact and deploys it.

**The actual deployment requires the repository owner to:**

1. Push this repository to a GitHub remote.
2. In the repository settings, go to **Pages** → **Source** and select **GitHub Actions**.
3. Point the `uecaps.vorotnikov.me` DNS to GitHub Pages (add a `CNAME` record pointing to `<username>.github.io`, or follow the GitHub Pages custom domain instructions).

The `public/CNAME` file (`uecaps.vorotnikov.me`) is copied into `dist/CNAME` by the build, so GitHub Pages will automatically associate the custom domain once DNS is configured.

These deployment steps (creating the GitHub remote, enabling Pages, configuring DNS) are performed by the repository owner and are outside the scope of this workflow file.

## Attribution

The multi-view rendering components are forked from [HandyMenny/uecapabilityparser-web](https://github.com/HandyMenny/uecapabilityparser-web) (MIT). The underlying parser logic is adapted from [HandyMenny/uecapabilityparser](https://github.com/HandyMenny/uecapabilityparser) (MIT). See `src/components/NOTICE.md` for details.

## Tech stack

- [Qwik](https://qwik.dev/) + Qwik City (static adapter — no server runtime)
- [Tailwind CSS](https://tailwindcss.com/)
- [@qwik-ui/headless](https://github.com/qwikifiers/qwik-ui)
- [fflate](https://github.com/101arrowz/fflate) (DEFLATE compression for URL fragments)
- [Vitest](https://vitest.dev/) (unit tests)
- pnpm

## License

MIT
