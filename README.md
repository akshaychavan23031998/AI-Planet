# AI Planet bootstrap

Tasks 1–9: a minimal React/Vite/TypeScript client and Express/TypeScript server, managed with npm workspaces, with a reusable Mongoose connection to MongoDB Atlas. Five domain models and a deterministic assignment-pack seed are available. A pure backend policy evaluator and claim workflow services are available. Versioned REST APIs expose these services under `/api/v1`.

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

The seed uses the existing `server/.env` Atlas configuration and disconnects afterward. Do not overwrite an existing local environment file. Normal Express startup does not require the source pack or `ASSIGNMENT_PACK_PATH` after seeding.

Expected dataset counts: **9 Employees, 1 TravelRequest, 17 Evidence (15 emails + 2 images), 14 Expenses, 1 draft Claim**. Every run verifies these counts, references and raw source-cost totals. Raw employee-paid gross is not reimbursement; no settlement or policy outcomes are stored.

The importer validates the exact 21-file inventory and pinned SHA-256 hashes before connecting. Even whitespace changes fail the pinned source check; review source changes against the canonical contract before updating hashes. MIME parsing extracts headers, body and attachment metadata; CSV parsing supplies all nine employees. Receipt metadata is explicitly pre-extracted from the canonical document, not OCR. The email attachment bodies are external-file pointers, not image bytes. Images retain relative asset references, hashes and metadata; no image-serving API or binary storage is introduced.

Seed keys are internal import identities, never Travel Request IDs. Upserts are scoped to `assignment-pack-v1`, reuse IDs and never delete records. Employee code is the employee identity. Rerunning deliberately restores seeded source fields and the seeded draft; unrelated records are preserved and conflicting identities fail. Run one seed at a time. Writes are ordered, not transactional; an interrupted run can be repaired by rerunning the same validated pack.

Money uses integer paise. Business dates stay YYYY-MM-DD strings; known timestamps include their original +05:30 offset before Date conversion. Evidence `receivedAt` represents the source Date header, not an independently verified delivery time. Advance credit date is known; `advanceNotifiedAt` is the Finance email timestamp, not an invented bank transaction time. Mixed hotel tax has no separate event date and is left null. The real Travel Request ID, HOD approval, settlement submission, tax allocation and dinner evidence gaps remain unresolved. Historical RM approval belongs only to TravelRequest; the Claim is DRAFT with no approvals, Finance completion or settlement amounts.

`npm run test:seed` uses Node's built-in test runner, needs the pack path, and performs no database writes. Its tamper check uses a disposable OS-temporary copy and leaves the original untouched.

## Pure policy evaluation

`server/src/domain/policy/evaluateClaim.ts` evaluates plain TypeScript inputs into expense amounts, findings, approval requirements, advance assessment and submission readiness. It does not load environment configuration, query MongoDB, mutate source data or persist results.

Run `npm run test:policy` or `npm test` from the root. These use the existing Node test runner and tsx, require neither MongoDB nor the assignment-pack path, and reuse Task 4's plain canonical fixture constants in tests. `npm run test:seed` remains a separate source-backed check.

Money remains safe integer paise. Eligible, disallowed, unresolved and explicitly excluded amounts remain separate; company-paid costs contribute only to the audit total. Unresolved included amounts or blockers make settlement provisional (`payableMinor` and `recoverableMinor` are `null`). An exact calculation is not payment authorization: business approvals and Finance verification are separate workflow steps.

Implementation conventions:

