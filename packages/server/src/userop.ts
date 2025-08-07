import Web3 from 'web3';

export interface UserOperationV7 {
    sender: string;
    nonce: string;
    callData: string;
    callGasLimit: string;
    verificationGasLimit: string;
    preVerificationGas: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    signature: string;
    paymasterAndData?: string;
    accountGasLimits?: string;
    gasFees?: string;
}

export class UserOpManager {
    private web3: Web3;
    private bundlerUrl: string;
    private nodeUrl: string;
    private entryPoint: string;
    private chainId: number;
    private readonly entrypointV7 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
    private readonly factoryAddress = '0x9aC904d8DfeA0866aB341208700dCA9207834DeB';

    constructor(nodeUrl: string, bundlerUrl: string, entryPoint: string, chainId: number) {
        this.web3 = new Web3(new Web3.providers.HttpProvider(nodeUrl));
        this.nodeUrl = nodeUrl;
        this.bundlerUrl = bundlerUrl;
        this.entryPoint = entryPoint;
        this.chainId = chainId;
    }

    selector(signature: string): string {
        return this.web3.utils.keccak256(signature).slice(0, 10);
    }

    private async getNonce(address: string, key: number = 0): Promise<string> {
        const encodedParams = this.web3.eth.abi.encodeParameters(['address', 'uint192'], [address, key]);
        const calldata = this.selector('getNonce(address,uint192)') + encodedParams.slice(2);
        
        const result = await this.web3.eth.call({
            to: this.entryPoint,
            data: calldata
        });
        
        return result;
    }

    async buildOp(
        sender: string, 
        target: string, 
        value: number, 
        calldata: string, 
        nonceKey: number = 0
    ): Promise<UserOperationV7> {
        const gasPrice = await this.web3.eth.getGasPrice();
        const tip = Math.max(Number(gasPrice) - Number(gasPrice), Number(Web3.utils.toWei('0.5', 'gwei')));
        const baseFee = Number(gasPrice) - tip;
        const fee = Math.max(Number(gasPrice), 2 * baseFee + tip);

        const encodedParams = this.web3.eth.abi.encodeParameters(['address', 'uint256', 'bytes'], [target, value, calldata]);
        const executeCalldata = this.selector('execute(address,uint256,bytes)') + encodedParams.slice(2);

        // For v0.7, we need to include the packed gas limits and fees
        const verificationGasLimit = 0 //250000; // Default verification gas
        const callGasLimit = 0 //200000; // Default call gas
        
        const accountGasLimits = this.web3.eth.abi.encodeParameter('uint128', verificationGasLimit).slice(34) +
            this.web3.eth.abi.encodeParameter('uint128', callGasLimit).slice(34);

        const gasFees = this.web3.eth.abi.encodeParameter('uint128', tip).slice(34) +
            this.web3.eth.abi.encodeParameter('uint128', fee).slice(34);

        return {
            sender,
            nonce: await this.getNonce(sender, nonceKey),
            callData: executeCalldata,
            callGasLimit: Web3.utils.toHex(callGasLimit),
            verificationGasLimit: Web3.utils.toHex(verificationGasLimit),
            preVerificationGas: Web3.utils.toHex(45000), // Default preVerificationGas
            maxFeePerGas: Web3.utils.toHex(fee),
            maxPriorityFeePerGas: Web3.utils.toHex(tip),
            signature: '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c',
            paymasterAndData: '0x',
            accountGasLimits: '0x' + accountGasLimits,
            gasFees: '0x' + gasFees
        };
    }

    public getEntrypoint() {
        return this.entryPoint
    }

    public getRpc() {
        return this.nodeUrl;
    }

    public isV7Entrypoint() {
        return this.entrypointV7.toLowerCase() === this.entrypointV7.toLowerCase();
    }

