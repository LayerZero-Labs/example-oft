import { Chain, EndpointId } from '@layerzerolabs/lz-definitions'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import { SOLANA_DVN_ADDRESS } from '@layerzerolabs/ops-definitions-layerzero'

import { DEFAULT_DVN, SEND, SEND_AND_CALL, AppConfig } from './types'

const DEFAULT_PEERS: AppConfig['peer']['default'] = {
    default: '', // inferred type
}

export const config: AppConfig = {
    token: {
        TokenOne: {
            decimal: 8,
            types: {
                [Chain.ETHEREUM]: 'OFT',
                [Chain.ARBSEP]: 'OFTAdapter',
                [Chain.BSC]: 'OFTAdapter',
                [Chain.METIS]: 'OFTAdapter',
                [Chain.POLYGON]: 'OFT',
                default: 'OFT',
            },
            address: {
                // OFTAdapter token address, will create a new one token if not provided
                // [Chain.ETHEREUM]: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            },
        },
        TokenTwo: {
            decimal: 8,
            types: {
                [Chain.ETHEREUM]: 'OFT',
                [Chain.BSC]: 'OFT',
                [Chain.POLYGON]: 'OFTAdapter',
                [Chain.SOLANA]: 'OFTAdapter',
                default: 'OFT',
            },
            address: {
                // OFTAdapter token address, will create a new one token if not provided
                // [Chain.SOLANA]: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // OFTAdapter token address
            },
        }
    },
    peer: {
        default: DEFAULT_PEERS,
    },
    enforceOptions: {
        default: {
            [EndpointId.SOLANA_V2_SANDBOX]: {
                [SEND]: Options.newOptions().addExecutorLzReceiveOption(200_000, 2500000).toHex(),
                [SEND_AND_CALL]: Options.newOptions().addExecutorLzReceiveOption(200_000, 2500000).toHex(),
            },
            default: {
                [SEND]: Options.newOptions().addExecutorLzReceiveOption(200_000, 0).toHex(),
                [SEND_AND_CALL]: Options.newOptions().addExecutorLzReceiveOption(200_000, 0).toHex(),
            },
        },
    },
    verifier: {
        sendUln: {
            confirmations: { default: { default: 6 } },
            requiredDVNs: {
                [Chain.SOLANA]: { default: [SOLANA_DVN_ADDRESS] },
                default: DEFAULT_DVN,
            },
            optionalDVNs: { default: { default: [] } },
            optionalDVNsThreshold: { default: { default: 0 } },
        },
        receiveUln: {
            confirmations: { default: { default: 6 } },
            requiredDVNs: {
                [Chain.SOLANA]: { default: [SOLANA_DVN_ADDRESS] },
                default: DEFAULT_DVN,
            },
            optionalDVNs: { default: { default: [] } },
            optionalDVNsThreshold: { default: { default: 0 } },
        },
    },
}
