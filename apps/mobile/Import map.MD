# ERS Import Path Audit — Master Reference

## Final Folder Tree

```
ers-mobile/                          ← PROJECT ROOT
│
├── App.tsx                          ← entry point
├── supabase.ts                      ← Supabase client (createClient lives here)
├── MainApp.tsx                      ← your existing file (unchanged)
│
├── screens/                         ← ALL screens live HERE (root level)
│   ├── AuthScreen.tsx
│   ├── ClientScreen.tsx
│   ├── CreateErrandScreen.tsx
│   ├── CreatePinScreen.tsx
│   ├── KycScreen.tsx
│   ├── otpscreen.tsx
│   ├── PaymentSuccessScreen.tsx
│   ├── ProfileScreen.tsx
│   ├── RunnerScreen.tsx
│   ├── SavedBanksScreen.tsx
│   ├── SelectBankScreen.tsx
│   ├── TransactionsScreen.tsx
│   ├── WalletScreen.tsx
│   ├── WithdrawHistoryScreen.tsx
│   └── WithdrawScreen.tsx
│
└── src/                             ← all non-screen source files
    ├── context/
    │   └── AuthContext.tsx          ← NEW (replaces old stub)
    │
    ├── hooks/
    │   ├── useLogout.ts             ← NEW
    │   ├── useApiDebugText.ts       ← existing
    │   └── useSocket.ts             ← existing
    │
    ├── navigation/
    │   ├── AppStack.tsx             ← NEW
    │   ├── AuthStack.tsx            ← NEW
    │   ├── BottomTabs.tsx           ← existing (unchanged)
    │   ├── index.tsx                ← existing (unchanged)
    │   └── RootNavigator.tsx        ← NEW
    │
    ├── api/
    ├── config/
    ├── services/
    ├── sockets/
    ├── stores/
    ├── types/
    └── utils/
```

---

## Import Map (every cross-file import, corrected)

### App.tsx (root)

| Import        | ❌ Was                       | ✅ Now                           |
| ------------- | ---------------------------- | -------------------------------- |
| AuthProvider  | `./context/AuthContext`      | `./src/context/AuthContext`      |
| RootNavigator | `./navigation/RootNavigator` | `./src/navigation/RootNavigator` |

**Why:** App.tsx lives at root. Files live inside `src/`. Must include `src/` prefix.

---

### src/context/AuthContext.tsx

| Import   | ❌ Was        | ✅ Now           |
| -------- | ------------- | ---------------- |
| supabase | `../supabase` | `../../supabase` |

**Why:** File is at `src/context/`. One `../` goes to `src/`. Second `../` goes to root where `supabase.ts` lives.

---

### src/navigation/RootNavigator.tsx

| Import    | ❌ Was                   | ✅ Now                     |
| --------- | ------------------------ | -------------------------- |
| useAuth   | `../context/AuthContext` | `../context/AuthContext` ✓ |
| AuthStack | `./AuthStack`            | `./AuthStack` ✓            |
| AppStack  | `./AppStack`             | `./AppStack` ✓             |

**All correct** — `src/navigation/` → `../context/` = `src/context/` ✓

---

### src/navigation/AuthStack.tsx

| Import     | ❌ Was                  | ✅ Now                     |
| ---------- | ----------------------- | -------------------------- |
| AuthScreen | `../screens/AuthScreen` | `../../screens/AuthScreen` |

