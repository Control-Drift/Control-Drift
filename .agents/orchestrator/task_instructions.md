# Implementation Instructions: Asynchronous Paginated Refactoring & SSO/RBAC Integration

Please implement the following refactoring tasks across the codebase.

## 1. Upgrades to `mock_database.js`
- **SSO/SAML Login**:
  - Add `/auth/sso` GET endpoint to handle mock SSO callbacks and redirect:
    - Accepts `role` query param ('admin' or 'reader'), `email` (defaulting to `${role}@sso.local`), and `redirect_uri`.
    - Generates a signed JWT with `{ email, role }` and redirects to `${redirect_uri}?token=${token}`.
  - Update `/auth/login` (POST):
    - Accepts a `role` field ('admin' or 'reader') or a `sso` flag.
    - If `sso` is true and email contains 'admin', role is 'admin'; else default to 'reader'.
    - If local credentials are submitted, respect the selected role.
    - Return `{ token, role }`.
- **RBAC Security Middleware**:
  - Secure both `/api/` and `/data/` endpoints using a unified token check.
  - If a request uses a write method (`POST`, `PUT`, `DELETE`), verify the JWT and check if `user.role === 'admin'`. If not, return `403 Forbidden` with a JSON error payload.
- **Data Key-Value Storage (/data/:key)**:
  - Add endpoints `GET /data/:key` and `PUT /data/:key` to store/fetch context data arrays/objects (e.g., `campaignSummaries`, `campaignEvidence`, `gaps` if requested, though gaps has its own CRUD).
- **Exercises GET Pagination, Filter, and Sort**:
  - Add query param support to `GET /api/exercises`:
    - `page` & `limit` (defaulting to 1 and 50).
    - `campaign` (case-insensitive filter).
    - `sort=date` & `order=desc|asc`.
  - Perform filtering and sorting in memory before paginating/slicing the array.
- **Gaps CRUD Endpoints**:
  - Support `GET /api/gaps` (list all gaps).
  - Support `POST /api/gaps` (create single gap, generating UUID if missing).
  - Support `PUT /api/gaps` (bulk update list of gaps).
  - Support `GET /api/gaps/:id`, `PUT /api/gaps/:id`, and `DELETE /api/gaps/:id` for individual gap CRUD.
- **Server-Side MITRE Coverage (Offline-Ready)**:
  - Add `GET /api/mitre-coverage`.
  - Implement `getParsedTaxonomy()`:
    - Attempt to read from `mitre_stix_cache.json`.
    - If cache is missing, attempt to download from GitHub.
    - If downloading fails (due to offline network restrictions), fall back to a built-in static list of core tactics and techniques (Initial Access, Execution, Persistence, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, Command and Control, Exfiltration, Impact).
    - Dynamically check if any exercises exist for TTPs not present in the taxonomy. If so, append those TTPs under a relevant tactic (e.g. "Execution") to ensure they are rendered.
  - Run the rollup coverage aggregation logic on the server using `db.exercises` and return the final tactics mapping.

## 2. Upgrades to `src/lib/db/adapters/RestApiAdapter.js`
- **SSO Login Support**:
  - Add `initiateSso()` that redirects window.location to `${this.endpoint}/auth/sso`.
  - Add `handleSsoCallback(token)` to decode and store the token and roles.
- **Persistent Token & Roles**:
  - In constructor, load `token` and `roles` from `localStorage` if they exist.
  - In `login()`, decode the returned token using `atob` to extract the `role` claim. Save both `token` and `roles` to `localStorage` and `this` variables.
  - In `logout()`, remove `token` and `roles` from `localStorage`.
- **Granular API Methods**:
  - Implement `fetchExercises(page, limit, campaign)` calling `/api/exercises`.
  - Implement `createExercise(exercise)` calling POST `/api/exercises`.
  - Implement `fetchGaps()` calling `/api/gaps`.
  - Implement `createGap(gap)` and `updateGap(id, gap)`.
  - Implement `fetchMitreCoverage()` calling `/api/mitre-coverage`.
- **JWT Header Injection**:
  - Ensure `getHeaders()` retrieves the active token and adds `Authorization: Bearer <token>`.

## 3. Upgrades to `src/AppContext.jsx`
- **Paginated State**:
  - Expose `exercises` (current page items), `totalExercises`, `exercisesPage`, and `exercisesLimit` from context.
  - Avoid loading the full exercises array at startup.
- **Remove Monolithic Bulk Auto-Saves**:
  - Delete the `useEffect` hooks that call `safeSave` on the entire `exercises` or `gaps` arrays.
- **Asynchronous Data Methods**:
  - Add `fetchExercisesPage(page, limit)` and `loadMitreCoverage()`.
  - Modify `completeExercise` to asynchronously call `dbAdapter.createExercise()`, and then reload the current page and trigger `loadMitreCoverage()`.
  - Modify gap-related actions (`createGap`, `updateGap`, `updateExerciseValidation`) to make asynchronous API requests to the gaps endpoints and reload gap list.
- **Role Decoding**:
  - Read `dbAdapter.roles` upon initialization and save user roles in state.
  - Export `isReadOnly = userRole === 'reader'` to block editing features for reader tokens.

## 4. UI View Components Refactoring
- **Dashboard (`Dashboard.jsx`)**:
  - Remove all client-side array reduces/iterations over the monolithic exercises array.
  - Fetch dashboard metrics asynchronously from `/api/metrics` and store in local component state.
  - Fetch the 4 most recent exercises from `/api/exercises?page=1&limit=4`.
- **Reports (`Reports.jsx`)**:
  - Fetch the unique campaigns list from `/api/campaigns` (or computed from `/api/exercises` if needed, but a campaigns endpoint is much better).
  - Add page navigation buttons to the exercises table.
  - Fetch campaign exercises paginated (e.g. `/api/exercises?campaign=CAMPAIGN_NAME&page=1&limit=10`).
- **MitreHeatmap (`MitreHeatmap.jsx`)**:
  - Load the pre-aggregated `mitreData` from the AppContext (which fetches `/api/mitre-coverage`).
  - Do not fetch the raw STIX file or run in-browser calculations.
- **AuthOverlay (`AuthOverlay.jsx`)**:
  - Add "Sign in with SAML/SSO" mockup button.
  - Add a Role Selection dropdown (Admin vs. Reader) to select the login role.
- **Read-Only / Reader Role Protection**:
  - If `isReadOnly` is true:
    - Disable dragging on Kanban board cards (`draggable={false}`).
    - Disable file upload dropzones in GapTracker and GapDetails.
    - Hide or disable "Run Simulation" / Campaign Launcher options.
    - Lock edit and delete inputs in form dialogs.

## 5. E2E Test Suite Upgrades (`run_e2e.js` and `TestRunner.jsx`)
- **Port Conflict Fix**:
  - In `run_e2e.js`, change the callback server port from `3001` to `3002` (or `3003`) to avoid conflicting with the mock database server.
  - Spawn the `mock_database.js` backend server in the background inside `run_e2e.js` before starting the browser, and terminate it on exit.
- **Test cases**:
  - Add new tests in `TestRunner.jsx` to verify SSO login, RBAC write failures, and paginated data fetching.
