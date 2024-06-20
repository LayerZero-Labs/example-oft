import * as commander from 'commander'

import { Environment, Stage } from '@layerzerolabs/lz-definitions'
import {getAppConfig} from '@layerzerolabs/oft-runtime-config'

export const OPTION_FROM_CHAINS = new commander.Option('-f, --from-chains <from-chains>', 'csv of from chains')
    .makeOptionMandatory(true)
    .argParser(function commaSeparatedList(value: string): string[] {
        return value.split(',')
    })

export const OPTION_TO_CHAINS = new commander.Option('-t, --to-chains <to-chains>', 'csv of to chains')
    .makeOptionMandatory(true)
    .argParser(function commaSeparatedList(value: string): string[] {
        return value.split(',')
    })

export const OPTION_FROM_CHAIN = new commander.Option(
    '-f, --from-chain <from-chain>',
    'csv of from chain'
).makeOptionMandatory(true)

export const OPTION_TO_CHAIN = new commander.Option('-t, --to-chain <to-chain>', 'csv of to chain').makeOptionMandatory(
    true
)

export const OPTION_STAGE = new commander.Option('-s, --stage <stage>', 'stage for lookup and configurations')
    .makeOptionMandatory(true)
    .choices(Object.values(Stage))

export const OPTION_DISABLE_CLEAR = new commander.Option('--disable-clear', 'disable clear').default(false)

export const OPTION_ENV = new commander.Option('-e, --env <env>', 'env for lookup and configurations')
    .makeOptionMandatory(true)
    .choices(Object.values(Environment))

export const OPTION_TOKEN_NAME = new commander.Option('-token, --token-name <env>', 'oft token name')
    .makeOptionMandatory(true)
    .choices(Array.from(new Set([...Object.keys(getAppConfig(Stage.SANDBOX).token), ...Object.keys(getAppConfig(Stage.TESTNET).token), ...Object.keys(getAppConfig(Stage.MAINNET).token)])))

export const OPTION_AMOUNT = new commander.Option('-a, --amount <env>', 'amount to send').makeOptionMandatory(true)
export const OPTION_RECIPIENT = new commander.Option('-r, --recipient <recipient>', 'recipient').makeOptionMandatory(
    true
)

export const OPTION_ADDRESS = new commander.Option('-addr, --address <address>', 'address').makeOptionMandatory(true)
