# AI Planet bootstrap

Task 1 only: a minimal React/Vite/TypeScript client and Express/TypeScript server, managed with npm workspaces. No expense-management features are implemented.

Use Node.js 22.20+ and npm. From the repository root:

```sh
npm install
npm run dev
```

Client: http://localhost:5173. Server: http://localhost:3000.
`GET /health` returns `{"status":"ok"}`. Stop development with Ctrl+C.
On Windows PowerShell where execution policy blocks `npm.ps1`, use `npm.cmd` in place of `npm`.

The server works with validated defaults. Optionally copy `server/.env.example` to `server/.env` to override `NODE_ENV`, `PORT`, or `CLIENT_ORIGIN`. Server scripts load that file through Node's built-in environment-file support. Development CORS allows the configured exact client origin; production CORS is not configured.

| Root command           | Purpose                                    |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | Start both workspaces                      |
| `npm run dev:client`   | Start Vite                                 |
| `npm run dev:server`   | Start Express with tsx watch               |
| `npm run build`        | Type-check/build client and compile server |
| `npm run typecheck`    | Check both workspaces                      |
| `npm run lint`         | ESLint across the repository               |
| `npm run format`       | Format repository source/configuration     |
| `npm run format:check` | Verify formatting                          |

After building, run `npm run start --workspace server` for the compiled server. `npm run preview --workspace client` previews the client build locally.

Reference-only artifacts remain outside this repository:

- `C:\Users\Akshay\Downloads\expense_reimbursement_takehome\pack`: original assignment pack; untouched and not ingested.
- `C:\Users\Akshay\Downloads\expense_reimbursement_takehome\expense-management-prototype.html`: approved visual and interaction baseline for later React implementation; untouched and not converted.
