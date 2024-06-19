import * as path from 'node:path'
import {pkgroot} from "@layerzerolabs/lz-utilities";
import {LzSolanaConfig} from "@layerzerolabs/anchor-cli-wrapper";
import {Chain, chainAndStageToNetwork, Environment, Stage} from "@layerzerolabs/lz-definitions"
import {getKeyPair} from "./src"

const sdkPrjPath = pkgroot('@layerzerolabs/oft-solana-sdk')
const contractsPrjPath = pkgroot('@layerzerolabs/oft-solana-contracts')

const SOLANA_SANDBOX_LOCAL = chainAndStageToNetwork(Chain.SOLANA, Stage.SANDBOX, Environment.LOCAL)

const config: LzSolanaConfig = {
    artifactsPath: path.join(sdkPrjPath, 'artifacts'),
    deploymentPath: path.join(sdkPrjPath, 'deployments'),
    deployer: {
        [SOLANA_SANDBOX_LOCAL]: {
            default: JSON.stringify(Array.from(getKeyPair('deployer', Stage.SANDBOX)?.secretKey!))
        }
    },
    programs:{
        oft: {
            anchorPrjPath: contractsPrjPath,
            keypairPath: {
                [SOLANA_SANDBOX_LOCAL]: {
                    default: path.join(contractsPrjPath, 'target', 'deploy', 'oft-keypair.json'),
                }
            },
        }
    },
}

export default config
