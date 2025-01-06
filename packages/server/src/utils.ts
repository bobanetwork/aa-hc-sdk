import Web3, { HexString } from "web3";
import "dotenv/config";

export type OffchainParameterParsed = {
    ver: string;
    sk: string;
    srcAddr: string;
    srcNonce: string;
    ooNonce: string;
    payload: string;
};

export type OffchainParameter = {
    ver: string;
    sk: string;
    src_addr: string;
    src_nonce: string;
    oo_nonce: string;
    payload: string;
};

export type Request = {
    skey: Uint8Array;
    srcAddr: string;
    srcNonce: number | bigint;
    opNonce: number | bigint;
    reqBytes: string;
};

export interface ServerActionResponse {
    success: boolean;
    response: any;
    signature: string;
}

const web3 = new Web3();

export function selector(name: string): HexString {
    const hex = web3.utils.toHex(web3.utils.keccak256(name));
    return hex.slice(2, 10);
}

/*** @deprecated in favor of getParsedRequest which simplifies the usage of `parseOffchainParameter` and `parseRequest` */
function parseOffchainParameter(
    params: OffchainParameter
): OffchainParameterParsed {
    return {
        ooNonce: params.oo_nonce,
        payload: params.payload,
        sk: params.sk,
        srcAddr: params.src_addr,
        srcNonce: params.src_nonce,
        ver: params.ver,
    };
}
/*** @deprecated in favor of getParsedRequest which simplifies the usage of `parseOffchainParameter` and `parseRequest` */
function parseRequest(params: OffchainParameterParsed): Request {
    return {
        skey: web3.utils.hexToBytes(params.sk),
        srcAddr: web3.utils.toChecksumAddress(params.srcAddr),
        srcNonce: web3.utils.hexToNumber("0x" + params.srcNonce),
        opNonce: web3.utils.hexToNumber(params.ooNonce),
        reqBytes: params.payload,
    } as const;
}

function getParsedRequest(params: OffchainParameter): Request {
    return {
        skey: web3.utils.hexToBytes(params.sk),
        srcAddr: web3.utils.toChecksumAddress(params.src_addr),
        srcNonce: web3.utils.hexToNumber("0x" + params.src_nonce),
        opNonce: web3.utils.hexToNumber(params.oo_nonce),
        reqBytes: params.payload,
    } as const;
}

function decodeAbi(
    types: string[],
    data: string
): { [key: string]: unknown; __length__: number } {
    return web3.eth.abi.decodeParameters(types, data);
}

/**
 * Generates and returns a response object with a signed payload.
 *
 * This function takes a request object, an error code, and a response payload,
 * encodes the necessary parameters, estimates gas, and signs the final encoded
 * parameters before returning the result. It ensures the integrity and
 * authenticity of the response by using the account's private key to sign the
 * hash of the final encoded parameters.
 *
 * @param {object} req - The request object containing source address, nonce, and other details.
 * @param {number} errorCode - The error code to include in the response.
 * @param {string} respPayload - The response payload to include.
 * @returns {object} - An object containing the success status, response payload, and signature.
 * @throws {Error}
 */
const generateResponse = (
    req: {
        readonly srcAddr: string;
        readonly reqBytes: string;
        readonly srcNonce: bigint | number;
        readonly skey: Uint8Array;
        readonly opNonce: bigint | number;
    },
    errorCode: number,
    respPayload: any
) => {
    if (!process.env.HC_HELPER_ADDR || !process.env.OC_HYBRID_ACCOUNT ||
        !process.env.CHAIN_ID || !process.env.OC_PRIVKEY || !process.env.ENTRY_POINTS) {
        throw new Error("One or more required environment variables are not defined");
    }

    const encodedResponse = web3.eth.abi.encodeParameters(
        ["address", "uint256", "uint32", "bytes"],
        [req.srcAddr, req.srcNonce, errorCode, respPayload]
    );
    const putResponseCallData = web3.eth.abi.encodeParameters(
        ["bytes32", "bytes"],
        [req.skey, encodedResponse]
    );
    const putResponseEncoded = "0x" + selector("PutResponse(bytes32,bytes)") +
        putResponseCallData.slice(2);
    const callDataEncoded = web3.eth.abi.encodeParameters(
        ["address", "uint256", "bytes"],
        [
            web3.utils.toChecksumAddress(process.env.HC_HELPER_ADDR),
            0,
            putResponseEncoded,
        ]
    );
    const executeEncoded = "0x" + selector("execute(address,uint256,bytes)") +
        callDataEncoded.slice(2);
    // Step 4: Calculate gas limits
    const limits = {
        verificationGasLimit: "0x10000",
        preVerificationGas: "0x10000",
    };
    const callGasEstimate = 705 * web3.utils.hexToBytes(respPayload).length + 170000;
    const accountGasLimits = Buffer.concat([
        Buffer.from(web3.eth.abi.encodeParameter('uint128',
            limits.verificationGasLimit).slice(-32, -16)),
        Buffer.from(web3.eth.abi.encodeParameter('uint128',
            callGasEstimate).slice(-32, -16))
    ]);
    const packed = web3.eth.abi.encodeParameters(
        [
            'address', 'uint256', 'bytes32', 'bytes32', 'bytes32',
            'uint256', 'bytes32', 'bytes32',
        ],
        [
            process.env.OC_HYBRID_ACCOUNT,
            req.opNonce,
            web3.utils.keccak256("0x"),
            web3.utils.keccak256(executeEncoded),
            '0x' + accountGasLimits.toString('hex'),
            limits.preVerificationGas,
            '0x' + '0'.repeat(64),
            web3.utils.keccak256("0x"),
        ]
    );
    // Step 7: Calculate final hash
    const finalHash = web3.utils.keccak256(
        web3.eth.abi.encodeParameters(
            ["bytes32", "address", "uint256"],
            [
                web3.utils.keccak256(packed),
                process.env.ENTRY_POINTS,
                process.env.CHAIN_ID,
            ]
        )
    );

    const account = web3.eth.accounts.privateKeyToAccount(process.env.OC_PRIVKEY!);
    const signature = account.sign(finalHash);
    return {
        success: errorCode === 0,
        response: respPayload,
        signature: signature.signature,
    };
};

export {
    Web3,
    HexString,
    getParsedRequest,
    parseOffchainParameter,
    parseRequest,
    decodeAbi,
    generateResponse
};