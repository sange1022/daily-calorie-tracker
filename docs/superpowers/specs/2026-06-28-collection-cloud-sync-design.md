# Collection Cloud Sync Design

## Goal

Change cloud synchronization from whole-state replacement to collection merging. When two devices contain different foods or daily entries, both devices must retain the union after synchronization.

## Confirmed Behavior

- Daily entries are identified by ID. Entries created independently on different devices remain separate, even when their date, meal, food name, and nutrition values match.
- Food library items are also merged by ID. Foods created independently on different devices remain separate.
- Deleting an entry or library item propagates to every connected device and must not be undone by an older offline copy.
- When the same entity is edited on multiple devices, the version with the newest modification timestamp wins.
- Weight, nutrition factors, and labels use last-write-wins behavior.
- Existing saved and cloud data is upgraded automatically without losing records.

## Approach

Keep the existing single Firestore document per sync code, but replace blind `setDoc` writes with transaction-based read, merge, and write operations. This limits the migration and keeps the current sync-code experience unchanged.

Each synchronized entity carries merge metadata:

- `updatedAt`: a numeric client timestamp used to resolve edits.
- Deleted entities are stored as tombstones containing their ID and deletion timestamp.
- A persistent local device ID is used as a deterministic tie-breaker if two updates have the same timestamp.

The synchronized state includes:

- Food library entities keyed by food ID.
- Daily-entry entities grouped by date and keyed by entry ID.
- Tombstones for deleted foods and daily entries.
- Versioned settings and labels.

The visible application state remains arrays and objects compatible with the current renderer. Merge metadata is normalized at the data boundary so the UI does not need a broad rewrite.

## Merge Rules

1. Normalize local and remote states, including legacy states without metadata.
2. Match foods and daily entries by ID.
3. Keep entities that exist on only one side.
4. For the same ID, choose the entity with the newer `updatedAt` value. Use device ID as a deterministic tie-breaker.
5. Compare each entity against its deletion tombstone. The newer event wins; a newer deletion hides the entity, while a genuinely newer edit may restore it.
6. Merge settings and labels by their own modification metadata.
7. Persist the merged result locally and write it back to Firestore in a transaction.

This means two independent entries for the same food are never combined and their portions are never added together.

## Synchronization Flow

### Local Change

The app stamps the changed entity or setting, saves locally immediately, then schedules a cloud transaction. The transaction reads the current cloud state, merges local and remote data, and writes the merged result.

### Initial Connection

The app reads the sync-space document, merges it with local data, saves the result locally, and publishes the union. Connecting a second device therefore cannot replace the first device's unique records.

### Remote Snapshot

When a Firestore snapshot arrives, the app merges it with current local data rather than assigning it directly. If the merged state contains local-only changes, the app schedules a write-back so both sides converge.

### Offline Recovery

Local changes continue to save while offline. When connectivity returns, the same transaction-based merge runs and combines both collections.

## Deletion And Retention

Deletion creates a tombstone instead of immediately forgetting the entity ID. Tombstones are synchronized with normal data and prevent stale devices from restoring deleted records.

Tombstones are retained indefinitely in this version. The tracker stores relatively little data, and permanent retention is safer than time-based cleanup for devices that may remain offline for a long period.

## Compatibility

Legacy entities without timestamps receive deterministic baseline metadata during normalization. Baseline timestamps must not make old imported data override newer synchronized edits. Existing export files remain importable, and exports include the metadata required to preserve merge behavior when moved between devices.

No changes are required to the sync-code UI or Firestore security model unless transaction testing reveals a rule restriction.

## Error Handling

- Transaction conflicts rely on Firestore's transaction retry behavior.
- Failed cloud operations leave local data intact and show the existing failure/offline status.
- Invalid remote data is rejected by normalization without replacing valid local state.
- Snapshot callbacks avoid endless write loops by writing only when the merged cloud representation differs from the received representation.

## Testing

Pure merge logic belongs in `tracker-core.js` and is covered with Node tests before UI integration. Required cases include:

- Union of unique foods and daily entries from two devices.
- Preservation of duplicate-looking entries with different IDs.
- Newest edit wins for the same ID.
- Newest deletion wins and prevents stale resurrection.
- Settings use last-write-wins behavior.
- Legacy states normalize without record or nutrition loss.
- Merge is commutative and idempotent for equivalent inputs.

Browser verification covers initial connection, local changes, deletion, reload persistence, offline status behavior, and responsive UI regression checks.
