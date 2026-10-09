# Pnara Cafe frontend

The point-of-sale frontend uses Next.js App Router. Its package manager is npm and its dependency lockfile is `package-lock.json`.

## Local development

Run the ASP.NET API at `http://localhost:5088`, then run:

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000/pos`. By default, the Next.js development server proxies `/api`, `/hubs`, and `/health` to `http://localhost:5088`. Set `API_PROXY_TARGET` in `.env.local` when the local API uses another address. `NEXT_PUBLIC_API_URL` is optional; leave it blank to use the same origin.

## Static production export

The cafe installer builds the application with `CAFE_STATIC_EXPORT=1` and a blank `NEXT_PUBLIC_API_URL`. Next.js writes an `out` folder with trailing-slash route directories; the ASP.NET API serves those files from the same loopback-only origin. The export uses client-side API requests and SignalR and does not require Node.js on the cafe computer.

Validate with `npm run lint`, `npm run typecheck`, and `npm run build` through `scripts/build-installer.ps1`. The build script also checks the exported POS, login, KDS, and admin route files and bundled styles and fonts.
