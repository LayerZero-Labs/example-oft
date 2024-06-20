/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as fs from 'fs'
import * as path from 'path'

import { globSync } from 'glob'

import { ChainType, EndpointVersion, Network, networkToChainType } from '@layerzerolabs/lz-definitions'
import '@layerzerolabs/ops-plugin-core'
import { Deployment, DeploymentFetcher } from '@layerzerolabs/ops-core'

export class LayerZeroDeploymentFetcher implements DeploymentFetcher {
    constructor(private workspace: string) {}

    toSource(packageName: string): string {
        const lookupTable = {
            '@layerzerolabs/oft-v2-evm-contracts': '@layerzerolabs/oft-v2-evm-sdk',
        }
        return packageName in lookupTable ? lookupTable[packageName as keyof typeof lookupTable] : packageName
    }

    async getDeployments(networks: Network[]): Promise<Deployment[]> {
        const deployments: Deployment[] = []
        for (const network of networks) {
            const chainType = networkToChainType(network)
            const packageName = JSON.parse(fs.readFileSync(path.join(this.workspace, 'package.json'), 'utf-8')).name
            const deploymentFiles = globSync(path.join(this.workspace, 'deployments', network, '*.json'))
            for (const deployment of deploymentFiles) {
                if (chainType === ChainType.EVM) {
                    const { address, abi, bytecode } = JSON.parse(fs.readFileSync(deployment, 'utf-8'))
                    const compatibleVersions = [EndpointVersion.V2]
                    // if (packageName === '@layerzerolabs/oft-v1-evm-contracts') {
                    //     compatibleVersions = [EndpointVersion.V1]
                    // }
                    deployments.push({
                        name: path.basename(deployment).replace('.json', ''),
                        address,
                        abi,
                        bytecode,
                        source: this.toSource(packageName),
                        network,
                        compatibleVersions,
                    })
                } else if (chainType === ChainType.SOLANA) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const deploymentData = JSON.parse(fs.readFileSync(deployment, 'utf-8'))
                    deployments.push(deploymentData)
                }
            }
        }
        return deployments
    }
}
