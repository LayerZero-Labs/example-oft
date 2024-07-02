import {web3} from '@coral-xyz/anchor'
import {getAccount, getAssociatedTokenAddress, getMint, TOKEN_PROGRAM_ID} from '@solana/spl-token'
import {AddressLookupTableProgram, Connection, PublicKey, Transaction, TransactionInstruction} from '@solana/web3.js'
import {getSimulationComputeUnits} from '@solana-developers/helpers'
import * as bip39 from 'bip39'
import {derivePath} from 'ed25519-hd-key'

import {
    OftTools,
    buildVersionedTransaction
} from '@layerzerolabs/lz-solana-sdk-v2'
import {logger, sleep} from '@layerzerolabs/lz-utilities'
import {Options, addressToBytes32} from '@layerzerolabs/lz-v2-utilities'

import {MessagingFee, NumberLike, OftSdk} from '../model'

export class OftSdkSolana implements OftSdk {
    readonly address: string
    private keyPair?: web3.Keypair

    // eslint-disable-next-line @typescript-eslint/require-await
    static async create(
        rpc: string,
        oftAddress: string,
        mintAddress: string,
        escrowAddress?: string
    ): Promise<OftSdkSolana> {
        const connection = new web3.Connection(rpc, 'confirmed')
        const tokenMint = new web3.PublicKey(mintAddress)
        const tokenEscrow = escrowAddress !== undefined ? new web3.PublicKey(escrowAddress) : undefined
        return new OftSdkSolana(connection, tokenMint, oftAddress, tokenEscrow)
    }

    protected constructor(
        public connection: web3.Connection,
        public tokenMint: web3.PublicKey,
        address: string,
        public tokenEscrow?: web3.PublicKey
    ) {
        this.address = address
    }

    connect(walletConf: { mnemonic: string; path?: string }): this {
        this.keyPair = getKeypair(walletConf.mnemonic, walletConf.path)
        return this
    }

    get oftProgramId(): PublicKey {
        return new PublicKey(this.address)
    }

    async quoteOft(
        dstEid: number,
        amountLD: NumberLike,
        payInLzToken = false,
        to?: string,
        options?: Uint8Array
    ): Promise<ReturnType<(typeof OftTools)['quoteOft']>> {
        const wallet = this.forceGetKeyPair
        const toBytes32 = addressToBytes32(to ?? this.forceGetKeyPair.publicKey.toBase58())
        const opts = options ?? this.getLzReceiveOptions().toBytes()

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
        return OftTools.quoteOft(
            this.connection,
            wallet.publicKey,
            this.tokenMint,
            dstEid,
            BigInt(amountLD),
            (BigInt(amountLD) * BigInt(9)) / BigInt(10),
            opts,
            Array.from(toBytes32),
            payInLzToken,
            this.tokenEscrow,
            Uint8Array.from([]),
            TOKEN_PROGRAM_ID,
            this.oftProgramId
        )
    }

    async quoteSend(
        dstEid: number,
        amountLD: NumberLike,
        payInLzToken = false,
        to?: string,
        options?: Uint8Array
    ): Promise<[MessagingFee & { tableAddr?: PublicKey }, Uint8Array]> {
        const wallet = this.forceGetKeyPair
        const opts = options ?? this.getLzReceiveOptions().toBytes()
        const toBytes32 = addressToBytes32(to ?? this.forceGetKeyPair.publicKey.toBase58())
        const fees = await OftTools.quoteWithUln(
            this.connection,
            wallet.publicKey,
            this.tokenMint,
            dstEid,
            BigInt(amountLD),
            (BigInt(amountLD) * BigInt(9)) / BigInt(10),
            opts,
            Array.from(toBytes32),
            payInLzToken,
            this.tokenEscrow,
            undefined,
            undefined,
            undefined,
            TOKEN_PROGRAM_ID,
            this.oftProgramId
        )
        return [fees, opts]
    }

