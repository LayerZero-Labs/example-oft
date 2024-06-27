import '@layerzerolabs/ops-plugin-core'

import {PublicKey, SystemProgram, TransactionInstruction} from '@solana/web3.js'
import BN from 'bn.js'


import {
    SolanaProvider as CoreSolanaProvider,
} from '@layerzerolabs/lz-corekit-solana'
import {
    EndpointId,
    Environment,
    Network,
    endpointIdToChain,
    endpointIdToNetwork,
    isEvmChain,
    isSolanaChain,
    networkToChain,
    networkToStage, endpointIdToStage, Chain,
} from '@layerzerolabs/lz-definitions'
import {
    DVNDeriver,
    EndpointProgram,
    ExecutorPDADeriver,
    OftPDADeriver,
    OftProgram,
    OftTools,
    PEER_SEED,
    SetConfigType,
    UlnProgram,
} from '@layerzerolabs/lz-solana-sdk-v2'
import {bytesToHex, findDeployment} from '@layerzerolabs/lz-utilities'
import { trim0x } from '@layerzerolabs/lz-v2-utilities'
import {OFT_TYPE, SEND, SEND_AND_CALL, getOftTokenInfo} from '@layerzerolabs/oft-runtime-config'
import {Deployment} from '@layerzerolabs/ops-core'
import {
    ConfigureManager,
    ProviderManager,
    SignerManager,
    TransactionData,
    configValueToAddressBytes32,
    configValueToAddresses,
    getConfigFunc,
} from '@layerzerolabs/ops-utilities'

