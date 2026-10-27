# Crew — Treasury for One-Person AI Companies

Crew is a smart contract treasury for solo founders running their business with AI agents. Revenue arrives at a crew's onchain address and splits automatically: a configurable share goes to the founder, a share goes to a tax reserve, and a share flows into a payroll pool that streams USDC to each AI agent or contractor at a weekly rate, claimable per second at any time.

Built with [Arc Studio](https://studio.arc.io)

## Tech Stack

- Contracts: Solidity 0.8.28, Foundry, OpenZeppelin 5.6.1
- Chain: Arc Testnet (Chain ID 5042002) — USDC is the native gas token
- Token: USDC ERC-20 (6 decimals, `0x3600000000000000000000000000000000000000` on Arc Testnet)
- Clone pattern: OpenZeppelin Clones (EIP-1167)
- Test framework: Foundry forge (unit, fuzz, invariant)

## Contracts

| Contract | Arc Testnet |
|---|---|
| CrewFactory | `0x36f3afcf29559b95c4b662eca054b6cf7e3a5141` |
| Crew implementation | `0x11a951EF6e825F99690dA89b1C38f9F56E275c1d` |

Explorer: https://explorer.testnet.arc.io/address/0x36f3afcf29559b95c4b662eca054b6cf7e3a5141

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.x
- [Foundry](https://book.getfoundry.sh) (`forge`)

### Install

```bash
bun install
```

### Environment Variables

None required for contract development. The USDC address is passed as a constructor argument.

### Run dev server (for future app)

```bash
bun run dev
```

### Build contracts

```bash
bun run contracts:build
```

### Test contracts

```bash
bun run contracts:test
```

## Contract Architecture

`CrewFactory` deploys a single `Crew` implementation contract and clones it (EIP-1167) for each new crew. The factory takes only the USDC address at construction, so the same bytecode works on Arc Testnet and mainnet.

`Crew` holds a crew's USDC balance and enforces three things:
1. Any new revenue that arrives (above the payroll reserve) is split among configured recipients by basis points; rounding dust goes to the first recipient so the contract never retains unaccounted funds.
2. The owner configures up to 20 members (AI agents, contractors, employees), each with a weekly USDC rate. Salary accrues per second using remainder-preserving integer arithmetic; anyone can trigger a claim for any member, and the claim always pays the member's own wallet.
3. The owner can withdraw only the portion of the payroll pool that has not yet been earned, protecting already-accrued salaries.

There is no admin key, no upgrade path, and no proxy. A USDC blocklist on the crew address freezes it.

## Mainnet launch — Arc Microgrants Round 2

**Built with Arc Studio:** [Crew project](https://studio.arc.io/app/12d60429-cca1-42d3-b1b3-9f7d390b106a).

Crew is the treasury for one-person companies run with AI agents. The founder can configure revenue recipients, a tax reserve, extra recipients, and a payroll pool; agents and contractors earn weekly USDC salaries that accrue every second. Anyone can trigger a member's claim, and the contract always sends the payment to that member's wallet.

- Live app: [crew-three-gilt.vercel.app](https://crew-three-gilt.vercel.app).
- Public source: [JWattjr/crew](https://github.com/JWattjr/crew).
- Network: **Arc mainnet, chain ID 5042**. The testnet details above are retained from Arc Studio's original README as development history; the hosted app uses the mainnet configuration below.

### Revenue split and streamed payroll

The founder chooses the recipients and payroll allocation when creating a crew. `pay(amount, memo)` transfers USDC into the crew and runs distribution in the same transaction. A plain USDC transfer to a crew address needs a subsequent permissionless `distribute()` call; contracts do not initiate transactions by themselves. Distribution reserves the payroll share, transfers the remaining revenue to configured recipients, and sends rounding dust to the first recipient. The tax reserve is a configured recipient wallet.

Each member has a weekly salary in 6-decimal USDC units. Accrual uses elapsed seconds over a 604,800-second week and preserves fractional remainders across settlements. Salary becomes claimable every second; settlement occurs onchain when a transaction runs. A claim pays up to the available payroll pool and retains any unpaid balance as owed. `fundPayroll()` adds funds directly to the payroll reserve without distributing them as new revenue.

### Security model

There is no platform admin key or upgrade mechanism. The factory creates EIP-1167 clones pointing to a fixed Crew implementation; these are minimal proxies, clarifying the original README's wording above. Each crew has an owner who configures splits, members and future salary rates, with two-step ownership transfer. Before changing a member's rate or removing them, the contract settles earned salary.

The owner's payroll withdrawal is limited to unearned funds: `max(payrollPool - totalAccruedNow(), 0)`. Earned salaries remain reserved. `claim(memberWallet)` is permissionless, but its payout goes only to the stored member wallet, never the caller. Token transfers use SafeERC20 and value-moving paths use a reentrancy guard. USDC blocklisting of a crew can freeze distribution and payroll; the contract has no admin override. The owner can update recipients through the emergency split path when ordinary distribution is blocked, which applies the new split to any undistributed revenue.

### Mainnet addresses and deployment evidence

| Item | Arc mainnet (5042) |
|---|---|
| CrewFactory | [0x71d17371cf90916777ce2a9d7652e804d1b6e729](https://explorer.arc.io/address/0x71d17371cf90916777ce2a9d7652e804d1b6e729) |
| Crew implementation | [0xc2e616875d6543c4619bf9c1eebb0f1724e7ec0f](https://explorer.arc.io/address/0xc2e616875d6543c4619bf9c1eebb0f1724e7ec0f) |
| USDC (6 decimals) | [0x3600000000000000000000000000000000000000](https://explorer.arc.io/address/0x3600000000000000000000000000000000000000) |
| Factory deployment | [0x26a3b5b7c121713324342be05fe7729625f320a69489d66a724bc88f12c912d4](https://explorer.arc.io/tx/0x26a3b5b7c121713324342be05fe7729625f320a69489d66a724bc88f12c912d4) |
| Deployment block | 28164172 |

Arc Studio's deployment report confirms that the mainnet bytecode is identical to the tested build. Each newly created crew receives its own clone address. The testnet factory remains [0x36f3afcf29559b95c4b662eca054b6cf7e3a5141](https://explorer.testnet.arc.io/address/0x36f3afcf29559b95c4b662eca054b6cf7e3a5141).

### Run the app and tests

Install dependencies with `npm install --legacy-peer-deps`. For mainnet app development, set these public Vite environment variables in your shell before running `npm run dev` or `npm run build`:

```text
VITE_CREW_CHAIN=arc-mainnet
VITE_CREW_FACTORY=0x71d17371cf90916777ce2a9d7652e804d1b6e729
VITE_CREW_DEPLOY_BLOCK=28164172
```

Without the chain override, the local app defaults to Arc Testnet. No private key or API secret is needed for the frontend; users sign transactions in their own wallet.

Run the Foundry unit, fuzz and invariant suite from the repository root:

```bash
forge test
```

Run the end-to-end flow in the Arc Studio Linux environment with Bun, Foundry (`forge` and `anvil`), dependencies installed, and the Vite dev server listening on port 5173:

```bash
bun run e2e/flow.ts
```

Arc Studio reports 88 passing Foundry tests, a max-preset audit, and a 65-check end-to-end flow. These are Arc Studio's reported results, not a claim that this hosting setup reran those suites. The E2E script combines fresh local Anvil/MockERC20 transactions, testnet reads, and dev-server HTTP checks; it does not spend mainnet funds. Its Studio-specific paths expect `/home/user/app`.

### Hosting and Arc Studio ownership

Vercel project `crew` is connected to `JWattjr/crew`, with Vite, install command `npm install --legacy-peer-deps`, build command `npm run build`, and output directory `dist`. The three public variables above are configured for Production and Preview. The existing `vercel.json` handles SPA deep links.

The contracts and application are built and maintained in [Arc Studio](https://studio.arc.io/app/12d60429-cca1-42d3-b1b3-9f7d390b106a). This repository setup adds hosting and documentation. Make application and contract fixes through Arc Studio; preserve later Studio pulls, and run `git pull --ff-only origin main` before pushing. If a pull cannot fast-forward, stop and reconcile with the Studio author without overwriting its files. Do not use a force push.
