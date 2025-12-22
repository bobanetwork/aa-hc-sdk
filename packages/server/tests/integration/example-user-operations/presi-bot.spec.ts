import * as dotenv from "dotenv";
import {UserOpManager} from "../../../src";

dotenv.config();

/**
 * Example user operations for the PresiBot live example.
 * This example is used to demonstrate how to use the UserOpManager to build, estimate, and send a user operation.
 * The user operation is used to call the submitResults function on the PresiBot contract.
 * The submitResults function is used to submit the results of the game to the PresiBot contract.
 * The results are then encoded and returned as a response.
 * This example is used to demonstrate how to use the UserOpManager to build, estimate, and send a user operation.
 * The user operation is used to call the submitResults function on the PresiBot contract.
 * The submitResults function is used to submit the results of the game to the PresiBot contract.
 * The results are then encoded and returned as a response.
 */
describe("Custom User Operation SDK Tests", () => {
    // Shared configuration
    const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
    const RPC = "https://sepolia.boba.network";
    const BUNDLER = "https://bundler-hc.sepolia.boba.network/rpc";
    const CHAIN_ID = 28882;
    const SENDER = "0x77fbd8f873e9361241161de136ad47883722b971";
    const CONTRACT_ADDRESS = "0xe7acf278fca7ca33c3ff14da3540b9d2b9a49b90";
    const PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY!;

    // Shared instances
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
            privateKey: PRIVATE_KEY,
        });
    });

    it.skip("should call submitAnswer via UserOperation to PresiBot", async () => {
        // build calldata
        const data = userOpManager.selector("submitResults()");
        // build operation
        const op = await userOpManager.buildOp(SENDER, CONTRACT_ADDRESS, 0, data, 0,);
        // estimate operation
        const { success, op: estimatedOp } = await userOpManager.estimateOp(op);
        // expect estimation success
        expect(success).toEqual(true)
        // sign and submit
        const receipt = await userOpManager.signSubmitOp(estimatedOp);

        expect(receipt).toBeDefined();
        expect(receipt.success).toBe(true);
        expect(receipt.receipt.status).toBe("0x1");
    }, 60000);

    it.skip("should call restartGame via UserOperation to PresiBot", async () => {
        // build calldata
        const calldata = userOpManager.selector("getDailyQuestion()");
        // build operation
        const op = await userOpManager.buildOp(SENDER, CONTRACT_ADDRESS, 0, calldata, 0,);
        // estimate operation
        const { success, op: estimatedOp } = await userOpManager.estimateOp(op);
        // expect estimation success
        expect(success).toEqual(true)
        // sign and submit
        const receipt = await userOpManager.signSubmitOp(estimatedOp);

        expect(receipt).toBeDefined();
        expect(receipt.success).toBe(true);
        expect(receipt.receipt.status).toBe("0x1");
    }, 60000);
});
