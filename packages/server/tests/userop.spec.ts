import {UserOpManager} from '../src/userop';
import Web3 from 'web3';
import * as dotenv from 'dotenv'

dotenv.config()

describe('AABundler SDK', () => {
    it('should call fetchPrice(string) via UserOperation', async () => {
        // Configuration
        const CONTRACT_ADDRESS = '0x704bc4e8f85f60f77e753d5f3f55e3f1c569586f';
        const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
        const RPC = "https://boba-sepolia.gateway.tenderly.co"
        const BUNDLER = "https://bundler-hc.sepolia.boba.network/rpc"
        const CHAIN_ID = 28882;
        const sender = '0x57D5AaF4C16c82a6435EF9e4102d807C47eDe74E';
        const privateKey = process.env.CLIENT_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error("CLIENT_PRIVATE_KEY not found")
        }

        const userOpManager = new UserOpManager(RPC, BUNDLER, ENTRY_POINT, CHAIN_ID);
        const web3 = new Web3(new Web3.providers.HttpProvider(RPC));

        const token = 'ETH';
        const encodedToken = web3.eth.abi.encodeParameter('string', token);
        const calldata = userOpManager.selector('fetchPrice(string)') + encodedToken.slice(2);

        const op = await userOpManager.buildOp(sender, CONTRACT_ADDRESS, 0, calldata, 0);

        console.log('Built UserOperation:', JSON.stringify(op, null, 2));

        const {success, op: estimatedOp} = await userOpManager.estimateOp(op);

        console.log('Gas estimation success:', success);
        console.log('Estimated gas:', {
            callGasLimit: estimatedOp.callGasLimit,
            verificationGasLimit: estimatedOp.verificationGasLimit,
            preVerificationGas: estimatedOp.preVerificationGas
        });

        const receipt = await userOpManager.signSubmitOp(estimatedOp, privateKey);

        expect(receipt).toBeDefined();
        expect(receipt.success).toBe(true);
        expect(receipt.receipt.status).toBe('0x1');
    }, 60000);
}); 