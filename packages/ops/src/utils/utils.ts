import {
    Chain,
    ChainType,
    Environment,
    Stage,
    chainAndStageToNetwork,
    getChainType,
} from '@layerzerolabs/lz-definitions'
import { pkgroot } from '@layerzerolabs/lz-utilities'
import {OFT_TYPE, getOftTokenInfo, TokenInfo} from '@layerzerolabs/oft-runtime-config'
import { OftSDKFactory, OftSdk } from '@layerzerolabs/oft-sdk'

import { LayerZeroDeploymentFetcher } from '../utils'

import { getOFTKey } from './keys'
import { getUrl } from './nodes'
import {_lockBoxKp, _mintKp} from "@layerzerolabs/oft-solana-ops/dist/src";

const EVM_OFT_PACKAGE = '@layerzerolabs/oft-evm-sdk'
const Solana_OFT_PACKAGE = '@layerzerolabs/oft-solana-sdk'

export async function getOFTSdk(
    chain: Chain,
    stage: Stage,
    env: Environment,
    oftAddress: string,
    oftType: OFT_TYPE,
    tokenMint?: string,
    tokenEscrow?: string
): Promise<OftSdk> {
    const network = chainAndStageToNetwork(chain, stage, env)
    const url = getUrl(chain, env)
    if (url === undefined) throw new Error(`Node url not found for chain: ${chain} and env: ${env}`)
    const key = getOFTKey(network)
    const sdk = await OftSDKFactory.getSdk(network, url, {
        address: oftAddress,
        type: oftType,
        mintAddress: tokenMint,
        escrowAddress: tokenEscrow,
    })
    return sdk.connect(key)
}

function getDeployName(tokenInfo: TokenInfo): string {
    return `${tokenInfo.name}${tokenInfo.type}`
}

export async function forceFindOFTAddress(
    chain: Chain,
    stage: Stage,
    env: Environment,
    oftName: string
): Promise<{ address: string; tokenMint?: string; tokenEscrow?: string }> {
    const network = chainAndStageToNetwork(chain, stage, env)
    const chainType = getChainType(chain)
    const tokenInfo = getOftTokenInfo(oftName, chain, stage)
    if (chainType === ChainType.EVM) {
        const evmDeploymentWorkspace = pkgroot(EVM_OFT_PACKAGE, __filename)
        const dpFetcher = new LayerZeroDeploymentFetcher(evmDeploymentWorkspace)
        const deployments = await dpFetcher.getDeployments([network])

        const deployment = deployments.find((x) => {
            return x.name === getDeployName(tokenInfo) && x.network === network
        })
        if (!deployment) throw new Error(`Deployment not found.`)
        return { address: deployment.address }
    } else if (chainType === ChainType.SOLANA) {
        const deploymentWorkspace = pkgroot(Solana_OFT_PACKAGE, __filename)
        const dpFetcher = new LayerZeroDeploymentFetcher(deploymentWorkspace)
        const deployments = await dpFetcher.getDeployments([network])
        const deployment = deployments.find((x) => {
            return x.name === 'oft' && x.network === network
        })
        if (!deployment) throw new Error(`Deployment not found.`)
        return {
            address: deployment.address,
            tokenMint: _mintKp(tokenInfo.name).publicKey.toBase58(),
            tokenEscrow: tokenInfo.type === 'OFTAdapter' ? _lockBoxKp(tokenInfo.name).publicKey.toBase58() : undefined
        }
    }
    throw new Error('Not supported chain')
}
