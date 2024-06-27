import { ethers } from 'ethers'
import _ from 'lodash'

import {
    EndpointId,
    Environment,
    Network,
    Stage,
    endpointIdToChain,
    endpointIdToNetwork,
    isEvmChain,
    isSolanaChain,
    networkToStage,
} from '@layerzerolabs/lz-definitions'
import { EndpointV2, EndpointV2__factory, OFTCore, UlnBase__factory } from '@layerzerolabs/lz-evm-sdk-v2'
import { SEND, SEND_AND_CALL, TokenInfo, getDeployName, getOftTokenInfo } from '@layerzerolabs/oft-runtime-config'
import '@layerzerolabs/ops-plugin-core'
import { ConfigurableOption, Deployment, Logger, Transaction, TransactionGroup } from '@layerzerolabs/ops-core'
import {
    ConfigureManager,
    LayerZeroEvmBaseConfigurable,
    ProviderManager,
    SignerManager,
    TransactionData,
    collectTransactionsEvmHelper,
    configValueToAddressBytes32,
    configValueToAddresses,
    getConfigFunc,
    isEqualBigNumberish,
} from '@layerzerolabs/ops-utilities'

import { OmniAdapterToken, OmniToken } from '@layerzerolabs/oft-evm-sdk'

const PACKAGE_NAME = '@layerzerolabs/oft-evm-sdk'
const SOLANA_PACKAGE_NAME = '@layerzerolabs/oft-solana-sdk'
const oftWallet = 'deployer'
const CONFIG_TYPE_ULN = 2

export default class OftConfigurable extends LayerZeroEvmBaseConfigurable {

    constructor(
        protected configManager: ConfigureManager,
        protected providerManager: ProviderManager,
        protected signerManager: SignerManager,
        protected tokenName: string
    ) {
        super(configManager, providerManager, signerManager)
        this.contracts = []
    }

    public async collectTransactions(
        local: EndpointId,
        remotes: EndpointId[],
        deployments: Deployment[],
        option: ConfigurableOption
    ): Promise<(Transaction | TransactionGroup)[]> {
        if (this.tokenName === '') {
            throw new Error('OFT_TOKEN env var is not set')
        }

        const callback = this.buildTransactionDatas.bind(this)
        const contracts: [string, string][] = []
        const chain = endpointIdToChain(local)
        const tokenInfo = getOftTokenInfo(this.tokenName,chain,option.stage)
        contracts.push([PACKAGE_NAME, getDeployName(tokenInfo)])

        return collectTransactionsEvmHelper(
            local,
            remotes,
            deployments,
            option,
            this.configManager,
            this.providerManager,
            this.signerManager,
            contracts,
            // @ts-expect-error
            callback
        )
    }

    async buildTransactionDatas(
        local: EndpointId,
        remotes: EndpointId[],
        deployments: Deployment[],
        network: Network,
        env: Environment,
        provider: ethers.providers.Provider,
        contract: OmniToken | OmniAdapterToken,
        packageName: string,
        contractName: string
    ): Promise<TransactionData[]> {
        const getConfig = this.configManager.get.bind(this.configManager, networkToStage(network))
        const { logger } = this
        const stage = networkToStage(network)

        const candidates: Promise<TransactionData[]>[] = [
            setPeer(contract, getConfig, logger, env, stage,local, remotes, deployments, this.tokenName),
            setEnforceOptions(contract, getConfig, local, remotes),
            setUlnConfig(contract, getConfig, logger, env, local, remotes, deployments, this.providerManager, true),
            setUlnConfig(contract, getConfig, logger, env, local, remotes, deployments, this.providerManager, false),
            // setSendLibrary(contract, getConfig, logger, env, local, remotes, deployments),
            // setReceiveLibrary(contract, getConfig, logger, env, local, remotes, deployments),
        ]
        return (await Promise.all(candidates)).flat()
    }
}

async function setPeer(
    contract: OFTCore,
    getConfig: getConfigFunc,
    logger: Logger,
    env: Environment,
    stage:Stage,
    local: EndpointId,
    remotes: EndpointId[],
    deployments: Deployment[],
    tokenName: string
): Promise<TransactionData[]> {
    const METHOD_NAME = 'setPeer'
    type ArgTypes = Parameters<OFTCore[typeof METHOD_NAME]>

    const txns: TransactionData[] = []
    for (const remote of remotes) {
        const remoteNetwork = endpointIdToNetwork(remote, env)
        const remoteChain = endpointIdToChain(remote)
        let configValue = getConfig('peer', [local, 'default'], [remote, 'default']) as string
        if (configValue === '') {
            const tokenInfo = getOftTokenInfo(tokenName,remoteChain,stage)
            if (isEvmChain(remoteChain)) {
                configValue = `${PACKAGE_NAME}|${getDeployName(tokenInfo)}`
            } else if (isSolanaChain(remoteChain)) {
                configValue = `${SOLANA_PACKAGE_NAME}|${getDeployName(tokenInfo)}`
            } else {
                throw new Error(`unsupported chain ${remoteChain}`)
            }
        }
        const expected: ArgTypes[1] = ethers.utils.hexlify(
            configValueToAddressBytes32(remoteNetwork, configValue, deployments)
        )
        const current = await contract.peers(remote)
        // remove old remote
        if (_.isEqualWith(expected, current, isEqualBigNumberish)) {
            continue
        }
        const method = contract.interface.getFunction(METHOD_NAME).name
        const args: ArgTypes = [remote, expected]
        const txn: TransactionData = [expected, current, method, args, remote, oftWallet, {}]
        txns.push(txn)
    }
    return txns
}

