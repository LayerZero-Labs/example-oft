export * from './oft-wireable'
export * from './util'

import { PublicKey } from '@solana/web3.js'

import { Network } from '@layerzerolabs/lz-definitions'
import { Deployment } from '@layerzerolabs/ops-core'

export function findProgram(
    name: 'endpoint' | 'uln' | 'executor',
    deployments: Deployment[],
    network: Network
): PublicKey {
    const endpointProgramId = deployments.find((x) => x.name === name && x.network === network)?.address
    if (endpointProgramId === undefined) {
        throw new Error('program not found, name: ' + name + ', network: ' + network)
    }
    return new PublicKey(endpointProgramId)
}
