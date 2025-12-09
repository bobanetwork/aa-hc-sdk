import os
import re
import sys
from typing import Dict, Any, Optional
from web3 import Web3
from eth_account import Account
import eth_account
from eth_abi import abi as ethabi
import requests
from jsonrpcclient import request
import time

class AAUtils:
    """
    Library to create and submit AA UserOperations to a Bundler.
    """

    def __init__(
        self,
        node_url: Optional[str] = None,
        bundler_url: Optional[str] = None,
        #private_key: Optional[str] = None,
    ):
        # Use environment variables with fallbacks to constructor parameters
        self.node_url = node_url or os.getenv('RPC_URL', 'https://sepolia.boba.network') # FIXME 
        self.bundler_url = bundler_url or os.getenv('BUNDLER_RPC', 'https://bundler-hc.sepolia.boba.network')
        #self.entry_point = entry_point or os.getenv('ENTRY_POINTS', '0x0000000071727De22E5E9d8BAf0edAc6f37da032')
        #self.chain_id = chain_id or int(os.getenv('CHAIN_ID', '28882'))  # Boba Sepolia
        #self.private_key = private_key or os.getenv('CLIENT_PRIVATE_KEY')

        #if not self.private_key:
        #    raise ValueError("Private key must be provided either as parameter or via OC_PRIVKEY or CLIENT_PRIVATE_KEY environment variable")

        # Initialize Web3 connection
        self.w3 = Web3(Web3.HTTPProvider(self.node_url))
        if not self.w3.is_connected:
            raise ConnectionError(f"Failed to connect to node at {self.node_url}")

        self.entry_point = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'


    def blockhash(self, num):
        return self.w3.eth.get_block(num).hash

    def aa_nonce(self, addr, key):
        """Returns the keyed AA nonce for an address"""
        calldata = selector("getNonce(address,uint192)") + ethabi.encode(['address','uint192'],[addr, key])
        ret = self.w3.eth.call({'to':self.entry_point,'data':calldata})
        return Web3.to_hex(ret)

    def build_op(self, sender, target, value, calldata, nonce_key=0, paymaster=None):
        """Builds a UserOperation to call an account's Execute method, passing specified parameters."""

        # Note - currently Tip affects the preVerificationGas estimate due to
        # the mechanism for offsetting the L1 storage fee. If tip is too low
        # the required L2 gas can exceed the block gas limit.
        tip = max(self.w3.eth.max_priority_fee, Web3.to_wei(0.001, 'gwei'))
        base_fee = self.w3.eth.gas_price - self.w3.eth.max_priority_fee
        print("tip", tip, "base_fee", base_fee)
        assert base_fee > 0
        fee = max(self.w3.eth.gas_price, 2 * base_fee + tip)
        print("Using gas prices", fee, tip, "detected",
              self.w3.eth.gas_price, self.w3.eth.max_priority_fee)

        ex_calldata = selector("execute(address,uint256,bytes)") + \
            ethabi.encode(['address', 'uint256', 'bytes'],
                          [target, value, calldata])

        op = {
           'sender': sender,
           'nonce': self.aa_nonce(sender,nonce_key),
           #factory - none
           #factoryData - none
           'callData': Web3.to_hex(ex_calldata),
           'callGasLimit': "0x0",
           'verificationGasLimit': Web3.to_hex(0),
           'preVerificationGas': "0x0",
           'maxFeePerGas': Web3.to_hex(fee),
           'maxPriorityFeePerGas': Web3.to_hex(tip),
           # Dummy signature, per Alchemy AA documentation
           'signature': '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c'
        }
        if paymaster:
          op['paymaster'] = paymaster
          op['paymasterData'] = "0x"
          op['paymasterVerificationGasLimit'] = "0x10002"
          op['paymasterPostOpGasLimit'] = "0x10000"
        print("Built userOperation", op)
        return op

    def estimate_op_gas(self, op, extra_pvg=0, extra_vg=0, extra_cg=0):
        """ Wrapper to call eth_estimateUserOperationGas() and update the op.
            Allows limits to be increased in cases where a bundler is
            providing insufficient estimates. Returns success flag + new op"""
        est_params = [op, self.entry_point]

        response = requests.post(
            self.bundler_url, json=request("eth_estimateUserOperationGas", params=est_params))
        print("estimateGas response", response.json())

        if 'error' in response.json():
            print("*** eth_estimateUserOperationGas failed")
            time.sleep(2)
            return False, op

        est_result = response.json()['result']

        op['preVerificationGas'] = Web3.to_hex(Web3.to_int(
            hexstr=est_result['preVerificationGas']) + extra_pvg)
        op['verificationGasLimit'] = Web3.to_hex(Web3.to_int(
            hexstr=est_result['verificationGasLimit']) + extra_vg)
        op['callGasLimit'] = Web3.to_hex(Web3.to_int(
            hexstr=est_result['callGasLimit']) + extra_cg)
        return True, op

    def sign_v7_op(self, user_op, signer_key):
        """Signs a UserOperation, returning a modified op containing a 'signature' field."""
        op = dict(user_op) # Derived fields are added to 'op' prior to hashing

        if 'paymaster' in op:
            op['paymasterAndData'] = op['paymaster'] + \
                op['paymasterVerificationGasLimit'][2:].zfill(32) + \
                op['paymasterPostOpGasLimit'][2:].zfill(32)
            # TODO - append paymasterData if present

        # The deploy-local script supplies the packed values prior to signature, as it bypasses the bundler.
        # For normal UserOperations the fields are derived here
        if 'accountGasLimits' not in op:
            account_gas_limits  = ethabi.encode(['uint128'],[Web3.to_int(hexstr=op['verificationGasLimit'])])[16:32] \
                + ethabi.encode(['uint128'],[Web3.to_int(hexstr=op['callGasLimit'])])[16:32]
        else:
            account_gas_limits = Web3.to_bytes(hexstr=op['accountGasLimits'])

        if 'gasFees' not in op:
            gas_fees = ethabi.encode(['uint128'],[Web3.to_int(hexstr=op['maxPriorityFeePerGas'])])[16:32] \
                + ethabi.encode(['uint128'],[Web3.to_int(hexstr=op['maxFeePerGas'])])[16:32]
        else:
            gas_fees = Web3.to_bytes(hexstr=op['gasFees'])

        if 'paymasterAndData' not in op:
            op['paymasterAndData'] = "0x"

        pack1 = ethabi.encode(['address','uint256','bytes32','bytes32','bytes32','uint256','bytes32','bytes32'], \
              [op['sender'],
              Web3.to_int(hexstr=op['nonce']),
              Web3.keccak(hexstr="0x"), # initcode
              Web3.keccak(hexstr=op['callData']),
              account_gas_limits,
              Web3.to_int(hexstr=op['preVerificationGas']),
              gas_fees,
              Web3.keccak(hexstr=op['paymasterAndData']),
              ])
        pack2 = ethabi.encode(['bytes32','address','uint256'], [Web3.keccak(pack1), self.entry_point, self.w3.eth.chain_id])
        e_msg = eth_account.messages.encode_defunct(Web3.keccak(pack2))
        signer_acct = eth_account.account.Account.from_key(signer_key)
        sig = signer_acct.sign_message(e_msg)
        user_op['signature'] = Web3.to_hex(sig.signature)
        return user_op

    def sign_submit_op(self, op, owner_key):
        """Sign and submit a UserOperation to the Bundler"""

        signed_op = self.sign_v7_op(op, owner_key)

        while True:
            response = requests.post(self.bundler_url, json=request(
                "eth_sendUserOperation", params=[signed_op, self.entry_point]))
            if 'result' in response.json():
                break
            if 'error' in response.json():
                emsg = response.json()['error']['message']
                if emsg == "replacement underpriced":
                    print("*** Retrying with increased maxPriorityFeePerGas")
                    op['maxPriorityFeePerGas'] += 1
                    time.sleep(5)
                # Workaround for sending debug_traceCall to unsynced node
                if not re.search(r'message: block 0x.{64} not found', emsg):
                    break
            print("*** Retrying eth_sendUserOperation")
            time.sleep(5)

        print("sendOperation response", response.json())
        if 'error' in response.json():
            print("*** eth_sendUserOperation failed")
            sys.exit(1)

        op_hash = {}
        op_hash['hash'] = response.json()['result']
        timeout = True
        for _ in range(500):
            print("Waiting for receipt...")
            time.sleep(10)
            op_receipt = requests.post(self.bundler_url, json=request(
                "eth_getUserOperationReceipt", params=op_hash))
            op_receipt = op_receipt.json()['result']
            if op_receipt is not None:
                # print("op_receipt", op_receipt)
                assert op_receipt['receipt']['status'] == "0x1"
                print("operation success", op_receipt['success'],
                      "txHash=", op_receipt['receipt']['transactionHash'])
                timeout = False
                assert op_receipt['success']
                break
        if timeout:
            print("*** Previous operation timed out")
            sys.exit(1)
        return op_receipt

# This is duplicated in HybridComputeSDK as "selector_hex"
def selector(name):
    name_hash = Web3.to_hex(Web3.keccak(text=name))
    return Web3.to_bytes(hexstr=str(name_hash)[:10])
