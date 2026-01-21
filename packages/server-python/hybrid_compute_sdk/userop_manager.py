import os
from typing import Dict, Any, Optional, Literal
from web3 import Web3
from eth_abi import abi as ethabi
import eth_account
from eth_account import Account
from eth_account.messages import encode_defunct
import requests
from jsonrpcclient import request as jsonrpc_request
import time

from .config import CONTRACT_CONFIG

ACCOUNT_FACTORY_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "owner", "type": "address"},
            {"internalType": "uint256", "name": "salt", "type": "uint256"},
        ],
        "name": "createAccount",
        "outputs": [
            {"internalType": "contract SimpleAccount", "name": "ret", "type": "address"}
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "owner", "type": "address"},
            {"internalType": "uint256", "name": "salt", "type": "uint256"},
        ],
        "name": "getAddress",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
]

class UserOpManager:
    def __init__(
        self,
        node_url: Optional[str] = None,
        bundler_url: Optional[str] = None,
        entry_point: Optional[str] = None,
        chain_id: Optional[int] = None,
        private_key: Optional[str] = None,
        simple_account_factory_address: Optional[str] = None,
        hybrid_account_factory_address: Optional[str] = None,
    ):
        self.node_url = node_url or os.getenv('RPC_URL', 'https://sepolia.boba.network')
        self.bundler_url = bundler_url or os.getenv('BUNDLER_RPC', 'https://bundler-hc.sepolia.boba.network/rpc')
        self.entry_point = entry_point or os.getenv('ENTRY_POINTS', '0x0000000071727De22E5E9d8BAf0edAc6f37da032')
        self.chain_id = chain_id or int(os.getenv('CHAIN_ID', '28882'))
        self.private_key = private_key or os.getenv('OC_PRIVKEY') or os.getenv('CLIENT_PRIVATE_KEY')
        
        if not self.private_key:
            raise ValueError("Private key must be provided")
        
        self.w3 = Web3(Web3.HTTPProvider(self.node_url))
        if not self.w3.is_connected:
            raise ConnectionError(f"Failed to connect to node at {self.node_url}")
        
        self.account = Account.from_key(self.private_key)
        self.entrypoint_v7 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
        
        if simple_account_factory_address:
            self.simple_account_factory_address = simple_account_factory_address
        else:
            config_key = 'boba_mainnet' if self.chain_id == 288 else 'boba_sepolia'
            self.simple_account_factory_address = CONTRACT_CONFIG[config_key]['simpleAccountFactory']
        
        if hybrid_account_factory_address:
            self.hybrid_account_factory_address = hybrid_account_factory_address
        else:
            config_key = 'boba_mainnet' if self.chain_id == 288 else 'boba_sepolia'
            self.hybrid_account_factory_address = CONTRACT_CONFIG[config_key]['hybridAccountFactory']
        
        self.simple_factory_contract = self.w3.eth.contract(
            address=self.simple_account_factory_address,
            abi=ACCOUNT_FACTORY_ABI
        )
        self.hybrid_factory_contract = self.w3.eth.contract(
            address=self.hybrid_account_factory_address,
            abi=ACCOUNT_FACTORY_ABI
        )
    
    def selector(self, signature: str) -> str:
        """Generate function selector from signature"""
        name_hash = Web3.keccak(text=signature)
        return Web3.to_hex(name_hash)[:10]
    
    def get_entrypoint(self) -> str:
        """Get the entry point address"""
        return self.entry_point
    
    def get_rpc(self) -> str:
        """Get the RPC URL"""
        return self.node_url
    
    def get_bundler_url(self) -> str:
        return self.bundler_url
    
    def get_account_factory_address(self) -> str:
        return self.simple_account_factory_address
    
    def is_v7_entrypoint(self) -> bool:
        return self.entry_point.lower() == self.entrypoint_v7.lower()
    
    def _get_nonce(self, address: str, key: int = 0) -> str:
        encoded_params = ethabi.encode(['address', 'uint192'], [address, key])
        calldata = self.selector("getNonce(address,uint192)") + Web3.to_hex(encoded_params)[2:]
        result = self.w3.eth.call({'to': self.entry_point, 'data': calldata})
        return Web3.to_hex(result)
    
    def build_op(
        self,
        sender: str,
        target: str,
        value: int,
        calldata: str,
        nonce_key: int = 0
    ) -> Dict[str, Any]:
        gas_price = self.w3.eth.gas_price
        tip = int(Web3.to_wei(0.5, 'gwei'))
        base_fee = gas_price
        fee = int(gas_price * 1.1)
        
        encoded_params = ethabi.encode(
            ['address', 'uint256', 'bytes'],
            [target, value, Web3.to_bytes(hexstr=calldata) if calldata.startswith('0x') else calldata.encode()]
        )
        execute_calldata = self.selector("execute(address,uint256,bytes)") + Web3.to_hex(encoded_params)[2:]
        
        return {
            'sender': sender,
            'nonce': self._get_nonce(sender, nonce_key),
            'callData': execute_calldata,
            'callGasLimit': '0x0',
            'verificationGasLimit': '0x0',
            'preVerificationGas': '0x0',
            'maxFeePerGas': Web3.to_hex(fee),
            'maxPriorityFeePerGas': Web3.to_hex(tip),
            'signature': '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c'
        }
    
    def estimate_op(self, op: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = requests.post(
                self.bundler_url,
                json=jsonrpc_request("eth_estimateUserOperationGas", params=[op, self.entry_point]),
                headers={'Content-Type': 'application/json'}
            )
            result = response.json()
            
            if 'error' in result:
                return {'success': False, 'op': op}
            
            estimates = result['result']
            op['preVerificationGas'] = estimates['preVerificationGas']
            op['verificationGasLimit'] = estimates['verificationGasLimit']
            op['callGasLimit'] = estimates['callGasLimit']
            
            return {'success': True, 'op': op}
        except Exception:
            return {'success': False, 'op': op}
    
    def _sign_v7_operation(self, op: Dict[str, Any]) -> Dict[str, Any]:
        verification_gas_limit = Web3.to_int(hexstr=op['verificationGasLimit'])
        call_gas_limit = Web3.to_int(hexstr=op['callGasLimit'])
        max_priority_fee = Web3.to_int(hexstr=op['maxPriorityFeePerGas'])
        max_fee = Web3.to_int(hexstr=op['maxFeePerGas'])
        
        account_gas_limits = (
            ethabi.encode(['uint128'], [verification_gas_limit])[16:32] +
            ethabi.encode(['uint128'], [call_gas_limit])[16:32]
        )
        
        gas_fees = (
            ethabi.encode(['uint128'], [max_priority_fee])[16:32] +
            ethabi.encode(['uint128'], [max_fee])[16:32]
        )
        
        paymaster_and_data = op.get('paymasterAndData', '0x')
        
        pack1 = ethabi.encode(
            ['address', 'uint256', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32', 'bytes32'],
            [
                op['sender'],
                Web3.to_int(hexstr=op['nonce']),
                Web3.keccak(hexstr='0x'),
                Web3.keccak(hexstr=op['callData']),
                account_gas_limits,
                Web3.to_int(hexstr=op['preVerificationGas']),
                gas_fees,
                Web3.keccak(hexstr=paymaster_and_data),
            ]
        )
        
        pack2 = ethabi.encode(
            ['bytes32', 'address', 'uint256'],
            [Web3.keccak(pack1), self.entry_point, self.chain_id]
        )
        
        message_hash = Web3.keccak(pack2)
        e_msg = encode_defunct(message_hash)
        sig = self.account.sign_message(e_msg)
        
        op['signature'] = Web3.to_hex(sig.signature)
        op['accountGasLimits'] = '0x' + account_gas_limits.hex()
        op['gasFees'] = '0x' + gas_fees.hex()
        if not op.get('paymasterAndData'):
            op['paymasterAndData'] = '0x'
        
        return op
    
    def _submit_operation(self, op: Dict[str, Any]) -> str:
        response = requests.post(
            self.bundler_url,
            json=jsonrpc_request("eth_sendUserOperation", params=[op, self.entry_point]),
            headers={'Content-Type': 'application/json'}
        )
        result = response.json()
        
        if 'error' in result:
            raise Exception(f"UserOperation submission failed: {result['error']['message']}")
        
        return result['result']
    
    def _wait_for_receipt(self, op_hash: str) -> Dict[str, Any]:
        for _ in range(50):
            time.sleep(10)
            
            response = requests.post(
                self.bundler_url,
                json=jsonrpc_request("eth_getUserOperationReceipt", params=[op_hash]),
                headers={'Content-Type': 'application/json'}
            )
            result = response.json()
            
            if result.get('result'):
                receipt = result['result']
                if receipt['receipt']['status'] != '0x1':
                    raise Exception("UserOperation failed")
                return receipt
        
        raise Exception("UserOperation timed out")
    
    def sign_submit_op(self, op: Dict[str, Any]) -> Dict[str, Any]:
        signed_op = self._sign_v7_operation(op)
        op_hash = self._submit_operation(signed_op)
        return self._wait_for_receipt(op_hash)
    
    async def get_expected_address(
        self,
        salt: int,
        account_type: Literal['simple', 'hybrid'] = 'simple',
        owner_address: Optional[str] = None
    ) -> str:
        owner = owner_address if owner_address else self.account.address
        factory = self.hybrid_factory_contract if account_type == 'hybrid' else self.simple_factory_contract
        expected_address = factory.functions.getAddress(owner, salt).call()
        return expected_address
    
    async def create_smart_account(
        self, 
        salt: int, 
        owner_address: Optional[str] = None
    ) -> Dict[str, Any]:
        new_owner = owner_address if owner_address else self.account.address
        smart_account_address = await self.get_expected_address(salt, 'simple', new_owner)
        
        tx = self.simple_factory_contract.functions.createAccount(
            new_owner, salt
        ).build_transaction({
            'from': self.account.address,
            'gas': 0,
            'gasPrice': 0,
            'nonce': 0
        })
        create_account_data = tx['data']
        
        gas_estimate = self.w3.eth.estimate_gas({
            'from': self.account.address,
            'to': self.simple_account_factory_address,
            'data': create_account_data
        })
        
        transaction = {
            'from': self.account.address,
            'to': self.simple_account_factory_address,
            'data': create_account_data,
            'gas': int(gas_estimate * 1.2),
            'nonce': self.w3.eth.get_transaction_count(self.account.address),
            'chainId': self.chain_id,
            'gasPrice': self.w3.eth.gas_price
        }
        
        signed_txn = self.w3.eth.account.sign_transaction(transaction, self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        
        self._fund_account(smart_account_address)
        
        return {'address': smart_account_address, 'receipt': receipt}
    
    async def create_hybrid_account(
        self,
        salt: int,
        owner_address: Optional[str] = None
    ) -> Dict[str, Any]:
        new_owner = owner_address if owner_address else self.account.address
        hybrid_account_address = await self.get_expected_address(salt, 'hybrid', new_owner)
        
        tx = self.hybrid_factory_contract.functions.createAccount(
            new_owner, salt
        ).build_transaction({
            'from': self.account.address,
            'gas': 0,
            'gasPrice': 0,
            'nonce': 0
        })
        create_account_data = tx['data']

        gas_estimate = self.w3.eth.estimate_gas({
            'from': self.account.address,
            'to': self.hybrid_account_factory_address,
            'data': create_account_data
        })
        
        transaction = {
            'from': self.account.address,
            'to': self.hybrid_account_factory_address,
            'data': create_account_data,
            'gas': int(gas_estimate * 1.2),
            'nonce': self.w3.eth.get_transaction_count(self.account.address),
            'chainId': self.chain_id,
            'gasPrice': self.w3.eth.gas_price
        }
        
        signed_txn = self.w3.eth.account.sign_transaction(transaction, self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        
        self._fund_account(hybrid_account_address)
        
        return {'address': hybrid_account_address, 'receipt': receipt}
    
    def _fund_account(self, account_address: str):
        funding_amount = Web3.to_wei(0.001, 'ether')
        
        try:
            pending_nonce = self.w3.eth.get_transaction_count(
                self.account.address,
                block_identifier='pending'
            )
            
            fund_transaction = {
                'from': self.account.address,
                'to': account_address,
                'value': funding_amount,
                'gas': 100000,
                'nonce': pending_nonce,
                'chainId': self.chain_id,
                'gasPrice': self.w3.eth.gas_price
            }
            
            signed_fund_txn = self.w3.eth.account.sign_transaction(fund_transaction, self.private_key)
            fund_hash = self.w3.eth.send_raw_transaction(signed_fund_txn.raw_transaction)
            self.w3.eth.wait_for_transaction_receipt(fund_hash)
        except Exception as err:
            if "nonce too low" in str(err).lower():
                nonce2 = self.w3.eth.get_transaction_count(
                    self.account.address,
                    block_identifier='pending'
                )
                fund_transaction['nonce'] = nonce2
                signed_fund_txn = self.w3.eth.account.sign_transaction(fund_transaction, self.private_key)
                fund_hash = self.w3.eth.send_raw_transaction(signed_fund_txn.raw_transaction)
                self.w3.eth.wait_for_transaction_receipt(fund_hash)
            else:
                raise err
    
    async def get_owner(self, contract_address: str) -> str:
        result = self.w3.eth.call({
            'to': contract_address,
            'data': '0x8da5cb5b'
        })
        owner_address = self.w3.codec.decode_single('address', result)
        return owner_address
