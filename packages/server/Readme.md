# Hybrid Compute Server SDK

<img src="coverage/badge-lines.svg" alt="Line Coverage">
<img src="coverage/badge-functions.svg" alt="Function Coverage">
<img src="coverage/badge-branches.svg" alt="Branch Coverage">

This SDK provides server-side functionality for Hybrid Compute operations, including RPC server setup and utility functions for blockchain interactions.

## Installation

```bash
npm install @bobanetwork/aa-hc-sdk-server web3
```

## Example Usages

Stuck? Here is an example implementation:
1. **[FetchPrice Example](https://github.com/bobanetwork/aa-hc-example)**

## Usage

### Setting up the RPC Server

```typescript
import {action} from "./server-actions/custom-server-action";
import { HybridComputeSDK } from '@bobanetwork/aa-hc-sdk-server';

/**  use the HC SDK to create a server, add a rpc method and start the server */
const hybridCompute = new HybridComputeSDK()
        .createJsonRpcServerInstance()
        .addServerAction('getprice(string)', action)
        .listenAt(1234);

console.log(`Started successfully: ${hybridCompute.isServerHealthy()}`)

```

### Setup your Server Actions

```typescript
import {getParsedRequest, generateResponseV7} from "./utils";
import axios from "axios";
import Web3 from "web3";

const web3 = new Web3();

export async function action(params: OffchainParameter): Promise<ServerActionResponse> {
    const request = getParsedRequest(params)

    try {
        // Tokensymbol was encoded with a string in the smart-contract
        const tokenSymbol = web3.eth.abi.decodeParameter(
            "string",
            request["reqBytes"]
        ) as string;

        const headers = {
            accept: "application/json",
            "x-access-token": process.env.COINRANKING_API_KEY,
        };

        const coinListResponse = await axios.get(
            "https://api.coinranking.com/v2/coins",
            {headers}
        );
        const token = coinListResponse.data.data.coins.find(
            (c: any) => c.symbol === tokenSymbol
        );

        if (!token) {
            throw new Error(`Token ${tokenSymbol} not found`);
        }

        const priceResponse = await axios.get(
            `https://api.coinranking.com/v2/coin/${token.uuid}/price`,
            {headers}
        );

        const tokenPrice = priceResponse.data.data.price;
        const encodedTokenPrice = web3.eth.abi.encodeParameter("string", tokenPrice);

        console.log("ENCODED TOKEN PRICE = ", encodedTokenPrice);
        return generateResponseV7(request, 0, encodedTokenPrice);
    } catch (error: any) {
        console.log("received error: ", error);
        return generateResponseV7(request, 1, web3.utils.asciiToHex(error.message));
    }
}
```

## User Operation Management

The SDK also includes a `UserOpManager` for creating and managing smart accounts with Account Abstraction (ERC-4337).

### Creating a Smart Account

Create a new smart account with an EOA (Externally Owned Account) as the owner:

```typescript
import { UserOpManager } from '@bobanetwork/aa-hc-sdk-server';
import Web3 from 'web3';

const RPC = "https://boba-sepolia.gateway.tenderly.co";
const BUNDLER = "https://bundler-hc.sepolia.boba.network/rpc";
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const CHAIN_ID = 28882;

// Account that will pay for the creation transaction
const senderAddress = '0xYourSenderAddress';
const privateKey = 'your-private-key';

// Initialize the UserOpManager
const userOpManager = new UserOpManager(RPC, BUNDLER, ENTRY_POINT, CHAIN_ID);
const web3 = new Web3(new Web3.providers.HttpProvider(RPC));

// Derive owner address from private key
const ownerAccount = web3.eth.accounts.privateKeyToAccount(privateKey);
const ownerAddress = ownerAccount.address;

// Create the smart account
const result = await userOpManager.createSmartAccount(
    senderAddress,  // Address that pays for creation
    privateKey,     // Private key to sign the operation
    ownerAddress,   // Owner of the new smart account
    123             // Salt for deterministic address (optional, defaults to 100)
);

console.log('Smart Account Address:', result.smartAccountAddress);
console.log('Transaction Receipt:', result.receipt);
```

### Sending Custom User Operations

Send a custom user operation to call any smart contract function:

```typescript
// Example: Call a fetchPrice function on a contract
const contractAddress = '0x704bc4e8f85f60f77e753d5f3f55e3f1c569586f';
const smartAccountAddress = '0xYourSmartAccountAddress';

// Encode the function call
const token = 'ETH';
const encodedToken = web3.eth.abi.encodeParameter('string', token);
const calldata = userOpManager.selector('fetchPrice(string)') + encodedToken.slice(2);

// Step 1: Build the UserOperation
const userOp = await userOpManager.buildOp(
    smartAccountAddress,  // Smart account that will execute
    contractAddress,      // Contract to call
    0,                   // Value to send (0 for function calls)
    calldata,            // Encoded function call
    0                    // Nonce key (optional)
);

