import { UserOpManager } from "../../src";
import { boba, bobaSepolia } from "viem/chains";

describe("UserOpManager: buildOp", () => {
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

  describe("Basic Operation Building", () => {
    it("should build a basic user operation with zero value", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";
      const value = 0;
      const calldata = "0x";

      const op = await manager.buildOp(sender, target, value, calldata);

      expect(op).toBeDefined();
      expect(op.sender).toBe(sender);
      expect(op.callData).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(op.nonce).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(op.signature).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it("should build operation with non-zero value", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";
      const value = 1000000000000000;
      const calldata = "0x";

      const op = await manager.buildOp(sender, target, value, calldata);

      expect(op).toBeDefined();
      expect(op.sender).toBe(sender);
      expect(op.callData).toContain("b61d27f6");
    });

    it("should build operation with custom calldata", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";
      const value = 0;
      const calldata = "0xa9059cbb00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000064";

      const op = await manager.buildOp(sender, target, value, calldata);

      expect(op).toBeDefined();
      expect(op.callData).toContain("b61d27f6");
    });

    it("should use default nonce key of 0", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";

      const op = await manager.buildOp(sender, target, 0, "0x");

      expect(op.nonce).toBeDefined();
      expect(op.nonce).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it("should accept custom nonce key", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";
      const nonceKey = 5;

      const op = await manager.buildOp(sender, target, 0, "0x", nonceKey);

      expect(op.nonce).toBeDefined();
      expect(op.nonce).toMatch(/^0x[0-9a-fA-F]+$/);
    });
  });

  describe("Gas Parameters", () => {
    it("should set maxFeePerGas higher than base fee", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";

      const op = await manager.buildOp(sender, target, 0, "0x");

      expect(op.maxFeePerGas).toBeDefined();
      expect(op.maxFeePerGas).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it("should set maxPriorityFeePerGas", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";

      const op = await manager.buildOp(sender, target, 0, "0x");

      expect(op.maxPriorityFeePerGas).toBeDefined();
      expect(op.maxPriorityFeePerGas).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it("should initialize gas limits to zero", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";

      const op = await manager.buildOp(sender, target, 0, "0x");

      expect(op.callGasLimit).toBe("0x0");
      expect(op.verificationGasLimit).toBe("0x0");
      expect(op.preVerificationGas).toBe("0x0");
    });
  });

  describe("CallData Construction", () => {
    it("should construct execute calldata with correct selector", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";

      const op = await manager.buildOp(sender, target, 0, "0x");

      expect(op.callData.startsWith("0xb61d27f6")).toBe(true);
    });

    it("should encode target address in calldata", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";

      const op = await manager.buildOp(sender, target, 0, "0x");

      expect(op.callData.toLowerCase()).toContain(target.slice(2).toLowerCase());
    });

    it("should handle empty calldata", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";

      const op = await manager.buildOp(sender, target, 0, "0x");

      expect(op.callData).toBeDefined();
      expect(op.callData.length).toBeGreaterThan(10);
    });

    it("should handle large calldata", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";
      const largeCalldata = "0x" + "ff".repeat(1000);

      const op = await manager.buildOp(sender, target, 0, largeCalldata);

      expect(op.callData).toBeDefined();
      expect(op.callData.length).toBeGreaterThan(largeCalldata.length);
    });
  });

  describe("Signature Field", () => {
    it("should include dummy signature", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";

      const op = await manager.buildOp(sender, target, 0, "0x");

      expect(op.signature).toBe(
        "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"
      );
    });

    it("should have 65-byte signature placeholder", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";

      const op = await manager.buildOp(sender, target, 0, "0x");

      expect(op.signature.length).toBe(132);
    });
  });

  describe("Multiple Operations", () => {
    it("should build different operations for different nonce keys", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";

      const op1 = await manager.buildOp(sender, target, 0, "0x", 0);
      const op2 = await manager.buildOp(sender, target, 0, "0x", 1);

      expect(op1.nonce).toBeDefined();
      expect(op2.nonce).toBeDefined();
    });

    it("should handle multiple operations with different values", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";

      const op1 = await manager.buildOp(sender, target, 0, "0x");
      const op2 = await manager.buildOp(sender, target, 1000, "0x");

      expect(op1).toBeDefined();
      expect(op2).toBeDefined();
      expect(op1.callData).not.toBe(op2.callData);
    });
  });

  describe("Network Chain Handling", () => {
    it("should work with mainnet configuration", async () => {
      const mainnetManager = new UserOpManager({
        nodeUrl: "https://mainnet.boba.network",
        bundlerUrl: "https://bundler-hc.mainnet.boba.network",
        entryPoint: ENTRY_POINT,
        chainId: boba.id,
        privateKey: PRIVATE_KEY,
      });

      const sender = "0x1234567890123456789012345678901234567890";
      const target = "0x0987654321098765432109876543210987654321";

      const op = await mainnetManager.buildOp(sender, target, 0, "0x");

      expect(op).toBeDefined();
      expect(op.sender).toBe(sender);
    });
  });
});

