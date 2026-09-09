# AI Planet bootstrap

Tasks 1–4: a minimal React/Vite/TypeScript client and Express/TypeScript server, managed with npm workspaces, with a reusable Mongoose connection to MongoDB Atlas. Five domain models and a deterministic assignment-pack seed are available. Policy, settlement and workflow behavior are not implemented.

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

## Assignment-pack seed

The persisted areas are Employee, TravelRequest, Evidence, Expense and Claim. Their canonical source contract is [docs/canonical-assignment-data.md](docs/canonical-assignment-data.md). The original pack and approved prototype remain external, read-only references.

Set `ASSIGNMENT_PACK_PATH` only when running the seed or its source-backed tests. For example, from the repository root in PowerShell:

```powershell
$env:ASSIGNMENT_PACK_PATH = '/path/to/assignment-pack'
npm run seed
npm run test:seed
Remove-Item Env:ASSIGNMENT_PACK_PATH
```

The seed uses the existing `server/.env` Atlas configuration and disconnects afterward. Do not overwrite an existing local environment file. Normal Express startup does not require the source pack or `ASSIGNMENT_PACK_PATH` after seeding. The HTTP endpoints remain only `/health` and `/ready`.

Expected dataset counts: **9 Employees, 1 TravelRequest, 17 Evidence (15 emails + 2 images), 14 Expenses, 1 draft Claim**. Every run verifies these counts, references and raw source-cost totals. Raw employee-paid gross is not reimbursement; no settlement or policy outcomes are stored.

The importer validates the exact 21-file inventory and pinned SHA-256 hashes before connecting. Even whitespace changes fail the pinned source check; review source changes against the canonical contract before updating hashes. MIME parsing extracts headers, body and attachment metadata; CSV parsing supplies all nine employees. Receipt metadata is explicitly pre-extracted from the canonical document, not OCR. The email attachment bodies are external-file pointers, not image bytes. Images retain relative asset references, hashes and metadata; no image-serving API or binary storage is introduced.

Seed keys are internal import identities, never Travel Request IDs. Upserts are scoped to `assignment-pack-v1`, reuse IDs and never delete records. Employee code is the employee identity. Rerunning deliberately restores seeded source fields and the seeded draft; unrelated records are preserved and conflicting identities fail. Run one seed at a time. Writes are ordered, not transactional; an interrupted run can be repaired by rerunning the same validated pack.

Money uses integer paise. Business dates stay YYYY-MM-DD strings; known timestamps include their original +05:30 offset before Date conversion. Evidence `receivedAt` represents the source Date header, not an independently verified delivery time. Advance credit date is known; `advanceNotifiedAt` is the Finance email timestamp, not an invented bank transaction time. Mixed hotel tax has no separate event date and is left null. The real Travel Request ID, HOD approval, settlement submission, tax allocation and dinner evidence gaps remain unresolved. Historical RM approval belongs only to TravelRequest; the Claim is DRAFT with no approvals, Finance completion or settlement amounts.

`npm run test:seed` uses Node's built-in test runner, needs the pack path, and performs no database writes. Its tamper check uses a disposable OS-temporary copy and leaves the original untouched.
