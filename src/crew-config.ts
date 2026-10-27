/**
 * Crew network and contract configuration.
 * Override via Vite env vars:
 *   VITE_CREW_CHAIN        = arc-testnet | arc-mainnet
 *   VITE_CREW_FACTORY      = 0x…
 *   VITE_CREW_DEPLOY_BLOCK = 123456
 *   VITE_CREW_RPC_URL      = https://…  (optional)
 *
 * All network facts (chain object, RPC URL, explorer base) come from this module.
 * Nothing else in src/ should import from 'viem/chains' directly for network selection.
 */

import { defineChain } from 'viem'
import { getUsdc, requireChain } from '@/onchain-facts'

const chainKey = (import.meta.env.VITE_CREW_CHAIN as string | undefined) ?? 'arc-testnet'

// ─── Arc Testnet facts ──────────────────────────────────────────────────────
const ARC_TESTNET_CHAIN_ID = 5042002
const ARC_TESTNET_FACTORY  = '0x36f3afcf29559b95c4b662eca054b6cf7e3a5141'
const ARC_TESTNET_DEPLOY_BLOCK = BigInt(0)

// ─── Arc Mainnet facts ──────────────────────────────────────────────────────
const ARC_MAINNET_CHAIN_ID = 5042   // Arc Mainnet chain ID
const ARC_MAINNET_FACTORY  = import.meta.env.VITE_CREW_FACTORY as string | undefined

// ─── Resolve active config ───────────────────────────────────────────────────
function resolveConfig() {
  if (chainKey === 'arc-mainnet') {
    if (!ARC_MAINNET_FACTORY) throw new Error('VITE_CREW_FACTORY required for arc-mainnet')
    const fact = requireChain(ARC_MAINNET_CHAIN_ID)
    const rpcUrl = (import.meta.env.VITE_CREW_RPC_URL as string | undefined) ?? fact.rpcUrls[0]
    return {
      chainId:        ARC_MAINNET_CHAIN_ID,
      factoryAddress: (import.meta.env.VITE_CREW_FACTORY ?? ARC_MAINNET_FACTORY) as `0x${string}`,
      deployBlock:    import.meta.env.VITE_CREW_DEPLOY_BLOCK
        ? BigInt(import.meta.env.VITE_CREW_DEPLOY_BLOCK as string)
        : BigInt(0),
      isTestnet:      false,
      explorerBase:   fact.explorerBase,
      rpcUrl,
      chainName:      'Arc',
    }
  }

  // Default: arc-testnet
  const fact = requireChain(ARC_TESTNET_CHAIN_ID)
  const rpcUrl = (import.meta.env.VITE_CREW_RPC_URL as string | undefined) ?? fact.rpcUrls[0]
  return {
    chainId:        ARC_TESTNET_CHAIN_ID,
    factoryAddress: (import.meta.env.VITE_CREW_FACTORY ?? ARC_TESTNET_FACTORY) as `0x${string}`,
    deployBlock:    import.meta.env.VITE_CREW_DEPLOY_BLOCK
      ? BigInt(import.meta.env.VITE_CREW_DEPLOY_BLOCK as string)
      : ARC_TESTNET_DEPLOY_BLOCK,
    isTestnet:      true,
    explorerBase:   fact.explorerBase,
    rpcUrl,
    chainName:      'Arc Testnet',
  }
}

export const CREW_CONFIG = resolveConfig()

// USDC on the configured chain (6 decimals)
export const USDC_ADDRESS = (
  getUsdc(CREW_CONFIG.chainId)?.address ?? '0x3600000000000000000000000000000000000000'
) as `0x${string}`

export const USDC_DECIMALS = 6

/**
 * A viem Chain object for the configured network, built from onchain-facts.
 * Used in createPublicClient calls and wagmi config so no file other than
 * this one needs to import a specific chain from viem/chains.
 */
export const CREW_CHAIN = (() => {
  const fact = requireChain(CREW_CONFIG.chainId)
  return defineChain({
    id:   fact.chainId,
    name: fact.name,
    nativeCurrency: {
      name:     fact.nativeCurrency.symbol,
      symbol:   fact.nativeCurrency.symbol,
      decimals: fact.nativeCurrency.decimals,
    },
    rpcUrls: {
      default: { http: [CREW_CONFIG.rpcUrl] },
    },
    blockExplorers: {
      default: { name: 'Explorer', url: fact.explorerBase },
    },
    testnet: fact.isTestnet,
  })
})()
