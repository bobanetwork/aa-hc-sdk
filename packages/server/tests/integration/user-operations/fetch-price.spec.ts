import { encodeAbiParameters, parseAbiParameters } from "viem";
import * as dotenv from "dotenv";
import { UserOpManager } from "../../../src";

dotenv.config();

describe("Custom User Operation SDK Tests", () => {
    // Shared configuration
    const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
    const RPC = "https://sepolia.boba.network";
    const BUNDLER = "https://bundler-hc.sepolia.boba.network/rpc";
    const CHAIN_ID = 28882;
    const SENDER = "0x77fBd8F873e9361241161DE136AD47883722b971";
    const CONTRACT_ADDRESS = "0x704BC4E8F85f60F77E753D5f3f55e3F1c569586f";

    let userOpManager: UserOpManager;
    let privateKey: string;

    beforeAll(() => {
        privateKey = process.env.CLIENT_PRIVATE_KEY!;
        if (!privateKey) {
            throw new Error("CLIENT_PRIVATE_KEY not found");
        }

        userOpManager = new UserOpManager({
            nodeUrl: RPC,
            bundlerUrl: BUNDLER,
            entryPoint: ENTRY_POINT,
            chainId: CHAIN_ID,
            privateKey: process.env.CLIENT_PRIVATE_KEY!,
        });
    });

it("should call fetchPrice(string) using the UserOperationManager", async () => {
    const token = "ETH";
    const encodedToken = encodeAbiParameters(
      parseAbiParameters("string"),
      [token]
    );
    const calldata = userOpManager.selector("fetchPrice(string)") + encodedToken.slice(2);
    const op = await userOpManager.buildOp(SENDER, CONTRACT_ADDRESS, 0, calldata, 0,);
    const { success, op: estimatedOp } = await userOpManager.estimateOp(op);

    expect(success).toEqual(true);
    console.log("Gas estimation success:", success);
    console.log("Estimated operation:", estimatedOp);

    const receipt = await userOpManager.signSubmitOp(estimatedOp);

    console.log("final receipt: ", receipt);
    expect(receipt).toBeDefined();
    expect(receipt.success).toBe(true);
    expect(receipt.receipt.status).toBe("0x1");
  }, 60000);
});