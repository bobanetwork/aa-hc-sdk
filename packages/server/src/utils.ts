import {
    keccak256,
    toHex,
    hexToBytes,
    checksumAddress,
    hexToNumber,
    encodeAbiParameters,
    parseAbiParameters, toBytes, padHex, hexToBigInt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

export type CreateResult = { address: string; receipt: any };

export interface UserOperationV7 {
  sender: string;
  nonce: string;
  initCode?: string;
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

export type CreateSmartAccountParams = {
  salt: number;
  ownerAddress?: string;
  ownerPrivateKey?: string;
};

export type GetExpectedAddressParams = {
  salt: number | string;
};

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

export function selector(name: string): string {
    const hash = keccak256(toBytes(name));
    return hash.slice(2, 10);
}

function selectorHex(name: string): string {
  const hex = toHex(keccak256(name as `0x${string}`));
  return hex.slice(0, 10); // Keep 0x prefix
}

/*** @deprecated in favor of getParsedRequest which simplifies the usage of `parseOffchainParameter` and `parseRequest` */
function parseOffchainParameter(
  params: OffchainParameter,
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
    skey: hexToBytes(params.sk as `0x${string}`),
    srcAddr: checksumAddress(params.srcAddr as `0x${string}`),
    srcNonce: hexToNumber(("0x" + params.srcNonce) as `0x${string}`),
    opNonce: hexToNumber(params.ooNonce as `0x${string}`),
    reqBytes: params.payload,
  } as const;
}

function getParsedRequest(params: OffchainParameter): Request {
    return {
        skey: hexToBytes(padHex(params.sk as `0x${string}`, { size: 32 })),
        srcAddr: checksumAddress(padHex(params.src_addr as `0x${string}`, { size: 20 })),
        srcNonce: hexToNumber(("0x" + params.src_nonce) as `0x${string}`),
        opNonce: hexToBigInt(params.oo_nonce as `0x${string}`),
        reqBytes: params.payload,
    } as const;
}

function decodeAbi(
  types: string[],
  data: string,
): { [key: string]: unknown; __length__: number } {
  // Note: VIEM doesn't have a direct equivalent to Web3's decodeParameters with named properties
  // This would need to be handled differently based on the specific use case
  // For now, we'll throw an error to identify where this is used so we can handle it properly
  throw new Error("decodeAbi function needs specific VIEM implementation based on usage context");
}

/**
 * V6 EntryPoint compliant generateResponse implementation
 * This is not compatible with EntryPoint v0.7 ()
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
const generateResponseV6 = async (
  req: {
    readonly srcAddr: string;
    readonly reqBytes: string;
    readonly srcNonce: bigint | number;
    readonly skey: Uint8Array;
    readonly opNonce: bigint | number;
  },
  errorCode: number,
  respPayload: any,
) => {
  if (
    !process.env.HC_HELPER_ADDR ||
    !process.env.OC_HYBRID_ACCOUNT ||
    !process.env.CHAIN_ID ||
    !process.env.OC_PRIVKEY ||
    !process.env.ENTRY_POINTS
  ) {
    throw new Error(
      "One or more required environment variables are not defined",
    );
  }

  const encodedResponse = encodeAbiParameters(
    parseAbiParameters("address, uint256, uint32, bytes"),
    [req.srcAddr as `0x${string}`, BigInt(req.srcNonce), errorCode, respPayload as `0x${string}`],
  );
  const putResponseCallData = encodeAbiParameters(
    parseAbiParameters("bytes32, bytes"),
    [toHex(req.skey), encodedResponse],
  );
  const putResponseEncoded =
    "0x" +
    selector("PutResponse(bytes32,bytes)") +
    putResponseCallData.slice(2);
  const callDataEncoded = encodeAbiParameters(
    parseAbiParameters("address, uint256, bytes"),
    [
      checksumAddress(process.env.HC_HELPER_ADDR as `0x${string}`),
      BigInt(0),
      putResponseEncoded as `0x${string}`,
    ],
  );
  const executeEncoded =
    "0x" +
    selector("execute(address,uint256,bytes)") +
    callDataEncoded.slice(2);
  // Step 4: Calculate gas limits
  const limits = {
    verificationGasLimit: "0x10000",
    preVerificationGas: "0x10000",
  };
  const callGasEstimate =
    705 * hexToBytes(respPayload as `0x${string}`).length + 170000;
  
  const verificationGasEncoded = encodeAbiParameters(
    parseAbiParameters("uint128"),
    [BigInt(hexToNumber(limits.verificationGasLimit as `0x${string}`))],
  );
  const callGasEncoded = encodeAbiParameters(
    parseAbiParameters("uint128"),
    [BigInt(callGasEstimate)],
  );
  
  const accountGasLimits = Buffer.concat([
    Buffer.from(verificationGasEncoded.slice(-32, -16), 'hex'),
    Buffer.from(callGasEncoded.slice(-32, -16), 'hex'),
  ]);

    const packed = encodeAbiParameters(
        parseAbiParameters("address, uint256, bytes32, bytes32, bytes32, uint256, bytes32, bytes32"),
        [
            process.env.OC_HYBRID_ACCOUNT as `0x${string}`,
            BigInt(req.opNonce),
            keccak256("0x"),
            keccak256(executeEncoded as `0x${string}`),
            padHex(("0x" + accountGasLimits.toString("hex")) as `0x${string}`, { size: 32 }),
            BigInt(hexToNumber(limits.preVerificationGas as `0x${string}`)),
            ("0x" + "0".repeat(64)) as `0x${string}`,
            keccak256("0x"),
        ],
    );

  // Step 7: Calculate final hash
  const finalHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters("bytes32, address, uint256"),
      [
        keccak256(packed),
        process.env.ENTRY_POINTS as `0x${string}`,
        BigInt(process.env.CHAIN_ID),
      ],
    ),
  );

  const account = privateKeyToAccount(process.env.OC_PRIVKEY! as `0x${string}`);
  const signature = await account.signMessage({
    message: { raw: finalHash },
  });
  return {
    success: errorCode === 0,
    response: respPayload,
    signature: signature,
  };
};

/**
 * V0.7 compliant generateResponse function that works with EntryPoint v0.7
 *
 * Works with Entrypoint: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
 *
 * This function creates v0.7 UserOperation signatures that are compatible with
 * the bundler's verification expectations (raw hash signing without Ethereum message prefix).
 *
 * @param {object} req - The request object containing source address, nonce, and other details.
 * @param {number} errorCode - The error code to include in the response.
 * @param {string} respPayload - The response payload to include.
 * @returns {object} - An object containing the success status, response payload, and signature.
 * @throws {Error}
 */
const generateResponseV7 = async (
  req: {
    readonly srcAddr: string;
    readonly reqBytes: string;
    readonly srcNonce: bigint | number;
    readonly skey: Uint8Array;
    readonly opNonce: bigint | number;
  },
  errorCode: number,
  respPayload: any,
): Promise<ServerActionResponse> => {
  if (
    !process.env.HC_HELPER_ADDR ||
    !process.env.OC_HYBRID_ACCOUNT ||
    !process.env.CHAIN_ID ||
    !process.env.OC_PRIVKEY ||
    !process.env.ENTRY_POINTS
  ) {
    throw new Error(
      "One or more required environment variables are not defined",
    );
  }

  const resp2 = encodeAbiParameters(
    parseAbiParameters("address, uint256, uint32, bytes"),
    [req.srcAddr as `0x${string}`, BigInt(req.srcNonce), errorCode, respPayload as `0x${string}`],
  );

  const putResponseCallData = encodeAbiParameters(
    parseAbiParameters("bytes32, bytes"),
    [toHex(req.skey), resp2],
  );
  const p_enc1 =
    selectorHex("PutResponse(bytes32,bytes)") + putResponseCallData.slice(2);

  const executeCallData = encodeAbiParameters(
    parseAbiParameters("address, uint256, bytes"),
    [checksumAddress(process.env.HC_HELPER_ADDR as `0x${string}`), BigInt(0), p_enc1 as `0x${string}`],
  );
  const p_enc2 =
    selectorHex("execute(address,uint256,bytes)") + executeCallData.slice(2);

  const limits = {
    verificationGasLimit: "0x10000",
    preVerificationGas: "0x10000",
  };

  const respPayloadBytes = hexToBytes(respPayload as `0x${string}`);
  const callGas = 705 * respPayloadBytes.length + 170000;

  const verificationGasEncoded = encodeAbiParameters(
    parseAbiParameters("uint128"),
    [BigInt(hexToNumber(limits.verificationGasLimit as `0x${string}`))],
  );
  const callGasEncoded = encodeAbiParameters(
    parseAbiParameters("uint128"),
    [BigInt(callGas)],
  );

  const verificationGasPart = verificationGasEncoded.slice(34, 66); // 32 chars
  const callGasPart = callGasEncoded.slice(34, 66); // 32 chars
  const accountGasLimits = "0x" + verificationGasPart + callGasPart;

  const initCodeHash = keccak256("0x");
  const callDataHash = keccak256(p_enc2 as `0x${string}`);
  const paymasterAndDataHash = keccak256("0x");

  const packed = encodeAbiParameters(
    parseAbiParameters("address, uint256, bytes32, bytes32, bytes32, uint256, bytes32, bytes32"),
    [
      process.env.OC_HYBRID_ACCOUNT as `0x${string}`,
      BigInt(req.opNonce),
      initCodeHash,
      callDataHash,
      accountGasLimits as `0x${string}`,
      BigInt(hexToNumber(limits.preVerificationGas as `0x${string}`)),
      ("0x" + "0".repeat(64)) as `0x${string}`,
      paymasterAndDataHash,
    ],
  );

  const packedHash = keccak256(packed);
  const ooHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters("bytes32, address, uint256"),
      [packedHash, process.env.ENTRY_POINTS as `0x${string}`, BigInt(process.env.CHAIN_ID)],
    ),
  );

  const account = privateKeyToAccount(process.env.OC_PRIVKEY! as `0x${string}`);
  const signature = await account.signMessage({
    message: { raw: ooHash },
  });

  return {
    success: errorCode === 0,
    response: respPayload,
    signature: signature,
  };
};

export {
  getParsedRequest,
  parseOffchainParameter,
  parseRequest,
  decodeAbi,
  generateResponseV6,
  generateResponseV7,
};
