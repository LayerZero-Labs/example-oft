import '@nomiclabs/hardhat-ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

import { getDeployedContractAddress } from '@layerzerolabs/lz-evm-sdk-v2'
import 'hardhat-deploy'
import { getDeployName, getOftTokenInfo } from '@layerzerolabs/oft-runtime-config'
import {networkToChain, networkToStage} from '@layerzerolabs/lz-definitions'



module.exports = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy } = hre.deployments
    const { deployer } = await hre.getNamedAccounts()

    console.log(`OFT deployer: ${deployer}`)


    const network = hre.network.name
    const tokenInfo = getOftTokenInfo(process.env.OFT_TOKEN,networkToChain(network),networkToStage(network))

    const endpointAddr =
        hre.network.name === 'hardhat'
            ? await hre.deployments.get(`EndpointMock`).then((t) => t.address)
            : getDeployedContractAddress(hre.network.name, 'EndpointV2')
    console.log(`EndpointV2: ${endpointAddr}`)

    await deploy(getDeployName(tokenInfo), {
        contract: 'OmniToken',
        from: deployer,
        args: [`${tokenInfo.name} OFT`, tokenInfo.name, endpointAddr, deployer],
        // if set it to true, will not attempt to deploy
        // even if the contract deployed under the same name is different
        skipIfAlreadyDeployed: true,
        log: true,
        waitConfirmations: 1,
    })
    console.log(`OFT deployed`)
}

module.exports.tags = ['OFT', 'test']
module.exports.dependencies = ['EndpointMock']
module.exports.skip = async ({ network }: HardhatRuntimeEnvironment) =>{

    const tokenInfo = getOftTokenInfo(process.env.OFT_TOKEN,networkToChain(network.name),networkToStage(network.name))
    return new Promise((resolve) => {
        resolve(tokenInfo.type !== 'OFT') // deploy only for OFT
    })
}
