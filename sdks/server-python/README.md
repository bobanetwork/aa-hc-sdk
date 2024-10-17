# README.md
# Hybrid Compute SDK

A Python SDK for creating JSON-RPC servers with hybrid compute capabilities.

## Installation

```
pip install hybrid_compute_sdk
```

## Usage

```python

# create your sdk instance
sdk = HybridComputeSDK()
sdk.create_json_rpc_server_instance()

def offchain_getprice(ver, sk, src_addr, src_nonce, oo_nonce, payload, *args):
    return sdk.gen_response(req, err_code, resp)

def main():
    print("created server")
    sdk.add_server_action("getprice(string)", offchain_getprice)

    print("Serving!")
    sdk.serve_forever()
```