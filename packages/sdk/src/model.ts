/**
 * interface for the oft app
 */
export interface OftSdk {
    readonly address: string

    connect(wallet: { mnemonic: string; path?: string }): this

    quoteOft(
        dstEid: number,
        amountLD: NumberLike,
        payInLzToken: boolean,
        to?: string,
        options?: Uint8Array
    ): Promise<any>

    quoteSend(
        dstEid: number,
        amountLD: NumberLike,
        payInLzToken: boolean,
        to?: string,
        options?: Uint8Array
    ): Promise<[MessagingFee, Uint8Array]>
    send(dstEid: number, amount: NumberLike, to?: string, options?: Uint8Array): Promise<string>
    getBalance(address?: string): Promise<string>
    getDecimals(): Promise<number>
}

export type NumberLike = string | number | bigint

export interface MessagingFee {
    nativeFee: NumberLike
    lzTokenFee: NumberLike
}
