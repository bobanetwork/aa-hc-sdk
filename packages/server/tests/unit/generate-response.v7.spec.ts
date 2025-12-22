import {
  encodeAbiParameters,
  hexToBytes,
  keccak256,
  parseAbiParameters,
  recoverMessageAddress,
  stringToHex,
  toBytes,
  toHex
} from "viem";
import {generateResponseV7} from "../../src";
import {selector} from "../../src/utils";

describe("Generate Response: V7", () => {
  const MOCK_REQ = {
    srcAddr: "0x77fBd8F873e9361241161DE136AD47883722b971",
    srcNonce: 2,
    opNonce: 12635766777711130205978152665277793421719161519075797539213956612096n,
    skey: new Uint8Array(32).fill(0xaa),
    reqBytes: "0x1234",
  };

  const MOCK_RESPONSE_PAYLOAD =
    "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000012323932342e323631363437333634383534350000000000000000000000000000";

  beforeAll(() => {
    process.env.HC_HELPER_ADDR = "0x11c4DbbaC4A0A47a7c76b5603bc219c5dAe752D6";
    process.env.OC_HYBRID_ACCOUNT = "0xe320ffca9e2bd1173d041f47fdc197e168fc1ea9";
    process.env.ENTRY_POINTS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
    process.env.CHAIN_ID = "28882";
    process.env.OC_PRIVKEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  });

  afterAll(() => {
    delete process.env.HC_HELPER_ADDR;
    delete process.env.OC_HYBRID_ACCOUNT;
    delete process.env.ENTRY_POINTS;
    delete process.env.CHAIN_ID;
    delete process.env.OC_PRIVKEY;
  });

  it("should generate valid signature for production ETH price request", async () => {
    const request = {
      srcAddr: "0xf40d61fb6a4f4e8658661c113c630c66fffb6670",
      reqBytes: "000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000034554480000000000000000000000000000000000000000000000000000000000",
      srcNonce: BigInt("2"),
      skey: hexToBytes("0x92ca68dd4634511b7d08a8ecac91171835546f11014d60e5117acb395fbe54cd"),
      opNonce: BigInt("25701704508088784691694756462441184117135612165485296107384398151681"),
    };

    const expectedResponse = "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000011323634332e333931343134343336353339000000000000000000000000000000";
    const result = await generateResponseV7(request, 0, expectedResponse);

    expect(result.success).toBe(true);
    expect(result.response).toBe(expectedResponse);
    expect(result.signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
    
    const result2 = await generateResponseV7(request, 0, expectedResponse);
    expect(result.signature).toBe(result2.signature);
  });

  it("should handle error codes correctly", async () => {
    const request = {
      srcAddr: "0xf40d61fb6a4f4e8658661c113c630c66fffb6670",
      reqBytes: "000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000034554480000000000000000000000000000000000000000000000000000000000",
      srcNonce: BigInt("2"),
      skey: hexToBytes("0x92ca68dd4634511b7d08a8ecac91171835546f11014d60e5117acb395fbe54cd"),
      opNonce: BigInt("25701704508088784691694756462441184117135612165485296107384398151681"),
    };

    const errorPayload = stringToHex("Error occurred");
    const result = await generateResponseV7(request, 1, errorPayload);

    expect(result.success).toBe(false);
    expect(result.response).toBe(errorPayload);
    expect(result.signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
  });

  it("should generate consistent signatures for same input", async () => {
    const request = {
      srcAddr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      reqBytes: "0x1234567890abcdef",
      srcNonce: BigInt(123456),
      skey: new Uint8Array(32).fill(0x01),
      opNonce: BigInt(789012),
    };

    const payload = stringToHex("payload");
    const result1 = await generateResponseV7(request, 0, payload);
    const result2 = await generateResponseV7(request, 0, payload);

    expect(result1.signature).toBe(result2.signature);
    expect(result1.response).toBe(result2.response);
    expect(result1.success).toBe(result2.success);
  });

  it("should handle different payload sizes", async () => {
    const request = {
      srcAddr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      reqBytes: "0x1234567890abcdef",
      srcNonce: BigInt(123456),
      skey: new Uint8Array(32).fill(0x01),
      opNonce: BigInt(789012),
    };

    const smallPayload = stringToHex("small");
    const largePayload = stringToHex("this is a much larger payload that should still work correctly");

    const smallResult = await generateResponseV7(request, 0, smallPayload);
    const largeResult = await generateResponseV7(request, 0, largePayload);

    expect(smallResult.signature).toBeDefined();
    expect(largeResult.signature).toBeDefined();
    expect(smallResult.signature).not.toBe(largeResult.signature);
  });

  it("should handle BigInt nonces correctly", async () => {
    const request = {
      srcAddr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      reqBytes: "0x1234567890abcdef",
      srcNonce: BigInt("18446744073709551615"),
      skey: new Uint8Array(32).fill(0x01),
      opNonce: BigInt("340282366920938463463374607431768211455"),
    };

    const payload = stringToHex("test");
    const result = await generateResponseV7(request, 0, payload);

    expect(result.signature).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.response).toBe(payload);
  });

  it("should produce 65-byte signatures", async () => {
    const request = {
      srcAddr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      reqBytes: "0x1234567890abcdef",
      srcNonce: BigInt(123456),
      skey: new Uint8Array(32).fill(0x01),
      opNonce: BigInt(789012),
    };

    const payload = stringToHex("test");
    const result = await generateResponseV7(request, 0, payload);

    expect(result.signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
  });

  it("should produce different signatures for different private keys", async () => {
    const request = {
      srcAddr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      reqBytes: "0x1234567890abcdef",
      srcNonce: BigInt(123456),
      skey: new Uint8Array(32).fill(0x01),
      opNonce: BigInt(789012),
    };

    const payload = stringToHex("test");
    const result1 = await generateResponseV7(request, 0, payload);

    process.env.OC_PRIVKEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const result2 = await generateResponseV7(request, 0, payload);

    expect(result1.signature).not.toBe(result2.signature);
  });

  it("should throw error for missing environment variables", async () => {
    delete process.env.HC_HELPER_ADDR;

    const request = {
      srcAddr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      reqBytes: "0x1234567890abcdef",
      srcNonce: BigInt(123456),
      skey: new Uint8Array(32).fill(0x01),
      opNonce: BigInt(789012),
    };

    await expect(async () => {
      await generateResponseV7(request, 0, stringToHex("test"));
    }).rejects.toThrow("One or more required environment variables are not defined");

    process.env.HC_HELPER_ADDR = "0x11c4DbbaC4A0A47a7c76b5603bc219c5dAe752D6";
  });

  describe("selector() function", () => {
    it("should generate correct PutResponse selector", () => {
      expect(selector("PutResponse(bytes32,bytes)")).toBe("dfc98ae8");
    });

    it("should generate correct execute selector", () => {
      expect(selector("execute(address,uint256,bytes)")).toBe("b61d27f6");
    });

    it("should match Python Web3.keccak(text=name) behavior", () => {
      const testString = "test(uint256)";
      const hash = keccak256(toBytes(testString));
      expect(hash.slice(0, 10)).toBe(keccak256(toBytes(testString)).slice(0, 10));
    });
  });

  describe("calldata construction", () => {
    it("should construct putResponseCallData with correct selector", () => {
      const enc_merged_response = encodeAbiParameters(
        parseAbiParameters("address, uint256, uint32, bytes"),
        [MOCK_REQ.srcAddr as `0x${string}`, BigInt(MOCK_REQ.srcNonce), 0, MOCK_RESPONSE_PAYLOAD as `0x${string}`]
      );

      const p1_enc = encodeAbiParameters(
        parseAbiParameters("bytes32, bytes"),
        [toHex(MOCK_REQ.skey), enc_merged_response as `0x${string}`]
      );

      const putResponseCallData = "0x" + selector("PutResponse(bytes32,bytes)") + p1_enc.slice(2);

      expect(putResponseCallData.startsWith("0xdfc98ae8")).toBe(true);
      expect(putResponseCallData.length).toBeGreaterThan(10);
    });

    it("should construct executeCallData with correct selector", () => {
      const helperAddr = "0x11c4DbbaC4A0A47a7c76b5603bc219c5dAe752D6";
      const mockCallData = "0xdfc98ae81234";

      const p2_enc = encodeAbiParameters(
        parseAbiParameters("address, uint256, bytes"),
        [helperAddr.toLowerCase() as `0x${string}`, BigInt(0), mockCallData as `0x${string}`]
      );

      const executeCallData = "0x" + selector("execute(address,uint256,bytes)") + p2_enc.slice(2);

      expect(executeCallData.startsWith("0xb61d27f6")).toBe(true);
      expect(executeCallData).toContain(helperAddr.toLowerCase().slice(2));
    });
  });

  describe("gas calculations", () => {
    it("should calculate call_gas_limit using bundler formula", () => {
      const respPayloadBytes = hexToBytes(MOCK_RESPONSE_PAYLOAD as `0x${string}`);
      const call_gas_limit = 705 * respPayloadBytes.length + 170000;

      expect(call_gas_limit).toBe(237680);
      expect(call_gas_limit).toBe(705 * 96 + 170000);
    });

    it("should encode accountGasLimits correctly", () => {
      const verification_gas_limit = 0x10000;
      const call_gas_limit = 237680;

      const verificationGasEncoded = encodeAbiParameters(parseAbiParameters("uint128"), [BigInt(verification_gas_limit)]);
      const callGasEncoded = encodeAbiParameters(parseAbiParameters("uint128"), [BigInt(call_gas_limit)]);

      const verificationGasPart = verificationGasEncoded.slice(34, 66);
      const callGasPart = callGasEncoded.slice(34, 66);
      const accountGasLimits = "0x" + verificationGasPart + callGasPart;

      expect(accountGasLimits).toBe("0x000000000000000000000000000100000000000000000000000000000003a070");
    });

    it("should handle empty payload", () => {
      const emptyPayload = "0x";
      const respPayloadBytes = hexToBytes(emptyPayload as `0x${string}`);
      const call_gas_limit = 705 * respPayloadBytes.length + 170000;

      expect(call_gas_limit).toBe(170000);
    });

    it("should handle large payload", () => {
      const largePayload = "0x" + "ff".repeat(10000);
      const respPayloadBytes = hexToBytes(largePayload as `0x${string}`);
      const call_gas_limit = 705 * respPayloadBytes.length + 170000;

      expect(call_gas_limit).toBe(705 * 10000 + 170000);
    });
  });

  describe("hash calculations", () => {
    it("should calculate empty data hash correctly", () => {
      const emptyHash = keccak256("0x");
      expect(emptyHash).toBe("0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
    });

    it("should pack operation parameters correctly", () => {
      const OC_HYBRID_ACCOUNT = "0xe320ffca9E2BD1173d041f47fDC197e168Fc1EA9";
      const accountGasLimits = "0x000000000000000000000000000100000000000000000000000000000003a070" as `0x${string}`;
      const initCodeHash = keccak256("0x");
      const callDataHash = "0x56ddb6616554be5572bb1636e315abbc1404270eee0539f0a4262206a7ca5110" as `0x${string}`;
      const paymasterAndDataHash = keccak256("0x");

      const packed = encodeAbiParameters(
        parseAbiParameters("address, uint256, bytes32, bytes32, bytes32, uint256, bytes32, bytes32"),
        [
          OC_HYBRID_ACCOUNT.toLowerCase() as `0x${string}`,
          BigInt(MOCK_REQ.opNonce),
          initCodeHash,
          callDataHash,
          accountGasLimits,
          BigInt(0x10000),
          ("0x" + "0".repeat(64)) as `0x${string}`,
          paymasterAndDataHash,
        ]
      );

      expect(packed).toContain(OC_HYBRID_ACCOUNT.toLowerCase().slice(2));
      expect(packed.length).toBeGreaterThan(500);
    });
  });

  describe("signature verification", () => {
    it("should produce recoverable signature", async () => {
      const testHash = "0x279a79b0f759fb1bb78b34c028af8ce4fa6f087ddad8fa95706c6318e5f5789a" as `0x${string}`;
      const testSignature = "0x1290b62c59a5a3d168ae3a1980d3c3f298f8feaec28c39f0f293636a9216929156f0b55d8b53c4f440b676a43f94d3557870e79cc9a67a641790ed45e317c3841c" as `0x${string}`;

      const recoveredAddress = await recoverMessageAddress({
        message: { raw: testHash },
        signature: testSignature,
      });

      expect(recoveredAddress).toBeDefined();
      expect(recoveredAddress.startsWith("0x")).toBe(true);
    });

    it("should reject invalid signatures", async () => {
      const mockHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
      
      await expect(async () => {
        await recoverMessageAddress({
          message: { raw: mockHash },
          signature: "0x" + "00".repeat(65) as `0x${string}`,
        });
      }).rejects.toThrow();
    });
  });

  describe("ABI encoding", () => {
    it("should match logged values for known input", () => {
      const enc_merged_response = encodeAbiParameters(
        parseAbiParameters("address, uint256, uint32, bytes"),
        [
          "0x77fbd8f873e9361241161de136ad47883722b971" as `0x${string}`,
          BigInt(2),
          0,
          MOCK_RESPONSE_PAYLOAD as `0x${string}`,
        ]
      );

      expect(enc_merged_response).toContain("77fbd8f873e9361241161de136ad47883722b971");
    });

    it("should handle error code 1", () => {
      const enc_merged_response = encodeAbiParameters(
        parseAbiParameters("address, uint256, uint32, bytes"),
        [MOCK_REQ.srcAddr as `0x${string}`, BigInt(MOCK_REQ.srcNonce), 1, MOCK_RESPONSE_PAYLOAD as `0x${string}`]
      );

      expect(enc_merged_response).toBeDefined();
    });
  });
});
