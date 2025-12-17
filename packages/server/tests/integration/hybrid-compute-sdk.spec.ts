import {HybridComputeSDK} from "../../src";

process.env.HC_HELPER_ADDR = "0x1234567890123456789012345678901234567890";
process.env.OC_HYBRID_ACCOUNT = "0x0987654321098765432109876543210987654321";
process.env.CHAIN_ID = "1";
process.env.OC_PRIVKEY =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
process.env.ENTRY_POINTS = "0xabcdef1234567890abcdef1234567890abcdef12";

describe("SDK Tests", () => {
  let sdk: HybridComputeSDK;

  beforeEach(() => {
    sdk = new HybridComputeSDK();
  });

  describe("createJsonRpcServerInstance", () => {
    it("should create an Express app and JSON-RPC server", () => {
      sdk.createJsonRpcServerInstance();
      expect(sdk.getApp()).toBeDefined();
      expect(sdk.getServer()).toBeDefined();
    });
  });

  describe("isServerHealthy", () => {
    it("should return false when server is not initialized", () => {
      expect(sdk.isServerHealthy()).toBe(false);
    });

    it("should return true when server is initialized", () => {
      sdk.createJsonRpcServerInstance();
      expect(sdk.isServerHealthy()).toBe(true);
    });
  });
});
