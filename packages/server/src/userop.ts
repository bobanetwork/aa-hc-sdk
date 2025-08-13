import {ACCOUNT_FACTORY_ABI} from "./abis";
import {CreateResult, CreateSmartAccountParams, GetExpectedAddressParams, UserOperationV7,} from "./utils";
import {
    createPublicClient,
    createWalletClient,
    encodeAbiParameters,
    encodeFunctionData,
    hexToNumber,
    http,
    keccak256,
    numberToHex,
    parseAbiParameters,
    parseEther,
    parseGwei,
    slice,
} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {bobaSepolia} from "viem/chains";

export class UserOpManager {
    private publicClient: any;
    private bundlerUrl: string;
    private nodeUrl: string;
    private entryPoint: string;
    private chainId: number;
    private privateKey: string;
    private account: any;
    private readonly entrypointV7 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
    private readonly factoryAddress =
        "0x9aC904d8DfeA0866aB341208700dCA9207834DeB";

    constructor(
        nodeUrl: string,
        bundlerUrl: string,
        entryPoint: string,
        chainId: number,
        privateKey: string,
    ) {
        this.publicClient = createPublicClient({
            chain: bobaSepolia,
            transport: http(nodeUrl),
        });
        this.account = privateKeyToAccount(privateKey as `0x${string}`);
        this.nodeUrl = nodeUrl;
        this.bundlerUrl = bundlerUrl;
        this.entryPoint = entryPoint;
        this.chainId = chainId;
        this.privateKey = privateKey;
    }

    selector(signature: string): string {
        return slice(keccak256(signature as `0x${string}`), 0, 4);
    }

    private async getNonce(address: string, key: number = 0): Promise<string> {
        const encodedParams = encodeAbiParameters(
            parseAbiParameters("address, uint192"),
            [address as `0x${string}`, BigInt(key)],
        );
        const calldata =
            this.selector("getNonce(address,uint192)") + encodedParams.slice(2);

        const result = await this.publicClient.call({
            to: this.entryPoint as `0x${string}`,
            data: calldata as `0x${string}`,
        });

        return result.data as string;
    }

    async buildOp(
        sender: string,
        target: string,
        value: number,
        calldata: string,
        nonceKey: number = 0,
    ): Promise<UserOperationV7> {
        const gasPrice = await this.publicClient.getGasPrice();
        const tip = Math.max(
            Number(gasPrice) - Number(gasPrice),
            Number(parseGwei("0.5")),
        );
        const baseFee = Number(gasPrice) - tip;
        const fee = Math.max(Number(gasPrice), 2 * baseFee + tip);

        const encodedParams = encodeAbiParameters(
            parseAbiParameters("address, uint256, bytes"),
            [target as `0x${string}`, BigInt(value), calldata as `0x${string}`],
        );
        const executeCalldata =
            this.selector("execute(address,uint256,bytes)") + encodedParams.slice(2);

        // For v0.7, we need to include the packed gas limits and fees
        const verificationGasLimit = 0; //250000; // Default verification gas
        const callGasLimit = 0; //200000; // Default call gas

        const accountGasLimits =
            encodeAbiParameters(
                parseAbiParameters("uint128"),
                [BigInt(verificationGasLimit)],
            ).slice(34) +
            encodeAbiParameters(
                parseAbiParameters("uint128"),
                [BigInt(callGasLimit)],
            ).slice(34);

        const gasFees =
            encodeAbiParameters(
                parseAbiParameters("uint128"),
                [BigInt(tip)],
            ).slice(34) +
            encodeAbiParameters(
                parseAbiParameters("uint128"),
                [BigInt(fee)],
            ).slice(34);

        return {
            sender,
            nonce: await this.getNonce(sender, nonceKey),
            callData: executeCalldata,
            callGasLimit: numberToHex(callGasLimit),
            verificationGasLimit: numberToHex(verificationGasLimit),
            preVerificationGas: numberToHex(45000), // Default preVerificationGas
            maxFeePerGas: numberToHex(fee),
            maxPriorityFeePerGas: numberToHex(tip),
            signature:
                "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c",
            paymasterAndData: "0x",
            accountGasLimits: "0x" + accountGasLimits,
            gasFees: "0x" + gasFees,
        };
    }

    public getEntrypoint() {
        return this.entryPoint;
    }

    public getRpc() {
        return this.nodeUrl;
    }

    public isV7Entrypoint() {
        return this.entryPoint.toLowerCase() === this.entrypointV7.toLowerCase();
    }

