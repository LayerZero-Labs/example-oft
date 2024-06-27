import '@layerzerolabs/hardhat-collect-outcomes'
import * as path from 'path'

import { HardhatUserConfig } from 'hardhat/types'

import { ChainType, Stage } from '@layerzerolabs/lz-definitions'
import { ProviderConfig, SignerConfig, buildHardhatEtherScan, buildHardhatNetworks } from '@layerzerolabs/ops-utilities'

import '@nomiclabs/hardhat-ethers'
import '@nomicfoundation/hardhat-chai-matchers'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-web3'
import 'hardhat-deploy'
import 'hardhat-deploy-ethers'
import 'hardhat-gas-reporter'
import 'hardhat-contract-sizer'
// import 'hardhat-spdx-license-identifier'
import 'solidity-coverage'

import '@layerzerolabs/hardhat-deploy-mnemonic'

import '@typechain/hardhat'

const accountsConfig = require('@layerzerolabs/oft-runtime-config/keys.json') as SignerConfig
const providersConfig = require('@layerzerolabs/oft-runtime-config/rpc.json') as ProviderConfig

// FIXME(dev): change it if you want to copy the artifacts and deployments to a different directory
const sdkWorkSpace = path.resolve(__dirname, `../sdk`)

const DEFAULT_PROVIDER_URL = 'http://127.0.0.1:8545/'

const hardhatConfig: Partial<HardhatUserConfig> = {
    defaultNetwork: 'hardhat',
    mocha: {
        timeout: 50000,
    },
    solidity: {
        compilers: [
            {
                version: '0.8.20',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 20000,
                    },
                },
            },
        ],
    },
    // options for hardhat-spdx-license-identifier
    // spdxLicenseIdentifier: {
    //     overwrite: true,
    //     runOnCompile: true,
    // },
    // options for hardhat-gas-reporter
    gasReporter: {
        currency: 'USD',
        enabled: process.env.REPORT_GAS === 'true',
        excludeContracts: ['contracts/libraries/'],
    },
    // options for @typechain/hardhat
    typechain: {
        outDir: 'src/typechain-types',
        target: 'ethers-v5',
        alwaysGenerateOverloads: false,
        dontOverrideCompile: false,
    },
    paths: {
        // options for @layerzerolabs/hardhat-collect-outcomes
        collects: {
            // collect artifacts to the SDK directory
            artifacts: {
                target: path.join(sdkWorkSpace, 'artifacts'),
                patterns: ['contracts/!(mocks)/**/+([a-zA-Z0-9_]).json'],
            },
            // collect deployments to the SDK directory
            deployments: {
                target: path.join(sdkWorkSpace, 'deployments'),
                patterns: ['**/!(solcInputs)/*.json'],
            },
        },
    },
}

/**
 * @layerzerolabs/hardhat-deploy-mnemonic will convert mnemonics to accounts with private keys
 */
const hardhatMnemonics: Pick<HardhatUserConfig, 'mnemonics'> = {
    mnemonics: accountsConfig[(process.env.STAGE ?? Stage.SANDBOX) as keyof typeof accountsConfig]?.[ChainType.EVM],
}

const accounts = { mnemonic: 'test test test test test test test test test test test junk', count: 300 }

const hardhatNetworks: Pick<HardhatUserConfig, 'networks'> = {
    networks: {
        localhost: {
            url: DEFAULT_PROVIDER_URL,
            accounts,
        },
        hardhat: {
            accounts,
            blockGasLimit: 30_000_000,
            throwOnCallFailures: false,
        },
        // buildHardhatNetworks will build a NetworksUserConfig with [network] and [network-local] for the network of each EndpointId,
        // the url of [network] and [network-local] can be overridden by providerConfig
        ...buildHardhatNetworks(providersConfig),
    },
}

const hardhatEtherscan: Pick<HardhatUserConfig, 'etherscan'> = {
    etherscan: {
        // buildHardhatEtherScan will build an EtherscanConfig to declare how to get the apiKey from the environment variables
        // e.g., the apiKey of the ethereum mainnet will read from process.env.ETHERSCAN_API_KEY
        ...buildHardhatEtherScan(),
    },
}

const config: HardhatUserConfig = {
    ...hardhatConfig,
    ...hardhatNetworks,
    ...hardhatMnemonics,
    ...hardhatEtherscan,
}

export default config
