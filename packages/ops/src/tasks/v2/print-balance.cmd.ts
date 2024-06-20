/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as commander from 'commander'

import { getOftTokenInfo } from '@layerzerolabs/oft-runtime-config'

import * as options from '../../options'
import { forceFindOFTAddress, getOFTSdk } from '../../utils/utils'

export const command = new commander.Command()

command
    .name('print-balance')
    .description('Print balance of a oft token')
    .addOption(options.OPTION_FROM_CHAINS)
    .addOption(options.OPTION_STAGE)
    .addOption(options.OPTION_ENV)
    .addOption(options.OPTION_TOKEN_NAME)
    .addOption(options.OPTION_ADDRESS)
    .action(async (options: any) => {
        for (const chain of options.fromChains) {
            const tokenInfo = getOftTokenInfo(options.tokenName, chain, options.stage)
            const {
                address: oftAddress,
                tokenMint,
                tokenEscrow,
            } = await forceFindOFTAddress(chain, options.stage, options.env, tokenInfo.name)
            const addr: string = options.address as string
            const sdk = await getOFTSdk(
                chain,
                options.stage,
                options.env,
                oftAddress,
                tokenInfo.type,
                tokenMint,
                tokenEscrow
            )
            const balance = await sdk.getBalance(addr)
            console.log(`(V2)${chain} balance: ${balance}`)
        }
    })
