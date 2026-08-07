# SKYNET Mobile

A standalone React Native (Expo) app for warehouse operators, scoped to just
two workflows from the SKYNET/`parcel_allocation_system` web app:

- **Box Unsealing** (1st scan)
- **LMD Verification** (2nd scan / outbound bagging)

It talks to the **same Next.js backend** the web app already uses
(`/api/allocate`, `/api/lmd-bags`, `/api/auth/login`) — no backend, database,
or Supabase changes are required. Just deploy the web app as normal and point
this app at its URL.

## Project layout

```
App.tsx                        Root: auth gate + bottom tab navigation
src/
  api/
    client.ts                  Thin fetch wrapper (reads base URL from config)
    auth.ts                    POST /api/auth/login
    allocate.ts                GET/POST /api/allocate (both scan stages)
    lmdBags.ts                 POST /api/lmd-bags (create/add-parcel/seal)
  context/
    AuthContext.tsx            Session persisted via expo-secure-store
  components/
    BarcodeScannerModal.tsx    Full-screen camera scanner (expo-camera)
    MawbPickerModal.tsx        MAWB selector
    BagPickerModal.tsx         Bag selector (or type/scan a bag number)
    PartnerSelector.tsx        ALL / PickMe / Domex / Pronto chips
    ScanLog.tsx                Scrollable OK/ERROR scan history
    SettingsSheet.tsx          Configure the backend API base URL
  screens/
    LoginScreen.tsx
    BoxUnsealingScreen.tsx     1st scan tab
    LMDVerificationScreen.tsx  2nd scan tab
    ProfileScreen.tsx          Sign out + server settings
  types/index.ts                Shared types (mirrors web app's src/types.ts)
  config.ts                    Persisted API base URL
```

## Setup

```bash
npm install
npx expo start
```

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR
code with Expo Go on a physical device.

## Pointing at your backend

On first launch, tap **Server Settings** on the login screen (or from the
Profile tab once signed in) and enter the URL where
`parcel_allocation_system` is deployed, e.g.:

```
https://skynet.dgl.lk
```

This is stored securely on-device via `expo-secure-store` and prefixed to
every API call. If you're developing locally, use your machine's LAN IP or an
`ngrok`/tunnel URL (not `localhost`, since the mobile device/simulator can't
reach your laptop's localhost directly).

## How each tab maps to the backend

**Box Unsealing**
1. Pick a MAWB → `GET /api/allocate?mawbs=true`
2. Pick a bag → `GET /api/allocate?getBags=true&mawbRef=...`
3. Scan a parcel → `POST /api/allocate { stage: 'first', trackingNumber, mawbRef, bagNumber, operator }`
4. Finish Bag → `POST /api/allocate { stage: 'finish-bag', ... }`

**LMD Verification**
1. Pick a MAWB, choose a target partner (ALL/PickMe/Domex/Pronto)
2. Open Outbound Bag → `POST /api/lmd-bags { action: 'create', mawbRef, partner, operator }`
3. Scan a parcel → `POST /api/allocate { stage: 'second', trackingNumber, targetMawb, targetPartner, operator }`,
   then on success → `POST /api/lmd-bags { action: 'add-parcel', ... }`
4. Seal Bag → `POST /api/lmd-bags { action: 'seal', ... }`

## What's intentionally out of scope

To keep this a focused, separate mobile project (per your request), the
following web-app-only features were **not** ported: Damaged Labels
exception flow, Dispatch Verify, Search Center, Dashboard, Reports,
Config/Zone Mapping, and the "force unseal with note" / "register extra
parcel" edge-case modals from the 1st-scan flow. Those all hit the same
`/api/allocate` and `/api/lmd-bags` endpoints (see `route.ts` in the web
repo), so they can be added as additional screens later using the same
`src/api/*` pattern.

## Notes / things to double-check before shipping

- **Barcode types**: `BarcodeScannerModal` is configured for
  `code128, ean13, qr, code39, upc_a`. Confirm this matches what your Code
  128 SKYNET labels actually use (the web app's custom barcode generator
  writes Code 128 — that's covered — but tighten/loosen this list based on
  what your RTD/handheld devices produce).
- **Auth**: this reuses the existing email/password login. If you'd rather
  use PIN-based quick switch (`/api/auth/switch`), that's a small addition
  to `src/api/auth.ts` + a PIN pad screen.
- **Duplicate-scan cooldown**: the scanner ignores repeat reads of the same
  frame for 1.5s (`cooldownMs` prop) rather than doing full duplicate
  detection — the server still catches true duplicates
  (`ALREADY_UNSEALED_PARCEL`, `BAG_ALREADY_COMPLETED`) and those show up as
  red entries in the scan log.
