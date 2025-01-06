import {generateResponse} from "../src";
import Web3 from "web3";

describe('UserOperation Encoding', function () {

    beforeAll(() => {
        process.env.HC_HELPER_ADDR = '0x11c4DbbaC4A0A47a7c76b5603bc219c5dAe752D6';
        process.env.OC_HYBRID_ACCOUNT = '0x77fbd8f873e9361241161de136ad47883722b971';
        process.env.CHAIN_ID = '28882';
        process.env.OC_PRIVKEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        process.env.ENTRY_POINTS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
    });

    it('should encode UserOperations correctly for V7', function () {
        // Convert string payload to hex bytes
        const payload = Web3.utils.utf8ToHex("payload");  // This converts the string to proper hex bytes

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

        const response = generateResponse(request, 0, payload);

        expect(response.success)
        expect(response.signature).toEqual("0x9c87d771f6f93673e01509641b37c17234aada309781fd514a212fe2d299d1b8358c0ab63513f51512cfe3f9d0b68b11ce8c984677bf292c8d7aa0e3606937731c");
        expect(response.response).toEqual("0x7061796c6f6164");
    });
});