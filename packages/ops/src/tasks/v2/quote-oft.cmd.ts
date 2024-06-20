/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as commander from 'commander'
import { BigNumber, ethers } from 'ethers'

import { Chain, EndpointVersion, chainAndStageToEndpointId } from '@layerzerolabs/lz-definitions'
import { getOftTokenInfo } from '@layerzerolabs/oft-runtime-config'

import * as options from '../../options'
import { forceFindOFTAddress, getOFTSdk } from '../../utils/utils'

export const command = new commander.Command()

command
    .name('quote-oft')
    .description('QuoteOft an oft token from one chain to another')
    .addOption(options.OPTION_FROM_CHAIN)
    .addOption(options.OPTION_TO_CHAIN)
    .addOption(options.OPTION_STAGE)
    .addOption(options.OPTION_ENV)
    .addOption(options.OPTION_TOKEN_NAME)
    .addOption(options.OPTION_AMOUNT)
    .addOption(options.OPTION_RECIPIENT)
    .action(async (options: any) => {
        const chain = options.fromChain as Chain
        const toChain = options.toChain as Chain
        const toEid = chainAndStageToEndpointId(toChain, options.stage, EndpointVersion.V2)
        const amount = BigNumber.from(options.amount)
        const tokenInfo = getOftTokenInfo(options.tokenName, chain, options.stage)
        const { address, tokenMint } = await forceFindOFTAddress(chain, options.stage, options.env, tokenInfo.name)
        const sdk = await getOFTSdk(chain, options.stage, options.env, address, tokenInfo.type, tokenMint)
        const decimals = await sdk.getDecimals()
        const recipient: string = options.recipient as string
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = await sdk.quoteOft(
            toEid,
            ethers.utils.parseUnits(amount.toString(), decimals).toString(),
            false,
            recipient
        )
        console.log(`(V2) QuoteOft result:`)
        console.log(result)
    })
