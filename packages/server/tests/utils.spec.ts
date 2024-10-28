import {
    selector,
    generateResponse,
    getParsedRequest, Web3,
} from '../src/utils';

describe('Web3 Utils', () => {
    const web3: Web3 = new Web3();
    const INIT_WORKING_PARAMS = {
        ver: '0.2',
        sk: 'e450d1db466678d703f18358d5e09749d871818d1c0ffb7375e18eb42304b02e',
        src_addr: '0ab728952d1b1f77c2f2368922ba0d9987ff6f5b',
        src_nonce: '0000000000000000000000000000000000000000000000000000000000000001',
        oo_nonce: '0xab728952d1b1f77c2f2368922ba0d9987ff6f5b0000000000000000',
        payload: '000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000034554480000000000000000000000000000000000000000000000000000000000'
    }

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Setup environment variables
        process.env.HC_HELPER_ADDR = '0x1234567890123456789012345678901234567890';
        process.env.OC_HYBRID_ACCOUNT = '0x2234567890123456789012345678901234567890';
        process.env.CHAIN_ID = '1';
        process.env.OC_PRIVKEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
        process.env.ENTRY_POINTS = '0x3234567890123456789012345678901234567890';
    });

    describe('selector', () => {
        it('should return first 8 characters of keccak256 hash without 0x prefix', () => {
            const result = selector('test');
            expect(result).toBe('9c22ff5f');

            const result2 = selector('another_method_added');
            expect(result2).toBe('d2fa5013');
        });
    });

    describe('parseOffchainParameter', () => {
        it('should correctly parse offchain parameters', () => {
            const result = getParsedRequest(INIT_WORKING_PARAMS);
            expect(result).toBeDefined()
        });
    });

    describe("should have the same outcome after parsed request was simplified", () => {
        it('should be congruent', function () {
            // initial params received | old way: parseParams -> parseRequest ->
            const finalOriginallyRequestedParams = {
                skey: new Uint8Array([
                    228, 80, 209, 219, 70, 102, 120, 215, 3, 241, 131, 88, 213, 224, 151, 73,
                    216, 113, 129, 141, 28, 15, 251, 115, 117, 225, 142, 180, 35, 4, 176, 46
                ]),
                srcAddr: '0x0aB728952d1b1f77c2f2368922ba0D9987Ff6f5b',
                srcNonce: 1,
                opNonce: 1128469964098940624791511213450670170707241872172207430605675167744n,
                reqBytes: '000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000034554480000000000000000000000000000000000000000000000000000000000'
            }

            const parsedRequestParams = getParsedRequest(INIT_WORKING_PARAMS);
            expect(parsedRequestParams).toEqual(finalOriginallyRequestedParams)
        });
    })

    describe('generateResponse', () => {
        it('should generate a valid response with signature', () => {
            const resPayload = web3.eth.abi.encodeParameter("string", '2500');
            const result = generateResponse(getParsedRequest(INIT_WORKING_PARAMS), 0, resPayload);

            expect(result).toBeDefined();
            expect(result.success).toBeTruthy();
            expect(result.response).toBeDefined();
            expect(result.signature).toBeDefined()
        });

        it('should set success to false when error code is non-zero', () => {
            const resPayload = web3.eth.abi.encodeParameter("string", '2500');
            const result = generateResponse(getParsedRequest(INIT_WORKING_PARAMS), 1, resPayload);

            expect(result.success).toEqual(false);
            expect(result).toBeDefined();
            expect(result.response).toBeDefined();
            expect(result.signature).toBeDefined()
        });
    });
});