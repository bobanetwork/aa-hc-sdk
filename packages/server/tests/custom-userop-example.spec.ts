import { UserOpManager } from "../src";
import Web3 from "web3";
import * as dotenv from "dotenv";

dotenv.config();

describe("Custom User Operation SDK Tests", () => {
  // Shared configuration
  const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  const RPC = "https://sepolia.boba.network";
  const BUNDLER = "https://bundler-hc.sepolia.boba.network/rpc";
  const CHAIN_ID = 28882;
  const sender = "0xf40d61fb6a4F4E8658661C113C630c66FFFb6670";
  const CONTRACT_ADDRESS = "0x704bc4e8f85f60f77e753d5f3f55e3f1c569586f";
  const PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY!;

  // Shared instances
  let userOpManager: UserOpManager;
  let web3: Web3;
  let privateKey: string;
  let ownerAddress: string;

  beforeAll(() => {
    privateKey = process.env.CLIENT_PRIVATE_KEY!;
    if (!privateKey) {
      throw new Error("CLIENT_PRIVATE_KEY not found");
    }

    userOpManager = new UserOpManager(
      RPC,
      BUNDLER,
      ENTRY_POINT,
      CHAIN_ID,
      PRIVATE_KEY,
    );
    web3 = new Web3(new Web3.providers.HttpProvider(RPC));

    const ownerAccount = web3.eth.accounts.privateKeyToAccount(privateKey);
    ownerAddress = ownerAccount.address;
  });
  it("should call fetchPrice(string) via UserOperation", async () => {
    const token = "ETH";
    const encodedToken = web3.eth.abi.encodeParameter("string", token);
    const calldata =
      userOpManager.selector("fetchPrice(string)") + encodedToken.slice(2);

    const op = await userOpManager.buildOp(
      sender,
      CONTRACT_ADDRESS,
      0,
      calldata,
      0,
    );

    console.log("Built UserOperation:", JSON.stringify(op, null, 2));

    const { success, op: estimatedOp } = await userOpManager.estimateOp(op);

    console.log("Gas estimation success:", success);
    console.log("Estimated operation:", estimatedOp);

    const receipt = await userOpManager.signSubmitOp(estimatedOp);

    console.log("final receipt: ", receipt);
    expect(receipt).toBeDefined();
    expect(receipt.success).toBe(true);
    expect(receipt.receipt.status).toBe("0x1");
  }, 60000);

  it("should create a new smart account and send a user operation", async () => {
    // Create new smart account
    const result = await userOpManager.createSmartAccount({
      salt: 104,
    });
    console.log("result is: ", result);
    expect(result).toBeDefined();
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(result.receipt).toBeDefined();

    // override new sender with latest account creation
    const sender = result.address;

    // Fetch Price Call
    const token = "ETH";
    const encodedToken = web3.eth.abi.encodeParameter("string", token);
    const calldata =
      userOpManager.selector("fetchPrice(string)") + encodedToken.slice(2);
    const op = await userOpManager.buildOp(
      sender,
      CONTRACT_ADDRESS,
      0,
      calldata,
      0,
    );
    console.log("Built UserOperation:", JSON.stringify(op, null, 2));
    const { success, op: estimatedOp } = await userOpManager.estimateOp(op);
    console.log("Gas estimation success:", success);
    console.log("Estimated operation:", estimatedOp);
    const receipt = await userOpManager.signSubmitOp(estimatedOp);
    console.log("final receipt: ", receipt);
    expect(receipt).toBeDefined();
    expect(receipt.success).toBe(true);
    expect(receipt.receipt.status).toBe("0x1");
  }, 60000);
});
