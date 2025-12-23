import { UserOpManager } from "../../src";
import { UserOperationV7 } from "../../src/utils";

describe("UserOpManager: Gas Estimation", () => {
  const RPC_URL = "https://sepolia.boba.network";
  const BUNDLER_URL = "https://bundler-hc.sepolia.boba.network/rpc";
  const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  const CHAIN_ID = 28882;
  const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  let manager: UserOpManager;

  beforeEach(() => {
    manager = new UserOpManager({
      nodeUrl: RPC_URL,
      bundlerUrl: BUNDLER_URL,
      entryPoint: ENTRY_POINT,
      chainId: CHAIN_ID,
      privateKey: PRIVATE_KEY,
    });
  });

  describe("estimateOp Success Scenarios", () => {
    it("should return success status and estimated operation", async () => {
      const mockOp: UserOperationV7 = {
        sender: "0x1234567890123456789012345678901234567890",
        nonce: "0x0",
        callData: "0xb61d27f6",
        callGasLimit: "0x0",
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: "0x3b9aca00",
        maxPriorityFeePerGas: "0x1dcd6500",
        signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c",
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          result: {
            preVerificationGas: "0x1000",
            verificationGasLimit: "0x2000",
            callGasLimit: "0x3000",
          },
        }),
      });

      const { success, op } = await manager.estimateOp(mockOp);

      expect(success).toBe(true);
      expect(op).toBeDefined();
      expect(op.preVerificationGas).toBe("0x1000");
      expect(op.verificationGasLimit).toBe("0x2000");
      expect(op.callGasLimit).toBe("0x3000");
    });

    it("should preserve original operation fields", async () => {
      const mockOp: UserOperationV7 = {
        sender: "0x1234567890123456789012345678901234567890",
        nonce: "0x5",
        callData: "0xabcdef",
        callGasLimit: "0x0",
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: "0x3b9aca00",
        maxPriorityFeePerGas: "0x1dcd6500",
        signature: "0x12345",
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          result: {
            preVerificationGas: "0x1000",
            verificationGasLimit: "0x2000",
            callGasLimit: "0x3000",
          },
        }),
      });

      const { success, op } = await manager.estimateOp(mockOp);

      expect(success).toBe(true);
      expect(op.sender).toBe(mockOp.sender);
      expect(op.nonce).toBe(mockOp.nonce);
      expect(op.callData).toBe(mockOp.callData);
      expect(op.maxFeePerGas).toBe(mockOp.maxFeePerGas);
      expect(op.maxPriorityFeePerGas).toBe(mockOp.maxPriorityFeePerGas);
      expect(op.signature).toBe(mockOp.signature);
    });

    it("should handle hex string gas values", async () => {
      const mockOp: UserOperationV7 = {
        sender: "0x1234567890123456789012345678901234567890",
        nonce: "0x0",
        callData: "0xb61d27f6",
        callGasLimit: "0x0",
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: "0x3b9aca00",
        maxPriorityFeePerGas: "0x1dcd6500",
        signature: "0x12345",
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          result: {
            preVerificationGas: "0xffffff",
            verificationGasLimit: "0xeeeeee",
            callGasLimit: "0xdddddd",
          },
        }),
      });

      const { success, op } = await manager.estimateOp(mockOp);

      expect(success).toBe(true);
      expect(op.preVerificationGas).toBe("0xffffff");
      expect(op.verificationGasLimit).toBe("0xeeeeee");
      expect(op.callGasLimit).toBe("0xdddddd");
    });
  });

  describe("estimateOp Failure Scenarios", () => {
    it("should return failure when bundler returns error", async () => {
      const mockOp: UserOperationV7 = {
        sender: "0x1234567890123456789012345678901234567890",
        nonce: "0x0",
        callData: "0xb61d27f6",
        callGasLimit: "0x0",
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: "0x3b9aca00",
        maxPriorityFeePerGas: "0x1dcd6500",
        signature: "0x12345",
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          error: {
            code: -32602,
            message: "Invalid UserOperation",
          },
        }),
      });

      const { success, op } = await manager.estimateOp(mockOp);

      expect(success).toBe(false);
      expect(op).toBeDefined();
      expect(op.callGasLimit).toBe("0x0");
    });

    it("should return failure when response parsing fails", async () => {
      const mockOp: UserOperationV7 = {
        sender: "0x1234567890123456789012345678901234567890",
        nonce: "0x0",
        callData: "0xb61d27f6",
        callGasLimit: "0x0",
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: "0x3b9aca00",
        maxPriorityFeePerGas: "0x1dcd6500",
        signature: "0x12345",
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const { success, op } = await manager.estimateOp(mockOp);

      expect(success).toBe(false);
      expect(op).toEqual(mockOp);
    });
  });

  describe("estimateOp Request Format", () => {
    it("should send correct JSON-RPC request format", async () => {
      const mockOp: UserOperationV7 = {
        sender: "0x1234567890123456789012345678901234567890",
        nonce: "0x0",
        callData: "0xb61d27f6",
        callGasLimit: "0x0",
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: "0x3b9aca00",
        maxPriorityFeePerGas: "0x1dcd6500",
        signature: "0x12345",
      };

      let capturedRequest: any;
      global.fetch = jest.fn().mockImplementation(async (url, options) => {
        capturedRequest = JSON.parse(options.body);
        return {
          json: async () => ({
            result: {
              preVerificationGas: "0x1000",
              verificationGasLimit: "0x2000",
              callGasLimit: "0x3000",
            },
          }),
        };
      });

      await manager.estimateOp(mockOp);

      expect(capturedRequest).toBeDefined();
      expect(capturedRequest.jsonrpc).toBe("2.0");
      expect(capturedRequest.method).toBe("eth_estimateUserOperationGas");
      expect(capturedRequest.params).toHaveLength(2);
      expect(capturedRequest.params[0].sender).toBe("0x1234567890123456789012345678901234567890");
      expect(capturedRequest.params[0].nonce).toBe("0x0");
      expect(capturedRequest.params[0].callData).toBe("0xb61d27f6");
      expect(capturedRequest.params[0].callGasLimit).toBe("0x0");
      expect(capturedRequest.params[0].verificationGasLimit).toBe("0x0");
      expect(capturedRequest.params[0].preVerificationGas).toBe("0x0");
      expect(capturedRequest.params[1]).toBe(ENTRY_POINT);
      expect(capturedRequest.id).toBe(1);
    });

    it("should use correct bundler URL", async () => {
      const mockOp: UserOperationV7 = {
        sender: "0x1234567890123456789012345678901234567890",
        nonce: "0x0",
        callData: "0xb61d27f6",
        callGasLimit: "0x0",
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: "0x3b9aca00",
        maxPriorityFeePerGas: "0x1dcd6500",
        signature: "0x12345",
      };

      let capturedUrl: string = "";
      global.fetch = jest.fn().mockImplementation(async (url) => {
        capturedUrl = url as string;
        return {
          json: async () => ({
            result: {
              preVerificationGas: "0x1000",
              verificationGasLimit: "0x2000",
              callGasLimit: "0x3000",
            },
          }),
        };
      });

      await manager.estimateOp(mockOp);

      expect(capturedUrl).toBe(BUNDLER_URL);
    });

    it("should set correct headers", async () => {
      const mockOp: UserOperationV7 = {
        sender: "0x1234567890123456789012345678901234567890",
        nonce: "0x0",
        callData: "0xb61d27f6",
        callGasLimit: "0x0",
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: "0x3b9aca00",
        maxPriorityFeePerGas: "0x1dcd6500",
        signature: "0x12345",
      };

      let capturedHeaders: any;
      global.fetch = jest.fn().mockImplementation(async (url, options) => {
        capturedHeaders = options.headers;
        return {
          json: async () => ({
            result: {
              preVerificationGas: "0x1000",
              verificationGasLimit: "0x2000",
              callGasLimit: "0x3000",
            },
          }),
        };
      });

      await manager.estimateOp(mockOp);

      expect(capturedHeaders["Content-Type"]).toBe("application/json");
    });
  });

  describe("estimateOp Edge Cases", () => {
    it("should handle operation with paymasterAndData", async () => {
      const mockOp: UserOperationV7 = {
        sender: "0x1234567890123456789012345678901234567890",
        nonce: "0x0",
        callData: "0xb61d27f6",
        callGasLimit: "0x0",
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: "0x3b9aca00",
        maxPriorityFeePerGas: "0x1dcd6500",
        signature: "0x12345",
        paymasterAndData: "0x9999999999999999999999999999999999999999",
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          result: {
            preVerificationGas: "0x1000",
            verificationGasLimit: "0x2000",
            callGasLimit: "0x3000",
          },
        }),
      });

      const { success, op } = await manager.estimateOp(mockOp);

      expect(success).toBe(true);
      expect(op.paymasterAndData).toBe(mockOp.paymasterAndData);
    });

    it("should handle very large gas estimates", async () => {
      const mockOp: UserOperationV7 = {
        sender: "0x1234567890123456789012345678901234567890",
        nonce: "0x0",
        callData: "0xb61d27f6",
        callGasLimit: "0x0",
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: "0x3b9aca00",
        maxPriorityFeePerGas: "0x1dcd6500",
        signature: "0x12345",
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          result: {
            preVerificationGas: "0xffffffffffffffff",
            verificationGasLimit: "0xffffffffffffffff",
            callGasLimit: "0xffffffffffffffff",
          },
        }),
      });

      const { success, op } = await manager.estimateOp(mockOp);

      expect(success).toBe(true);
      expect(op.preVerificationGas).toBe("0xffffffffffffffff");
    });

    it("should handle empty result object gracefully", async () => {
      const mockOp: UserOperationV7 = {
        sender: "0x1234567890123456789012345678901234567890",
        nonce: "0x0",
        callData: "0xb61d27f6",
        callGasLimit: "0x0",
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: "0x3b9aca00",
        maxPriorityFeePerGas: "0x1dcd6500",
        signature: "0x12345",
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          result: {},
        }),
      });

      const { success, op } = await manager.estimateOp(mockOp);

      expect(success).toBe(true);
      expect(op).toBeDefined();
    });
  });
});

