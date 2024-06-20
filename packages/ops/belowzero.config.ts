import '@layerzerolabs/ops-plugin-core'

import { ChainType } from '@layerzerolabs/lz-definitions'
import { pkgroot } from '@layerzerolabs/lz-utilities'
import {getAllAppConfigs, getAppConfig} from '@layerzerolabs/oft-runtime-config'
import { OFTWireable } from '@layerzerolabs/oft-solana-ops'
import { OpsUserConfig } from '@layerzerolabs/ops-core'
import {
    LayerZeroConfigManager,
    LayerZeroProviderManager,
    LayerZeroSignerManager,
    SolanaBundle,
    SolanaDeployable,
    buildBundle,
    readAccountsConfig,
    readNodeUrls,
} from '@layerzerolabs/ops-utilities'

const v2Config = getAllAppConfigs()
const nodeUrls = readNodeUrls(require.resolve('@layerzerolabs/oft-runtime-config/rpc.json'))
const keys = readAccountsConfig(require.resolve('@layerzerolabs/oft-runtime-config/keys.json'))

const accounts = keys

const providerManager = new LayerZeroProviderManager(nodeUrls)
const signerManager = new LayerZeroSignerManager(accounts, providerManager)

const solanaSdkRoot = pkgroot('@layerzerolabs/lz-solana-sdk-v2')
const v2SolanaBundles: SolanaBundle[] = new Array<SolanaBundle>(
    {
        tags: ['solana-sdk'],
        alias: 'solana-sdk',
        name: 'solana-sdk',
        path: solanaSdkRoot,
        deploymentPackage: solanaSdkRoot,
        deployer: new SolanaDeployable(solanaSdkRoot, solanaSdkRoot, ['sdk']),
        skipDeploy: true,
        skipConfig: true,
    },
    {
        name: 'factory',
        tags: ['oft'],
        path: pkgroot('@layerzerolabs/oft-solana-ops'),
        deploymentPackage: pkgroot('@layerzerolabs/oft-solana-sdk'),
        skipConfig: true,
        deployer: new SolanaDeployable(pkgroot('@layerzerolabs/oft-solana-ops'), pkgroot('@layerzerolabs/oft-solana-sdk'), ['oft']),
    },
    {
        name: 'oft',
        tags: ['oft'],
        path: pkgroot('@layerzerolabs/oft-solana-ops'),
        deploymentPackage: pkgroot('@layerzerolabs/oft-solana-sdk'),
        configurator: new OFTWireable(
            new LayerZeroConfigManager(v2Config),
            providerManager,
            signerManager,
            process.env.OFT_TOKEN ?? ''
        ),
        requirements: ['solana-sdk'],
        skipDeploy: true,
    }
).map((config: SolanaBundle) => {
    config.tags = ['v2', ...config.tags]
    config.chainTypes = [ChainType.SOLANA]
    return config
})

const config: OpsUserConfig = {
    bundles: [...v2SolanaBundles].map((x) => buildBundle(x)),
    extenders: [pkgroot('@layerzerolabs/ops-plugin-clear'), pkgroot('@layerzerolabs/ops-plugin-localnet')],
}

export default config
