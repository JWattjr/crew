/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 *
 * The active chain is determined entirely by VITE_CREW_CHAIN (via crew-config).
 * Do not import arcTestnet or arc (mainnet) directly here — use CREW_CHAIN.
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { CREW_CHAIN, CREW_CONFIG } from './crew-config'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(CREW_CONFIG.chainId, CREW_CONFIG.rpcUrl)

export const config = createConfig({
  chains: [CREW_CHAIN, mainnet], // mainnet kept for ENS resolution only
  connectors: [injected()],
  transports: {
    [CREW_CHAIN.id]: http(CREW_CONFIG.rpcUrl),
    [mainnet.id]:    http(), // ENS resolution
  },
})