    async send(dstEid: number, amount: NumberLike, to?: string, opts?: Uint8Array): Promise<string> {
        const toBytes32 = to !== undefined ? addressToBytes32(to) : this.forceGetKeyPair.publicKey.toBytes()
        const wallet = this.forceGetKeyPair
        const tokenSource = await getAssociatedTokenAddress(this.tokenMint, wallet.publicKey)
        const [fee, options] = await this.quoteSend(dstEid, amount, false, to, opts)

        const ix = await OftTools.sendWithUln(
            this.connection,
            wallet.publicKey,
            this.tokenMint,
            tokenSource,
            dstEid,
            BigInt(amount),
            (BigInt(amount) * BigInt(9)) / BigInt(10),
            options,
            Array.from(toBytes32),
            BigInt(fee.nativeFee),
            BigInt(fee.lzTokenFee),
            this.tokenEscrow,
            undefined,
            undefined,
            undefined,
            TOKEN_PROGRAM_ID,
            this.oftProgramId
        )

        const ixKeys = ix.keys.map((key) => {
            return key.pubkey
        })
        const addressLookupTable = await createAddressTable(this.connection, wallet, wallet.publicKey, ixKeys)

        await sleep(2000) // wait the address table active

        const lookupTableAccounts = await this.connection.getAddressLookupTable(addressLookupTable).then((table) => {
            return table.value
        })

        const units = await getSimulationComputeUnits(this.connection, [ix], wallet.publicKey, lookupTableAccounts ? [lookupTableAccounts] : [])
        const customersCU = units === null ? 1000 : units < 1000 ? 1000 : Math.ceil(units * 1.5)
        const modifyComputeUnits = web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: customersCU,
        })
        const tx = await buildVersionedTransaction(this.connection, wallet.publicKey, [modifyComputeUnits, ix], 'confirmed', undefined, addressLookupTable)
        tx.sign([wallet])
        const hash = await this.connection.sendTransaction(tx, {skipPreflight: true})
        await this.connection.confirmTransaction(hash, 'confirmed')
        return hash
    }

    async getBalance(userAddress?: string): Promise<string> {
        const kp = this.forceGetKeyPair
        const address =
            userAddress !== undefined
                ? await getAssociatedTokenAddress(this.tokenMint, new web3.PublicKey(userAddress))
                : await getAssociatedTokenAddress(this.tokenMint, kp.publicKey)
        const accountInfo = await this.connection.getAccountInfo(address)
        if (accountInfo === null) {
            logger.warn(`Account not found for address: ${address.toBase58()}`)
            return '0'
        }
        const acc = await getAccount(this.connection, address)
        const decimals = await this.getDecimals()
        return (acc.amount / BigInt(10) ** BigInt(decimals)).toString()
    }

    async getDecimals(): Promise<number> {
        const mint = await getMint(this.connection, this.tokenMint)
        return mint.decimals
    }

    get forceGetKeyPair(): web3.Keypair {
        if (this.keyPair === undefined) {
            throw new Error('KeyPair not found')
        }
        return this.keyPair
    }

    getLzReceiveOptions(): Options {
        const options = Options.newOptions()
        options.addExecutorLzReceiveOption(200000, 0)
        return options
    }
}

function getKeypair(mnemonic: string, path = "m/44'/501'/0'/0'"): web3.Keypair {
    const seed = bip39.mnemonicToSeedSync(mnemonic, '') // (mnemonic, password)
    return web3.Keypair.fromSeed(derivePath(path, seed.toString('hex')).key)
}


async function createAddressTable(
    connection: Connection,
    wallet: web3.Keypair,
    authority: PublicKey,
    addresses: PublicKey[]
): Promise<PublicKey> {
    const payer = wallet.publicKey;
    const slot = await connection.getSlot('finalized');
    const [createInstruction, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
        payer,
        authority,
        recentSlot: slot,
    });

    // Create initial transaction to create the lookup table
    await sendAndConfirmTransaction(connection, wallet, payer, [createInstruction]);

    // Process addresses in chunks of 25
    for (let i = 0; i < addresses.length; i += 25) {
        const splitAddresses = addresses.slice(i, i + 25);
        const extendInstruction = AddressLookupTableProgram.extendLookupTable({
            payer,
            authority,
            lookupTable: lookupTableAddress,
            addresses: splitAddresses,
        });

        await sendAndConfirmTransaction(connection, wallet, payer, [extendInstruction]);
    }

    return lookupTableAddress;
}

async function sendAndConfirmTransaction(
    connection: Connection,
    wallet: web3.Keypair,
    payer: PublicKey,
    instructions: TransactionInstruction[]
): Promise<void> {
    const transaction = await buildVersionedTransaction(connection, payer, instructions);
    transaction.sign([wallet]);
    const hash = await connection.sendTransaction(transaction, {skipPreflight: true});
    await connection.confirmTransaction(hash, 'confirmed');
}


