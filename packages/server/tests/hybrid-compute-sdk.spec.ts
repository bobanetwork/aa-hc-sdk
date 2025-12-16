import { HybridComputeSDK } from "../src";
import { selector } from "../src/utils";
// @ts-ignore
import request from "supertest";

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

  describe("addServerAction", () => {
    it("should add a method to the JSON-RPC server", async () => {
      const mockHandler = jest.fn().mockResolvedValue({ result: "success" });
      sdk.createJsonRpcServerInstance();
      sdk.addServerAction("testMethod", mockHandler);

      const server = sdk.getServer();
      const methodName = selector("testMethod");
      const params = {
        ver: "1.0",
        sk: "0xkey",
        src_addr: "0xaddr",
        src_nonce: "123",
        oo_nonce: "456",
        payload: "0xpayload",
      };

      // Use type assertion to access private server instance
      const response = await (server as any).receive({
        jsonrpc: "2.0",
        method: methodName,
        params,
        id: 1,
      });

      expect(response).toBeDefined();
      expect(mockHandler).toHaveBeenCalled();
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

  describe("API Integration", () => {
    it.skip("should handle JSON-RPC requests correctly", async () => {
      const mockHandler = jest.fn().mockResolvedValue({ result: "success" });

      sdk
        .createJsonRpcServerInstance()
        .addServerAction("testMethod", mockHandler)
        .listenAt(3000);

      const app = sdk.getApp();
      if (!app) throw new Error("App not initialized");

      const response = await request(app)
        .post("/hc")
        .send({
          jsonrpc: "2.0",
          method: selector("testMethod"),
          params: {
            ver: "1.0",
            sk: "0xkey",
            src_addr: "0xaddr",
            src_nonce: "123",
            oo_nonce: "456",
            payload: "0xpayload",
          },
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalled();
    });
  });
});
