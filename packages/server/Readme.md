# Hybrid Compute Server SDK

The **Hybrid Compute Server SDK** provides:

- Server-side JSON-RPC server utilities for **Hybrid Compute** actions.
- Full **ERC-4337 v0.7 and v0.6** User Operation Management.
- Utility functions for off-chain request parsing and signed responses.
- **Built with VIEM** - Modern, lightweight, and TypeScript-first blockchain library.


### 📦 Installation

```bash
npm install @bobanetwork/aa-hc-sdk-server
```


### Quick Start

### 1. Create a Hybrid Compute JSON-RPC Server

```typescript
import { action } from "./server-actions/custom-server-action";
import { HybridComputeSDK } from "@bobanetwork/aa-hc-sdk-server";

const hybridCompute = new HybridComputeSDK()
  .createJsonRpcServerInstance()
  .addServerAction("getprice(string)", action)
  .listenAt(1234);

console.log(`Server started: ${hybridCompute.isServerHealthy()}`);
```

---

### 2. Create a Server Action

```typescript
import { getParsedRequest, generateResponseV7 } from "./utils";
import { encodeAbiParameters, parseAbiParameters, decodeAbiParameters, stringToHex } from "viem";
import axios from "axios";

export async function action(params: OffchainParameter) {
  const request = getParsedRequest(params);

  try {
    const [tokenSymbol] = decodeAbiParameters(
      parseAbiParameters("string"),
      request.reqBytes as `0x${string}`
    );

    const headers = {
      accept: "application/json",
      "x-access-token": process.env.COINRANKING_API_KEY,
    };

    const { data: { data: { coins } } } = await axios.get(
      "https://api.coinranking.com/v2/coins",
      { headers }
    );

    const token = coins.find((c: any) => c.symbol === tokenSymbol);
    if (!token) throw new Error(`Token ${tokenSymbol} not found`);

    const { data: { data: { price } } } = await axios.get(
      `https://api.coinranking.com/v2/coin/${token.uuid}/price`,
      { headers }
    );

    const encodedPrice = encodeAbiParameters(
      parseAbiParameters("string"),
      [price]
    );

    return await generateResponseV7(request, 0, encodedPrice);
  } catch (error: any) {
    return await generateResponseV7(request, 1, stringToHex(error.message));
  }
}
```

### User Operation Management

### Create a Smart Account

```typescript
import { UserOpManager } from "@bobanetwork/aa-hc-sdk-server";

const userOpManager = new UserOpManager(
  "https://sepolia.boba.network",
  "https://bundler-hc.sepolia.boba.network/rpc",
  "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  28882,
  'your-private-key'
);

// Create a new smart account
const result = await userOpManager.createSmartAccount({
  salt: 123
});

console.log("Smart Account Address:", result.address);
```

### Build, Estimate & Send a custom UserOperation

```typescript
import { encodeAbiParameters, parseAbiParameters } from "viem";

const encodedToken = encodeAbiParameters(
  parseAbiParameters("string"),
  ["ETH"]
);

const calldata =
  userOpManager.selector("fetchPrice(string)") + encodedToken.slice(2);

const op = await userOpManager.buildOp(
  "0xYourSmartAccount",
  "0xTargetContract",
  0,
  calldata
);

const { success, op: estimated } = await userOpManager.estimateOp(op);
if (!success) throw new Error("Gas estimation failed");

const receipt = await userOpManager.signSubmitOp(estimated);
console.log("Operation hash:", receipt.userOpHash);
```

---

### Get Smart Account Info (e.g. Owner)

```typescript
const expectedAddr = await userOpManager.getExpectedAddress({ salt: 123 });
console.log("Deterministic address:", expectedAddr);