async function setEnforceOptions(
    contract: OFTCore,
    getConfig: getConfigFunc,
    local: EndpointId,
    remotes: EndpointId[]
): Promise<TransactionData[]> {
    const METHOD_NAME = 'setEnforcedOptions'
    type ArgTypes = Parameters<OFTCore[typeof METHOD_NAME]>

    const txns: TransactionData[] = []
    const enforceParams: { eid: number; msgType: number; options: string }[] = []
    const currentParams: { eid: number; msgType: number; options: string }[] = []
    for (const remote of remotes) {
        for (const msgType of [SEND, SEND_AND_CALL]) {
            const expectedOptions = getConfig(
                'enforceOptions',
                [local, 'default'],
                [remote, 'default'],
                msgType
            ) as string
            // get current enforced options
            const currentOptions = await contract.enforcedOptions(remote, msgType)
            if (expectedOptions !== currentOptions) {
                enforceParams.push({ eid: remote, msgType, options: expectedOptions })
                currentParams.push({ eid: remote, msgType, options: currentOptions })
            }
        }
    }
    if (enforceParams.length > 0) {
        const method = contract.interface.getFunction(METHOD_NAME).name
        const args: ArgTypes = [enforceParams]
        const txn: TransactionData = [enforceParams, currentParams, method, args, remotes, oftWallet, {}]
        txns.push(txn)
    }

    return txns
}

async function setUlnConfig(
    oft: OmniToken | OmniAdapterToken,
    getConfig: getConfigFunc,
    logger: Logger,
    env: Environment,
    local: EndpointId,
    remotes: EndpointId[],
    deployments: Deployment[],
    providerManager: ProviderManager,
    isSend: boolean
): Promise<TransactionData[]> {
    const METHOD_NAME = 'setConfig'
    type ArgTypes = Parameters<EndpointV2[typeof METHOD_NAME]>

    const txns: TransactionData[] = []
    const network = endpointIdToNetwork(local, env)
    const endpointAddress = await oft.endpoint()
    const provider = (
        await providerManager.getProvider(endpointIdToChain(local), env)
    ).getProvider() as ethers.providers.Provider
    const endpoint = EndpointV2__factory.connect(endpointAddress, provider)

    let configName: string
    if (isSend) {
        configName = 'sendUln'
    } else {
        configName = 'receiveUln'
    }

    for (const remote of remotes) {
        let cfg
        try {
            cfg = getConfig('verifier', configName)
        } catch (e) {
            // no uln1 config
        }
        if (!cfg) {
            logger.warn(`no verifier/uln config for ${local} -> ${remote}`)
            continue
        }

        const confirmations = ethers.BigNumber.from(
            getConfig(
                'verifier',
                configName,
                'confirmations',
                [local, endpointIdToChain(local), 'default'],
                [remote, endpointIdToChain(remote), 'default']
            ) as string | number
        )
        const requiredDVNs = configValueToAddresses(
            network,
            getConfig(
                'verifier',
                configName,
                'requiredDVNs',
                [local, endpointIdToChain(local), 'default'],
                [remote, endpointIdToChain(remote), 'default']
            ) as string[],
            deployments
        )
            .map((e) => ethers.utils.getAddress(e))
            .sort(function (a, b) {
                return a.toLowerCase().localeCompare(b.toLowerCase())
            })
        const optionalDVNs = configValueToAddresses(
            network,
            getConfig(
                'verifier',
                configName,
                'optionalDVNs',
                [local, endpointIdToChain(local), 'default'],
                [remote, endpointIdToChain(remote), 'default']
            ) as string[],
            deployments
        )
            .map((e) => ethers.utils.getAddress(e))
            .sort(function (a, b) {
                return a.toLowerCase().localeCompare(b.toLowerCase())
            })
        const optionalDVNThreshold = getConfig(
            'verifier',
            configName,
            'optionalDVNsThreshold',
            [local, endpointIdToChain(local), 'default'],
            [remote, endpointIdToChain(remote), 'default']
        ) as string | number

        const expected = {
            confirmations,
            optionalDVNs,
            requiredDVNs,
            requiredDVNCount: requiredDVNs.length,
            optionalDVNCount: optionalDVNs.length,
            optionalDVNThreshold,
        }

        let messageLib: string
        if (isSend) {
            messageLib = await endpoint.getSendLibrary(oft.address, remote)
        } else {
            messageLib = (await endpoint.getReceiveLibrary(oft.address, remote)).lib
        }

        const uln = UlnBase__factory.connect(messageLib, provider)
        const ulnConfig = await uln.getUlnConfig(oft.address, remote)
        const current = {
            confirmations: ulnConfig.confirmations,
            optionalDVNs: ulnConfig.optionalDVNs,
            requiredDVNs: ulnConfig.requiredDVNs,
            requiredDVNCount: ulnConfig.requiredDVNCount,
            optionalDVNCount: ulnConfig.optionalDVNCount,
            optionalDVNThreshold: ulnConfig.optionalDVNThreshold,
        }

        const ulnConfigEncoded = ethers.utils.defaultAbiCoder.encode(
            [
                {
                    type: 'tuple',
                    name: 'ulnConfig',
                    components: [
                        { name: 'confirmations', type: 'uint64' },
                        { name: 'requiredDVNCount', type: 'uint8' },
                        { name: 'optionalDVNCount', type: 'uint8' },
                        { name: 'optionalDVNThreshold', type: 'uint8' },
                        { name: 'requiredDVNs', type: 'address[]' },
                        { name: 'optionalDVNs', type: 'address[]' },
                    ],
                },
            ] as any,
            [expected]
        )

        const method = oft.interface.getFunction(METHOD_NAME).name
        const args: ArgTypes = [
            oft.address,
            messageLib,
            [{ eid: remote, configType: CONFIG_TYPE_ULN, config: ulnConfigEncoded }],
        ]
        const txn: TransactionData = [expected, current, method, args, remote, 'deployer', {}]
        logger.debug(txn)
        txns.push(txn)
    }

    return txns
}