- Any amount even one paise above an approval band's upper threshold enters the next band. International travel requires the complete business hierarchy. Pre-travel routing uses the estimate; claim routing uses currently included eligible plus unresolved requested amounts, excluding known disallowances and company-paid costs. That claim basis is marked provisional until evaluation is final.
- Missing historical Travel Request ID/approvals and an undetermined or exceeded historical advance cap remain visible warnings, not employee instructions to fabricate records. Included missing proof, unresolved dinner requirements and unallocated hotel tax block readiness. An explicit dinner exclusion retains informational findings. Manual tax resolution must have a note and integer allocations totaling the source amount; no allocation is assumed or persisted.
- Meals share one cap per business date, including arrival/return days. Stable expense-key order assigns eligible/disallowed portions across that day's receipts; it does not change the daily total. Conflicting city tiers on one day require review. Other cities default to the policy's Tier 3/others band unless a tier is supplied. Every line still needs linked proof under §5.2, including meals at or below INR 500.
- Duplicate matching requires the same merchant, date, amount and bill reference (or an explicit duplicate-evidence relation), with matching component/line identity. It does not merge separate hotel nights/components. A repeated candidate contributes no second reimbursement and must be explicitly excluded to clear its blocker.
- Approval timestamps must predate the relevant event. When only a business date is known, a same-day approval cannot prove it preceded that event; comparison conservatively uses the start of that date in India. The advance cap rounds down to whole paise so it cannot exceed 60%.

The canonical initial evaluation is intentionally provisional. Dinner and mixed hotel tax remain unresolved; the future-review test supplies a hypothetical tax allocation and dinner exclusion only in memory. The canonical document, seeded source facts and database are unchanged.

## Claim workflow and demo identity

`server/src/domain/claims/` provides employee-code identity resolution, hierarchy authorization, pure transition planning, persisted policy-input assembly and conditional Mongo updates. `resolveDemoActor(employeeCode)` loads Employee data; public workflow services reload the actor and ignore caller-supplied roles or hierarchy. This is deliberate demo impersonation, not real authentication. The HTTP boundary resolves the demo identity before protected routes.

Services: `submitClaim`, `approveClaim`, `returnClaim`, `resubmitClaim`, `verifyClaimByFinance`, `schedulePayment` and `markClaimPaid`. Run `npm run test:workflow` for offline workflow/service tests. Root `npm test` runs policy, workflow, API, OpenAPI and client tests; source-dependent `test:seed` stays separate. Tests mock Mongo query boundaries and never change Atlas.

Persistent states are `DRAFT`, `MANAGER_REVIEW`, `HOD_REVIEW`, `DIVISION_REVIEW`, `MD_REVIEW`, `FINANCE_REVIEW`, `RETURNED`, `PAYMENT_SCHEDULED` and `PAID`. Submission is an audit event and enters the first required review immediately. Only the claimant submits/resubmits; the exact resolved ancestor approves/returns; Finance actions require a persisted Finance role. No claimant may review their own claim, including Finance review. A claimant occupying a business approval level skips that level and lower levels, escalating to the next higher resolved ancestor; missing/cyclic hierarchy or no higher approver fails safely.

Every resubmission restarts the full recalculated route in a new review cycle. This is the approved workflow design decision, not a claimed source-policy fact. Prior approvals/events remain for audit and cannot satisfy a new cycle. Active Finance metadata is cleared on resubmission. The canonical unresolved Claim still fails submission with `POLICY_NOT_READY`; no readiness rules were weakened or historical approvals invented. Claim-specific expense reviews now persist explicit exclusions and reviewed hotel-tax allocations without changing source Expenses.

Each write atomically matches Claim ID, claimant, expected status, review cycle and `workflowVersion`; it increments the version and appends decisions/history in the same update. A lost match returns `CLAIM_STATE_CONFLICT`. The version also protects Finance verification, which keeps `FINANCE_REVIEW`. Old draft documents lacking cycle/version read as zero without migration. Fresh seed defaults explicitly clear Finance metadata and the review fingerprint to null, so seed field updates cannot leave stale payment metadata. Submission records the resolved route and a SHA-256 fingerprint of the plain policy input; subsequent approvals/Finance actions reject changed inputs or routes, while a return can request correction. Policy results/settlement totals are not stored. Conditional updates protect the Claim document, not a transaction across related collections; future financial edits must coordinate with the Claim revision and active-review restrictions.

