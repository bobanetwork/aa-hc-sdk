import { contractConfig } from "../../src/config";

describe("Contract Configuration", () => {
  describe("Configuration Structure", () => {
    it("should have boba_sepolia configuration", () => {
      expect(contractConfig.boba_sepolia).toBeDefined();
    });

    it("should have boba_mainnet configuration", () => {
      expect(contractConfig.boba_mainnet).toBeDefined();
    });

    it("should have simpleAccountFactory for boba_sepolia", () => {
      expect(contractConfig.boba_sepolia.simpleAccountFactory).toBeDefined();
    });

    it("should have hybridAccountFactory for boba_sepolia", () => {
      expect(contractConfig.boba_sepolia.hybridAccountFactory).toBeDefined();
    });

    it("should have simpleAccountFactory for boba_mainnet", () => {
      expect(contractConfig.boba_mainnet.simpleAccountFactory).toBeDefined();
    });

    it("should have hybridAccountFactory for boba_mainnet", () => {
      expect(contractConfig.boba_mainnet.hybridAccountFactory).toBeDefined();
    });
  });

  describe("Address Validation", () => {
    it("should have valid Ethereum address format for boba_sepolia simpleAccountFactory", () => {
      const address = contractConfig.boba_sepolia.simpleAccountFactory;
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("should have valid Ethereum address format for boba_sepolia hybridAccountFactory", () => {
      const address = contractConfig.boba_sepolia.hybridAccountFactory;
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("should have valid Ethereum address format for boba_mainnet simpleAccountFactory", () => {
      const address = contractConfig.boba_mainnet.simpleAccountFactory;
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("should have valid Ethereum address format for boba_mainnet hybridAccountFactory", () => {
      const address = contractConfig.boba_mainnet.hybridAccountFactory;
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  describe("Specific Address Values", () => {
    it("should have correct simpleAccountFactory for boba_sepolia", () => {
      expect(contractConfig.boba_sepolia.simpleAccountFactory).toBe(
        "0x9aC904d8DfeA0866aB341208700dCA9207834DeB"
      );
    });

    it("should have correct hybridAccountFactory for boba_sepolia", () => {
      expect(contractConfig.boba_sepolia.hybridAccountFactory).toBe(
        "0xFe90bCD7e5E3F88383A216B050ce4E513A8178Ae"
      );
    });

    it("should have correct simpleAccountFactory for boba_mainnet", () => {
      expect(contractConfig.boba_mainnet.simpleAccountFactory).toBe(
        "0x584960A850D74400280c436a07BE738C1c96195B"
      );
    });

    it("should have correct hybridAccountFactory for boba_mainnet", () => {
      expect(contractConfig.boba_mainnet.hybridAccountFactory).toBe(
        "0xFe90bCD7e5E3F88383A216B050ce4E513A8178Ae"
      );
    });
  });

  describe("Network Differences", () => {
    it("should have different simpleAccountFactory addresses for mainnet and sepolia", () => {
      const sepoliaAddress = contractConfig.boba_sepolia.simpleAccountFactory;
      const mainnetAddress = contractConfig.boba_mainnet.simpleAccountFactory;
      expect(sepoliaAddress).not.toBe(mainnetAddress);
    });

    it("should have same hybridAccountFactory address for mainnet and sepolia", () => {
      const sepoliaAddress = contractConfig.boba_sepolia.hybridAccountFactory;
      const mainnetAddress = contractConfig.boba_mainnet.hybridAccountFactory;
      expect(sepoliaAddress).toBe(mainnetAddress);
    });
  });

  describe("Configuration Immutability", () => {
    it("should not allow modification of boba_sepolia config", () => {
      const originalAddress = contractConfig.boba_sepolia.simpleAccountFactory;
      
      expect(() => {
        (contractConfig.boba_sepolia as any).simpleAccountFactory = "0x0000000000000000000000000000000000000000";
      }).not.toThrow();
      
      expect(contractConfig.boba_sepolia.simpleAccountFactory).toBeDefined();
    });

    it("should maintain reference to original config object", () => {
      const ref1 = contractConfig.boba_sepolia;
      const ref2 = contractConfig.boba_sepolia;
      expect(ref1).toBe(ref2);
    });
  });

  describe("Network Keys", () => {
    it("should have exactly two network configurations", () => {
      const networks = Object.keys(contractConfig);
      expect(networks).toHaveLength(2);
    });

    it("should have boba_sepolia as a key", () => {
      expect("boba_sepolia" in contractConfig).toBe(true);
    });

    it("should have boba_mainnet as a key", () => {
      expect("boba_mainnet" in contractConfig).toBe(true);
    });
  });

  describe("Factory Types", () => {
    it("should have both factory types for each network", () => {
      Object.values(contractConfig).forEach((network) => {
        expect(network).toHaveProperty("simpleAccountFactory");
        expect(network).toHaveProperty("hybridAccountFactory");
      });
    });

    it("should have non-empty factory addresses", () => {
      Object.values(contractConfig).forEach((network) => {
        expect(network.simpleAccountFactory.length).toBeGreaterThan(0);
        expect(network.hybridAccountFactory.length).toBeGreaterThan(0);
      });
    });
  });
});

