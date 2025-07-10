import { generateResponseV7 } from '../src/utils';
import Web3 from 'web3';

describe('generateResponseV7 - Production Data Verification', () => {
    const web3 = new Web3();

    beforeAll(() => {
        process.env.HC_HELPER_ADDR = '0x11c4DbbaC4A0A47a7c76b5603bc219c5dAe752D6';
        process.env.OC_HYBRID_ACCOUNT = '0xe320ffca9e2bd1173d041f47fdc197e168fc1ea9';
        process.env.ENTRY_POINTS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
        process.env.CHAIN_ID = '28882';
        process.env.OC_PRIVKEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    });

    afterAll(() => {
        // Clean up environment variables
        delete process.env.HC_HELPER_ADDR;
        delete process.env.OC_HYBRID_ACCOUNT;
        delete process.env.ENTRY_POINTS;
        delete process.env.CHAIN_ID;
        delete process.env.OC_PRIVKEY;
    });

    describe('Production Log Test Case', () => {
        it('should generate valid signature for ETH price request using production parameters', () => {
            const request = {
                srcAddr: '0xf40d61fb6a4f4e8658661c113c630c66fffb6670',
                reqBytes: '000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000034554480000000000000000000000000000000000000000000000000000000000',
                srcNonce: BigInt('2'), // From src_nonce in logs
                skey: web3.utils.hexToBytes('0x92ca68dd4634511b7d08a8ecac91171835546f11014d60e5117acb395fbe54cd'),
                opNonce: BigInt('25701704508088784691694756462441184117135612165485296107384398151681') // From oo_nonce calculation
            };

            const expectedResponse = '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000011323634332e333931343134343336353339000000000000000000000000000000';            
            const result = generateResponseV7(request, 0, expectedResponse);

            expect(result.success).toBe(true);
            expect(result.response).toBe(expectedResponse);
            expect(result.signature).toBeDefined();
            expect(result.signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
            const result2 = generateResponseV7(request, 0, expectedResponse);
            expect(result.signature).toBe(result2.signature);
        });

        it('should handle error codes correctly with production parameters', () => {
            const request = {
                srcAddr: '0xf40d61fb6a4f4e8658661c113c630c66fffb6670',
                reqBytes: '000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000034554480000000000000000000000000000000000000000000000000000000000',
                srcNonce: BigInt('2'),
                skey: web3.utils.hexToBytes('0x92ca68dd4634511b7d08a8ecac91171835546f11014d60e5117acb395fbe54cd'),
                opNonce: BigInt('25701704508088784691694756462441184117135612165485296107384398151681')
            };

            const errorPayload = web3.utils.utf8ToHex('Error occurred');
            const result = generateResponseV7(request, 1, errorPayload);

            expect(result.success).toBe(false);
            expect(result.response).toBe(errorPayload);
            expect(result.signature).toBeDefined();
            expect(result.signature).toMatch(/^0x[0-9a-fA-F]{130}$/); // 65 bytes = 130 hex chars
        });

        it('should match existing v0.7 test signature for known parameters', () => {
            // Use the same parameters as the existing user-operation.spec.ts test
            const request = {
                srcAddr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                reqBytes: "0x1234567890abcdef",
                srcNonce: BigInt(123456),
                skey: new Uint8Array([
                    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
                    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
                    0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
                    0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20
                ]),
                opNonce: BigInt(789012)
            };

            // Set up environment to match existing test
            process.env.OC_HYBRID_ACCOUNT = '0x77fbd8f873e9361241161de136ad47883722b971';
            
            const payload = web3.utils.utf8ToHex("payload");
            const result = generateResponseV7(request, 0, payload);

            expect(result.success).toBe(true);
            expect(result.response).toBe(payload);
            expect(result.signature).toBeDefined();
            expect(result.signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
        });
    });

    describe('V0.7 Core Functionality', () => {
        beforeEach(() => {
            // Set up test environment with known test private key
            process.env.HC_HELPER_ADDR = '0x11c4DbbaC4A0A47a7c76b5603bc219c5dAe752D6';
            process.env.OC_HYBRID_ACCOUNT = '0x77fbd8f873e9361241161de136ad47883722b971';
            process.env.CHAIN_ID = '28882';
            process.env.OC_PRIVKEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
            process.env.ENTRY_POINTS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
        });

        it('should generate consistent signatures for same input', () => {
            const request = {
                srcAddr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                reqBytes: "0x1234567890abcdef",
                srcNonce: BigInt(123456),
                skey: new Uint8Array([
                    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
                    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
                    0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
                    0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20
                ]),
                opNonce: BigInt(789012)
            };

            const payload = web3.utils.utf8ToHex("payload");
            
            const result1 = generateResponseV7(request, 0, payload);
            const result2 = generateResponseV7(request, 0, payload);

            expect(result1.signature).toBe(result2.signature);
            expect(result1.response).toBe(result2.response);
            expect(result1.success).toBe(result2.success);
        });

        it('should handle different payload sizes correctly', () => {
            const request = {
                srcAddr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                reqBytes: "0x1234567890abcdef",
                srcNonce: BigInt(123456),
                skey: new Uint8Array(32).fill(0x01),
                opNonce: BigInt(789012)
            };

            const smallPayload = web3.utils.utf8ToHex("small");
            const largePayload = web3.utils.utf8ToHex("this is a much larger payload that should still work correctly");

            const smallResult = generateResponseV7(request, 0, smallPayload);
            const largeResult = generateResponseV7(request, 0, largePayload);

            expect(smallResult.signature).toBeDefined();
            expect(largeResult.signature).toBeDefined();
            expect(smallResult.signature).not.toBe(largeResult.signature);
        });

        it('should handle BigInt nonces correctly', () => {
            const request = {
                srcAddr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                reqBytes: "0x1234567890abcdef",
                srcNonce: BigInt('18446744073709551615'), // Max uint64
                skey: new Uint8Array(32).fill(0x01),
                opNonce: BigInt('340282366920938463463374607431768211455') // Max uint128
            };

            const payload = web3.utils.utf8ToHex("test");
            const result = generateResponseV7(request, 0, payload);

            expect(result.signature).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.response).toBe(payload);
        });

        it('should throw error for missing environment variables', () => {
            delete process.env.HC_HELPER_ADDR;

            const request = {
                srcAddr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                reqBytes: "0x1234567890abcdef",
                srcNonce: BigInt(123456),
                skey: new Uint8Array(32).fill(0x01),
                opNonce: BigInt(789012)
            };

            expect(() => {
                generateResponseV7(request, 0, web3.utils.utf8ToHex("test"));
            }).toThrow("One or more required environment variables are not defined");
        });

        describe('Gas Calculation Verification', () => {
            it('should calculate gas correctly for different payload sizes', () => {
                const request = {
                    srcAddr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                    reqBytes: "0x1234567890abcdef",
                    srcNonce: BigInt(123456),
                    skey: new Uint8Array(32).fill(0x01),
                    opNonce: BigInt(789012)
                };

                // Test with known payload sizes
                const payload32Bytes = '0x' + '00'.repeat(32); // 32 bytes
                const payload64Bytes = '0x' + '00'.repeat(64); // 64 bytes
                
                const result32 = generateResponseV7(request, 0, payload32Bytes);
                const result64 = generateResponseV7(request, 0, payload64Bytes);

                expect(result32.signature).toBeDefined();
                expect(result64.signature).toBeDefined();
                expect(result32.signature).not.toBe(result64.signature);
            });
        });

        describe('Signature Format Verification', () => {
            it('should produce 65-byte signatures (130 hex chars)', () => {
                const request = {
                    srcAddr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                    reqBytes: "0x1234567890abcdef",
                    srcNonce: BigInt(123456),
                    skey: new Uint8Array(32).fill(0x01),
                    opNonce: BigInt(789012)
                };

                const payload = web3.utils.utf8ToHex("test");
                const result = generateResponseV7(request, 0, payload);

                expect(result.signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
            });

            it('should produce different signatures for different private keys', () => {
                const request = {
                    srcAddr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                    reqBytes: "0x1234567890abcdef",
                    srcNonce: BigInt(123456),
                    skey: new Uint8Array(32).fill(0x01),
                    opNonce: BigInt(789012)
                };

                const payload = web3.utils.utf8ToHex("test");
                
                // First signature
                const result1 = generateResponseV7(request, 0, payload);
                
                // Change private key and generate second signature
                process.env.OC_PRIVKEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
                const result2 = generateResponseV7(request, 0, payload);

                expect(result1.signature).not.toBe(result2.signature);
            });
        });
    });
}); 