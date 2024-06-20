import {TransactionInstruction} from "@solana/web3.js";
import {buildVersionedTransaction} from "@layerzerolabs/lz-solana-sdk-v2";
import {
    ConfigureManager, getConfigFunc,
    LayerZeroSolanaBaseConfigurable,
    ProviderManager, sendTransactionsHelper,
    SignerManager, TransactionData
} from "@layerzerolabs/ops-utilities";
import {networkToChain} from "@layerzerolabs/lz-definitions";
import {Transaction, TransactionGroup} from "@layerzerolabs/ops-core";
import {SolanaProvider as CoreSolanaProvider, SolanaSigner as CoreSolanaSigner} from "@layerzerolabs/lz-corekit-solana";
import {isTransactionGroup} from "@layerzerolabs/ops-plugin-core";
import {SignedTransaction} from "@layerzerolabs/lz-core"
import {hexlify} from "@ethersproject/bytes"
import {_lockBoxKp, _mintKp} from "./util"

export const oftWallet = 'deployer'

export abstract class BaseOFTWireable extends LayerZeroSolanaBaseConfigurable {
    constructor(
        protected configManager: ConfigureManager,
        protected providerManager: ProviderManager,
        protected signerManager: SignerManager,
        protected tokenName: string
    ) {
        super(configManager, providerManager, signerManager)
    }

    public async sendTransactions(transactions: Transaction[], confirms?: number): Promise<string[]> {
        return sendTransactionsHelper(transactions, this.providerManager, this.signTransactions.bind(this), confirms)
    }

    async signTransactions(transactions: (Transaction | TransactionGroup)[]): Promise<Transaction[]> {
        const signedTxns: Transaction[] = []
        for (const txn of transactions) {
            if (isTransactionGroup(txn)) {
                for (const tx of txn.txns) {
                    await this._signTx(tx);
                    signedTxns.push({
                        type: 'Transaction',
                        network: tx.network,
                        env: tx.env,
                        signerName: tx.signerName,
                        raw: tx,
                        signed: tx.signed,
                    })
                }
            } else {
                await this._signTx(txn);
                signedTxns.push({
                    type: 'Transaction',
                    network: txn.network,
                    env: txn.env,
                    signerName: txn.signerName,
                    raw: txn,
                    signed: txn.signed,
                })
            }
        }
        return signedTxns
    }

    private async _signTx(tx: Transaction) {
        const provider = (await this.providerManager
            .getProvider(networkToChain(tx.network), tx.env)
            .then(async (p) => p.getProvider())) as CoreSolanaProvider
        const payer = (await this.signerManager.getSigner(tx.network, tx.env, oftWallet)).getSigner() as CoreSolanaSigner
        const ix = tx.raw as TransactionInstruction
        const versionedTransaction = await buildVersionedTransaction(provider.nativeProvider, payer.publicKey, [ix])
        const signerKeys = ix.keys.filter((k) => k.isSigner)
        if (signerKeys.length === 2) {
            if (signerKeys[1].pubkey.equals(_mintKp(this.tokenName).publicKey)) {
                versionedTransaction.sign([payer, _mintKp(this.tokenName)])
            } else if (signerKeys[1].pubkey.equals(_lockBoxKp(this.tokenName).publicKey)) {
                versionedTransaction.sign([payer, _lockBoxKp(this.tokenName)])
            } else if (signerKeys[1].pubkey.equals(payer.publicKey)) {
                versionedTransaction.sign([payer])
            } else {
                throw new Error(`unknown signer ${signerKeys[1].pubkey}`)
            }
        } else {
            versionedTransaction.sign([payer])
        }
        tx.signed = SignedTransaction.from(hexlify(versionedTransaction.serialize()))
    }
}