# Hybrid Compute Client SDK


<img src="coverage/badge-lines.svg" alt="Line Coverage">
<img src="coverage/badge-functions.svg" alt="Function Coverage">
<img src="coverage/badge-branches.svg" alt="Branch Coverage">

This SDK provides client-side functionality for Hybrid Compute operations in React applications.

## Installation

```bash
npm install @bobanetwork/aa-hc-sdk-client
```

## Usage

```typescript
import { HybridComputeClientSDK } from '@bobanetwork/aa-hc-sdk-client';
import {MetaMaskContext} from "@/context/MetamaskContext";

export const defaultSnapOrigin = 'npm:@bobanetwork/snap-account-abstraction-keyring-hc'

const [state] = useContext(MetaMaskContext);

// Boba Local, or 28882 Boba Sepolia
const chainId = '901'

// Create the SDK
const sdk = new HybridComputeClientSDK(chainId, state.selectedAcount.id);

// Build an invoke transaction
const transactionDetails = await clientSdk.buildInvokeTransaction({
    selector: {name: "fetchPrice", params: ["string"]},
    transaction: {
        contractAddress: import.meta.env.FETCH_PRICE_CONTRACT,
        parameters: {types: ['string'], values: [tokenSymbol]},
        value: "0"
    }
})

// Invoke a snap
const result = await sdk.invokeSnap({
    defaultSnapOrigin,
    transactionDetails,
});

console.log("Done: ", result);
```



## API Documentation

### `HybridComputeClientSDK`

#### Constructor

```typescript
constructor(chain: string, accountIdConnected: string)
```

#### Methods

- `buildInvokeTransaction(params: CreateInvokeTransaction): Promise<InvokeTransaction>`
- `invokeSnap(invokeOptions: InvokeTransactionOptions): Promise<any>`
- `setConnectedAccount(accountId: string): void`
- `setChain(chain: string): void`

For more detailed information about the types and interfaces, please refer to the source code.