// Step 2: Estimate gas
const { success, op: estimatedOp } = await userOpManager.estimateOp(userOp);

if (!success) {
    throw new Error('Gas estimation failed');
}

// Step 3: Sign and submit
const receipt = await userOpManager.signSubmitOp(estimatedOp, privateKey);

console.log('Operation Hash:', receipt.userOpHash);
console.log('Transaction Status:', receipt.receipt.status);
```

### Verifying Smart Account Owner

Check the owner of any smart account:

```typescript
const contractAddress = '0xSmartAccountAddress';
const owner = await userOpManager.getOwner(contractAddress);
console.log('Contract Owner:', owner);
```

### UserOpManager Methods

- **`createSmartAccount(senderAddress, privateKey, ownerAddress, salt?)`**  
  Creates a new smart account via UserOperation

- **`buildOp(sender, target, value, calldata, nonceKey?)`**  
  Builds a UserOperation for any contract call

- **`estimateOp(userOperation)`**  
  Estimates gas limits for a UserOperation

- **`signSubmitOp(userOperation, privateKey)`**  
  Signs and submits a UserOperation to the network

- **`getOwner(contractAddress)`**  
  Returns the owner address of a smart contract

- **`selector(functionSignature)`**  
  Generates a function selector from signature (e.g., 'transfer(address,uint256)')

- **`getEntrypoint()`** / **`getRpc()`** / **`isV7Entrypoint()`**  
  Getter methods for configuration

### UserOperationV7 Interface

The `UserOperationV7` interface represents an ERC-4337 v0.7 UserOperation:

```typescript
interface UserOperationV7 {
    sender: string;                // Smart account address
    nonce: string;                 // Unique transaction number
    callData: string;              // Encoded function call
    callGasLimit: string;          // Gas limit for the main call
    verificationGasLimit: string;  // Gas limit for verification
    preVerificationGas: string;    // Gas for bundler overhead
    maxFeePerGas: string;          // Maximum gas fee
    maxPriorityFeePerGas: string;  // Maximum priority fee
    signature: string;             // Signature for verification
    paymasterAndData?: string;     // Paymaster data (optional)
    accountGasLimits?: string;     // Packed gas limits (v0.7)
    gasFees?: string;              // Packed fee data (v0.7)
}
```

## API Documentation

### `HybridComputeSDK`

#### Constructor

```typescript
constructor()
```

#### Methods

- `createJsonRpcServerInstance(): HybridComputeSDK`
  Initializes the JSON-RPC server.

- `addServerAction(selectorName: string, fun: (params: OffchainParameter) => any): HybridComputeSDK`
  Adds an action to the RPC server.

- `listenAt(port: number): HybridComputeSDK`
  Starts the server on the specified port.

- `isServerHealthy(): boolean`
  Checks if the server is properly initialized.

- `getApp(): Express | undefined`
  Returns the Express app instance.

- `getServer(): JSONRPCServer`
  Returns the JSON-RPC server instance.

### Utility Functions

- `selector(name: string): HexString`
  Generates a function selector.

- `parseOffchainParameter(params: OffchainParameter): OffchainParameterParsed`
  Parses offchain parameters.

- `parseRequest(params: OffchainParameterParsed): Request`
  Parses a request from parsed offchain parameters.

- `decodeAbi(types: string[], data: string): { [key: string]: unknown; __length__: number }`
  Decodes ABI-encoded data.

- `generateResponse(req: object, errorCode: number, respPayload: string): ServerActionResponse`
  Generates a response object with a signed payload.

### Types

- `OffchainParameter`
- `OffchainParameterParsed`
- `Request`
- `ServerActionResponse`

For detailed type definitions, please refer to the source code.

## Environment Variables

The SDK uses the following environment variables:

### Hybrid Compute Server Variables

- `HC_HELPER_ADDR`: Address of the Hybrid Compute helper contract.
- `OC_HYBRID_ACCOUNT`: Address of the Hybrid Compute account.
- `ENTRY_POINTS`: Entry points for the Hybrid Compute system.
- `CHAIN_ID`: ID of the blockchain network.
- `OC_PRIVKEY`: Private key for signing responses.

### UserOperation Management Variables

- `CLIENT_PRIVATE_KEY`: Private key for signing UserOperations and managing smart accounts.

Ensure these are set in your environment or `.env` file.

### Example .env file

```env
# Hybrid Compute Configuration
HC_HELPER_ADDR=0x11c4DbbaC4A0A47a7c76b5603bc219c5dAe752D6
OC_HYBRID_ACCOUNT=0xe320ffca9e2bd1173d041f47fdc197e168fc1ea9
ENTRY_POINTS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
CHAIN_ID=28882
OC_PRIVKEY=your-offchain-private-key

# UserOperation Management
CLIENT_PRIVATE_KEY=your-client-private-key
```

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
