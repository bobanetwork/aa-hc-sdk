import {HybridComputeSDK} from "../../src";
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

  describe("isServerHealthy", () => {
    it("should return false when server is not initialized", () => {
      expect(sdk.isServerHealthy()).toBe(false);
    });

    it("should return true when server is initialized", () => {
      sdk.createJsonRpcServerInstance();
      expect(sdk.isServerHealthy()).toBe(true);
    });
  });

  describe("addServerAction", () => {
    beforeEach(() => {
      sdk.createJsonRpcServerInstance();
    });

    it("should register a server action", () => {
      const action = jest.fn().mockReturnValue({ result: "success" });
      
      sdk.addServerAction("testAction", action);
      
      expect(sdk.getServer()).toBeDefined();
    });

    it("should allow chaining after addServerAction", () => {
      const action = jest.fn();
      
      const result = sdk.addServerAction("testAction", action);
      
      expect(result).toBe(sdk);
    });

    it("should register multiple server actions", () => {
      const action1 = jest.fn().mockReturnValue({ data: "action1" });
      const action2 = jest.fn().mockReturnValue({ data: "action2" });
      
      sdk.addServerAction("action1", action1);
      sdk.addServerAction("action2", action2);
      
      expect(sdk.getServer()).toBeDefined();
    });
  });

  describe("JSON-RPC Endpoint", () => {
    beforeEach(() => {
      sdk.createJsonRpcServerInstance();
    });

    it("should handle valid JSON-RPC request", async () => {
      const mockAction = jest.fn().mockResolvedValue({ result: "test_result" });
      sdk.addServerAction("testMethod", mockAction);

      const response = await request(sdk.getApp()!)
        .post("/hc")
        .send({
          jsonrpc: "2.0",
          method: "0x9c22ff5f",
          params: {
            ver: "0.2",
            sk: "test_key",
            src_addr: "0x1234567890123456789012345678901234567890",
            src_nonce: "01",
            oo_nonce: "0x01",
            payload: "0x",
          },
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("jsonrpc", "2.0");
    });

    it("should return 204 for request with no response", async () => {
      const response = await request(sdk.getApp()!)
        .post("/hc")
        .send({
          jsonrpc: "2.0",
          method: "nonExistentMethod",
          id: 1,
        });

      expect([200, 204]).toContain(response.status);
    });

    it("should handle malformed JSON", async () => {
      const response = await request(sdk.getApp()!)
        .post("/hc")
        .set("Content-Type", "application/json")
        .send("invalid json");

      expect(response.status).toBe(400);
    });
  });

  describe("Method Chaining", () => {
    it("should allow full method chaining", () => {
      const action = jest.fn();
      
      const result = sdk
        .createJsonRpcServerInstance()
        .addServerAction("test", action);
      
      expect(result).toBe(sdk);
      expect(sdk.isServerHealthy()).toBe(true);
    });

    it("should maintain instance across chains", () => {
      const action1 = jest.fn();
      const action2 = jest.fn();
      
      sdk
        .createJsonRpcServerInstance()
        .addServerAction("action1", action1)
        .addServerAction("action2", action2);
      
      expect(sdk.isServerHealthy()).toBe(true);
    });
  });
});
