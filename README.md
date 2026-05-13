# oneview-status

A tiny tool for checking whether a list of HPE OneView appliances is
reachable and reporting their `currentVersion`. Two pieces:

- **`oneview-status.html`** — a static page that takes a list of
  appliance URLs (one per line), renders a status table, and remembers
  the URL list in `localStorage`.
- **`proxy.js`** — a small Node HTTP server, stdlib only, that the page
  calls instead of hitting appliances directly. It exists to skip TLS
  verification, since OneView appliances usually have self-signed certs
  that browsers reject and that the `fetch` API has no way to bypass.

## Why a proxy

Browsers deliberately do not expose any way for `fetch` to ignore
certificate errors — TLS validation happens below the JavaScript layer.
The proxy fetches `/rest/version` from Node's `https` module with
`rejectUnauthorized: false`, then returns the result to the page over
plain HTTP on localhost. That's the only piece of the flow that needs
to bypass TLS verification, and it stays on your machine.

## Requirements

- Node.js 16+ (uses only `http`, `https`, `url` from the stdlib)
- A modern browser

## Run it

```sh
git clone https://github.com/geeteq/oneview-status.git
cd oneview-status
node proxy.js
```

The proxy listens on `http://127.0.0.1:8765` by default. Override the
port with `PORT=9000 node proxy.js` if 8765 is taken.

Then open `oneview-status.html` in a browser — either double-click it
or `open oneview-status.html` on macOS / `xdg-open oneview-status.html`
on Linux. The page calls `http://127.0.0.1:8765` directly, so it works
from the local filesystem; no web server needed.

Paste one appliance URL per line into the textarea (e.g.
`https://oneview1.example.com`) and click **Check status**. Each row
shows:

| Column           | What it shows                                            |
| ---------------- | -------------------------------------------------------- |
| Appliance        | The URL you entered.                                     |
| Status           | `200 OK` / `HTTP <code>, no version` / `unreachable`.    |
| OneView version  | `currentVersion N (min M)` when the appliance returns it.|

The URL list persists across reloads via `localStorage`.

## Proxy API

The proxy exposes one endpoint:

```
GET /version?target=<https://appliance>
```

- `target` must be an `https://` URL. The proxy appends `/rest/version`
  to it; the path is **hardcoded** so the proxy can't be repurposed as
  a general open relay.
- The response is always JSON:
  ```json
  { "status": 200, "body": { "currentVersion": "..." } }
  ```
  …or, on failure:
  ```json
  { "error": "<message>" }
  ```

CORS is open (`Access-Control-Allow-Origin: *`), so the page can be
served from anywhere, including `file://`.

## Security notes

- The proxy binds to `127.0.0.1` only — nothing on the LAN can reach
  it. Don't run it on a shared/multi-user host: anyone with local shell
  access could call it.
- TLS verification is disabled **for the proxy's outbound calls only**.
  Your browser still validates the proxy's `http://127.0.0.1` (which
  isn't TLS at all) the normal way.
- No credentials are involved. `/rest/version` is unauthenticated on
  OneView appliances.

## Stopping

`Ctrl-C` the `node proxy.js` process. The page will show every row as
`proxy unreachable` until you start it again.
