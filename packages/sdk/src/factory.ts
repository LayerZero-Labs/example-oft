import '@layerzerolabs/ops-plugin-core'
import { Network, isEvmChain, isSolanaChain, networkToChain } from '@layerzerolabs/lz-definitions'
import { OFT_TYPE } from '@layerzerolabs/oft-runtime-config'

import { OftSdk } from './model'
import { OftSdkSolana } from './solana'
import { OftSdkEvm } from './evm'

export class OftSDKFactory {
    static async getSdk(
        network: Network,
        rpc: string,
        tokenInfo: { address: string; type: OFT_TYPE; mintAddress?: string; escrowAddress?: string }
    ): Promise<OftSdk> {
        const chain = networkToChain(network)
        const isEvm = isEvmChain(chain)
        if (isEvm) {
            return OftSdkEvm.create(rpc, tokenInfo.address, tokenInfo.type)
        }
        const isSolana = isSolanaChain(chain)
        if (isSolana) {
            const { mintAddress } = tokenInfo
            if (mintAddress === undefined) {
                throw new Error('mintAddress is required for Solana chain')
            }
            if (tokenInfo.type === 'OFTAdapter' && tokenInfo.escrowAddress === undefined) {
                throw new Error('escrowAddress is required for Solana chain')
            }
            return OftSdkSolana.create(rpc, tokenInfo.address, mintAddress, tokenInfo.escrowAddress)
        }

        throw new Error('Not supported chain')
    }
}
