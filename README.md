# AI Planet bootstrap

Tasks 1–2: a minimal React/Vite/TypeScript client and Express/TypeScript server, managed with npm workspaces, with a reusable Mongoose connection to MongoDB Atlas. No expense-management features are implemented.

Use Node.js 22.20+ and npm. MongoDB Atlas is required for server startup. If you do not already have `server/.env`, copy `server/.env.example` to it. Provide your real `MONGODB_URI` and set `MONGODB_DB_NAME` to `ai_planet_expense`. Keep the database name separate from the URI. Never commit `server/.env`.

From the repository root:

```sh
npm install
npm run dev
```

Client: http://localhost:5173. Server: http://localhost:3000.
`GET /health` returns HTTP 200 with `{"status":"ok"}` for HTTP liveness, independently of MongoDB. `GET /ready` inspects the current Mongoose connection state: HTTP 200 with `{"status":"ready","database":"connected"}` when connected, otherwise HTTP 503 with `{"status":"not_ready","database":"disconnected"}`. It does not open a connection per request. Stop development with Ctrl+C.
On Windows PowerShell where execution policy blocks `npm.ps1`, use `npm.cmd` in place of `npm`.

The server validates its environment, connects to MongoDB, then starts listening. Initial connection failure exits unsuccessfully without exposing connection details. SIGINT/SIGTERM stop HTTP requests before disconnecting MongoDB. `NODE_ENV`, `PORT`, and `CLIENT_ORIGIN` retain their bootstrap defaults. Server scripts load that file through Node's built-in environment-file support. Development CORS allows the configured exact client origin; production CORS is not configured.

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