Finance verification does not mark paid. Payable settlements can be scheduled on a non-past 10th or 25th, using India business dates; marking paid requires an arrived schedule and a nonblank reference. Recoverable and zero settlements stay verified in `FINANCE_REVIEW`, with their derived direction exposed and reimbursement scheduling prohibited. No fake payment, extra terminal state, banking or payroll execution is introduced.

## Versioned REST API

`/api/v1` provides travel requests, evidence metadata, source expenses, claims, policy validation/readiness/settlement, approval queues and Finance actions. `/health` and `/ready` remain public operational endpoints. Public `GET /api/v1/demo/users` lists the seeded employees; every other feature route requires `X-Demo-Employee-Code` (for example, `NX-4471`). The server resolves roles and hierarchy from Employee records, never body/header role claims. This is demo identity, not authentication.

Claimants read their own records. Business approvers see their exact current assignments; Finance sees Finance-review, payment-scheduled and paid claims. Mutations delegate to the existing workflow services. Responses use `{ data }`, lists add `meta.count`, and errors use `{ error: { code, message, details? } }`. Dates and money retain the source conventions above. Evidence exposes relative asset references only; image delivery is not implemented.

Only the claimant can exclude, restore or resolve an expense in a DRAFT or RETURNED claim. Reviews and append-only review history live on Claim and share its conditional revision guard. Restore retains any explicit tax allocation; resolving an excluded expense does not silently include it. Manual allocation is limited to mixed hotel tax and validated by the existing policy function. Original Expense and Evidence records stay unchanged. The unreviewed canonical scenario remains blocked; no hypothetical review decision is seeded.

`npm run test:api` runs Supertest against the real Express middleware, routes and services with isolated Mongo query mocks. Supertest and its TypeScript definitions are development dependencies only. These tests, `npm run test:policy`, `npm run test:workflow` and root `npm test` require neither Atlas nor the source pack and do not write to Atlas. The app factory is importable without environment credentials; normal server startup still validates configuration and connects before listening.

## OpenAPI and Swagger UI

`GET /openapi.json` serves the static OpenAPI 3.0.3 contract. `GET /docs` opens Swagger UI for every `/api/v1` route plus `/health` and `/ready`. Both documentation endpoints are public. In Swagger **Authorize**, enter a demo employee code such as `NX-4471`; protected operations send it as `X-Demo-Employee-Code`. This is demo identity, not real authentication. Swagger retains the entry locally for convenience.

The contract is maintained in `server/src/openapi/` and does not query MongoDB or read the assignment pack. Swagger loads the same `/openapi.json` document. Normal server startup still requires the existing Atlas configuration. Examples of tax allocations, future scheduling and payment references are explicitly hypothetical; the canonical initial settlement remains provisional.

Run `npm run test:openapi` for offline specification/reference validation, route and schema coverage, canonical example checks and Swagger HTTP tests. Root `npm test` includes this suite. `swagger-ui-express` serves the UI; its TypeScript definitions, `openapi-types` and `@apidevtools/swagger-parser` are development-only typing and contract-validation tools.

## React foundation

The client now provides the approved Nortex shell, React Router, TanStack Query, a native-fetch API client, a small demo identity Context, Lucide icons and one Sonner toast root. CSS Modules use shared tokens based on the external approved prototype. The Dashboard now loads actor-visible trips, estimates, advances, evidence counts and claim-status links from the backend. Trip and Evidence pages expose source facts; Claim review now supports employee decisions and submission; Approvals and Finance pages provide assigned review queues and server-backed decisions.

Routes: `/`, `/trips/:travelRequestId`, `/trips/:travelRequestId/evidence`, `/claims/:claimId`, `/approvals`, `/finance` and a not-found fallback. Route identifiers are Mongo document IDs, not business Travel Request IDs. Trip/evidence/claim sidebar entries use the current route or recent API records; no seed ID is invented. Approval and Finance navigation is visible for demo exploration; backend authorization remains authoritative.

