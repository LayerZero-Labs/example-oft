import '@nomiclabs/hardhat-ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

import 'hardhat-deploy'
import { getOftTokenInfo } from '@layerzerolabs/oft-runtime-config'
import {networkToChain, networkToStage} from '@layerzerolabs/lz-definitions'

module.exports = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy } = hre.deployments
    const { deployer } = await hre.getNamedAccounts()

    console.log(`TokenMock deployer: ${deployer}`)

    const network = hre.network.name
    const tokenInfo = getOftTokenInfo(process.env.OFT_TOKEN,networkToChain(network),networkToStage(network))

    await deploy(tokenInfo.name, {
        contract: 'TokenMock',
        from: deployer,
        args: [],
        // if set it to true, will not attempt to deploy
        // even if the contract deployed under the same name is different
        skipIfAlreadyDeployed: true,
        log: true,
        waitConfirmations: 1,
    })
    console.log(`Token deployed`)
}

module.exports.tags = ['Token', 'test']

module.exports.skip = async ({ network }: HardhatRuntimeEnvironment) =>{

    const tokenInfo = getOftTokenInfo(process.env.OFT_TOKEN,networkToChain(network.name),networkToStage(network.name))
    return new Promise((resolve) => {
        resolve(tokenInfo.token !== undefined || tokenInfo.type === 'OFT') // deploy only OFTAdapter and token is not defined
    })
}
