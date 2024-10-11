# README.md
# Hybrid Compute SDK

A Python SDK for creating JSON-RPC servers with hybrid compute capabilities.

## Installation

```
pip install hybrid_compute_sdk
```

## Usage

```python
import asyncio
from hybrid_compute_sdk.server import HybridComputeSDK

async def main():
    sdk = HybridComputeSDK()
    server = sdk.create_json_rpc_server_instance()

    async def hybrid_action(params):
        gen_response(request, error_code, response) 
        
    server.add_server_action("test_action", hybrid_action)
    
    await server.listen_at(8080)

if __name__ == '__main__':
    asyncio.run(main())
```