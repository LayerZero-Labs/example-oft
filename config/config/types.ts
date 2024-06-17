import { EVM_VERIFIER_ADDRESS, EidChainOrDefault, EidOrDefault } from '@layerzerolabs/ops-definitions-layerzero'
import {Chain} from "@layerzerolabs/lz-definitions";

export const SEND = 1
export const SEND_AND_CALL = 2
export type SendType = typeof SEND | typeof SEND_AND_CALL

export type OFT_TYPE = 'OFT' | 'OFTAdapter'

export interface TokenInfo {
    name: string
    type: OFT_TYPE
    token?: string
}

export interface AppConfig {
    token: {
        [name in string]: {
            decimal: number
            types: { [chain in Chain | 'default']?: OFT_TYPE }
            address: { [chain in Chain]?: string }
        }
    }
    peer: { [eid in EidOrDefault<number>]?: { [eid in EidOrDefault<number>]?: string } }
    enforceOptions: {
        [eid in EidOrDefault<number>]?: {
            [eid in EidOrDefault<number>]?: { [type in SendType]: string }
        }
    }
    verifier?: {
        sendUln?: {
            confirmations: {
                [eid in EidChainOrDefault<number>]?: { [eid in EidChainOrDefault<number>]?: string | number }
            }
            requiredDVNs: { [eid in EidChainOrDefault<number>]?: { [eid in EidChainOrDefault<number>]?: string[] } }
            optionalDVNs: { [eid in EidChainOrDefault<number>]?: { [eid in EidChainOrDefault<number>]?: string[] } }
            optionalDVNsThreshold: {
                [eid in EidChainOrDefault<number>]?: { [eid in EidChainOrDefault<number>]?: string | number }
            }
        }
        receiveUln?: {
            confirmations: {
                [eid in EidChainOrDefault<number>]?: { [eid in EidChainOrDefault<number>]?: string | number }
            }
            requiredDVNs: { [eid in EidChainOrDefault<number>]?: { [eid in EidChainOrDefault<number>]?: string[] } }
            optionalDVNs: { [eid in EidChainOrDefault<number>]?: { [eid in EidChainOrDefault<number>]?: string[] } }
            optionalDVNsThreshold: {
                [eid in EidChainOrDefault<number>]?: { [eid in EidChainOrDefault<number>]?: string | number }
            }
        }
    }
}

export const DEFAULT_DVN = {
    default: [EVM_VERIFIER_ADDRESS],
}
