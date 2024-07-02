import * as commander from 'commander'

import {
    Chain,
    Environment,
    Stage,
    chainAndStageToNetwork
} from '@layerzerolabs/lz-definitions'
import {getOftTokenInfo} from '@layerzerolabs/oft-runtime-config'

import * as options from '../../options'
import {getOrCreateAssociatedTokenAccount, mintToChecked} from "@solana/spl-token";
import {getUrl} from "../../utils/nodes";
import {Connection, Keypair, PublicKey} from "@solana/web3.js";
import {sha256} from 'ethereumjs-util'
import {getOFTKey, getSolanaKeypair} from "../../utils/keys";

export const command = new commander.Command()

const SOLANA_OFT_TOKEN_DECIMALS = 8

command
    .name('mint-solana-adapter-token')
    .description('Mint solana adapter token to deployer')
    .addOption(options.OPTION_STAGE)
    .addOption(options.OPTION_ENV)
    .addOption(options.OPTION_TOKEN_NAME)
    .action(
        async (options: {
            stage: Stage
            amount: string
            tokenName: string
            env: Environment
        }): Promise<void> => {

            const chain = Chain.SOLANA
            const stage = options.stage
            const env = options.env
            const network = chainAndStageToNetwork(chain, stage, env)
            const tokenInfo = getOftTokenInfo(options.tokenName, chain, stage)
            const url = getUrl(chain, env)
            if (url === undefined) throw new Error(`Node url not found for chain: ${chain} and env: ${env}`)

            const connection = new Connection(url, 'confirmed')
            let mintPK: PublicKey
            const oftName = tokenInfo.name
            const mintKp = Keypair.fromSeed(sha256(Buffer.from(oftName, 'utf-8')))
            mintPK = mintKp.publicKey

            const key = getOFTKey(network)

            const deployKP = getSolanaKeypair(key.mnemonic, key.path)

            if (tokenInfo.type === 'OFTAdapter' && tokenInfo.token === undefined) {
                const tokenAccount = await getOrCreateAssociatedTokenAccount(
                    connection,
                    deployKP,
                    mintPK,
                    deployKP.publicKey,
                    false
                )
                await mintToChecked(
                    connection,
                    deployKP,
                    mintPK,
                    tokenAccount.address,
                    deployKP,
                    BigInt(100000000) * BigInt(10 ** SOLANA_OFT_TOKEN_DECIMALS), // amount. if your decimals is 8, you mint 10^8 for 1 token
                    SOLANA_OFT_TOKEN_DECIMALS
                )
            }else{
                console.log(`Token ${oftName} is not an adapter token`)
            }


            return Promise.resolve()
        }
    )
