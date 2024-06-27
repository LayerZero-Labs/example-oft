import { BigNumber, ethers } from 'ethers'

import { OFT, OFTAdapter, OFTAdapter__factory, OFT__factory } from '@layerzerolabs/lz-evm-sdk-v2'
import { Options, addressToBytes32 } from '@layerzerolabs/lz-v2-utilities'
import { ERC20, ERC20__factory } from '@layerzerolabs/oft-evm-contracts'

import { MessagingFee, NumberLike, OftSdk } from '../model'
import { OFT_TYPE } from '@layerzerolabs/oft-runtime-config'

export class OftSdkEvm implements OftSdk {
    readonly address: string
    wallet?: ethers.Wallet

    static async create(
        providerOrUrl: string | ethers.providers.Provider,
        address: string,
        oftType: OFT_TYPE
    ): Promise<OftSdkEvm> {
        const provider =
            typeof providerOrUrl === 'string'
                ? new ethers.providers.StaticJsonRpcProvider(providerOrUrl)
                : providerOrUrl
        let oft: OFT | OFTAdapter
        let oftErc20: ERC20
        if (oftType === 'OFT') {
            oft = OFT__factory.connect(address, provider)
            oftErc20 = ERC20__factory.connect(address, provider)
        } else {
            oft = OFTAdapter__factory.connect(address, provider)
            const token = await oft.token()
            oftErc20 = ERC20__factory.connect(token, provider)
        }
        return new OftSdkEvm(provider, oftType, oft, oftErc20)
    }

    protected constructor(
        public readonly provider: ethers.providers.Provider,
        public readonly oftType: OFT_TYPE,
        public oft: OFT | OFTAdapter,
        public oftErc20: ERC20
    ) {
        this.address = oft.address
    }

    connect(walletConf: { mnemonic: string; path?: string }): this {
        const wallet = ethers.Wallet.fromMnemonic(walletConf.mnemonic, walletConf.path).connect(this.provider)
        this.wallet = wallet
        this.oft = this.oft.connect(wallet)
        this.oftErc20 = this.oftErc20.connect(wallet)
        return this
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async quoteOft(
        dstEid: number,
        amountLD: NumberLike,
        payInLzToken: boolean,
        to?: string,
        options?: Uint8Array
    ): Promise<any> {
        const toBytes32 = addressToBytes32(to ?? this.forceGetWallet.address)
        const opts = options ?? this.getLzReceiveOptions().toBytes()
        const result = await this.oft.quoteOFT({
            dstEid,
            to: toBytes32,
            amountLD,
            minAmountLD: BigNumber.from(amountLD).mul(9).div(10), // 10% tolerance
            composeMsg: '0x',
            extraOptions: opts,
            oftCmd: '0x',
        })
        return {
            oftLimit: {
                minAmountLD: result.oftLimit.minAmountLD.toString(),
                maxAmountLD: result.oftLimit.maxAmountLD.toString(),
            },
            oftFeeDetails: result.oftFeeDetails,
            oftReceipt: {
                amountSendLD: result.oftReceipt.amountSentLD.toString(),
                amountReceivedLD: result.oftReceipt.amountReceivedLD.toString(),
            },
        }
    }

    async quoteSend(
        dstEid: number,
        amountLD: NumberLike,
        payInLzToken = false,
        to?: string,
        options?: Uint8Array
    ): Promise<[MessagingFee, Uint8Array]> {
        const toBytes32 = addressToBytes32(to ?? this.forceGetWallet.address)
        console.log('xxx', dstEid, amountLD.toString(), Buffer.from(toBytes32).toString('hex'))
        const opts = options ?? Uint8Array.from([]) // use the enforcedOptions only if options is undefined
        const fee = await this.oft.quoteSend(
            {
                dstEid,
                to: toBytes32,
                amountLD,
                minAmountLD: BigNumber.from(amountLD).mul(9).div(10), // 10% tolerance
                composeMsg: '0x',
                extraOptions: opts,
                oftCmd: '0x',
            },
            payInLzToken
        )
        return [
            {
                nativeFee: fee.nativeFee.toNumber(),
                lzTokenFee: fee.lzTokenFee.toNumber(),
            },
            opts,
        ]
    }

    async send(dstEid: number, amount: NumberLike, to?: string, opts?: Uint8Array): Promise<string> {
        const toBytes32 = addressToBytes32(to ?? this.forceGetWallet.address)
        const [fee, options] = await this.quoteSend(dstEid, amount, false, to, opts)
        const wallet = this.forceGetWallet

        // approve OFTAdapter to spend OFT
        if (this.oftType === 'OFTAdapter') {
            const allowance = await this.oftErc20.allowance(wallet.address, this.address)
            if (allowance.lt(amount)) {
                await this.oftErc20.approve(this.address, amount).then(async (x) => x.wait())
            }
        }

        const resp = await this.oft
            .send(
                {
                    dstEid,
                    to: toBytes32,
                    amountLD: amount,
                    minAmountLD: BigNumber.from(amount).mul(9).div(10), // 10% tolerance
                    composeMsg: '0x',
                    extraOptions: options,
                    oftCmd: '0x',
                },
                fee,
                wallet.address,
                { value: fee.nativeFee }
            )
            .then(async (x) => x.wait())
        return resp.transactionHash
    }

    async getBalance(address?: string): Promise<string> {
        const balance = await this.oftErc20.balanceOf(address ?? this.forceGetWallet.address)
        const decimals = await this.getDecimals()
        return ethers.utils.formatUnits(balance, decimals)
    }

    async getDecimals(): Promise<number> {
        return this.oftErc20.decimals()
    }

    async transfer(to: string, amount: number): Promise<string> {
        const resp = await this.oftErc20.transfer(to, amount).then(async (x) => x.wait())
        return resp.transactionHash
    }

    getLzReceiveOptions(): Options {
        const options = Options.newOptions()
        options.addExecutorLzReceiveOption(200000, 0)
        return options
    }

    get forceGetWallet(): ethers.Wallet {
        if (!this.wallet) {
            throw new Error('Wallet not connected')
        }
        return this.wallet
    }
}
