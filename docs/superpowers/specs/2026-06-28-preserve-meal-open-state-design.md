# Preserve Meal Open State Design

## Problem

Morning, noon, and evening use native `details` elements. Cloud synchronization and local edits call `renderMeals()`, which replaces those elements and resets every meal to its default collapsed state. A cloud callback arriving just after a user click therefore makes the meal appear to close by itself.

## Design

Before rebuilding the meal markup, collect the IDs of currently open meal sections. Add a stable `data-meal` ID to each section and restore the `open` attribute for IDs that were open before the render.

The first render has no previous elements, so all meals remain collapsed by default. Later renders caused by cloud snapshots, portion changes, deletions, additions, or date navigation preserve the user's current open sections.

## Testing

- Add a pure helper test proving that only open meal sections are captured.
- Reproduce the original timing: connect cloud sync, immediately expand a meal, wait for the cloud callback, and verify the section remains open.
- Verify initial page load still has three collapsed meal sections.
- Run the existing tracker tests and check browser console health.
