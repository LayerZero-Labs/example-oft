import * as commander from 'commander'
import { BigNumber, ethers } from 'ethers'

import { Chain, EndpointVersion, Environment, Stage, chainAndStageToEndpointId } from '@layerzerolabs/lz-definitions'
import { getOftTokenInfo } from '@layerzerolabs/oft-runtime-config'

import * as options from '../../options'
import { forceFindOFTAddress, getOFTSdk } from '../../utils/utils'

export const command = new commander.Command()

command
    .name('send')
    .description('Send an oft token from one chain to another')
    .addOption(options.OPTION_FROM_CHAIN)
    .addOption(options.OPTION_TO_CHAIN)
    .addOption(options.OPTION_STAGE)
    .addOption(options.OPTION_ENV)
    .addOption(options.OPTION_TOKEN_NAME)
    .addOption(options.OPTION_AMOUNT)
    .addOption(options.OPTION_RECIPIENT)
    .action(
        async (options: {
            fromChain: Chain
            toChain: Chain
            stage: Stage
            amount: string
            tokenName: string
            env: Environment
            recipient: string
        }): Promise<void> => {
            const chain = options.fromChain
            const { toChain } = options
            const toEid = chainAndStageToEndpointId(toChain, options.stage, EndpointVersion.V2)
            const amount = BigNumber.from(options.amount)
            const tokenInfo = getOftTokenInfo(options.tokenName, chain, options.stage)
            const { address, tokenMint, tokenEscrow } = await forceFindOFTAddress(
                chain,
                options.stage,
                options.env,
                tokenInfo.name
            )
            const sdk = await getOFTSdk(
                chain,
                options.stage,
                options.env,
                address,
                tokenInfo.type,
                tokenMint,
                tokenEscrow
            )
            const decimals = await sdk.getDecimals()
            const recipient: string = options.recipient
            let executorOptions: Uint8Array | undefined

            // if (toChain === Chain.SOLANA) {
            //     const toUrl = getUrl(toChain, options.env)
            //     if (toUrl === undefined) {
            //         return Promise.reject(new Error(`No url found for chain ${chain} and ${options.env}`))
            //     }
            //     const connection = new Connection(toUrl)
            //     const sendOptions = Options.newOptions()
            //     const gasLimit = 200000
            //     const { tokenMint: toTokenMint } = await forceFindOFTAddress(
            //         toChain,
            //         options.stage,
            //         options.env,
            //         tokenInfo.name
            //     )
            //     if (toTokenMint === undefined) {
            //         return Promise.reject(new Error(`No token mint found for chain ${chain} and ${options.env}`))
            //     }
            //     const associatedToken = getAssociatedTokenAddressSync(
            //         new PublicKey(toTokenMint),
            //         new PublicKey(recipient),
            //         false,
            //         TOKEN_PROGRAM_ID,
            //         ASSOCIATED_TOKEN_PROGRAM_ID
            //     )
            //     const tokenAccountInfo = await connection.getAccountInfo(associatedToken)
            //     if (tokenAccountInfo === null) {
            //         const lzReceiveValue = await getMinimumBalanceForRentExemptAccount(connection)
            //         sendOptions.addExecutorLzReceiveOption(gasLimit, lzReceiveValue)
            //         console.log(`executor options: gasLimit ${gasLimit} lzReceiveValue ${lzReceiveValue}`)
            //         executorOptions = sendOptions.toBytes()
            //     }
            // }
            const hash = await sdk.send(
                toEid,
                ethers.utils.parseUnits(amount.toString(), decimals).toString(),
                recipient,
                executorOptions
            )
            console.log(
                `(V2) Sent ${options.amount} ${options.tokenName} from ${chain} to ${toChain} with hash ${hash}`
            )
            return Promise.resolve()
        }
    )
