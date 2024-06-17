import { Stage } from '@layerzerolabs/lz-definitions'

import { config as mainnetConfig } from './mainnet'
import { config as sandboxConfig } from './sandbox'
import { config as testnetConfig } from './testnet'
import { AppConfig } from './types'

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
