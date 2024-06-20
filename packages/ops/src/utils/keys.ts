/* eslint-disable @typescript-eslint/strict-boolean-expressions */

import { ChainType, getChainType, networkToChain, networkToStage } from '@layerzerolabs/lz-definitions'
import {readAccountsConfig} from "@layerzerolabs/ops-utilities";

interface Key {
    mnemonic: string
    path?: string
}

const OFT_KEY_NAME = 'deployer'
const signersConfig = readAccountsConfig(require.resolve('@layerzerolabs/oft-runtime-config/keys.json'))

export function getOFTKey(network: string): Key {
    const stage = networkToStage(network)
    const chain = networkToChain(network)
    switch (getChainType(chain)) {
        case ChainType.EVM: {
            const key = signersConfig[stage]?.[ChainType.EVM]?.[OFT_KEY_NAME]
            if (key === undefined || !key.mnemonic) {
                throw new Error(
                    `No mnemonic for stage ${stage} and chainType ${ChainType.EVM} and name ${OFT_KEY_NAME}`
                )
            }
            return {
                mnemonic: key.mnemonic,
                path: key.path,
            }
        }
        case ChainType.SOLANA: {
            const key = signersConfig[stage]?.[ChainType.SOLANA]?.[OFT_KEY_NAME]
            if (key === undefined || !key.mnemonic) {
                throw new Error(
                    `No mnemonic for stage ${stage} and chainType ${ChainType.SOLANA} and name ${OFT_KEY_NAME}`
                )
            }
            return {
                mnemonic: key.mnemonic,
                path: key.path,
            }
        }
        default: {
            throw new Error(`Unsupported chain type ${chain}`)
        }
    }
}
