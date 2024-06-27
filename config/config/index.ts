import {Chain, Stage} from '@layerzerolabs/lz-definitions'

import { config as mainnetConfig } from './mainnet'
import { config as sandboxConfig } from './sandbox'
import { config as testnetConfig } from './testnet'
import {AppConfig, TokenInfo} from './types'

export * from './types'

export function getAppConfig(stage: Stage): AppConfig {
    switch (stage) {
        case Stage.SANDBOX:
            return sandboxConfig
        case Stage.TESTNET:
            return testnetConfig
        case Stage.MAINNET:
            return mainnetConfig
        default:
            throw new Error(`Invalid stage: ${stage}`)
    }
}

export function getAllAppConfigs(): { [stage in Stage]: AppConfig } {
    return {
        [Stage.MAINNET]: mainnetConfig,
        [Stage.TESTNET]: testnetConfig,
        [Stage.SANDBOX]: sandboxConfig,
    }
}

export function getOftTokenInfo(tokenName: string, chain: Chain, stage: Stage): TokenInfo {
    const oftTokenConfig = getAppConfig(stage).token
    const tokenInfo = oftTokenConfig[tokenName]
    if (!tokenInfo) {
        throw new Error(`Token ${tokenName} not found, please check deploy-config.ts`)
    }
    const tokenType = tokenInfo.types[chain] ?? tokenInfo.types.default
    if (!tokenType) {
        throw new Error(`Token ${tokenName} type not found for chain ${chain}`)
    }
    const token = tokenType === 'OFTAdapter' ? tokenInfo.address?.[chain] : undefined

    return {
        name: tokenName,
        type: tokenType,
        token,
    }
}

export function getDeployName(tokenInfo: TokenInfo): string {
    return `${tokenInfo.name}${tokenInfo.type}`
}


