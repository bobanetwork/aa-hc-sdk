# README.md
# Hybrid Compute SDK

A Python SDK for creating JSON-RPC servers with hybrid compute capabilities.

## Installation

```
pip install hybrid_compute_sdk
```

## Run tests

> python -m pytest test.py -v --full-trace

## Example Usages

Stuck? Here are some implementations: 
1. **[CodeCaster](https://github.com/bobanetwork/aa-hc-CodeCaster)** 
2. **[BlockChainBusters](https://github.com/bobanetwork/boba-blockchain-busters)**


## Using the SDK

```python
from web3 import Web3
from jsonrpclib.SimpleJSONRPCServer import SimpleJSONRPCServer, SimpleJSONRPCRequestHandler
from server_action import offchain_text2multi
from hybrid_compute_sdk import HybridComputeSDK
import logging

# Initialize logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def offchain_hello(ver, sk, src_addr, src_nonce, oo_nonce, payload, *args):
    return { "success":True, "response":payload, "signature":"0x" }

def server_loop():
    # new sdk instance
    sdk = HybridComputeSDK()
    
    # prepare the server
    sdk.create_json_rpc_server_instance()
    
    # add a custom server action
    sdk.add_server_action("text2multi(string)", offchain_text2multi)
    
    # add another server action
    sdk.add_server_action("hello", offchain_hello)
    
    # start server
    sdk.serve_forever()

server_loop()
```