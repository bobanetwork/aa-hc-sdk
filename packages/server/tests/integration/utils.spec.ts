import { recoverMessageAddress, createPublicClient, http, parseAbi } from "viem";
import { bobaSepolia } from "viem/chains";
import * as dotenv from "dotenv";

dotenv.config();

describe("Utils: Integration Tests", () => {
  const RPC = "https://sepolia.boba.network";

  it("should verify backend signature recovery against on-chain owner", async () => {
    const OC_HYBRID_ACCOUNT = "0xe320ffca9E2BD1173d041f47fDC197e168Fc1EA9";
    const testHash = "0xc04a0c56ecd19e2611bfe7f53c7325dd3792b7347b4729c1ed22fb1029145375";
    const testSignature = "0xba9d2576e33e253c80703c063a4825974e284af0ca370cc2fb49910eb0851c27318c9f0d3987fe08a8066e9fe4af81dc513fb344b23d905169f6cdde0405e0841c";
    
    const recoveredAddress = await recoverMessageAddress({
      message: { raw: testHash as `0x${string}` },
      signature: testSignature as `0x${string}`,
    });
    
    const publicClient = createPublicClient({
      chain: bobaSepolia,
      transport: http(RPC),
    });
    
    const ownerAddress = await publicClient.readContract({
      address: OC_HYBRID_ACCOUNT,
      abi: parseAbi(['function owner() view returns (address)']),
      functionName: 'owner',
    });
    
    expect(recoveredAddress.toLowerCase()).toBe(ownerAddress.toLowerCase());
  }, 30000);
});
