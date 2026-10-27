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
