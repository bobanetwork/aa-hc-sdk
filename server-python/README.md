# README.md
# Hybrid Compute SDK

A Python SDK for creating JSON-RPC servers with hybrid compute capabilities.

## Installation

```
pip install hybrid_compute_sdk
```

## Usage

```python
from hybrid_compute_sdk import HybridComputeSDK

TEST_PORT = 8080

sdk = HybridComputeSDK()
server = sdk.create_json_rpc_server_instance()

@server.add_server_action("testAction")
def test_action():
    return {"state": "running", "name": "another_action", "valid": True}

@server.add_server_action("anotherAction")
def another_action():
    return {"state": "running", "name": "another_action", "valid": True}

@server.add_server_action("andAnotherAction")
def and_another_action():
    return {"state": "paused", "name": "and_another_action", "valid": True}

server.listen_at(TEST_PORT)
```