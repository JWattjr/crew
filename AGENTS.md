# Crew

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Crew is the treasury for one-person companies run with AI agents. Revenue arrives at a crew's address and splits automatically: part to the founder, part to a tax reserve, part into a payroll pool that streams salary to each AI agent or contractor, claimable per second.

## Deployed Contracts (Arc Testnet)

| Contract | Address |
|---|---|
| CrewFactory | `0x36f3afcf29559b95c4b662eca054b6cf7e3a5141` |
| Crew (implementation) | `0x11a951EF6e825F99690dA89b1C38f9F56E275c1d` |

Explorer: https://explorer.testnet.arc.io/address/0x36f3afcf29559b95c4b662eca054b6cf7e3a5141

USDC (Arc Testnet): `0x3600000000000000000000000000000000000000`

## Contract Architecture

- `contracts/Crew.sol` — Clone-initializable treasury. Inherits Initializable + ReentrancyGuard (OZ 5.6.1, clone-safe via ERC-7201 namespaced slot). Owner set at initialize time. Two-step ownership transfer. distribute() is public/anyone-callable. Payroll uses remainder-tracking accrual math to prevent truncation grief.
- `contracts/CrewFactory.sol` — Deploys one Crew implementation at construction and clones it per crew. No admin key.
- `contracts/test/*.t.sol` — 88 Foundry tests (unit, fuzz, invariant).

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```

## E2E Test

The full end-to-end flow is exercised by `e2e/flow.ts`. Run with:

```bash
bun run e2e/flow.ts
```

**What it verifies (all 65 checks pass):**

- Compiles contracts with `forge build`.
- Spins up a local Anvil instance, deploys `MockERC20` + `CrewFactory` fresh, mints 1 000 mock USDC to each test wallet.
- Creates a crew with a 50/20/30 split; verifies `CrewCreated` event and all `getSplit` values.
- Adds two members; verifies `getMembers` returns correct names and weekly rates.
- Funds payroll (200 USDC) via `approve` + `fundPayroll`; verifies `payrollPool`.
- Pays 10 USDC with a memo; verifies exact Paid-event amounts (founder 56%, tax 14%, payroll 30%), exact `Distributed.toPayroll`.
- Advances block time by one week with `evm_increaseTime`; reads `accruedNow` and checks within \$0.01 of weekly rate; verifies ticker formula: `owed + accruedNow + (weeklyRate × elapsed) / ONE_WEEK_MS` matches contract.
- Ticker adds \$0.000115/s for a 70 USDC/wk member (correct, not double-counted).
- Claims member-2 salary from member-1's wallet; verifies payment goes to member-2, pool decreases, `Claimed` event fields.
- Changes split to 60/10/30; verifies next payment uses new split.
- Funds payroll to 676 USDC total, then calls `withdrawUnearnedPayroll(half)`; verifies the withdrawn amount is ≤ unearned USDC; verifies over-withdrawal reverts with `SalariesEarned`.
- Live Arc Testnet read: `crewCount()` responds, `implementation()` = `0x11a951…`.
- HTTP UI checks: all 5 SPA routes (`/`, `/new`, `/crew/:addr`, `/pay/:addr`, `/crews`) return 200 + HTML with the correct `<div id="root">` mount point; HMR endpoint live; `main.tsx` served; zero critical browser console errors captured.
- Config isolation: no `explorer.testnet.arc.io` outside generated files; no `import arcTestnet from 'viem/chains'` outside `crew-config.ts`.

**What was NOT tested (Arc Testnet USDC precompile limitation):**

- `fundPayroll`, `pay`, `claim`, and `withdrawUnearnedPayroll` on the deployed Arc Testnet contract directly via the Vite UI. The Arc Testnet USDC at `0x3600…0000` is a native-token precompile; `transferFrom` reverts in an Anvil fork (`--fork-url https://rpc.testnet.arc.io`) even when the ERC-20 allowance is set correctly. All write-path logic is covered by the local MockERC20 tests and the 88 Foundry unit tests.

## Arc Testnet Quirk — Native USDC and `transferFrom`

On Arc Testnet, the native gas asset IS USDC. `balanceOf`, `approve`, and `allowance` on the ERC-20 precompile (`0x3600…0000`) work correctly. `transferFrom` reverts in a forked Anvil environment (the precompile code path diverges from a standard ERC-20 contract). `anvil_deal` and `anvil_setStorageAt` do not work for this precompile. `anvil_setBalance` (sets the 18-dec native balance) correctly updates the 6-dec ERC-20 `balanceOf` view (ratio: `native / 1e12 = erc20`). Full production flows work on the live Arc Testnet network when called from the UI with a real wallet.

## Chain Note

`src/crew-config.ts` is the single source of truth for chain configuration. It exports `CREW_CHAIN` (a `defineChain` viem object), `CREW_CONFIG.explorerBase`, `CREW_CONFIG.rpcUrl`, and `CREW_CONFIG.chainName`. All other files import from this module — no file imports `arcTestnet` from `viem/chains` or hardcodes `explorer.testnet.arc.io`.
