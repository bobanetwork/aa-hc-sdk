import { UserOpManager } from "../../src";

describe("UserOpManager: Account Methods", () => {
  const RPC_URL = "https://sepolia.boba.network";
  const BUNDLER_URL = "https://bundler-hc.sepolia.boba.network/rpc";
  const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  const CHAIN_ID_TESTNET = 28882;
  const CHAIN_ID_MAINNET = 288;
  const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  let manager: UserOpManager;

  beforeEach(() => {
    manager = new UserOpManager({
      nodeUrl: RPC_URL,
      bundlerUrl: BUNDLER_URL,
      entryPoint: ENTRY_POINT,
      chainId: CHAIN_ID_TESTNET,
      privateKey: PRIVATE_KEY,
    });
  });

  describe("getExpectedAddress", () => {
    it("should return expected address for simple account with numeric salt", async () => {
      const salt = 12345;
      
      const address = await manager.getExpectedAddress({ salt, accountType: 'simple' });
      
      expect(address).toBeDefined();
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("should return expected address for hybrid account with numeric salt", async () => {
      const salt = 12345;
      
      const address = await manager.getExpectedAddress({ salt, accountType: 'hybrid' });
      
      expect(address).toBeDefined();
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("should return expected address for simple account with string salt", async () => {
      const salt = "54321";
      
      const address = await manager.getExpectedAddress({ salt, accountType: 'simple' });
      
      expect(address).toBeDefined();
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("should default to simple account type when not specified", async () => {
      const salt = 12345;
      
      const addressDefault = await manager.getExpectedAddress({ salt });
      const addressSimple = await manager.getExpectedAddress({ salt, accountType: 'simple' });
      
      expect(addressDefault).toBe(addressSimple);
    });

    it("should return different addresses for different salts", async () => {
      const address1 = await manager.getExpectedAddress({ salt: 1 });
      const address2 = await manager.getExpectedAddress({ salt: 2 });
      
      expect(address1).not.toBe(address2);
    });

    it("should return different addresses for simple vs hybrid", async () => {
      const salt = 12345;
      
      const simpleAddress = await manager.getExpectedAddress({ salt, accountType: 'simple' });
      const hybridAddress = await manager.getExpectedAddress({ salt, accountType: 'hybrid' });
      
      expect(simpleAddress).not.toBe(hybridAddress);
    });

    it("should return same address for same salt and type", async () => {
      const salt = 12345;
      
      const address1 = await manager.getExpectedAddress({ salt, accountType: 'simple' });
      const address2 = await manager.getExpectedAddress({ salt, accountType: 'simple' });
      
      expect(address1).toBe(address2);
    });

    it("should handle large salt values", async () => {
      const salt = 999999999999;
      
      const address = await manager.getExpectedAddress({ salt });
      
      expect(address).toBeDefined();
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("should handle zero salt", async () => {
      const salt = 0;
      
      const address = await manager.getExpectedAddress({ salt });
      
      expect(address).toBeDefined();
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  describe("getExpectedAddress with Different Networks", () => {
    it("should work with mainnet configuration", async () => {
      const mainnetManager = new UserOpManager({
        nodeUrl: "https://mainnet.boba.network",
        bundlerUrl: "https://bundler-hc.mainnet.boba.network",
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID_MAINNET,
        privateKey: PRIVATE_KEY,
      });

      const address = await mainnetManager.getExpectedAddress({ salt: 12345 });
      
      expect(address).toBeDefined();
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("should return different addresses for different networks with same salt", async () => {
      const mainnetManager = new UserOpManager({
        nodeUrl: "https://mainnet.boba.network",
        bundlerUrl: "https://bundler-hc.mainnet.boba.network",
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID_MAINNET,
        privateKey: PRIVATE_KEY,
      });

      const testnetAddress = await manager.getExpectedAddress({ salt: 12345 });
      const mainnetAddress = await mainnetManager.getExpectedAddress({ salt: 12345 });
      
      expect(testnetAddress).not.toBe(mainnetAddress);
    });
  });

  describe("Factory Address Configuration", () => {
    it("should use default simple account factory for testnet", () => {
      const factoryAddress = manager.getAccountFactoryAddress();
      
      expect(factoryAddress).toBe("0x9aC904d8DfeA0866aB341208700dCA9207834DeB");
    });

    it("should use default simple account factory for mainnet", () => {
      const mainnetManager = new UserOpManager({
        nodeUrl: "https://mainnet.boba.network",
        bundlerUrl: "https://bundler-hc.mainnet.boba.network",
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID_MAINNET,
        privateKey: PRIVATE_KEY,
      });

      const factoryAddress = mainnetManager.getAccountFactoryAddress();
      
      expect(factoryAddress).toBe("0x584960A850D74400280c436a07BE738C1c96195B");
    });

    it("should use custom simple account factory when provided", () => {
      const customFactory = "0x1111111111111111111111111111111111111111";
      const customManager = new UserOpManager({
        nodeUrl: RPC_URL,
        bundlerUrl: BUNDLER_URL,
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID_TESTNET,
        privateKey: PRIVATE_KEY,
        simpleAccountFactoryAddress: customFactory,
      });

      const factoryAddress = customManager.getAccountFactoryAddress();
      
      expect(factoryAddress).toBe(customFactory);
    });

    it("should use custom hybrid account factory when provided", () => {
      const customHybridFactory = "0x2222222222222222222222222222222222222222";
      const customManager = new UserOpManager({
        nodeUrl: RPC_URL,
        bundlerUrl: BUNDLER_URL,
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID_TESTNET,
        privateKey: PRIVATE_KEY,
        hybridAccountFactoryAddress: customHybridFactory,
      });

      expect(customManager).toBeDefined();
    });
  });

  describe("Selector Method", () => {
    it("should generate correct selector for function signature", () => {
      const signature = "execute(address,uint256,bytes)";
      const selector = manager.selector(signature);
      
      expect(selector).toBe("0xb61d27f6");
    });

    it("should generate selector with 0x prefix", () => {
      const signature = "test()";
      const selector = manager.selector(signature);
      
      expect(selector.startsWith("0x")).toBe(true);
    });

    it("should generate 10 character selector (0x + 8 hex chars)", () => {
      const signature = "myFunction(uint256)";
      const selector = manager.selector(signature);
      
      expect(selector.length).toBe(10);
    });

    it("should be deterministic", () => {
      const signature = "transfer(address,uint256)";
      const selector1 = manager.selector(signature);
      const selector2 = manager.selector(signature);
      
      expect(selector1).toBe(selector2);
    });

    it("should generate different selectors for different signatures", () => {
      const selector1 = manager.selector("functionA()");
      const selector2 = manager.selector("functionB()");
      
      expect(selector1).not.toBe(selector2);
    });
  });

  describe("Entrypoint Validation", () => {
    it("should identify v7 entrypoint", () => {
      const isV7 = manager.isV7Entrypoint();
      
      expect(isV7).toBe(true);
    });

    it("should not identify v6 entrypoint as v7", () => {
      const v6Manager = new UserOpManager({
        nodeUrl: RPC_URL,
        bundlerUrl: BUNDLER_URL,
        entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        chainId: CHAIN_ID_TESTNET,
        privateKey: PRIVATE_KEY,
      });

      const isV7 = v6Manager.isV7Entrypoint();
      
      expect(isV7).toBe(false);
    });

    it("should handle uppercase entrypoint address", () => {
      const upperManager = new UserOpManager({
        nodeUrl: RPC_URL,
        bundlerUrl: BUNDLER_URL,
        entryPoint: "0x0000000071727DE22E5E9D8BAF0EDAC6F37DA032",
        chainId: CHAIN_ID_TESTNET,
        privateKey: PRIVATE_KEY,
      });

      const isV7 = upperManager.isV7Entrypoint();
      
      expect(isV7).toBe(true);
    });

    it("should handle mixed case entrypoint address", () => {
      const mixedManager = new UserOpManager({
        nodeUrl: RPC_URL,
        bundlerUrl: BUNDLER_URL,
        entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
        chainId: CHAIN_ID_TESTNET,
        privateKey: PRIVATE_KEY,
      });

      const isV7 = mixedManager.isV7Entrypoint();
      
      expect(isV7).toBe(true);
    });
  });

  describe("Getter Methods", () => {
    it("should return correct entrypoint address", () => {
      const entrypoint = manager.getEntrypoint();
      expect(entrypoint).toBe(ENTRY_POINT);
    });

    it("should return correct RPC URL", () => {
      const rpc = manager.getRpc();
      expect(rpc).toBe(RPC_URL);
    });

    it("should return correct bundler URL", () => {
      const bundler = manager.getBundlerUrl();
      expect(bundler).toBe(BUNDLER_URL);
    });

    it("should preserve exact URLs from configuration", () => {
      const customRpc = "https://custom-rpc.example.com";
      const customBundler = "https://custom-bundler.example.com";
      const customManager = new UserOpManager({
        nodeUrl: customRpc,
        bundlerUrl: customBundler,
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID_TESTNET,
        privateKey: PRIVATE_KEY,
      });
      expect(customManager.getRpc()).toBe(customRpc);
      expect(customManager.getBundlerUrl()).toBe(customBundler);
    });
  });
});