    async estimateOp(
        op: UserOperationV7,
    ): Promise<{ success: boolean; op: UserOperationV7 }> {
        try {
            const response = await fetch(this.bundlerUrl, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "eth_estimateUserOperationGas",
                    params: [op, this.entryPoint],
                    id: 1,
                }),
            });

            const result = await response.json();

            if (result.error) {
                console.error("Gas estimation failed:", result.error);
                // Use fallback gas values if estimation fails
                if (this.isV7Entrypoint()) {
                    const fallbackVerificationGas = 70000;
                    const fallbackCallGas = 100000;
                    
                    op.verificationGasLimit = numberToHex(fallbackVerificationGas);
                    op.callGasLimit = numberToHex(fallbackCallGas);
                    op.preVerificationGas = numberToHex(50000);
                    
                    const accountGasLimits =
                        encodeAbiParameters(
                            parseAbiParameters("uint128"),
                            [BigInt(fallbackVerificationGas)],
                        ).slice(34) +
                        encodeAbiParameters(
                            parseAbiParameters("uint128"),
                            [BigInt(fallbackCallGas)],
                        ).slice(34);

                    op.accountGasLimits = "0x" + accountGasLimits;
                }
                return {success: true, op}; // Continue with fallback values
            }

            const estimates = result.result;
            op.preVerificationGas = estimates.preVerificationGas;
            op.verificationGasLimit = estimates.verificationGasLimit;
            op.callGasLimit = estimates.callGasLimit;

            // For v0.7, we need to update the packed gas fields
            if (this.isV7Entrypoint()) {
                const verificationGas = hexToNumber(estimates.verificationGasLimit as `0x${string}`);
                const callGas = Math.max(hexToNumber(estimates.callGasLimit as `0x${string}`), 21000); // Ensure minimum gas
                
                const accountGasLimits =
                    encodeAbiParameters(
                        parseAbiParameters("uint128"),
                        [BigInt(verificationGas)],
                    ).slice(34) +
                    encodeAbiParameters(
                        parseAbiParameters("uint128"),
                        [BigInt(callGas)],
                    ).slice(34);

                op.accountGasLimits = "0x" + accountGasLimits;
                op.callGasLimit = numberToHex(callGas); // Update the individual field too
            }

            return {success: true, op};
        } catch (error) {
            console.error("Gas estimation error:", error);
            return {success: false, op};
        }
    }

    private async signV7Operation(op: UserOperationV7): Promise<UserOperationV7> {
        const verificationGasLimit = hexToNumber(op.verificationGasLimit as `0x${string}`);
        const callGasLimit = hexToNumber(op.callGasLimit as `0x${string}`);
        const maxPriorityFeePerGas = hexToNumber(op.maxPriorityFeePerGas as `0x${string}`);
        const maxFeePerGas = hexToNumber(op.maxFeePerGas as `0x${string}`);

        const accountGasLimits =
            encodeAbiParameters(
                parseAbiParameters("uint128"),
                [BigInt(verificationGasLimit)],
            ).slice(34) +
            encodeAbiParameters(
                parseAbiParameters("uint128"),
                [BigInt(callGasLimit)],
            ).slice(34);

        const gasFees =
            encodeAbiParameters(
                parseAbiParameters("uint128"),
                [BigInt(maxPriorityFeePerGas)],
            ).slice(34) +
            encodeAbiParameters(
                parseAbiParameters("uint128"),
                [BigInt(maxFeePerGas)],
            ).slice(34);

        const pack1 = encodeAbiParameters(
            parseAbiParameters("address, uint256, bytes32, bytes32, bytes32, uint256, bytes32, bytes32"),
            [
                op.sender as `0x${string}`,
                BigInt(hexToNumber(op.nonce as `0x${string}`)),
                keccak256("0x"), // initcode
                keccak256(op.callData as `0x${string}`),
                ("0x" + accountGasLimits) as `0x${string}`,
                BigInt(hexToNumber(op.preVerificationGas as `0x${string}`)),
                ("0x" + gasFees) as `0x${string}`,
                keccak256((op.paymasterAndData || "0x") as `0x${string}`),
            ],
        );

        const pack2 = encodeAbiParameters(
            parseAbiParameters("bytes32, address, uint256"),
            [keccak256(pack1), this.entryPoint as `0x${string}`, BigInt(this.chainId)],
        );

        const messageHash = keccak256(pack2);

        op.signature = await this.account.signMessage({
            message: {raw: messageHash},
        });
        return op;
    }

    private async submitOperation(op: UserOperationV7): Promise<any> {
        const response = await fetch(this.bundlerUrl, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_sendUserOperation",
                params: [op, this.entryPoint],
                id: 1,
            }),
        });

        const result = await response.json();

        if (result.error) {
            throw new Error(
                `UserOperation submission failed: ${result.error.message}`,
            );
        }

        return result.result;
    }

    private async waitForReceipt(opHash: string): Promise<any> {
        for (let i = 0; i < 50; i++) {
            await new Promise((resolve) => setTimeout(resolve, 10000));

            const response = await fetch(this.bundlerUrl, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "eth_getUserOperationReceipt",
                    params: [opHash],
                    id: 1,
                }),
            });

            const result = await response.json();

            if (result.result) {
                if (result.result.receipt.status !== "0x1") {
                    throw new Error("UserOperation failed");
                }
                return result.result;
            }
        }
        throw new Error("UserOperation timed out");
    }

    async signSubmitOp(op: UserOperationV7): Promise<any> {
        const signedOp = await this.signV7Operation(op);
        const opHash = await this.submitOperation(signedOp);
        return await this.waitForReceipt(opHash);
    }

    async createSmartAccount(
        params: CreateSmartAccountParams,
    ): Promise<CreateResult> {
        const account = privateKeyToAccount(this.privateKey as `0x${string}`);
        const publicClient = createPublicClient({
            chain: bobaSepolia,
            transport: http(this.getRpc()),
        });
        const walletClient = createWalletClient({
            account,
            chain: bobaSepolia,
            transport: http(this.getRpc()),
        });
        const saltBI = BigInt(params.salt);

        // owner is either explicitly set, or derived from the PK
        const newOwner = params.ownerAddress
            ? params.ownerAddress
            : (account.address as `0x${string}`);

        const smartAccountAddress = await publicClient.readContract({
            address: this.factoryAddress as `0x${string}`,
            abi: ACCOUNT_FACTORY_ABI,
            functionName: "getAddress",
            args: [newOwner, saltBI],
        });

        console.log("New Address: ", smartAccountAddress);

        const data = encodeFunctionData({
            abi: ACCOUNT_FACTORY_ABI,
            functionName: "createAccount",
            args: [newOwner, saltBI],
        });

        const gas = await publicClient.estimateGas({
            account,
            to: this.factoryAddress as `0x${string}`,
            data,
        });

        const hash = await walletClient.sendTransaction({
            to: this.factoryAddress as `0x${string}`,
            data,
            gas,
        });
        const receipt = await publicClient.waitForTransactionReceipt({hash});

        const pendingNonce = await publicClient.getTransactionCount({
            address: account.address,
            blockTag: "pending",
        });

        try {
            const fundHash = await walletClient.sendTransaction({
                to: smartAccountAddress as `0x${string}`,
                value: parseEther("0.001"),
                nonce: pendingNonce,
            });
            await publicClient.waitForTransactionReceipt({hash: fundHash});
            console.log(`Funded ${smartAccountAddress} with 0.001 ETH: ${fundHash}`);
        } catch (err: any) {
            if (String(err?.message || err).includes("nonce too low")) {
                const nonce2 = await publicClient.getTransactionCount({
                    address: account.address,
                    blockTag: "pending",
                });
                const fundHash = await walletClient.sendTransaction({
                    to: smartAccountAddress as `0x${string}`,
                    value: parseEther("0.001"),
                    nonce: nonce2,
                });
                await publicClient.waitForTransactionReceipt({hash: fundHash});
                console.log(`Funded on retry: ${fundHash}`);
            } else {
                throw err;
            }
        }

        return {address: smartAccountAddress as any, receipt};
    }

    async getExpectedAddress({salt}: GetExpectedAddressParams): Promise<`0x${string}`> {
        const account = privateKeyToAccount(this.privateKey as `0x${string}`);

        const publicClient = createPublicClient({
            chain: bobaSepolia,
            transport: http(this.getRpc()),
        });

        const saltBI = BigInt(salt);
        const expectedAddress = await publicClient.readContract({
            address: this.factoryAddress as `0x${string}`,
            abi: ACCOUNT_FACTORY_ABI,
            functionName: "getAddress",
            args: [account.address, saltBI],
        });

        return expectedAddress as `0x${string}`;
    }

    async getOwner(contractAddress: string): Promise<string> {
        const result = await this.publicClient.call({
            to: contractAddress as `0x${string}`,
            data: "0x8da5cb5b",
        });

        // For getOwner, we just need to return the address directly since it's already properly formatted
        return result.data as string;
    }
}
