import * as dotenv from "dotenv";
import {boba} from "viem/chains";
import {UserOpManager} from "../../src";
dotenv.config();

describe("User Operation Manager Tests", () => {
  const RPC_MAINNET = "https://mainnet.boba.network";
  const RPC_TESTNET = "https://gateway.tenderly.co/public/boba-sepolia";
  const BUNDLER_TESTNET = "https://bundler-hc.sepolia.boba.network/rpc";
  const BUNDLER_MAINNET = "https://bundler-hc.mainnet.boba.network"
  const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  const ACCOUNT_FACTORY_TESTNET='0x9aC904d8DfeA0866aB341208700dCA9207834DeB'
  const ACCOUNT_FACTORY_MAINNET = '0x584960A850D74400280c436a07BE738C1c96195B'
  const CHAIN_ID_TESTNET = 28882;
  const CHAIN_ID_MAINNET = 288;
  const PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY!;

  const userOperationManager = new UserOpManager({
    nodeUrl: RPC_TESTNET,
    bundlerUrl: BUNDLER_TESTNET,
    entryPoint: ENTRY_POINT,
    chainId: CHAIN_ID_TESTNET,
    privateKey: PRIVATE_KEY,
  });

  describe('UserOP Manager Object', function () {
    it('should instantiate the correct UOP Manager object for testnet', function () {
      const manager = new UserOpManager({
          nodeUrl: RPC_TESTNET,
          bundlerUrl: BUNDLER_TESTNET,
          entryPoint: ENTRY_POINT,
          chainId: CHAIN_ID_TESTNET,
          privateKey: PRIVATE_KEY,
      })
      expect(manager.getEntrypoint()).toEqual(ENTRY_POINT)
      expect(manager.getRpc()).toEqual(RPC_TESTNET)
      expect(manager.getBundlerUrl()).toEqual(BUNDLER_TESTNET)
      expect(manager.getAccountFactoryAddress()).toEqual(ACCOUNT_FACTORY_TESTNET)
    });

    it('should instantiate the correct UOP Manager object for testnet', function () {
      const manager = new UserOpManager({
          nodeUrl: RPC_MAINNET,
          bundlerUrl: BUNDLER_MAINNET,
          entryPoint: ENTRY_POINT,
          chainId: CHAIN_ID_MAINNET,
          privateKey: PRIVATE_KEY,
      })
      expect(manager.getEntrypoint()).toEqual(ENTRY_POINT)
      expect(manager.getRpc()).toEqual(RPC_MAINNET)
      expect(manager.getBundlerUrl()).toEqual(BUNDLER_MAINNET)
      expect(manager.getAccountFactoryAddress()).toEqual(ACCOUNT_FACTORY_MAINNET)
    });
  });


  it("should return correct entrypoint address", async () => {
    const result = userOperationManager.getEntrypoint();
    expect(result).toBe(ENTRY_POINT);
  });

  it("should return correct RPC URL", async () => {
    const result = userOperationManager.getRpc();
    expect(result).toBe(RPC_TESTNET);
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

  it.skip("should create a new smart account only by salt", async () => {
    const salt = new Date().getTime();
    const result = await userOperationManager.createSmartAccount({ salt });
    const expectedAddress = await userOperationManager.getExpectedAddress({salt});

    expect(result.address).toEqual(expectedAddress)
    expect(result).toBeDefined();
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(result.receipt).toBeDefined();
  }, 60000);

  it.skip("should create a new smart account only by salt", async () => {
    const result = await userOperationManager.createSmartAccount({
      salt: new Date().getTime(),
    });
    expect(result).toBeDefined();
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(result.receipt).toBeDefined();
  }, 60000);

  describe("Bundler smoke test", () => {
    it.skip("should send a simple OP to the bundler to test it", async () => {
      const nodeUrl     = "https://mainnet.boba.network";
      const bundlerUrl  = "https://bundler-hc.mainnet.boba.network";
      const chainId     = boba.id
      const smartAccountAddress = '0x4D21055D17ffB8A3929e232df0DA91b7f594Ea07';

      if (!nodeUrl || !bundlerUrl || !PRIVATE_KEY || !smartAccountAddress) {
        throw new Error("Missing env vars: RPC_URL / BUNDLER_URL / PRIVATE_KEY / SMART_ACCOUNT");
      }

      const mgr = new UserOpManager({
          nodeUrl,
          bundlerUrl,
          entryPoint: ENTRY_POINT,
          chainId,
          privateKey: PRIVATE_KEY,
      });
      const target  = "0x000000000000000000000000000000000000dEaD";
      const value   = 0;
      const data    = "0x";
      const unsignedOp = await mgr.buildOp(
          smartAccountAddress,
          target,
          value,
          data
      );
      const { success, op: estimatedOp } = await mgr.estimateOp(unsignedOp);
      expect(success).toEqual(true);
      expect(estimatedOp).toBeDefined();
    })
  });
});