    async estimateOp(op: UserOperationV7): Promise<{ success: boolean, op: UserOperationV7 }> {
        try {
            const response = await fetch(this.bundlerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_estimateUserOperationGas',
                    params: [op, this.entryPoint],
                    id: 1
                })
            });

            const result = await response.json();
            
            if (result.error) {
                console.error('Gas estimation failed:', result.error);
                return { success: false, op };
            }

            const estimates = result.result;
            op.preVerificationGas = estimates.preVerificationGas;
            op.verificationGasLimit = estimates.verificationGasLimit;
            op.callGasLimit = estimates.callGasLimit;

            return { success: true, op };
        } catch (error) {
            console.error('Gas estimation error:', error);
            return { success: false, op };
        }
    }

    private signV7Operation(op: UserOperationV7, privateKey: string): UserOperationV7 {
        const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
        
        const verificationGasLimit = Web3.utils.toNumber(op.verificationGasLimit);
        const callGasLimit = Web3.utils.toNumber(op.callGasLimit);
        const maxPriorityFeePerGas = Web3.utils.toNumber(op.maxPriorityFeePerGas);
        const maxFeePerGas = Web3.utils.toNumber(op.maxFeePerGas);
        
        const accountGasLimits = this.web3.eth.abi.encodeParameter('uint128', verificationGasLimit).slice(34) +
            this.web3.eth.abi.encodeParameter('uint128', callGasLimit).slice(34);

        const gasFees = this.web3.eth.abi.encodeParameter('uint128', maxPriorityFeePerGas).slice(34) +
            this.web3.eth.abi.encodeParameter('uint128', maxFeePerGas).slice(34);

        const pack1 = this.web3.eth.abi.encodeParameters(
            ['address', 'uint256', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32', 'bytes32'],
            [
                op.sender,
                Web3.utils.toNumber(op.nonce),
                this.web3.utils.keccak256('0x'), // initcode
                this.web3.utils.keccak256(op.callData),
                '0x' + accountGasLimits,
                Web3.utils.toNumber(op.preVerificationGas),
                '0x' + gasFees,
                this.web3.utils.keccak256(op.paymasterAndData || '0x')
            ]
        );

        const pack2 = this.web3.eth.abi.encodeParameters(
            ['bytes32', 'address', 'uint256'],
            [this.web3.utils.keccak256(pack1), this.entryPoint, this.chainId]
        );

        const messageHash = this.web3.utils.keccak256(pack2);
        const signature = account.sign(messageHash);
        
        op.signature = signature.signature;
        return op;
    }

    private async submitOperation(op: UserOperationV7): Promise<any> {
        const response = await fetch(this.bundlerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_sendUserOperation',
                params: [op, this.entryPoint],
                id: 1
            })
        });

        const result = await response.json();
        
        if (result.error) {
            throw new Error(`UserOperation submission failed: ${result.error.message}`);
        }

        return result.result;
    }

    private async waitForReceipt(opHash: string): Promise<any> {
        for (let i = 0; i < 50; i++) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            const response = await fetch(this.bundlerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getUserOperationReceipt',
                    params: [opHash],
                    id: 1
                })
            });

            const result = await response.json();
            
            if (result.result) {
                if (result.result.receipt.status !== '0x1') {
                    throw new Error('UserOperation failed');
                }
                return result.result;
            }
        }
        throw new Error('UserOperation timed out');
    }

    async signSubmitOp(op: UserOperationV7, privateKey: string): Promise<any> {
        const signedOp = this.signV7Operation(op, privateKey);
        const opHash = await this.submitOperation(signedOp);
        return await this.waitForReceipt(opHash);
    }

    async createSmartAccount(
        senderAddress: string, 
        privateKey: string, 
        ownerAddress: string, 
        salt: number = 100, 
        factoryAddress: string = this.factoryAddress
    ): Promise<{ smartAccountAddress: string, receipt: any }> {
        // First, predict the smart account address
        const encodedParams = this.web3.eth.abi.encodeParameters(['address', 'uint256'], [ownerAddress, salt]);
        const calldata = '0x5fbfb9cf' + encodedParams.slice(2);

        const predictedAddress = await this.web3.eth.call({
            to: factoryAddress,
            data: calldata
        });
        const smartAccountAddress = this.web3.eth.abi.decodeParameter('address', predictedAddress) as string;

        // Build and execute UserOperation to actually create the account
        const op = await this.buildOp(senderAddress, factoryAddress, 0, calldata);
        const { success, op: estimatedOp } = await this.estimateOp(op);
        
        if (!success) {
            throw new Error('Failed to estimate gas for smart account creation');
        }

        const receipt = await this.signSubmitOp(estimatedOp, privateKey);

        return {
            smartAccountAddress,
            receipt
        };
    }

    async getOwner(contractAddress: string): Promise<string> {
        const result = await this.web3.eth.call({
            to: contractAddress,
            data: '0x8da5cb5b' // owner() method signature
        });

        return this.web3.eth.abi.decodeParameter('address', result) as string;
    }
} 