// async function setSendLibrary(
//     contract: ethers.Contract,
//     getConfig: getConfigFunc,
//     logger: Logger,
//     env: Environment,
//     local: EndpointId,
//     remotes: EndpointId[],
//     deployments: Deployment[]
// ): Promise<TransactionData[]> {
//     const METHOD_NAME = 'setSendLibrary'
//     type ArgTypes = Parameters<contracts.OmniCounter[typeof METHOD_NAME]>
//     const localNetwork = endpointIdToNetwork(local, env)
//     const txns: TransactionData[] = []
//     for (const remote of remotes) {
//         const configValue = getConfig('sendLibrary', [local, 'default'], [remote, 'default']) as string
//         const expected: ArgTypes[1] = configValueToAddress(localNetwork, configValue, deployments)
//         const method = contract.interface.getFunction(METHOD_NAME).name
//         const current = await contract.getSendLibrary(remote)
//         const args: ArgTypes = [remote, expected]
//         const txn: TransactionData = [expected, current, method, args, remote, 'deployer', {}]
//         logger.debug(txn)
//         txns.push(txn)
//     }
//     return txns
// }
//
// async function setReceiveLibrary(
//     contract: ethers.Contract,
//     getConfig: getConfigFunc,
//     logger: Logger,
//     env: Environment,
//     local: EndpointId,
//     remotes: EndpointId[],
//     deployments: Deployment[]
// ): Promise<TransactionData[]> {
//     const METHOD_NAME = 'setReceiveLibrary'
//     type ArgTypes = Parameters<contracts.OmniCounter[typeof METHOD_NAME]>
//     const localNetwork = endpointIdToNetwork(local, env)
//     const txns: TransactionData[] = []
//     for (const remote of remotes) {
//         const configValue = getConfig('receiveLibrary', [local, 'default'], [remote, 'default']) as string
//         const expected: ArgTypes[1] = configValueToAddress(localNetwork, configValue, deployments)
//         const method = contract.interface.getFunction(METHOD_NAME).name
//         const current = await contract.getReceiveLibrary(remote)
//         const args: ArgTypes = [remote, expected]
//         const txn: TransactionData = [expected, current, method, args, remote, 'deployer', {}]
//         logger.debug(txn)
//         txns.push(txn)
//     }
//     return txns
// }
//
// async function setUlnConfig(
//     counter: ethers.Contract,
//     getConfig: getConfigFunc,
//     logger: Logger,
//     env: Environment,
//     local: EndpointId,
//     remotes: EndpointId[],
//     deployments: Deployment[],
//     providerManager: ProviderManager,
//     isSend: boolean
// ): Promise<TransactionData[]> {
//     const METHOD_NAME = 'setConfig'
//     type ArgTypes = Parameters<EndpointV2[typeof METHOD_NAME]>
//
//     const txns: TransactionData[] = []
//     const network = endpointIdToNetwork(local, env)
//     const endpointAddress = await counter.endpoint()
//     const provider = (
//         await providerManager.getProvider(endpointIdToChain(local), env)
//     ).getProvider() as ethers.providers.Provider
//     const endpoint = EndpointV2__factory.connect(endpointAddress, provider)
//
//     let configName: string
//     if (isSend) {
//         configName = 'sendUln'
//     } else {
//         configName = 'receiveUln'
//     }
//
//     for (const remote of remotes) {
//         const remoteChainType = endpointIdToChainType(remote)
//         if (remoteChainType === ChainType.SOLANA) {
//             // TODO: remove this check when solana is supported
//             continue
//         }
//         let cfg
//         try {
//             cfg = getConfig('verifier', configName)
//         } catch (e) {
//             // no uln1 config
//         }
//         if (!cfg) {
//             logger.warn(`no verifier/uln config for ${local} -> ${remote}`)
//             continue
//         }
//
//         const confirmations = ethers.BigNumber.from(
//             getConfig(
//                 'verifier',
//                 configName,
//                 'confirmations',
//                 [local, endpointIdToChain(local), 'default'],
//                 [remote, endpointIdToChain(remote), 'default']
//             ) as string | number
//         )
//         const requiredDVNs = configValueToAddresses(
//             network,
//             getConfig(
//                 'verifier',
//                 configName,
//                 'requiredDVNs',
//                 [local, endpointIdToChain(local), 'default'],
//                 [remote, endpointIdToChain(remote), 'default']
//             ) as string[],
//             deployments
//         )
//             .map((e) => ethers.utils.getAddress(e))
//             .sort(function (a, b) {
//                 return a.toLowerCase().localeCompare(b.toLowerCase())
//             })
//         const optionalDVNs = configValueToAddresses(
//             network,
//             getConfig(
//                 'verifier',
//                 configName,
//                 'optionalDVNs',
//                 [local, endpointIdToChain(local), 'default'],
//                 [remote, endpointIdToChain(remote), 'default']
//             ) as string[],
//             deployments
//         )
//             .map((e) => ethers.utils.getAddress(e))
//             .sort(function (a, b) {
//                 return a.toLowerCase().localeCompare(b.toLowerCase())
//             })
//         const optionalDVNThreshold = getConfig(
//             'verifier',
//             configName,
//             'optionalDVNsThreshold',
//             [local, endpointIdToChain(local), 'default'],
//             [remote, endpointIdToChain(remote), 'default']
//         ) as string | number
//
//         const expected = {
//             confirmations,
//             optionalDVNs,
//             requiredDVNs,
//             requiredDVNCount: requiredDVNs.length,
//             optionalDVNCount: optionalDVNs.length,
//             optionalDVNThreshold,
//         }
//
//         let messageLib: string
//         if (isSend) {
//             messageLib = await endpoint.getSendLibrary(counter.address, remote)
//         } else {
//             messageLib = (await endpoint.getReceiveLibrary(counter.address, remote)).lib
//         }
//
//         const uln = UlnBase__factory.connect(messageLib, provider)
//         const ulnConfig = await uln.getUlnConfig(counter.address, remote)
//         const current = {
//             confirmations: ulnConfig.confirmations,
//             optionalDVNs: ulnConfig.optionalDVNs,
//             requiredDVNs: ulnConfig.requiredDVNs,
//             requiredDVNCount: ulnConfig.requiredDVNCount,
//             optionalDVNCount: ulnConfig.optionalDVNCount,
//             optionalDVNThreshold: ulnConfig.optionalDVNThreshold,
//         }
//
//         const ulnConfigEncoded = ethers.utils.defaultAbiCoder.encode(
//             [
//                 {
//                     type: 'tuple',
//                     name: 'ulnConfig',
//                     components: [
//                         { name: 'confirmations', type: 'uint64' },
//                         { name: 'requiredDVNCount', type: 'uint8' },
//                         { name: 'optionalDVNCount', type: 'uint8' },
//                         { name: 'optionalDVNThreshold', type: 'uint8' },
//                         { name: 'requiredDVNs', type: 'address[]' },
//                         { name: 'optionalDVNs', type: 'address[]' },
//                     ],
//                 },
//             ] as any,
//             [expected]
//         )
//
//         const method = counter.interface.getFunction(METHOD_NAME).name
//         const args: ArgTypes = [
//             counter.address,
//             messageLib,
//             [{ eid: remote, configType: CONFIG_TYPE_ULN, config: ulnConfigEncoded }],
//         ]
//         const txn: TransactionData = [expected, current, method, args, remote, 'deployer', {}]
//         logger.debug(txn)
//         txns.push(txn)
//     }
//
//     return txns
// }
