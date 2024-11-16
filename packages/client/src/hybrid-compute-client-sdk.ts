import { AbiCoder, concat, ethers, FunctionFragment, hexlify } from "ethers";
import { CreateInvokeTransaction, InvokeTransactionOptions } from "./hybrid-compute-client-sdk.interface";

interface SnapConfig {
    snapOrigin: string
    snapVersion: '1.1.3' | '1.1.4' | string,
}

interface HybridComputeInitOptions {
    chain: string;
    accountIdConnected: string;
    snapConfiguration: SnapConfig
}

/**
 * HybridComputeClientSDK class for building and invoking transactions
 */
export class HybridComputeClientSDK {
    private config: HybridComputeInitOptions;
    private abiCoder: ethers.AbiCoder;

    /**
     * Constructor for HybridComputeClientSDK
     * @param hybridComputeOptions
     */
    constructor(hybridComputeOptions: HybridComputeInitOptions) {
        this.config = hybridComputeOptions;
        this.abiCoder = new AbiCoder();
    }

    /**
     * Builds an invoke transaction
     * @param params - Parameters for creating the invoke transaction
     * @returns The built invoke transaction
     */
    async buildInvokeTransaction(params: CreateInvokeTransaction) {
        const funcSelector = FunctionFragment.getSelector(
            params.selector.name,
            params.selector.params
        );
        const encodedParams = this.abiCoder.encode(
            params.transaction.parameters.types,
            params.transaction.parameters.values
        );
        const txData = hexlify(concat([funcSelector, encodedParams]));

        return {
            payload: {
                to: params.transaction.contractAddress,
                value: params.transaction.value,
                data: txData,
            },
            account: this.config.accountIdConnected,
            scope: `eip155:${this.config.chain}`,
        };
    }

    /**
     * Invokes a snap
     * @param invokeOptions - Options for invoking the snap
     * @returns The result of the snap invocation
     */
    async invokeSnap(invokeOptions: InvokeTransactionOptions) {
        // @ts-ignore
        return await window.ethereum!.request({
            method: "wallet_invokeSnap",
            params: {
                snapId: this.config.snapConfiguration.snapOrigin,
                request: {
                    method: `eth_sendUserOpBoba${invokeOptions.usePaymaster ? 'PM' : ''}`,
                    params: [invokeOptions.transactionDetails],
                    id: this.config.accountIdConnected,
                },
            },
        });
    }

    /**
     * Sets the connected account
     * @param accountId - The account ID to set
     */
    setConnectedAccount(accountId: string) {
        this.config.accountIdConnected = accountId;
    }

    /**
     * Sets the blockchain network
     * @param chain - The chain to set
     */
    setChain(chain: string) {
        this.config.chain = chain;
    }
}