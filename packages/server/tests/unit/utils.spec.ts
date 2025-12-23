import { decodeAbiParameters, parseAbiParameters, hexToBytes } from "viem";
import { selector, getParsedRequest, parseOffchainParameter, parseRequest, OffchainParameter } from "../../src/utils";

describe("Utils: ABI Encoding/Decoding", () => {
  it("should decode token price correctly", () => {
    const encodedData =
      "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000012323931362e383533383835323736303531360000000000000000000000000000";
    
    const [decodedData] = decodeAbiParameters(
      parseAbiParameters("string"),
      encodedData as `0x${string}`
    );
    
    expect(decodedData).toEqual("2916.8538852760516");
  });

  it("should decode long text correctly", () => {
    const encodedData =
      "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000fe486f772063616e2074686520556e69746564205374617465732062616c616e636520646f6d65737469632065636f6e6f6d69632073747261746567696573206c696b652073747564656e74206c6f616e2072656d697373696f6e207769746820676c6f62616c2066696e616e6369616c2073686966747320737563682061732074686520696e6372656173696e67206d6f76656d656e7420617761792066726f6d2074686520555320446f6c6c617220627920425249435320636f756e74726965732c207768696c6520656e737572696e67206c6f6e672d7465726d20706f6c69746963616c20616e642065636f6e6f6d69632073746162696c6974793f0000";
    
    const [decodedData] = decodeAbiParameters(
      parseAbiParameters("string"),
      encodedData as `0x${string}`
    );
    
    expect(decodedData).toContain("How can the United States balance");
  });

  it("should decode another token price correctly", () => {
    const encodedData =
      "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000012323932382e333436363734393333303232380000000000000000000000000000";
    
    const [decodedData] = decodeAbiParameters(
      parseAbiParameters("string"),
      encodedData as `0x${string}`
    );
    
    expect(decodedData).toEqual("2928.3466749330228");
  });
});

describe("Utils: Selector Function", () => {
  it("should generate correct selector for simple function", () => {
    const result = selector("transfer(address,uint256)");
    expect(result).toBe("a9059cbb");
    expect(result.length).toBe(8);
  });

  it("should generate correct selector for execute function", () => {
    const result = selector("execute(address,uint256,bytes)");
    expect(result).toBe("b61d27f6");
  });

  it("should generate correct selector for PutResponse", () => {
    const result = selector("PutResponse(bytes32,bytes)");
    expect(result).toBe("dfc98ae8");
  });

  it("should generate correct selector for getNonce", () => {
    const result = selector("getNonce(address,uint192)");
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });

  it("should handle function with no parameters", () => {
    const result = selector("test()");
    expect(result).toMatch(/^[0-9a-f]{8}$/);
    expect(result.length).toBe(8);
  });

  it("should be deterministic for same input", () => {
    const result1 = selector("myFunction(string)");
    const result2 = selector("myFunction(string)");
    expect(result1).toBe(result2);
  });

  it("should produce different selectors for different functions", () => {
    const result1 = selector("functionA(uint256)");
    const result2 = selector("functionB(uint256)");
    expect(result1).not.toBe(result2);
  });
});

