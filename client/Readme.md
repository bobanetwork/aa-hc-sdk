# Hybrid Compute Client SDK

This SDK provides client-side functionality for Hybrid Compute operations in React applications.

## Installation

```bash
npm install @bobanetwork/aa-hc-sdk-client
```

## Usage

```typescript
import { HybridComputeClientSDK } from '@bobanetwork/aa-hc-sdk-client';

const sdk = new HybridComputeClientSDK('chainId', 'accountId');

// Build an invoke transaction
const transaction = await sdk.buildInvokeTransaction({
  // ... transaction parameters
});

// Invoke a snap
const result = await sdk.invokeSnap({
  // ... invoke options
});
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

## License

ISC