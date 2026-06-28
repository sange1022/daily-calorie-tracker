# Preserve Meal Open State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent meal sections from closing when cloud synchronization or local edits rerender the meal list.

**Architecture:** Add a small pure helper in `tracker-core.js` to collect open meal IDs. `renderMeals()` captures those IDs before replacing markup and restores the native `open` attribute using stable `data-meal` values.

**Tech Stack:** JavaScript ES modules, native HTML `details`, Node test runner, Firebase/Firestore browser flow.

---

### Task 1: Capture Open Meals

**Files:**
- Modify: `tracker-core.js`
- Test: `tests/tracker-core.test.mjs`

- [ ] Add a failing test importing `collectOpenMealIds` and asserting that only entries with `open: true` are returned.
- [ ] Run `node --test tests/tracker-core.test.mjs` and confirm the missing export failure.
- [ ] Implement `collectOpenMealIds(details)` as a pure function returning a `Set` of valid `dataset.meal` values.
- [ ] Run the test suite and confirm all tests pass.

### Task 2: Restore Native Details State

**Files:**
- Modify: `index.html`

- [ ] Import `collectOpenMealIds` from `tracker-core.js`.
- [ ] Capture `details.meal-section` state at the start of `renderMeals()`.
- [ ] Add `data-meal` and a conditional `open` attribute to each generated meal section.
- [ ] Run `node --test tests/tracker-core.test.mjs` and `git diff --check`.

### Task 3: Reproduce And Publish

**Files:**
- Verify: `index.html`
- Verify: `tracker-core.js`

- [ ] Load the local page and confirm all three meals start collapsed.
- [ ] Connect cloud sync, immediately open a meal, wait for the cloud callback, and confirm it remains open.
- [ ] Verify console health and the existing food controls.
- [ ] Commit, merge to `main`, deploy atomically to GitHub Pages, and verify the production page.