describe("Utils: getParsedRequest", () => {
  const validParams: OffchainParameter = {
    ver: "0.2",
    sk: "e450d1db466678d703f18358d5e09749d871818d1c0ffb7375e18eb42304b02e",
    src_addr: "0ab728952d1b1f77c2f2368922ba0d9987ff6f5b",
    src_nonce: "0000000000000000000000000000000000000000000000000000000000000001",
    oo_nonce: "0xab728952d1b1f77c2f2368922ba0d9987ff6f5b0000000000000000",
    payload: "0x1234",
  };

  it("should parse valid offchain parameters", () => {
    const result = getParsedRequest(validParams);
    
    expect(result).toBeDefined();
    expect(result.srcAddr).toBe("0x0aB728952d1b1f77c2f2368922ba0D9987Ff6f5b");
    expect(result.srcNonce).toBe(1);
    expect(result.reqBytes).toBe("0x1234");
    expect(result.skey).toBeInstanceOf(Uint8Array);
    expect(result.skey.length).toBe(32);
  });

  it("should handle different nonce values", () => {
    const params = { ...validParams, src_nonce: "00000000000000000000000000000000000000000000000000000000000000ff" };
    const result = getParsedRequest(params);
    expect(result.srcNonce).toBe(255);
  });

  it("should handle large nonce values", () => {
    const params = { ...validParams, src_nonce: "0000000000000000000000000000000000000000000000000000000000ffffff" };
    const result = getParsedRequest(params);
    expect(result.srcNonce).toBe(16777215);
  });

  it("should handle opNonce as BigInt", () => {
    const result = getParsedRequest(validParams);
    expect(typeof result.opNonce).toBe("bigint");
  });

  it("should handle empty payload", () => {
    const params = { ...validParams, payload: "" };
    const result = getParsedRequest(params);
    expect(result.reqBytes).toBe("");
  });

  it("should handle 0x prefixed payload", () => {
    const params = { ...validParams, payload: "0xabcdef" };
    const result = getParsedRequest(params);
    expect(result.reqBytes).toBe("0xabcdef");
  });

  it("should checksum the address correctly", () => {
    const params = { ...validParams, src_addr: "0ab728952d1b1f77c2f2368922ba0d9987ff6f5b" };
    const result = getParsedRequest(params);
    expect(result.srcAddr).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(result.srcAddr.toLowerCase()).toBe("0x0ab728952d1b1f77c2f2368922ba0d9987ff6f5b");
  });

  it("should pad skey to 32 bytes", () => {
    const result = getParsedRequest(validParams);
    expect(result.skey.length).toBe(32);
  });

  it("should handle different skey lengths", () => {
    const params = { ...validParams, sk: "0xff" };
    const result = getParsedRequest(params);
    expect(result.skey.length).toBe(32);
  });
});

describe("Utils: Deprecated Functions", () => {
  const testParams: OffchainParameter = {
    ver: "0.2",
    sk: "0xe450d1db466678d703f18358d5e09749d871818d1c0ffb7375e18eb42304b02e",
    src_addr: "0x0ab728952d1b1f77c2f2368922ba0d9987ff6f5b",
    src_nonce: "0000000000000000000000000000000000000000000000000000000000000001",
    oo_nonce: "0xab728952d1b1f77c2f2368922ba0d9987ff6f5b0000000000000000",
    payload: "0x1234",
  };

  it("should parse offchain parameters with parseOffchainParameter", () => {
    const result = parseOffchainParameter(testParams);
    
    expect(result).toBeDefined();
    expect(result.srcAddr).toBe(testParams.src_addr);
    expect(result.srcNonce).toBe(testParams.src_nonce);
    expect(result.ooNonce).toBe(testParams.oo_nonce);
    expect(result.payload).toBe(testParams.payload);
    expect(result.sk).toBe(testParams.sk);
    expect(result.ver).toBe(testParams.ver);
  });

  it("should convert parsed parameters with parseRequest", () => {
    const parsed = parseOffchainParameter(testParams);
    const result = parseRequest(parsed);
    
    expect(result).toBeDefined();
    expect(typeof result.srcNonce).toBe("number");
    expect(typeof result.opNonce).toBe("number");
    expect(result.skey).toBeInstanceOf(Uint8Array);
    expect(result.reqBytes).toBe(testParams.payload);
  });

  it("should maintain consistency between old and new flow", () => {
    const newFlow = getParsedRequest(testParams);
    const oldFlow = parseRequest(parseOffchainParameter(testParams));
    
    expect(newFlow.srcAddr).toBe(oldFlow.srcAddr);
    expect(newFlow.srcNonce).toBe(oldFlow.srcNonce);
    expect(newFlow.reqBytes).toBe(oldFlow.reqBytes);
    expect(Array.from(newFlow.skey)).toEqual(Array.from(oldFlow.skey));
  });
});
