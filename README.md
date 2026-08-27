# Wordsy

A self-hosted daily word game. Guess the five-letter word in six tries.

This is a vibe-coded proof of concept — written quickly, for fun, to see
whether the thing could be built in an afternoon. It works and it is pleasant
to play, but it has no tests, no build pipeline, and no roadmap. Treat it as a
starting point to fork rather than a maintained product.

Everything runs in the browser — there is no backend, no account, and no
telemetry. Your statistics and in-progress game live in your browser's
`localStorage`, and the daily puzzle is derived from your device's local date,
so the server never needs to know anything about you.

> **Not affiliated with anything.** This project has no connection to Wordle
> or The New York Times, nor to *Wordsy*, the card game by Formal Ferret
> Games. The name was a throwaway pun that stuck.

## Run it with Docker

The image is a single nginx container serving static files. It works on
x86-64, and on ARM boards like a Raspberry Pi or an ARM-based NAS.

```bash
git clone https://github.com/jeffmueller/wordsy.git
cd wordsy
docker compose up -d
```

Then open `http://<host>:8080`.

To use a different port, edit the left-hand number in `docker-compose.yml`:

```yaml
ports:
  - "3000:80"     # http://<host>:3000
```

Without compose:

```bash
docker build -t wordsy .
docker run -d --name wordsy -p 8080:80 --restart unless-stopped wordsy
```

### Updating

```bash
git pull
docker compose up -d --build
```

Assets are cached for an hour rather than indefinitely, so browsers pick up a
new build within the hour without a hard refresh.

### HTTPS

The container speaks plain HTTP on port 80 and does not terminate TLS. Put it
behind whatever reverse proxy you already run — Caddy, Traefik, Nginx Proxy
Manager, or your NAS's built-in front end — and let that handle certificates.

### Building for another machine's architecture

To build on an x86-64 laptop for a Raspberry Pi, or to publish one image that
covers both:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  -t ghcr.io/jeffmueller/wordsy:latest --push .
```

`linux/arm64` covers a 64-bit Raspberry Pi OS on a Pi 3/4/5; `linux/arm/v7`
covers the 32-bit builds and older boards.

## Run it without Docker

It is a static site, so any web server will do:

```bash
python3 -m http.server 8080
```

## Known limitations

Worth knowing before you file an issue:

- **The answer is in the page.** With no backend, the word list and the
  day's answer are both reachable from the browser console. Anyone determined
  to cheat can. This is inherent to a client-only build, not an oversight.
- **Dark theme only.** The palette is hardcoded; there is no light mode and no
  `prefers-color-scheme` support.
- **Animations always run.** `prefers-reduced-motion` is not yet respected.
- **No tests.** See above re: vibe-coded.

## Word lists

`js/words.js` holds two lists: `ANSWERS` (words that can be the daily puzzle)
and `VALID_GUESSES` (words accepted as a guess but never used as an answer).

Both are maintained by scripts rather than by hand, so the editing rules stay
reviewable:

- `scripts/filter-plurals.js` — drops plural answers, since no puzzle should
  resolve to a plural. Needs a system dictionary; set `DICT_FILE` if yours
  lives somewhere unusual.
- `scripts/filter-offensive.js` — removes slurs and crude vulgarities. The
  blocklist at the top of that file *is* the content policy: it targets terms
  whose primary use is as a slur, and deliberately keeps ordinary vocabulary
  that merely reads as unpleasant ("death", "slave", "crack"). Disagree with a
  call? Edit the list and re-run the script.

## Development

- `index.html`, `css/`, `js/` — the entire game; no build step.
- `js/game.js` — game rules, scoring, persistence, daily answer selection.
- `js/ui.js` — rendering, input, animation, modals.
- `js/words.js` — generated; edit the scripts above rather than this file.
- `docker/nginx.conf` — the container's server config.
- `deployment/` — the author's own scripts for deploying to a specific
  Raspberry Pi. Not needed to run Wordsy yourself. Copy
  `deployment/.env.deploy.example` to `.env.deploy` if you want to adapt them.

## License

MIT — see [LICENSE](LICENSE).
