import os
import sys
from web3 import Web3
from eth_abi import abi as ethabi
import eth_account
from jsonrpclib.SimpleJSONRPCServer import SimpleJSONRPCServer, SimpleJSONRPCRequestHandler

class RequestHandler(SimpleJSONRPCRequestHandler):
    rpc_paths = ('/', '/hc')

class HybridComputeSDK:
    def __init__(self):
        self.server = None
        try:
            self.EP_ADDR = os.environ['ENTRY_POINTS']
            self.HC_CHAIN = int(os.environ['CHAIN_ID'])
            self.HH_ADDR = os.environ['HC_HELPER_ADDR']
            self.HA_ADDR = os.environ['OC_HYBRID_ACCOUNT']
            self.HA_OWNER = os.environ['OC_OWNER']
            self.hc1_key = os.environ['OC_PRIVKEY']
        except KeyError as e:
            raise EnvironmentError(f"Missing required environment variable: {e.args[0]}")

        if self.HC_CHAIN == 0:
            raise ValueError("CHAIN_ID must not be 0")

        for var_name, var_value in [
            ('HC_HELPER_ADDR', self.HH_ADDR),
            ('ENTRY_POINTS', self.EP_ADDR),
            ('OC_HYBRID_ACCOUNT', self.HA_ADDR),
            ('OC_OWNER', self.HA_OWNER),
        ]:
            if len(var_value) != 42:
                raise ValueError(f"{var_name} must be 42 characters long")

        if len(self.hc1_key) != 66:
            raise ValueError("OC_PRIVKEY must be 66 characters long")

        try:
            self.EntryPointAddr = Web3.to_checksum_address(self.EP_ADDR)
            self.hc1_addr = Web3.to_checksum_address(self.HA_OWNER)
            self.HybridAcctAddr = Web3.to_checksum_address(self.HA_ADDR)
            self.HelperAddr = Web3.to_checksum_address(self.HH_ADDR)
        except ValueError as e:
            raise ValueError(f"Invalid Ethereum address: {str(e)}")

    def create_json_rpc_server_instance(self, host='0.0.0.0', port=1234):
        self.server = SimpleJSONRPCServer((host, port), requestHandler=RequestHandler)
        return self

    def add_server_action(self, selector_name, action):
        self.server.register_function(action, self.selector(selector_name))
        return self

    def serve_forever(self):
        if self.server:
            print(f"Server started at http://{self.server.server_address[0]}:{self.server.server_address[1]}")
            self.server.serve_forever()

    def serve_once(self):
        if self.server:
            print(f"Server handling one request at http://{self.server.server_address[0]}:{self.server.server_address[1]}")
            self.server.handle_request()

    def stop_server(self):
        if self.server:
            self.server.shutdown()

    def is_server_healthy(self):
        return self.server is not None

    def get_server(self):
        return self.server

    def selector(self, name):
        name_hash = Web3.to_hex(Web3.keccak(text=name))
        return str(name_hash)[2:10]

    def selector_hex(self, name):
        name_hash = Web3.to_hex(Web3.keccak(text=name))
        return Web3.to_bytes(hexstr=str(name_hash)[:10])

    # version 0.7 (gen_response_v7)
    def gen_response(self, req, err_code, resp_payload):
        resp2 = ethabi.encode(['address', 'uint256', 'uint32', 'bytes'], [
                              req['srcAddr'], req['srcNonce'], err_code, resp_payload])
        p_enc1 = self.selector_hex("PutResponse(bytes32,bytes)") + \
            ethabi.encode(['bytes32', 'bytes'], [req['skey'], resp2])  # dfc98ae8

        p_enc2 = self.selector_hex("execute(address,uint256,bytes)") + \
            ethabi.encode(['address', 'uint256', 'bytes'], [
                Web3.to_checksum_address(self.HelperAddr), 0, p_enc1])

        limits = {
            'verificationGasLimit': "0x10000",
            'preVerificationGas': "0x10000",
        }

        # This call_gas formula is a "close enough" estimate for the initial implementation.
        # A more accurate model, or a protocol enhancement to run an actual simulation, may
        # be required in the future.
        call_gas = 705*len(resp_payload) + 170000

        print("call_gas calculation", len(resp_payload), 4+len(p_enc2), call_gas)

        account_gas_limits = \
            ethabi.encode(['uint128'],[Web3.to_int(hexstr=limits['verificationGasLimit'])])[16:32] + \
            ethabi.encode(['uint128'],[call_gas])[16:32]

        gas_fees = Web3.to_bytes(
            hexstr="0x0000000000000000000000000000000000000000000000000000000000000000"
        )

        packed = ethabi.encode([
            'address',
            'uint256',
            'bytes32',
            'bytes32',
            'bytes32',
            'uint256',
            'bytes32',
            'bytes32',
        ], [
            self.HybridAcctAddr,
            req['opNonce'],
            Web3.keccak(Web3.to_bytes(hexstr='0x')),  # initCode
            Web3.keccak(p_enc2),
            account_gas_limits,
            Web3.to_int(hexstr=limits['preVerificationGas']),
            gas_fees,
            Web3.keccak(Web3.to_bytes(hexstr='0x')), # paymasterAndData
        ])
        oo_hash = Web3.keccak(ethabi.encode(['bytes32', 'address', 'uint256'], [
                             Web3.keccak(packed), self.EntryPointAddr, self.HC_CHAIN]))

        signer_acct = eth_account.account.Account.from_key(self.hc1_key)
        e_msg = eth_account.messages.encode_defunct(oo_hash)
        sig = signer_acct.sign_message(e_msg)

        success = err_code == 0
        print("Method returning success={} response={} signature={}".format(success, Web3.to_hex(resp_payload), Web3.to_hex(sig.signature)))

        return ({
            "success": success,
            "response": Web3.to_hex(resp_payload),
            "signature": Web3.to_hex(sig.signature)
        })


    def parse_req(self, sk, src_addr, src_nonce, oo_nonce, payload):
        req = {}
        req['skey'] = Web3.to_bytes(hexstr=sk)
        req['srcAddr'] = Web3.to_checksum_address(src_addr)
        req['srcNonce'] = Web3.to_int(hexstr=src_nonce)
        req['opNonce'] = Web3.to_int(hexstr=oo_nonce)
        req['reqBytes'] = Web3.to_bytes(hexstr=payload)
        return req