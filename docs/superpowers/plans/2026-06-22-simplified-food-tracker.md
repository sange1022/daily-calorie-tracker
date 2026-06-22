# Simplified Food Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dashboard-like page with a focused daily food log, categorized food buttons, editable portions, and collapsed secondary tools without losing existing data.

**Architecture:** Extract pure migration and nutrition calculations into `tracker-core.js`, cover them with Node tests, and keep the UI and Firebase integration in `index.html`. Preserve the existing localStorage key and Firestore document structure.

**Tech Stack:** Static HTML/CSS, browser ES modules, Firebase Web SDK, Node built-in test runner, Playwright.

---

### Task 1: Data migration and portion calculations

**Files:**
- Create: `tracker-core.js`
- Create: `tests/tracker-core.test.mjs`

- [ ] Write tests for automatic category assignment, legacy row migration, and portion recalculation.
- [ ] Run `node --test tests/tracker-core.test.mjs` and confirm failure because the module does not exist.
- [ ] Implement `inferFoodCategory`, `normalizeFood`, `normalizeDailyRow`, `normalizeTrackerState`, and `updateRowPortion`.
- [ ] Run the tests and confirm all pass.

### Task 2: Focused daily-log interface

**Files:**
- Modify: `index.html`

- [ ] Replace the expanded dashboard layout with date navigation, four intake totals, food category tabs, food buttons, portion controls, and meal lists.
- [ ] Add collapsed sections for calendar, goals, cloud/data, and food library.
- [ ] Connect category selection, food creation/editing, portion editing, deletion, import/export, and Firebase sync to normalized state.
- [ ] Keep all visible controls responsive and accessible.

### Task 3: Migration and browser verification

**Files:**
- Test fixture only: `/Users/xuwuyingzao/Downloads/每日卡路里记录-2026-06-22.json`

- [ ] Verify the backup migrates to 29 foods, 6 days, and 66 rows without changing historic totals.
- [ ] Test adding two portions, editing portions, category switching, hidden food creation, and cloud sync in two browser contexts.
- [ ] Capture desktop and mobile screenshots and check console errors and horizontal overflow.

### Task 4: Deploy

**Files:**
- Commit: `index.html`, `tracker-core.js`, tests, and plan.

- [ ] Commit the implementation.
- [ ] Upload changed files to `sange1022/daily-calorie-tracker`.
- [ ] Wait for GitHub Pages and repeat the live core-flow test.
