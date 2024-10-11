import sys
import os
from hybrid_compute_sdk import HybridComputeSDK
from eth_abi import abi as ethabi
from web3 import Web3
import requests

# create your sdk instance
sdk = HybridComputeSDK()
sdk.create_json_rpc_server_instance()

def offchain_getprice(ver, sk, src_addr, src_nonce, oo_nonce, payload, *args):
    print("-> offchain_getprice handler called with subkey={} src_addr={} src_nonce={} oo_nonce={} payload={} extra_args={}".format(sk,
          src_addr, src_nonce, oo_nonce, payload, args))
    err_code = 0
    resp = Web3.to_bytes(text="unknown error")
    assert(ver == "0.2")

    try:
        print("parsing request!!")
        req = sdk.parse_req(sk, src_addr, src_nonce, oo_nonce, payload)
        print("parsed requests !!!")
        dec = ethabi.decode(['string'], req['reqBytes'])
        tokenSymbol = dec[0]
        tokenSymbol = tokenSymbol.upper()
        print("tokensymbol", tokenSymbol)

        coinListUrl = "https://api.coinranking.com/v2/coins"
        headers = {
            "accept": "application/json",
            # "x-access-token": COINRANKING_API_KEY,
        }

        tokenUuid = None
        coinListJson = requests.get(coinListUrl, headers=headers).json()
        for c in coinListJson["data"]["coins"]:
            print("c", c["symbol"])
            if c["symbol"] == tokenSymbol:
                tokenUuid = c["uuid"]
                tokenName = c["name"]
                break

        if not tokenUuid:
            print("Token {} not found", tokenSymbol)
            resp = Web3.to_bytes(
                text="Error: Token {} not found".format(tokenSymbol))
            return sdk.gen_response(req, 1, resp)

        priceUrl = "https://api.coinranking.com/v2/coin/{}/price".format(
            tokenUuid)
        headers = {
            "accept": "application/json",
        }
        priceResponse = requests.get(priceUrl, headers=headers)
        price = None
        if priceResponse.status_code == requests.codes.ok:
            price = priceResponse.json()["data"]["price"]
            resp = ethabi.encode(["string"], [price])
            err_code = 0
            print("Price for {}: ".format(tokenName), price)
        else:
            print("Error:", priceResponse.status_code, priceResponse.text)
            err_code = 1
            resp = Web3.to_bytes(
                text="Error: {}".format(priceResponse.status_code))

    except Exception as e:
        print("DECODE FAILED", e)

    return sdk.gen_response(req, err_code, resp)

def main():
    print("created server")
    sdk.add_server_action("getprice(string)", offchain_getprice)

    print("Serving!")
    sdk.serve_forever()

if __name__ == '__main__':
    main()