const owner = await userOpManager.getOwner("0x...");
console.log("Owner:", owner);
```

---

## 📚 API Reference

### HybridComputeSDK

| Method | Description |
|--------|-------------|
| `createJsonRpcServerInstance()` | Create JSON-RPC server instance |
| `addServerAction(selectorName, handler)` | Register a server RPC method |
| `listenAt(port)` | Start server |
| `isServerHealthy()` | Check if server is running |
| `getApp()` | Get Express app |
| `getServer()` | Get JSONRPCServer instance |

---

### UserOpManager

| Method | Description |
|--------|-------------|
| `selector(signature)` | Get function selector |
| `buildOp(sender, target, value, calldata, nonceKey?)` | Build a UserOperation |
| `estimateOp(userOp)` | Estimate gas usage |
| `signSubmitOp(userOp)` | Sign + submit UserOp |
| `createSmartAccount(params)` | Deploy a smart account |
| `createSmartContract(sender, privKey, bytecode, salt?)` | Deploy a contract |
| `getExpectedAddress({ salt })` | Compute deterministic account address |
| `getOwner(contractAddress)` | Get account owner |
| `getEntrypoint()` / `getRpc()` / `isV7Entrypoint()` | Config getters |

---

### Utils

| Function | Description |
|----------|-------------|
| `selector(name)` | Function selector |
| `getParsedRequest(params)` | Parse incoming OffchainParameter |
| `generateResponseV6(req, errCode, payload)` | Sign response for Entrypoint v0.6 |
| `await generateResponseV7(req, errCode, payload)` | **[ASYNC]** Sign response for Entrypoint v0.7 |

## 🌍 Environment Variables

```env
# Valid v6 or v7 HC Helper Address
HC_HELPER_ADDR=0x...

# Valid v6 or v7 Entrypoint (only one EP is required)
ENTRY_POINTS=0x...

# Your custom Hybrid Account 
OC_HYBRID_ACCOUNT=0x...

# The Chain Id to operate on
CHAIN_ID=28882

# The owner of your Hybrid Account
OC_PRIVKEY=your-offchain-key

# UserOp Manager - Used to interact with custom User Operations
CLIENT_PRIVATE_KEY=your-key
```

---

## 🐛 Troubleshooting

This guide answers a couple of issues one might encounter.

### Common Issues

**"replacement underpriced" error:**
```typescript
// Solution 1: Use random nonce key
const randomNonceKey = Math.floor(Math.random() * 1000);
const op = await userOpManager.buildOp(sender, target, 0, calldata, randomNonceKey);

// Solution 2: Wait 10-15 minutes between tests on same account
```

**Get a list of supported Entrypoints from the current bundler** 
```
curl -X POST -H "Content-Type: application/json" --data '{
    "jsonrpc":"2.0",
    "method":"eth_supportedEntryPoints",
    "id":1
}' https://bundler-hc.sepolia.boba.network
```

**Check if given address is deployed/contract**
```
curl -X POST -H "Content-Type: application/json" --data '{
    "jsonrpc":"2.0",
    "method":"eth_getCode",
    "params":["0xf683c1fdc7254c138dd71a9d36bef65d9ebfc4c7", "latest"],
    "id":1
}' https://sepolia.boba.network
```

**Should load block to get hash and number**
```
There is an issue with the RPC and you need to switch it.
```

**UserOp Failed precheck should get payer balance**
```
There is an issue with the RPC and you need to switch it.
```

**Invalid user operation for entry point: 0x0000000071727de22e5e9d8baf0edac6f37da032**
```
In case you migrated from version 0.6 to 0.7, this issue might occur. Check the tests or the latest implementation for 0.7. Version 0.7 does some things differently, especially how gas values are packed.
```

**HC03: Bad offchain signature**
```
In general, this happens if there is a mismatch between the signer and the owner of a given account.

Several possible ways:

1. Using the Snap Library: If you create your User Operation with the Snap Library on the Frontend (e.g. PriceFeed example), the signer (your EOA) must be the owner of the HYBRID_ACCOUNT that you have created during the initial setup. You can check the owner of your Hybrid Account either via the SDK or via the above CURL call. The Hybrid Account is the "sender" of the UOP in this case and must be signed by the private key that leads to its owner.

2. Sending a custom User Operation with the SDK: The "sender" adress in the custom user operation must be a smart account.

3. Sending a custom User Operation with the SDK: The owner of the "sender" key in the custom UOP must be signable by the private key that you've supplied. If the signature generated does not match the owner from the sender key, the operation is rejected.
```

**"callGasLimit is 0" error:**
```
- Gas estimation failed due to rate limiting
- The SDK automatically uses fallback gas values
- Check your bundler endpoint is accessible
```

**"Invalid params" error:**
```
- Ensure you're using the correct EntryPoint address for v0.7: `0x000000007...0edAc6f37da032`
- Verify your UserOperation has proper v0.7 format with `accountGasLimits` field
- Signature might be plain
```

## 📄 License

ISC
