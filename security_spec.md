# Security Specification — JurnalFx Firestore Rules

## 1. Data Invariants
1. **Strict Ownership & Verified Identity**: Every document under `/users/{userId}/journal/{settingsId}`, `/users/{userId}/trades/{tradeId}`, and `/users/{userId}/cashflows/{cashflowId}` is strictly private to `userId` and requires `request.auth != null`, `request.auth.uid == userId`, `request.auth.token.email_verified == true`, and `data.ownerId == request.auth.uid`.
2. **Path & ID Hardening**: All path variables (`userId`, `settingsId`, `tradeId`, `cashflowId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` chars. `settingsId` is restricted to `'settings'`.
3. **Anti-Shadow & Type Safety**: Creates enforce exact required & allowed keysets (`hasAll` + `hasOnly`). Updates use explicit `affectedKeys().hasOnly(...)` action allowlists wrapped in `isValid*()` validators.
4. **Immutability & Server Timestamps**: `ownerId` and `createdAt` are immutable after creation; `createdAt` (and `updatedAt` on settings updates) must equal `request.time`.
5. **Bounded Strings & Numeric Sanity**: `journalName` (`1..40`), `method` (`1..80`), `pair` (`1..20`), `note` (`0..500` / `0..300`), `dateKey` (`^\d{4}-\d{2}-\d{2}$`), `riskPercent` (`> 0 && <= 100`), `initialCapitalIdr` (`> 0`), `amountIdr` (`> 0`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: `request.auth == null` creating `/users/u1/trades/t1` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `request.auth.token.email_verified == false` writing to `/users/u1/trades/t1` -> `PERMISSION_DENIED`.
3. **Cross-Tenant Read/List**: User `u2` attempting `get` or `list` on `/users/u1/trades` -> `PERMISSION_DENIED`.
4. **OwnerId Hijack on Create**: User `u1` creating trade under `/users/u1/trades/t1` with `ownerId: "u2"` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: User `u1` creating trade with extra `isAdmin: true` field -> `PERMISSION_DENIED` (`hasOnly` rejection).
6. **Oversized Document ID Poisoning**: Creating `/users/u1/trades/` with 300-char ID or `/.../` -> `PERMISSION_DENIED`.
7. **Client Timestamp Spoofing**: Creating trade with client-supplied `createdAt` != `request.time` -> `PERMISSION_DENIED`.
8. **Immutable Field Mutation**: Updating `journal/settings` to change `ownerId` or `createdAt` -> `PERMISSION_DENIED`.
9. **Invalid Settings Document ID**: Creating `/users/u1/journal/otherDoc` instead of `settings` -> `PERMISSION_DENIED`.
10. **Invalid Enum / Negative Capital**: Creating trade with `outcome: "JACKPOT"` or `initialCapitalIdr: -5000` -> `PERMISSION_DENIED`.
11. **Oversized Method/Note Payload**: Creating trade with `method` length 500 chars (`> 80`) or `note` length 2000 chars (`> 500`) -> `PERMISSION_DENIED`.
12. **Malformed DateKey**: Creating trade with `dateKey: "20-11-2026"` instead of `YYYY-MM-DD` -> `PERMISSION_DENIED`.
