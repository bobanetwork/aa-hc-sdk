import {HybridComputeClientSDK} from "../src";

describe('HybridComputeClientSDK', () => {
    let sdk: HybridComputeClientSDK;

    beforeEach(() => {
        sdk = new HybridComputeClientSDK('1', '0x1234567890123456789012345678901234567890');
    });

    describe('buildInvokeTransaction', () => {
        it('should build a valid invoke transaction', async () => {
            const params = {
                selector: {
                    name: 'transfer',
                    params: ['address', 'uint256'],
                },
                transaction: {
                    contractAddress: '0x1234567890123456789012345678901234567890',
                    parameters: {
                        types: ['address', 'uint256'],
                        values: ['0x1234567890123456789012345678901234567890', '1000000000000000000'],
                    },
                    value: "0"
                },
            };

            const result = await sdk.buildInvokeTransaction(params);

            expect(result).toHaveProperty('payload');
            expect(result.payload).toHaveProperty('to', params.transaction.contractAddress);
            expect(result.payload).toHaveProperty('value', '0');
            expect(result.payload).toHaveProperty('data');
            expect(result).toHaveProperty('account', '0x1234567890123456789012345678901234567890');
            expect(result).toHaveProperty('scope', 'eip155:1');
        });
    });

    describe('invokeSnap', () => {
        it('should call window.ethereum.request with correct parameters', async () => {
            const mockRequest = jest.fn().mockResolvedValue('mockResult');
            global.window = {
                ethereum: {
                    request: mockRequest,
                },
            } as any;

            const params = {
                selector: {
                    name: 'transfer',
                    params: ['address', 'uint256'],
                },
                transaction: {
                    contractAddress: '0x1234567890123456789012345678901234567890',
                    parameters: {
                        types: ['address', 'uint256'],
                        values: ['0x1234567890123456789012345678901234567890', '1000000000000000000'],
                    },
                    value: "0"
                },
            };

            const mockTransaction = await sdk.buildInvokeTransaction(params)

            const invokeOptions = {
                defaultSnapOrigin: 'npm:@metamask/example-snap',
                usePaymaster: false,
                transactionDetails: mockTransaction,
            };

            const result = await sdk.invokeSnap(invokeOptions);

            expect(mockRequest).toHaveBeenCalledWith({
                method: 'wallet_invokeSnap',
                params: {
                    snapId: 'npm:@metamask/example-snap',
                    request: {
                        method: 'eth_sendUserOpBoba',
                        params: [invokeOptions.transactionDetails],
                        id: '0x1234567890123456789012345678901234567890',
                    },
                },
            });

            expect(result).toBe('mockResult');
        });
    });

    describe('setConnectedAccount', () => {
        it('should update the connected account', () => {
            sdk.setConnectedAccount('0x9876543210987654321098765432109876543210');
            expect((sdk as any).accountIdConnected).toBe('0x9876543210987654321098765432109876543210');
        });
    });

    describe('setChain', () => {
        it('should update the chain', () => {
            sdk.setChain('42');
            expect((sdk as any).chain).toBe('42');
        });
    });
});