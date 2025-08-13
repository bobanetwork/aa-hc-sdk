import Web3 from "web3";
import {ACCOUNT_FACTORY_ABI} from "./abis";
import {
    CreateResult,
    CreateSmartAccountParams,
    GetExpectedAddressParams, UserOperationV7,
} from "./utils";
import {
    createPublicClient,
    createWalletClient,
    http,
    encodeFunctionData,
    parseEther,
    toHex,
} from "viem";
import {privateKeyToAccount, privateKeyToAddress} from "viem/accounts";
import {bobaSepolia} from "viem/chains";

export class UserOpManager {
    private web3: Web3;
    private bundlerUrl: string;
    private nodeUrl: string;
    private entryPoint: string;
    private chainId: number;
    private privateKey: string;
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
        this.web3 = new Web3(new Web3.providers.HttpProvider(nodeUrl));
        this.nodeUrl = nodeUrl;
        this.bundlerUrl = bundlerUrl;
        this.entryPoint = entryPoint;
        this.chainId = chainId;
        this.privateKey = privateKey;
    }

    selector(signature: string): string {
        return this.web3.utils.keccak256(signature).slice(0, 10);
    }

    private async getNonce(address: string, key: number = 0): Promise<string> {
        const encodedParams = this.web3.eth.abi.encodeParameters(
            ["address", "uint192"],
            [address, key],
        );
        const calldata =
            this.selector("getNonce(address,uint192)") + encodedParams.slice(2);

        const result = await this.web3.eth.call({
            to: this.entryPoint,
            data: calldata,
        });

        return result;
    }

    async buildOp(
        sender: string,
        target: string,
        value: number,
        calldata: string,
        nonceKey: number = 0,
    ): Promise<UserOperationV7> {
        const gasPrice = await this.web3.eth.getGasPrice();
        const tip = Math.max(
            Number(gasPrice) - Number(gasPrice),
            Number(Web3.utils.toWei("0.5", "gwei")),
        );
        const baseFee = Number(gasPrice) - tip;
        const fee = Math.max(Number(gasPrice), 2 * baseFee + tip);

        const encodedParams = this.web3.eth.abi.encodeParameters(
            ["address", "uint256", "bytes"],
            [target, value, calldata],
        );
        const executeCalldata =
            this.selector("execute(address,uint256,bytes)") + encodedParams.slice(2);

        // For v0.7, we need to include the packed gas limits and fees
        const verificationGasLimit = 0; //250000; // Default verification gas
        const callGasLimit = 0; //200000; // Default call gas

        const accountGasLimits =
            this.web3.eth.abi
                .encodeParameter("uint128", verificationGasLimit)
                .slice(34) +
            this.web3.eth.abi.encodeParameter("uint128", callGasLimit).slice(34);

        const gasFees =
            this.web3.eth.abi.encodeParameter("uint128", tip).slice(34) +
            this.web3.eth.abi.encodeParameter("uint128", fee).slice(34);

        return {
            sender,
            nonce: await this.getNonce(sender, nonceKey),
            callData: executeCalldata,
            callGasLimit: Web3.utils.toHex(callGasLimit),
            verificationGasLimit: Web3.utils.toHex(verificationGasLimit),
            preVerificationGas: Web3.utils.toHex(45000), // Default preVerificationGas
            maxFeePerGas: Web3.utils.toHex(fee),
            maxPriorityFeePerGas: Web3.utils.toHex(tip),
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
                return {success: false, op};
            }

            const estimates = result.result;
            op.preVerificationGas = estimates.preVerificationGas;
            op.verificationGasLimit = estimates.verificationGasLimit;
            op.callGasLimit = estimates.callGasLimit;

            return {success: true, op};
        } catch (error) {
            console.error("Gas estimation error:", error);
            return {success: false, op};
        }
    }

    private signV7Operation(op: UserOperationV7): UserOperationV7 {
        const account = this.web3.eth.accounts.privateKeyToAccount(this.privateKey);

        const verificationGasLimit = Web3.utils.toNumber(op.verificationGasLimit);
        const callGasLimit = Web3.utils.toNumber(op.callGasLimit);
        const maxPriorityFeePerGas = Web3.utils.toNumber(op.maxPriorityFeePerGas);
        const maxFeePerGas = Web3.utils.toNumber(op.maxFeePerGas);

        const accountGasLimits =
            this.web3.eth.abi
                .encodeParameter("uint128", verificationGasLimit)
                .slice(34) +
            this.web3.eth.abi.encodeParameter("uint128", callGasLimit).slice(34);

        const gasFees =
            this.web3.eth.abi
                .encodeParameter("uint128", maxPriorityFeePerGas)
                .slice(34) +
            this.web3.eth.abi.encodeParameter("uint128", maxFeePerGas).slice(34);

        const pack1 = this.web3.eth.abi.encodeParameters(
            [
                "address",
                "uint256",
                "bytes32",
                "bytes32",
                "bytes32",
                "uint256",
                "bytes32",
                "bytes32",
            ],
            [
                op.sender,
                Web3.utils.toNumber(op.nonce),
                this.web3.utils.keccak256("0x"), // initcode
                this.web3.utils.keccak256(op.callData),
                "0x" + accountGasLimits,
                Web3.utils.toNumber(op.preVerificationGas),
                "0x" + gasFees,
                this.web3.utils.keccak256(op.paymasterAndData || "0x"),
            ],
        );

        const pack2 = this.web3.eth.abi.encodeParameters(
            ["bytes32", "address", "uint256"],
            [this.web3.utils.keccak256(pack1), this.entryPoint, this.chainId],
        );

        const messageHash = this.web3.utils.keccak256(pack2);
        const signature = account.sign(messageHash);

        op.signature = signature.signature;
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
        const signedOp = this.signV7Operation(op);
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
        const result = await this.web3.eth.call({
            to: contractAddress,
            data: "0x8da5cb5b",
        });

        return this.web3.eth.abi.decodeParameter("address", result) as string;
    }
}
