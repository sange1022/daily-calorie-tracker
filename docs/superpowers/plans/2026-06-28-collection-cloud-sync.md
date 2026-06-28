# Collection Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every sync space converge on the union of records from all devices while propagating edits and deletions safely.

**Architecture:** Add pure metadata-aware normalization and merge functions to `tracker-core.js`. Keep the current UI state shape, stamp local mutations in `index.html`, and replace blind Firestore writes with transactional read-merge-write operations.

**Tech Stack:** Static HTML, JavaScript ES modules, Node test runner, Firebase Authentication, Cloud Firestore transactions.

---

### Task 1: Merge Unique Records And Resolve Edits

**Files:**
- Modify: `tracker-core.js`
- Test: `tests/tracker-core.test.mjs`

- [ ] **Step 1: Write failing tests for collection union and last-write-wins edits**

Add tests importing `mergeTrackerStates` and assert that different IDs from both sides survive, duplicate-looking rows with different IDs stay separate, and the newer `updatedAt` wins for the same ID.

```js
const merged = mergeTrackerStates(local, remote, defaults);
assert.deepEqual(merged.days["2026-06-28"].map((row) => row.id).sort(), ["local-row", "remote-row"]);
assert.equal(merged.library.find((food) => food.id === "egg").name, "水煮蛋");
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/tracker-core.test.mjs`

Expected: FAIL because `mergeTrackerStates` is not exported.

- [ ] **Step 3: Implement metadata normalization and entity merging**

Add pure helpers that normalize `updatedAt` and `updatedBy`, choose the newest version by timestamp and device ID, merge library items by ID, and merge each date's rows by ID.

```js
export function mergeTrackerStates(left, right, defaults = {}) {
  const local = normalizeTrackerState(left, defaults);
  const remote = normalizeTrackerState(right, defaults);
  return mergeNormalizedStates(local, remote, defaults);
}
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `node --test tests/tracker-core.test.mjs`

Expected: all tests pass.

### Task 2: Propagate Deletions And Merge Settings

**Files:**
- Modify: `tracker-core.js`
- Test: `tests/tracker-core.test.mjs`

- [ ] **Step 1: Write failing tests for tombstones and settings conflicts**

Assert that a newer tombstone removes an entity, an older tombstone does not remove a newer edit, settings use their metadata timestamp, and merging twice is idempotent.

```js
assert.equal(merged.days["2026-06-28"].some((row) => row.id === "deleted-row"), false);
assert.equal(merged.settings.weight, 92);
assert.deepEqual(mergeTrackerStates(merged, remote, defaults), merged);
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/tracker-core.test.mjs`

Expected: FAIL because tombstones and metadata-aware settings are not merged yet.

- [ ] **Step 3: Implement tombstone and versioned settings merging**

Normalize a `syncMeta` object containing `foodTombstones`, `rowTombstones`, `settings`, and `labels`. Compare each live entity with its tombstone and remove only when the tombstone is the newest event.

```js
syncMeta: {
  foodTombstones: {},
  rowTombstones: {},
  settings: { updatedAt: 0, updatedBy: "" },
  labels: { updatedAt: 0, updatedBy: "" },
}
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `node --test tests/tracker-core.test.mjs`

Expected: all merge, deletion, legacy migration, and existing nutrition tests pass.

### Task 3: Stamp Local Changes And Use Firestore Transactions

**Files:**
- Modify: `index.html`
- Test: `tests/tracker-core.test.mjs`

- [ ] **Step 1: Add local metadata stamping at every mutation point**

Persist a device ID under `${storeKey}-device-id`. Stamp newly added and edited foods and rows with `updatedAt` and `updatedBy`; create tombstones before deleting. Stamp settings and labels when changed.

```js
function syncStamp() {
  return { updatedAt: Date.now(), updatedBy: deviceId };
}
```

- [ ] **Step 2: Replace cloud overwrite with transactional merging**

Import `runTransaction` and `mergeTrackerStates`. In `pushStateToCloud`, read the latest cloud document inside a transaction, merge it with local state, write the merged state, then persist the same merged result locally.

```js
const merged = await runTransaction(db, async (transaction) => {
  const snapshot = await transaction.get(syncRef);
  const remote = snapshot.exists() ? normalizeImportedState(snapshot.data().data) : null;
  const next = remote ? mergeTrackerStates(state, remote, defaults) : state;
  transaction.set(syncRef, { data: structuredClone(next), updatedAt: serverTimestamp() });
  return next;
});
```

- [ ] **Step 3: Merge initial reads and snapshots instead of assigning remote state**

Use the same pure merge function during initial connection and snapshot handling. Save the merged result locally, render it, and schedule a transaction only when local data contributes something absent from the snapshot.

- [ ] **Step 4: Run automated tests and static checks**

Run: `node --test tests/tracker-core.test.mjs`

Run: `git diff --check`

Expected: tests pass and no whitespace errors are reported.

### Task 4: Browser Verification And Deployment

**Files:**
- Verify: `index.html`
- Verify: `tracker-core.js`

- [ ] **Step 1: Start a local server and verify the existing tracker UI**

Run: `python3 -m http.server 51519`

Open `http://localhost:51519/` and verify daily totals, food addition, portion editing, deletion, date navigation, and dark mode.

- [ ] **Step 2: Verify two-device convergence**

Use two isolated browser contexts with the same sync code. Add one unique daily row in each context, confirm both rows appear in both contexts, delete one row, and confirm the deletion propagates without restoring the row.

- [ ] **Step 3: Run final verification**

Run: `node --test tests/tracker-core.test.mjs`

Run: `git status --short && git diff --check`

Expected: all tests pass, only intended files are modified, and diff checks are clean.

- [ ] **Step 4: Commit and deploy**

```bash
git add tracker-core.js tests/tracker-core.test.mjs index.html docs/superpowers/plans/2026-06-28-collection-cloud-sync.md
git commit -m "Add collection-based cloud sync"
git push origin main
```

Confirm the GitHub Pages deployment succeeds and verify the production URL loads the updated app.
