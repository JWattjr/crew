# Crew — Arc Microgrants Round 2

Track: **Built with Arc Studio**. This is the builder's second entry, following Plug.

## Three-sentence description

Crew is the treasury for one-person companies run with AI agents, splitting incoming USDC revenue among the founder, a tax reserve, extra recipients and a payroll pool. Agents and contractors earn weekly salaries that accrue every second, and anyone can trigger a claim while the contract always pays the member's own wallet. The contracts and React/Vite app were built in Arc Studio, where the project was tested with 88 Foundry unit, fuzz and invariant tests, a max-preset audit, and a 65-check end-to-end flow before mainnet deployment.

## Project and builder

- Arc Studio project: [Crew — Built with Arc Studio](https://studio.arc.io/app/12d60429-cca1-42d3-b1b3-9f7d390b106a).
- Live app: [crew-three-gilt.vercel.app](https://crew-three-gilt.vercel.app).
- Public repository: [JWattjr/crew](https://github.com/JWattjr/crew).
- Video walkthrough: TODO — add video URL.
- Builder profile: TODO — add grant-platform builder profile URL.
- GitHub profile: [JWattjr](https://github.com/JWattjr).

## Contract evidence — Arc mainnet

Network: **Arc mainnet (chain ID 5042)**. USDC has 6 decimals.

| Evidence | Address or transaction |
|---|---|
| CrewFactory contract | [0x71d17371cf90916777ce2a9d7652e804d1b6e729](https://explorer.arc.io/address/0x71d17371cf90916777ce2a9d7652e804d1b6e729) |
| Crew implementation contract | [0xc2e616875d6543c4619bf9c1eebb0f1724e7ec0f](https://explorer.arc.io/address/0xc2e616875d6543c4619bf9c1eebb0f1724e7ec0f) |
| USDC | [0x3600000000000000000000000000000000000000](https://explorer.arc.io/address/0x3600000000000000000000000000000000000000) |
| Factory deploy transaction | [0x26a3b5b7c121713324342be05fe7729625f320a69489d66a724bc88f12c912d4](https://explorer.arc.io/tx/0x26a3b5b7c121713324342be05fe7729625f320a69489d66a724bc88f12c912d4) |
| Factory deploy block | 28164172 |
| Example crew clone contract | TODO — add `https://explorer.arc.io/address/<crew-address>` after creating the demo crew. |

Each crew is an EIP-1167 clone deployed by CrewFactory. Arc Studio reports the deployed bytecode is identical to the tested build. Testnet reference only: [CrewFactory 0x36f3afcf29559b95c4b662eca054b6cf7e3a5141](https://explorer.testnet.arc.io/address/0x36f3afcf29559b95c4b662eca054b6cf7e3a5141).

## Example transaction evidence

Record successful **Arc mainnet** transactions from the same demo crew. The factory deployment above is separate evidence and does not stand in for these user flows.

| Flow | Explorer transaction link |
|---|---|
| Create crew | TODO — `https://explorer.arc.io/tx/<create-crew-hash>` |
| Pay with split | TODO — `https://explorer.arc.io/tx/<pay-with-split-hash>` |
| Claim salary | TODO — `https://explorer.arc.io/tx/<claim-salary-hash>` |

## Security and testing evidence

- No platform admin key or upgrade mechanism; each crew has a fixed implementation and owner-managed configuration.
- The owner can withdraw only unearned payroll. Claims always pay the stored member wallet, even when someone else submits the transaction.
- Arc Studio reports 88 Foundry tests, including fuzz and invariants, a max-preset audit, and a 65-check end-to-end flow.
- Reproduce with `forge test` and `bun run e2e/flow.ts` in the Arc Studio environment; see README prerequisites and scope.
- Live hosting verification (27 October 2026): production deployment `dpl_Dn4TRRG46VSY1oQbEGB1hCQivJXs` reached READY from commit `791f9b5`; the Vite app rendered after direct navigation and browser refresh at `/`, `/new`, `/crews`, and `/crew/0x0000000000000000000000000000000000000001`. The footer displayed `Arc`, the dashboard Explorer link used `explorer.arc.io`, and no browser console errors were captured on these app routes. The placeholder address checks routing and the dashboard shell; it is not a deployed demo crew.
- Mainnet connection verification: the configured RPC returned chain ID `0x13b2` (5042) and 1,831 bytes of factory bytecode. The factory Explorer page opened as an Arc Mainnet contract with the supplied deployment transaction, implementation and block.
- Public production domain: `crew-three-gilt.vercel.app`. Team and branch aliases can require Vercel authentication; use the public domain for judges.

This file is a preparation checklist. No grant form has been submitted.
