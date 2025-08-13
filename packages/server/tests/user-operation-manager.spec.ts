import { UserOpManager } from "../src";
import * as dotenv from "dotenv";
dotenv.config();

describe("User Operation Manager Tests", () => {
  const RPC = "https://sepolia.boba.network";
  const BUNDLER = "https://bundler-hc.sepolia.boba.network/rpc";
  const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  const CHAIN_ID = 28882;
  const PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY!;

  const userOperationManager = new UserOpManager(
    RPC,
    BUNDLER,
    ENTRY_POINT,
    CHAIN_ID,
    PRIVATE_KEY,
  );

  it("should return correct entrypoint address", async () => {
    const result = userOperationManager.getEntrypoint();
    expect(result).toBe(ENTRY_POINT);
  });

  it("should return correct RPC URL", async () => {
    const result = userOperationManager.getRpc();
    expect(result).toBe(RPC);
  });

  it("should correctly identify V7 entrypoint", async () => {
    const result = userOperationManager.isV7Entrypoint();
    expect(result).toBe(true);
  });

  it("should generate correct function selector", async () => {
    const signature = "execute(address,uint256,bytes)";
    const result = userOperationManager.selector(signature);
    console.log("Function selector for", signature, ":", result);

    expect(result).toMatch(/^0x[0-9a-fA-F]{8}$/);
    expect(result.length).toBe(10);
  });

  it("should create a new smart account only by salt", async () => {
    const salt = new Date().getTime();
    const result = await userOperationManager.createSmartAccount({ salt });
    const expectedAddress = await userOperationManager.getExpectedAddress({salt});

    expect(result.address).toEqual(expectedAddress)
    expect(result).toBeDefined();
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(result.receipt).toBeDefined();
  }, 60000);

  it("should create a new smart account only by salt", async () => {
    const result = await userOperationManager.createSmartAccount({
      salt: new Date().getTime(),
    });
    expect(result).toBeDefined();
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(result.receipt).toBeDefined();
  }, 60000);
});
