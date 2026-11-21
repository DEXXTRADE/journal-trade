# Security Specification — JurnalFx Firestore Rules (Direct Access Workspace)

## 1. Data Invariants
1. **Workspace Isolation & Global Default-Deny**: Every document outside `/journals/main` (including `/users/**` and any arbitrary collection) is denied via the root catch-all `allow read, write: if false;`. Only the single dedicated journal ID `'main'` is readable/writable without a login screen, as requested by the user.
2. **Relational Parent Check ("Master Gate")**: Sub-collection writes (`/journals/{journalId}/trades/{tradeId}` and `/journals/{journalId}/cashflows/{cashflowId}`) verify parent existence via `exists(/databases/$(database)/documents/journals/$(journalId))` (or `existsAfter(...)` on batched reset) and enforce `data.journalId == journalId`.
3. **Path & ID Hardening**: All path variables (`journalId`, `tradeId`, `cashflowId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` chars. `journalId` is strictly restricted to `'main'`.
4. **Anti-Shadow & Type Safety**: Creates enforce exact required & allowed keysets (`hasAll` + `hasOnly`). Updates use explicit `affectedKeys().hasOnly(...)` action allowlists wrapped in `isValidJournalSettings()`. Trades and cashflows are immutable (`allow update: if false`).
5. **Immutability & Server Timestamps**: `journalId` and `createdAt` are immutable after creation; `createdAt` (and `updatedAt` on settings updates) must equal `request.time`.
6. **Bounded Strings & Numeric Sanity**: `journalName` (`1..40`), `theme` (`'light' | 'dark'`), `method` (`1..80`), `pair` (`1..20`), `note` (`0..500` / `0..300`), `dateKey` (`^\d{4}-\d{2}-\d{2}$`), `riskPercent` (`> 0 && <= 100`), `initialCapitalIdr` (`> 0`), `amountIdr` (`> 0`).
7. **Secure List Queries**: `allow list` on `trades` and `cashflows` evaluates `existing().journalId == 'main'`, requiring queries to filter by `where('journalId', '==', 'main')`.

## 2. Adversarial Payloads Covered
1. **Arbitrary Collection Write**: Writing to `/users/u1/trades/t1` or `/admin/flags` -> `PERMISSION_DENIED`.
2. **Non-Default Journal ID Creation**: Creating `/journals/other` -> `PERMISSION_DENIED` (`journalId == 'main'` gate).
3. **Orphaned Subcollection Write**: Creating trade with mismatched `journalId: "other"` -> `PERMISSION_DENIED`.
4. **Shadow / Ghost Field Injection**: Creating trade or settings with extra `isAdmin: true` -> `PERMISSION_DENIED` (`hasOnly` rejection).
5. **Oversized Document ID Poisoning**: Creating `/journals/main/trades/` with 300-char ID -> `PERMISSION_DENIED`.
6. **Client Timestamp Spoofing**: Creating trade with client-supplied `createdAt != request.time` -> `PERMISSION_DENIED`.
7. **Immutable Field Mutation**: Updating `/journals/main` to change `journalId` or `createdAt` -> `PERMISSION_DENIED`.
8. **Invalid Theme Enum**: Updating `/journals/main` with `theme: "neon"` -> `PERMISSION_DENIED`.
9. **Invalid Outcome / Negative Capital**: Creating trade with `outcome: "JACKPOT"` or `initialCapitalIdr: -5000` -> `PERMISSION_DENIED`.
10. **Oversized Method/Note Payload**: Creating trade with `method` length 500 chars (`> 80`) or `note` length 2000 chars (`> 500`) -> `PERMISSION_DENIED`.
11. **Malformed DateKey**: Creating trade with `dateKey: "20-11-2026"` -> `PERMISSION_DENIED`.
12. **Trade Update Bypass**: Attempting `update` on `/journals/main/trades/{tradeId}` -> `PERMISSION_DENIED` (`allow update: if false`).