`client/.env.example` documents public `VITE_API_BASE_URL`, defaulting to `http://localhost:3000`. Set an HTTP(S) backend origin only, with no credentials, path, query or fragment. Local development works with the default without creating a client environment file. Vite configuration is public browser data; never put secrets in it.

The identity selector loads `/api/v1/demo/users`. It restores a returned employee code from `ai-planet-demo-employee-code`, otherwise selects `NX-4471`, otherwise the first returned user. An empty directory clears the stored code. Storage failures retain in-memory operation. Only the selected code is stored; demo identity is not authentication. Protected API callers pass the current code explicitly as `X-Demo-Employee-Code` and use `queryKeys.actor(code, resource, id?)`; public users have a separate key. Do not use previous-persona placeholder data. Route content remounts on identity changes to discard local view state.

Queries use 30-second freshness, one retry for transient failures, no 4xx retries and no window-focus refetch. Mutations do not retry. Fetch supports cancellation and distinguishes API errors from network failures. Read-only API modules cover travel requests, evidence list/detail, normalized expenses and minimal claim status. Protected queries also revalidate on mount and render API errors before cached results.

Run `npm run test:client` for offline Vitest/Testing Library checks. Root `npm test` includes client and existing server suites; `test:seed` remains separate. Client tests mock fetch and require neither the backend nor the assignment pack. The responsive shell uses a persistent desktop sidebar and a native modal navigation dialog below 900px; the identity row wraps on phones for readable labels.

## Employee trip and evidence experience

The Dashboard links to `/trips/:travelRequestId` and `/trips/:travelRequestId/evidence` using real backend records. Trip detail preserves unknown business IDs, recorded historical approvals and reconciliation notes. Source-normalized expenses retain both employee-paid and company-paid costs; displayed gross totals are not reimbursement calculations.

Evidence includes every returned classification, including duplicates, failed payments, claimant mismatch and noise. Local classification/kind filters and search operate on the loaded list. An accessible detail drawer fetches actor-scoped evidence, shows email text and receipt metadata, follows relationships and traces linked expenses. Receipt references are metadata-only because the backend does not serve image binaries; no local filesystem paths are fetched by the browser. The Claim workspace links these sources to backend policy evaluation and Claim-specific review decisions.

## Employee Claim review

`/claims/:claimId` displays source expenses, policy findings, settlement, submission readiness and persisted workflow history by review cycle. Policy results, approval routes and financial amounts remain backend authoritative; unknown payable/recoverable values stay pending rather than becoming zero.

Only the claimant can edit `DRAFT` and `RETURNED` claims. Exclude requires a reason; restore preserves audit history; mixed hotel tax resolution requires an explicit allocation and reason, with no assumed canonical split. React Hook Form, Zod and the Zod resolver validate form input, including exact decimal-to-paise conversion. These decisions never modify source Expense or Evidence records.

Submit and resubmit call the existing workflow endpoints without supplying a next status, approver or review cycle. `SUBMITTED` is a history event, not a persistent Claim status. Mutations do not retry or optimistically change financial values; affected actor-scoped Claim queries refetch before updated figures are shown. Conflicts and policy-not-ready responses refresh the current review state.

Frontend mutation tests use mocked HTTP responses. Do not use canonical Atlas claims for mutation smoke tests.

### Approval and Finance workspaces

`/approvals` shows the selected demo identity's assigned business reviews. Review policy findings, settlement and evidence before approving or returning with remarks. `/finance` uses the authorized Finance queue for verification, payment scheduling and completion references. Current-cycle verification is read from server metadata; it can leave a claim in `FINANCE_REVIEW`. Final recoverable and zero balances have no reimbursement payment action.

All mutations use the existing API and refresh actor-scoped queues and claim context. Payment dates and workflow authorization remain server-controlled. Payment completion records demo metadata only; there is no bank or payment-provider integration. Frontend action tests mock HTTP; live smoke checks only read the canonical scenario.
