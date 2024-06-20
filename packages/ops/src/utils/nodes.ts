import * as fs from 'fs'

import { Environment } from '@layerzerolabs/lz-definitions'

let urls: { [key: string]: { [key: string]: string } } | undefined = undefined

export function getUrl(network: string, env: Environment): string | undefined {
    if (urls === undefined) {
        const filePath = require.resolve('@layerzerolabs/oft-runtime-config/rpc.json')
        const content = fs.readFileSync(filePath, 'utf8')
        urls = JSON.parse(content) as { [key: string]: { [key: string]: string } }
    }
    return urls[env][network]
}