**Why:** `src/navigation/` → `../screens/` = `src/screens/` (doesn't exist). Need `../../screens/` to reach root `screens/`.

---

### src/navigation/AppStack.tsx

| Import             | ❌ Was                          | ✅ Now                             |
| ------------------ | ------------------------------- | ---------------------------------- |
| BottomTabs         | `./BottomTabs`                  | `./BottomTabs` ✓                   |
| CreateErrandScreen | `../screens/CreateErrandScreen` | `../../screens/CreateErrandScreen` |
| TransactionsScreen | `../screens/TransactionsScreen` | `../../screens/TransactionsScreen` |
| All other screens  | `../screens/*`                  | `../../screens/*`                  |

**Why:** Same as AuthStack — screens/ is at root, not inside src/.

---

### src/hooks/useLogout.ts

| Import  | ❌ Was                   | ✅ Now                     |
| ------- | ------------------------ | -------------------------- |
| useAuth | `../context/AuthContext` | `../context/AuthContext` ✓ |

**All correct** — `src/hooks/` → `../context/` = `src/context/` ✓

---

### screens/AuthScreen.tsx

| Import   | ❌ Was        | ✅ Now          |
| -------- | ------------- | --------------- |
| supabase | `../supabase` | `../supabase` ✓ |

**All correct** — `screens/` → `../supabase` = root `supabase.ts` ✓

---

## The One Rule That Fixes All Errors

```
screens/ is at PROJECT ROOT
src/     is at PROJECT ROOT

From src/navigation/ or src/context/ or src/hooks/:
  → to supabase.ts:   use ../../supabase
  → to screens/*:     use ../../screens/*
  → to other src/*:   use ../otherFolder/*

From screens/*:
  → to supabase.ts:   use ../supabase
  → to src/*:         use ../src/*

From App.tsx (root):
  → to src/*:         use ./src/*
  → to screens/*:     use ./screens/*
  → to supabase.ts:   use ./supabase
```

---

## TypeScript Errors Fixed

| Error                                  | File            | Fix                                                                                                                            |
| -------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `'s' implicitly has an 'any' type`     | AuthContext.tsx | SDK types inferred from `supabase.auth.getSession()` return type; no annotation needed if `@supabase/supabase-js` is installed |
| `'error' implicitly has an 'any' type` | AuthContext.tsx | Same — SDK infers the error type                                                                                               |
| `'event' implicitly has an 'any' type` | AuthContext.tsx | Added `(event: AuthChangeEvent, s: Session \| null)`                                                                           |
| `'s' implicitly has an 'any' type`     | AuthContext.tsx | Added explicit param type in onAuthStateChange callback                                                                        |
| `catch (err: any)`                     | all files       | Changed to `catch (err: unknown)` + `instanceof Error` narrowing                                                               |
| `role` type cast `as any`              | AuthScreen.tsx  | Replaced with `('client' \| 'runner')` const assertion                                                                         |

---

## Fix Order (step-by-step)

1. **Copy `src/context/AuthContext.tsx`** → replace existing stub in `src/context/`
2. **Copy `src/navigation/RootNavigator.tsx`** → place in `src/navigation/`
3. **Copy `src/navigation/AuthStack.tsx`** → place in `src/navigation/`
4. **Copy `src/navigation/AppStack.tsx`** → place in `src/navigation/`
5. **Copy `src/hooks/useLogout.ts`** → place in `src/hooks/`
6. **Copy `screens/AuthScreen.tsx`** → replace existing in root `screens/`
7. **Update `App.tsx`** at project root — change the two import paths (add `src/` prefix)
8. **Check `MainApp.tsx`** — if it contains a `<NavigationContainer>`, remove it
9. **Run:** `npx tsc --noEmit` to verify zero TypeScript errors
10. **Run the app** and confirm: unauthenticated → AuthScreen, login → Tabs, logout → AuthScreen

---

## Remaining Runtime Risks

| Risk                                            | Location                                       | Mitigation                                                            |
| ----------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| `supabase.ts` missing `createClient`            | root `supabase.ts`                             | Verify file exports a default Supabase client                         |
| `BottomTabs.tsx` missing client/runner tab gate | `src/navigation/BottomTabs.tsx`                | BottomTabs should read `user.user_metadata.role` to show correct tabs |
| Screens without `mounted` guard                 | ClientScreen, RunnerScreen, WalletScreen, etc. | Apply the safe loading pattern from previous audit to each screen     |
| `profiles` table missing                        | Supabase dashboard                             | Run `create_profiles.sql` migration                                   |
| `@supabase/supabase-js` not installed           | package.json                                   | `npx expo install @supabase/supabase-js`                              |
| `@react-navigation/native-stack` not installed  | package.json                                   | `npx expo install @react-navigation/native-stack`                     |
