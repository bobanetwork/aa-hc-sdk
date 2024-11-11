# Hybrid Compute Server SDK

<img src="coverage/badge-lines.svg" alt="Line Coverage">
<img src="coverage/badge-functions.svg" alt="Function Coverage">
<img src="coverage/badge-branches.svg" alt="Branch Coverage">

This SDK provides server-side functionality for Hybrid Compute operations, including RPC server setup and utility functions for blockchain interactions.

## Installation

```bash
npm install @bobanetwork/aa-hc-sdk-server
```

## Example Usages

Stuck? Here is an example implementation:
1. **[FetchPrice Example](https://github.com/bobanetwork/aa-hc-example)**

## Usage

### Setting up the RPC Server (index.ts)

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
import {getParsedRequest} from "./utils";

export async function action(params: OffchainParameter): Promise<ServerActionResponse> {
  const request = getParsedRequest(params);

  try {
    const tokenSymbol = web3.eth.abi.decodeParameter("string", request["reqBytes"]) as string;

    const headers = {
      accept: "application/json",
      "x-access-token": process.env.COINRANKING_API_KEY,
    };

    const coinListResponse = await axios.get("https://api.coinranking.com/v2/coins", {headers});
    
    const token = coinListResponse.data.data.coins.find((c: any) => c.symbol === tokenSymbol);
    
    const priceResponse = await axios.get(`https://api.coinranking.com/v2/coin/${token.uuid}/price`, {headers});
    
    const encodedTokenPrice = web3.eth.abi.encodeParameter("string", priceResponse.data.data.price);

    return generateResponse(request, 0, encodedTokenPrice);
    
  } catch (error: any) {
    return generateResponse(request, 1, web3.utils.asciiToHex(error.message));
  }
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

- `HC_HELPER_ADDR`: Address of the Hybrid Compute helper contract.
- `OC_HYBRID_ACCOUNT`: Address of the Hybrid Compute account.
- `ENTRY_POINTS`: Entry points for the Hybrid Compute system.
- `CHAIN_ID`: ID of the blockchain network.
- `OC_PRIVKEY`: Private key for signing responses.

Ensure these are set in your environment or `.env` file.

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
