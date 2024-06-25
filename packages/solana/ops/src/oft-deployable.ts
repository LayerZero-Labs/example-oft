import { DeployOption, Deployable, Deployment, CompileOption } from '@layerzerolabs/ops-core'
import {Chain, Network, networkToChain} from '@layerzerolabs/lz-definitions'
import {_oftConfigPda} from './util'
import path from 'node:path'
import * as fs from 'node:fs'
import {OFT_TYPE} from "@layerzerolabs/oft-runtime-config";
import {PublicKey} from "@solana/web3.js";


export class SolanaOftTokenDeployable implements Deployable {
    constructor(private deploymentPackageRoot: string, private oftDeploymentName: string, private tokenName: string, private oftType: OFT_TYPE) {
    }

    compile(option: CompileOption): Promise<void> {
        // Solana oft token is not a program, it is a PDA account. So no need to compile
        return Promise.resolve(undefined)
    }

    deploy(option: DeployOption): Promise<Deployment[]> {
        // Solana oft token is not a program, it is a PDA account. So no need to deploy
        return Promise.resolve([])
    }

    getDeployments(networks: Network[]): Promise<Deployment[]> {
        // @dev Solana oft token don't have deployments actually, it is a PDA account.
        // But we implement getDeployments so that we can get the address of the PDA account for wiring and not to break the workflow of BelowZero
        const solanaNetworks = networks.filter((network: Network) => networkToChain(network) === Chain.SOLANA)
        const deployments: Deployment[] = solanaNetworks.map((network: Network) => {
            // get the oft factory program deployment
            const oftDeployment: Deployment = JSON.parse(fs.readFileSync(path.join(this.deploymentPackageRoot, network, `${this.oftDeploymentName}.json`), 'utf-8'))
            return {
                name: this.tokenName,
                address: _oftConfigPda(this.tokenName, this.oftType, new PublicKey(oftDeployment.address)).toBase58(),
                network,
                compatibleVersions: oftDeployment.compatibleVersions,
            }
        })
        return Promise.resolve(deployments);
    }
}