import {
    findProgram,
    getDeployName,
    _oftConfigPda,
    _mintKp,
    _lockBoxKp,
    _deployKeyPair,
    _accountExists
} from './util'
import {createInitializeMintInstruction, getMintLen, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {BaseOFTWireable, oftWallet} from "./base-oft-wireable"

const EVM_PACKAGE_NAME = '@layerzerolabs/oft-evm-sdk'
const SOLANA_PACKAGE_NAME = '@layerzerolabs/oft-solana-sdk'

export class OFTWireable extends BaseOFTWireable {
    constructor(
        protected configManager: ConfigureManager,
        protected providerManager: ProviderManager,
        protected signerManager: SignerManager,
        protected tokenName: string
    ) {
        super(configManager, providerManager, signerManager, tokenName)
    }

    async buildTransactionDatas(
        local: EndpointId,
        remotes: EndpointId[],
        deployments: Deployment[],
        network: Network,
        env: Environment,
        provider: CoreSolanaProvider
    ): Promise<TransactionData[]> {
        if (!this.tokenName) {
            throw new Error(`tokenName not set`)
        }
        const getConfig = this.configManager.get.bind(this.configManager, networkToStage(network)) as getConfigFunc
        const endpoint = new EndpointProgram.Endpoint(findProgram('endpoint', deployments, network))
        const uln = new UlnProgram.Uln(findProgram('uln', deployments, network))

        const candidates: Promise<TransactionData[]>[] = [
            ...remotes.flatMap((remote) => [
                initOFT(provider, this.tokenName, deployments, getConfig, env, local, remote),
                setPeers(provider, this.tokenName, deployments, getConfig, env, local, remote),
                initSendLibrary(provider, this.tokenName, deployments, getConfig, endpoint, remote),
                initReceiveLibrary(provider, this.tokenName, deployments, getConfig, endpoint, remote),
                initOappNonce(
                    provider,
                    endpoint,
                    this.tokenName,
                    deployments,
                    getConfig,
                    env,
                    local,
                    remote
                ),
                setEnforceOptions(provider, this.tokenName, deployments, local, remote, getConfig),
                initUlnConfig(provider, this.tokenName, deployments, getConfig, endpoint, uln, remote),
                setUlnConfig(provider, this.tokenName, getConfig, endpoint, uln, deployments, env, local, remote, true),
                setUlnConfig(provider, this.tokenName, getConfig, endpoint, uln, deployments, env, local, remote, false),
                setOappExecutor(provider, endpoint, uln, this.tokenName, getConfig, deployments, env, local, remote),
            ]),
        ]
        return (await Promise.all(candidates)).flat()
    }
}

async function initOFT(
    provider: CoreSolanaProvider,
    tokenName: string,
    deployments: Deployment[],
    getConfig: getConfigFunc,
    env: Environment,
    local: EndpointId,
    remote: EndpointId
): Promise<TransactionData[]> {
    const stage = endpointIdToStage(local)
    const chain = endpointIdToChain(local)
    const deployKP = _deployKeyPair(oftWallet, stage)
    const oftProgramId = new PublicKey(findDeployment(deployments, 'oft', { chain })?.address as string)
    const type = getConfig('token', tokenName, 'types', [chain, 'default']) as OFT_TYPE
    const decimal = getConfig('token', tokenName, 'decimal') as number
    let ixs: TransactionInstruction[] = []
    const oftConfigPda: PublicKey = _oftConfigPda(tokenName, type, oftProgramId)
    const mintKp = _mintKp(tokenName)
    let mintPK: PublicKey = mintKp.publicKey
    const mintExists = await _accountExists(provider, mintPK)
    const oftConfigExists = await _accountExists(provider, oftConfigPda)
    if (type === 'OFT') {
        // step 1, create the mint token
        const createMintIxs = mintExists ? [] : [
            SystemProgram.createAccount({
                fromPubkey: deployKP.publicKey,
                newAccountPubkey: mintPK,
                space: getMintLen([]),
                lamports: await provider.nativeProvider.getMinimumBalanceForRentExemption(getMintLen([])),
                programId: TOKEN_PROGRAM_ID,
            }),
            createInitializeMintInstruction(mintPK, decimal, oftConfigPda, oftConfigPda, TOKEN_PROGRAM_ID),
        ]

        // step 2, create the OFT config
        const initOftIx = await OftTools.createInitNativeOftIx(
            deployKP.publicKey,
            deployKP.publicKey,
            mintPK,
            deployKP.publicKey,
            6,
            TOKEN_PROGRAM_ID,
            oftProgramId
        )
        ixs = oftConfigExists ? createMintIxs : [...createMintIxs, initOftIx]
    } else {
        // deploy Adapter OFT
        const lockBox = _lockBoxKp(tokenName)

        const address = getConfig('token', tokenName, 'address', local)
        if (address !== undefined) {
            mintPK = new PublicKey(address)
        } else {
            // step 1, create the mint token
            const createMintIxs = [
                SystemProgram.createAccount({
                    fromPubkey: deployKP.publicKey,
                    newAccountPubkey: mintPK,
                    space: getMintLen([]),
                    lamports: await provider.nativeProvider.getMinimumBalanceForRentExemption(getMintLen([])),
                    programId: TOKEN_PROGRAM_ID,
                }),
                createInitializeMintInstruction(
                    mintPK,
                    decimal,
                    deployKP.publicKey,
                    deployKP.publicKey,
                ),
            ]
            ixs = mintExists ? [] : createMintIxs
        }
        const ix = await OftTools.createInitAdapterOftIx(
            deployKP.publicKey,
            deployKP.publicKey,
            mintPK,
            lockBox.publicKey,
        6,
            TOKEN_PROGRAM_ID,
            oftProgramId
        )
        ixs = oftConfigExists? ixs : ixs.concat(ix)
    }
    return ixs.map((ix, index) => [true, false, `initOFT${index}`, ix, remote, oftWallet, {}] as TransactionData)
}

async function setPeers(
    provider: CoreSolanaProvider,
    tokenName: string,
    deployments: Deployment[],
    getConfig: getConfigFunc,
    env: Environment,
    local: EndpointId,
    remote: EndpointId
): Promise<TransactionData[]> {
    const method = 'setPeer'
    const stage = endpointIdToStage(local)
    const deployKP = _deployKeyPair(oftWallet, stage)
    const remoteNetwork = endpointIdToNetwork(remote, env)
    const remoteChain = networkToChain(remoteNetwork)
    let configValue = getConfig('peer', [local, 'default'], [remote, 'default']) as string
    const chain = endpointIdToChain(local)
    const type = getConfig('token', tokenName, 'types', [chain, 'default']) as OFT_TYPE
    const oftProgramId = new PublicKey(findDeployment(deployments, 'oft', { chain })?.address as string)
    const oftConfigPda = _oftConfigPda(tokenName, type, oftProgramId)
    if (configValue === '') {
        const remoteTokenInfo = getOftTokenInfo(tokenName, remoteChain, stage)
        if (isEvmChain(remoteChain)) {
            configValue = `${EVM_PACKAGE_NAME}|${getDeployName(remoteTokenInfo)}`
        } else if (isSolanaChain(remoteChain)) {
            console.log(`Unsupported remote chain: ${remoteChain}, not support self rollback for now`)
            return []
        } else {
            console.log(`Unsupported remote chain: ${remoteChain}`)
            return []
        }
    }
    const expected = configValueToAddressBytes32(remoteNetwork, configValue, deployments)
    const ix = await OftTools.createSetPeerIx(
        deployKP.publicKey,
        oftConfigPda,
        remote,
        Array.from(expected),
        oftProgramId
    )

    let current = ''
    try {
        // seeds = [PEER_SEED, &oft_config.key().to_bytes(), &params.dst_eid.to_be_bytes()],
        const peer = dstPeerPDA(oftConfigPda, remote, oftProgramId)
        const info = await OftProgram.accounts.Peer.fromAccountAddress(provider.nativeProvider, peer, {
            commitment: 'confirmed',
        })
        current = Buffer.from(info.address).toString('hex')
    } catch (e) {
        /*remote not init*/
    }

    const txn: TransactionData = [bytesToHex(expected), current, method, ix, remote, oftWallet, {}]
    return [txn]
}

async function initSendLibrary(
    provider: CoreSolanaProvider,
    tokenName: string,
    deployments: Deployment[],
    getConfig: getConfigFunc,
    endpoint: EndpointProgram.Endpoint,
    remote: EndpointId
): Promise<TransactionData[]> {
    const method = 'initSendLibrary'
    const stage = endpointIdToStage(remote)
    const deployKP = _deployKeyPair(oftWallet, stage)
    const type = getConfig('token', tokenName, 'types', [Chain.SOLANA, 'default']) as OFT_TYPE
    const oftProgramId = new PublicKey(findDeployment(deployments, 'oft', { chain: Chain.SOLANA })?.address as string)
    const oftConfigPda = _oftConfigPda(tokenName, type, oftProgramId)
    const ix = await endpoint.initSendLibrary(
        provider.nativeProvider,
        deployKP.publicKey,
        oftConfigPda,
        remote
    )
    if (ix == null) {
        return []
    }
    const txn: TransactionData = [true, false, method, ix, remote, oftWallet, {}]
    return [txn]
}

async function initReceiveLibrary(
    provider: CoreSolanaProvider,
    tokenName: string,
    deployments: Deployment[],
    getConfig: getConfigFunc,
    endpoint: EndpointProgram.Endpoint,
    remote: EndpointId
): Promise<TransactionData[]> {
    const method = 'initReceiveLibrary'
    const stage = endpointIdToStage(remote)
    const deployKP = _deployKeyPair(oftWallet, stage)
    const type = getConfig('token', tokenName, 'types', [Chain.SOLANA, 'default']) as OFT_TYPE
    const oftProgramId = new PublicKey(findDeployment(deployments, 'oft', { chain: Chain.SOLANA })?.address as string)
    const oftConfigPda = _oftConfigPda(tokenName, type, oftProgramId)
    const ix = await endpoint.initReceiveLibrary(
        provider.nativeProvider,
        deployKP.publicKey,
        oftConfigPda,
        remote
    )
    if (ix == null) {
        return []
    }
    const txn: TransactionData = [true, false, method, ix, remote, oftWallet, {}]
    return [txn]
}

async function initOappNonce(
    provider: CoreSolanaProvider,
    endpoint: EndpointProgram.Endpoint,
    tokenName: string,
    deployments: Deployment[],
    getConfig: getConfigFunc,
    env: Environment,
    local: EndpointId,
    remote: EndpointId
): Promise<TransactionData[]> {
    const remoteChain = endpointIdToChain(remote)
    const remoteNetwork = endpointIdToNetwork(remote, env)
    const method = 'initOappNonce'
    const stage = endpointIdToStage(local)
    const deployKP = _deployKeyPair(oftWallet, stage)
    const type = getConfig('token', tokenName, 'types', [Chain.SOLANA, 'default']) as OFT_TYPE
    const oftProgramId = new PublicKey(findDeployment(deployments, 'oft', { chain: Chain.SOLANA })?.address as string)
    const oftConfigPda = _oftConfigPda(tokenName, type, oftProgramId)
    let configValue = getConfig('peer', [local, 'default'], [remote, 'default']) as string

    if (configValue === '') {
        const remoteTokenInfo = getOftTokenInfo(tokenName, remoteChain, stage)
        if (isEvmChain(remoteChain)) {
            configValue = `${EVM_PACKAGE_NAME}|${getDeployName(remoteTokenInfo)}`
        } else if (isSolanaChain(remoteChain)) {
            console.log(`Unsupported remote chain: ${remoteChain}, not support self rollback for now`)
            return []
        } else {
            console.log(`Unsupported remote chain: ${remoteChain}`)
            return []
        }
    }
    console.log('configValue', configValue)
    const remoteAddress = configValueToAddressBytes32(remoteNetwork, configValue, deployments)

    const ix = await endpoint.initOAppNonce(
        provider.nativeProvider,
        deployKP.publicKey,
        remote,
        oftConfigPda,
        remoteAddress
    )
    if (ix === null) return []
    let current = false
    try {
        const nonce = await endpoint.getNonce(provider.nativeProvider, oftConfigPda, remote, remoteAddress)
        if (nonce) {
            current = true
        }
    } catch (e) {
        /*nonce not init*/
    }
    const expected = true
    const txn: TransactionData = [expected, current, method, ix, remote, oftWallet, {}]

    return [txn]
}

async function initUlnConfig(
    provider: CoreSolanaProvider,
    tokenName: string,
    deployments: Deployment[],
    getConfig: getConfigFunc,
    endpoint: EndpointProgram.Endpoint,
    uln: UlnProgram.Uln,
    remote: EndpointId
): Promise<TransactionData[]> {
    const method = 'initOappConfig'
    const stage = endpointIdToStage(remote)
    const deployKP = _deployKeyPair(oftWallet, stage)
    const type = getConfig('token', tokenName, 'types', [Chain.SOLANA, 'default']) as OFT_TYPE
    const oftProgramId = new PublicKey(findDeployment(deployments, 'oft', { chain: Chain.SOLANA })?.address as string)
    const oftConfigPda = _oftConfigPda(tokenName, type, oftProgramId)

    const current = await uln.getSendConfigState(provider.nativeProvider, oftConfigPda, remote)
    if (current) {
        return []
    }
    const ix = await endpoint.initOappConfig(
        deployKP.publicKey,
        uln,
        deployKP.publicKey,
        oftConfigPda,
        remote
    )
    const txn: TransactionData = [true, false, method, ix, undefined, oftWallet, {}]
    return [txn]
}

async function setEnforceOptions(
    provider: CoreSolanaProvider,
    tokenName: string,
    deployments: Deployment[],
    local: EndpointId,
    remote: EndpointId,
    getConfig: getConfigFunc
): Promise<TransactionData[]> {
    const stage = endpointIdToStage(remote)
    const deployKP = _deployKeyPair(oftWallet, stage)
    const type = getConfig('token', tokenName, 'types', [Chain.SOLANA, 'default']) as OFT_TYPE
    const oftProgramId = new PublicKey(findDeployment(deployments, 'oft', { chain: Chain.SOLANA })?.address as string)
    const oftConfigPda = _oftConfigPda(tokenName, type, oftProgramId)
    const deriver = new OftPDADeriver(oftProgramId)
    const [enforcedOpsPda] = deriver.enforcedOptions(oftConfigPda, remote)
    const enforcedOpsInfo = await provider.nativeProvider.getAccountInfo(enforcedOpsPda)
    const enforcedAccountState =
        enforcedOpsInfo !== null ? OftProgram.accounts.EnforcedOptions.fromAccountInfo(enforcedOpsInfo)[0] : undefined

    const expectedOptions: { send: string; sendAndCall: string } = {
        send: '',
        sendAndCall: '',
    }
    const currentOptions: { send: string; sendAndCall: string } = {
        send: '',
        sendAndCall: '',
    }
    const expectedSendOptions = trim0x(
        getConfig('enforceOptions', [local, 'default'], [remote, 'default'], SEND) as string
    )
    const currentSendOptions = enforcedAccountState
        ? trim0x(Buffer.from(enforcedAccountState.send).toString('hex'))
        : ''
    if (expectedSendOptions !== currentSendOptions) {
        expectedOptions.send = expectedSendOptions
        currentOptions.send = currentSendOptions
    }
    const expectedSendAndCallOptions = trim0x(
        getConfig('enforceOptions', [local, 'default'], [remote, 'default'], SEND_AND_CALL) as string
    )
    const currentSendAndCallOptions = enforcedAccountState
        ? trim0x(Buffer.from(enforcedAccountState.sendAndCall).toString('hex'))
        : ''
    if (expectedSendAndCallOptions !== currentSendAndCallOptions) {
        expectedOptions.sendAndCall = expectedSendAndCallOptions
        currentOptions.sendAndCall = currentSendAndCallOptions
    }
    if (Object.keys(expectedOptions).length === 0) {
        return []
    }

    const method = 'SetEnforcedOptions'
    const admin = deployKP.publicKey

    const ix = await OftTools.createSetEnforcedOptionsIx(
        admin,
        oftConfigPda,
        remote,
        Uint8Array.from(Buffer.from(expectedSendOptions, 'hex')),
        Uint8Array.from(Buffer.from(expectedSendAndCallOptions, 'hex')),
        oftProgramId
    )
    const txn: TransactionData = [expectedOptions, currentOptions, method, ix, remote, oftWallet, {}]

    return [txn]
}

async function setUlnConfig(
    provider: CoreSolanaProvider,
    tokenName: string,
    getConfig: getConfigFunc,
    endpoint: EndpointProgram.Endpoint,
    uln: UlnProgram.Uln,
    deployments: Deployment[],
    env: Environment,
    local: EndpointId,
    remote: EndpointId,
    isSend: boolean
): Promise<TransactionData[]> {
    const network = endpointIdToNetwork(local, env)
    const stage = endpointIdToStage(local)
    const deployKP = _deployKeyPair(oftWallet, stage)
    const type = getConfig('token', tokenName, 'types', [Chain.SOLANA, 'default']) as OFT_TYPE
    const oftProgramId = new PublicKey(findDeployment(deployments, 'oft', { chain: Chain.SOLANA })?.address as string)
    const oftConfigPda = _oftConfigPda(tokenName, type, oftProgramId)
    const method = 'SetConfig'

    let configName: string
    if (isSend) {
        configName = 'sendUln'
    } else {
        configName = 'receiveUln'
    }

    try {
        getConfig('verifier', configName)
    } catch (e) {
        throw new Error(`no verifier/uln config for ${local} -> ${remote}`)
    }

    const confirmations = getConfig(
        'verifier',
        configName,
        'confirmations',
        [local, endpointIdToChain(local), 'default'],
        [remote, endpointIdToChain(remote), 'default']
    ) as number

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
    ).map((program) => {
        return new DVNDeriver(new PublicKey(program)).config()[0]
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
    ).map((program) => {
        return new DVNDeriver(new PublicKey(program)).config()[0]
    })

    const optionalDVNThreshold = getConfig(
        'verifier',
        configName,
        'optionalDVNsThreshold',
        [local, endpointIdToChain(local), 'default'],
        [remote, endpointIdToChain(remote), 'default']
    ) as string | number

    const expected: UlnProgram.types.UlnConfig = {
        confirmations: confirmations,
        requiredDvnCount: requiredDVNs.length,
        optionalDvnCount: optionalDVNs.length,
        optionalDvnThreshold: parseInt(optionalDVNThreshold.toString()),
        requiredDvns: requiredDVNs,
        optionalDvns: optionalDVNs,
    }

    let currentConfig: UlnProgram.types.UlnConfig | undefined
    let configType: SetConfigType
    if (isSend) {
        configType = SetConfigType.SEND_ULN
        currentConfig = (await uln.getSendConfigState(provider.nativeProvider, oftConfigPda, remote))?.uln
    } else {
        configType = SetConfigType.RECEIVE_ULN
        currentConfig = (await uln.getReceiveConfigState(provider.nativeProvider, oftConfigPda, remote))?.uln
    }

    let current: UlnProgram.types.UlnConfig | undefined
    if (currentConfig) {
        current = {
            confirmations: parseInt(currentConfig.confirmations.toString()),
            requiredDvnCount: currentConfig.requiredDvns.length,
            optionalDvnCount: currentConfig.optionalDvns.length,
            optionalDvnThreshold: currentConfig.optionalDvnThreshold,
            requiredDvns: currentConfig.requiredDvns,
            optionalDvns: currentConfig.optionalDvns,
        }
    }

    const ix = await endpoint.setOappConfig(
        provider.nativeProvider,
        deployKP.publicKey,
        oftConfigPda,
        uln.program,
        remote,
        {
            configType,
            value: expected,
        }
    )

    const txn: TransactionData = [
        JSON.stringify(expected),
        JSON.stringify(current),
        method,
        ix,
        undefined,
        oftWallet,
        {},
    ]
    return [txn]
}

async function setOappExecutor(
    provider: CoreSolanaProvider,
    endpoint: EndpointProgram.Endpoint,
    uln: UlnProgram.Uln,
    tokenName: string,
    getConfig: getConfigFunc,
    deployments: Deployment[],
    env: Environment,
    local: EndpointId,
    remote: EndpointId
): Promise<TransactionData[]> {
    const network = endpointIdToNetwork(local, env)
    const method = 'SetConfig/executor'
    const stage = endpointIdToStage(local)
    const deployKP = _deployKeyPair(oftWallet, stage)
    const type = getConfig('token', tokenName, 'types', [Chain.SOLANA, 'default']) as OFT_TYPE
    const oftProgramId = new PublicKey(findDeployment(deployments, 'oft', { chain: Chain.SOLANA })?.address as string)
    const oftConfigPda = _oftConfigPda(tokenName, type, oftProgramId)

    const defaultOutboundMaxMessageSize = 10000
    const executorProgramId = findProgram('executor', deployments, network)
    const [executorPda] = new ExecutorPDADeriver(executorProgramId).config()
    const expected: UlnProgram.types.ExecutorConfig = {
        maxMessageSize: defaultOutboundMaxMessageSize, // TODO: get from config
        executor: executorPda, // TODO: get from config
    }

    const current = (await uln.getSendConfigState(provider.nativeProvider, oftConfigPda, remote))?.executor
    const ix = await endpoint.setOappConfig(
        provider.nativeProvider,
        deployKP.publicKey,
        oftConfigPda,
        uln.program,
        remote,
        {
            configType: SetConfigType.EXECUTOR,
            value: expected,
        }
    )
    const txn: TransactionData = [
        JSON.stringify(expected),
        JSON.stringify(current),
        method,
        ix,
        undefined,
        oftWallet,
        {},
    ]
    return [txn]
}

function dstPeerPDA(localOftConfigPDA: PublicKey, remoteId: EndpointId, oftProgramId: PublicKey): PublicKey {
    const [peer] = PublicKey.findProgramAddressSync(
        [
            Buffer.from(PEER_SEED, 'utf8'),
            Buffer.from(localOftConfigPDA.toBytes()),
            new BN(remoteId).toArrayLike(Buffer, 'be', 4),
        ],
        oftProgramId
    )
    return peer
}
