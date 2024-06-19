import {mnemonicToSeedSync} from "bip39";
import {derivePath} from "ed25519-hd-key";
import {Chain, Stage} from "@layerzerolabs/lz-definitions";
import {Keypair, PublicKey} from "@solana/web3.js";
import {readAccountsConfig} from "@layerzerolabs/ops-utilities";
import {AppConfig, OFT_TYPE, TokenInfo} from "@layerzerolabs/oft-runtime-config";
import {sha256} from "ethereumjs-util";
import {OftPDADeriver} from "@layerzerolabs/lz-solana-sdk-v2";
import {SolanaProvider as CoreSolanaProvider} from "@layerzerolabs/lz-corekit-solana";

const signersConfig = readAccountsConfig(require.resolve('@layerzerolabs/oft-runtime-config/keys.json'))


export function privateKeyFromDerivePath(mnemonic: string, path: string): Uint8Array {
    const normalizeMnemonic = mnemonic
        .trim()
        .split(/\s+/)
        .map((part) => part.toLowerCase())
        .join(' ')
    const seed = mnemonicToSeedSync(normalizeMnemonic)
    const { key } = derivePath(path, seed.toString('hex'))
    return new Uint8Array(key)
}

export function getKeyPair(walletKey: string, stage: Stage): Keypair | undefined {
    const walletKeyConfig = signersConfig[stage]?.[Chain.SOLANA]?.[walletKey]
    if (walletKeyConfig === undefined) {
        return undefined
    }
    const { mnemonic, path } = walletKeyConfig
    if (mnemonic === undefined) {
        return undefined
    }
    if (path === undefined) {
        return undefined
    }
    return Keypair.fromSeed(privateKeyFromDerivePath(mnemonic, path))
}

export function getOftTokenInfo(chain: Chain, tokenName: string, oftTokenConfig: AppConfig["token"]): TokenInfo {
    if (!tokenName) {
        throw new Error(`OFT_TOKEN env var is not set, available tokens are: ${Object.keys(oftTokenConfig).join(', ')}`)
    }
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

export function _mintKp(tokenName: string): Keypair {
    return Keypair.fromSeed(sha256(Buffer.from(tokenName, 'utf-8')))
}

export function _lockBoxKp(tokenName: string): Keypair {
    return Keypair.fromSeed(sha256(Buffer.from(`${tokenName}-lockbox`, 'utf-8')))
}

export function _oftConfigPda(tokenName: string, type: OFT_TYPE, oftProgramId: PublicKey): PublicKey {
    const oftDeriver = new OftPDADeriver(oftProgramId)
    if (type === 'OFT') {
        return oftDeriver.oftConfig(_mintKp(tokenName).publicKey)[0]
    } else {
        return oftDeriver.oftConfig(_lockBoxKp(tokenName).publicKey)[0]
    }
}

export function _deployKeyPair(wallet: string, stage: Stage): Keypair {
    const deployKP = getKeyPair(wallet, stage)
    if (deployKP === undefined) {
        throw new Error(`deployer keypair named ${wallet} not found for ${stage}`)
    }
    return deployKP

}

export async function _accountExists(provider: CoreSolanaProvider, account: PublicKey): Promise<boolean> {
    const info = await provider.nativeProvider.getAccountInfo(account)
    return info !== null
}