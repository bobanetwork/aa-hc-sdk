# Hybrid Compute SDK - Python Server

This package provides Python server-side functionality for the Hybrid Compute SDK, including smart account management and user operation handling.

## Features

- **HybridComputeSDK**: Core server functionality for hybrid compute operations
- **UserOpManager**: Smart account creation and management (new!)
  - Create smart accounts with custom or default owners
  - Get expected addresses before creation
  - Retrieve account ownership information
  - Full compatibility with TypeScript UserOpManager

## Installation

```bash
pip install -r requirements.txt
```

## Configuration

The UserOpManager automatically uses environment variables for configuration. Create a `.env` file based on `.env-template`:

```bash
# Boba Sepolia Configuration
RPC_URL=https://sepolia.boba.network
BUNDLER_RPC=https://bundler-hc.sepolia.boba.network
ENTRY_POINTS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
CHAIN_ID=28882

# Private Key (choose one)
OC_PRIVKEY=0x...  # Your private key for account operations
# CLIENT_PRIVATE_KEY=0x...  # Alternative private key variable
```

## Quick Start

### Basic Usage

```python
from hybrid_compute_sdk import HybridComputeSDK, UserOpManager

# Initialize the main SDK
sdk = HybridComputeSDK()

# Initialize UserOpManager with environment variables
userop_manager = UserOpManager()

# Or override specific parameters if needed
userop_manager = UserOpManager(
    node_url="https://sepolia.boba.network",
    bundler_url="https://bundler-hc.sepolia.boba.network", 
    entry_point="0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    chain_id=28882,  # Boba Sepolia
    private_key="0x..."  # Your private key
)
```

### Smart Account Management

The `UserOpManager` provides the same functionality as the TypeScript version:

#### Get Expected Address

```python
# Get expected address for a smart account
salt = 12345
expected_address = await userop_manager.get_expected_address(salt)
print(f"Expected address: {expected_address}")

# With custom owner
custom_owner = "0x1234..."
expected_address = await userop_manager.get_expected_address(salt, custom_owner)
```

#### Create Smart Account

```python
# Create smart account with default owner (from private key)
result = await userop_manager.create_smart_account(salt)
print(f"Created account: {result['address']}")
print(f"Transaction: {result['receipt']['transactionHash'].hex()}")

# Create with custom owner
result = await userop_manager.create_smart_account(salt, custom_owner)
```

#### Get Account Owner

```python
# Get owner of a smart account
owner = await userop_manager.get_owner(account_address)
print(f"Account owner: {owner}")
```

## API Reference

### UserOpManager

#### Constructor

```python
UserOpManager(
    node_url: Optional[str] = None,      # Defaults to RPC_URL env var
    bundler_url: Optional[str] = None,   # Defaults to BUNDLER_RPC env var
    entry_point: Optional[str] = None,   # Defaults to ENTRY_POINTS env var
    chain_id: Optional[int] = None,      # Defaults to CHAIN_ID env var (28882)
    private_key: Optional[str] = None,   # Defaults to OC_PRIVKEY or CLIENT_PRIVATE_KEY env var
)
```

#### Methods

- `create_smart_account(salt: int, owner_address: Optional[str] = None) -> Dict[str, Any]`
  - Creates a new smart account
  - Automatically funds with 0.001 ETH
  - Returns address and transaction receipt

- `get_expected_address(salt: int, owner_address: Optional[str] = None) -> str`
  - Gets the expected address before creation
  - Useful for pre-computing addresses

- `get_owner(contract_address: str) -> str`
  - Retrieves the owner of a smart account

- `is_v7_entrypoint() -> bool`
  - Checks if using v0.7 entry point

- `selector(signature: str) -> str`
  - Generates function selectors

## Testing

Run the test suite to ensure functionality matches the TypeScript version:

```bash
# Run all tests
pytest

# Run specific test files
pytest tests/test_userop_manager.py
pytest tests/test_integration.py

# Run with coverage
pytest --cov=hybrid_compute_sdk
```

## Examples

See `examples/userop_example.py` for a complete usage example.

## Compatibility

This Python implementation is designed to be fully compatible with the TypeScript `UserOpManager`:

- Same method signatures and behavior
- Identical constants and addresses
- Matching error handling and retry logic
- Same transaction flow and funding mechanism

## Environment Variables

The following environment variables are used for configuration:

- `RPC_URL`: Boba Sepolia RPC endpoint (default: https://sepolia.boba.network)
- `BUNDLER_RPC`: Boba Sepolia bundler endpoint (default: https://bundler-hc.sepolia.boba.network)
- `ENTRY_POINTS`: Entry point contract address (default: 0x0000000071727De22E5E9d8BAf0edAc6f37da032)
- `CHAIN_ID`: Blockchain chain ID (default: 28882 for Boba Sepolia)
- `OC_PRIVKEY` or `CLIENT_PRIVATE_KEY`: Private key for transactions

## Dependencies

- `web3`: Ethereum Web3 library
- `eth-account`: Ethereum account management
- `eth-abi`: Ethereum ABI encoding/decoding
- `pytest`: Testing framework
- `pytest-asyncio`: Async testing support

## License

See LICENSE file for details.
