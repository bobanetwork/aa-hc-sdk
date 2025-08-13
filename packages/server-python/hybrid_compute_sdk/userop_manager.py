import os
from typing import Dict, Any, Optional
from web3 import Web3
from eth_abi import abi as ethabi
import eth_account
from eth_account import Account
from eth_account.messages import encode_defunct

# Account Factory ABI for creating smart accounts
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
    """Python equivalent of the TypeScript UserOpManager for managing smart account operations"""
    
    def __init__(
        self,
        node_url: Optional[str] = None,
        bundler_url: Optional[str] = None,
        entry_point: Optional[str] = None,
        chain_id: Optional[int] = None,
        private_key: Optional[str] = None,
    ):
        # Use environment variables with fallbacks to constructor parameters
        self.node_url = node_url or os.getenv('RPC_URL', 'https://sepolia.boba.network')
        self.bundler_url = bundler_url or os.getenv('BUNDLER_RPC', 'https://bundler-hc.sepolia.boba.network')
        self.entry_point = entry_point or os.getenv('ENTRY_POINTS', '0x0000000071727De22E5E9d8BAf0edAc6f37da032')
        self.chain_id = chain_id or int(os.getenv('CHAIN_ID', '28882'))  # Boba Sepolia
        self.private_key = private_key or os.getenv('OC_PRIVKEY') or os.getenv('CLIENT_PRIVATE_KEY')
        
        if not self.private_key:
            raise ValueError("Private key must be provided either as parameter or via OC_PRIVKEY or CLIENT_PRIVATE_KEY environment variable")
        
        # Initialize Web3 connection
        self.w3 = Web3(Web3.HTTPProvider(self.node_url))
        if not self.w3.is_connected:
            raise ConnectionError(f"Failed to connect to node at {self.node_url}")
        
        # Create account from private key
        self.account = Account.from_key(self.private_key)
        
        # Constants
        self.entrypoint_v7 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
        self.factory_address = "0x9aC904d8DfeA0866aB341208700dCA9207834DeB"
        
        # Create contract instance for factory
        self.factory_contract = self.w3.eth.contract(
            address=self.factory_address,
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
    
    def is_v7_entrypoint(self) -> bool:
        """Check if this is a v0.7 entry point"""
        return self.entry_point.lower() == self.entrypoint_v7.lower()
    
    async def create_smart_account(
        self, 
        salt: int, 
        owner_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new smart account
        
        Args:
            salt: Salt value for account creation
            owner_address: Optional owner address (defaults to account from private key)
            
        Returns:
            Dict containing the new account address and transaction receipt
        """
        # Owner is either explicitly set, or derived from the PK
        new_owner = owner_address if owner_address else self.account.address
        
        # Get the expected smart account address
        smart_account_address = await self.get_expected_address(salt, new_owner)
        
        print(f"New Address: {smart_account_address}")
        
        # Prepare transaction data
        create_account_data = self.factory_contract.encodeABI(
            fn_name="createAccount",
            args=[new_owner, salt]
        )
        
        # Estimate gas
        gas_estimate = self.w3.eth.estimate_gas({
            'from': self.account.address,
            'to': self.factory_address,
            'data': create_account_data
        })
        
        # Build and sign transaction
        transaction = {
            'from': self.account.address,
            'to': self.factory_address,
            'data': create_account_data,
            'gas': gas_estimate,
            'nonce': self.w3.eth.get_transaction_count(self.account.address),
            'chainId': self.chain_id
        }
        
        # Get current gas price
        gas_price = self.w3.eth.gas_price
        transaction['gasPrice'] = gas_price
        
        # Sign and send transaction
        signed_txn = self.w3.eth.account.sign_transaction(transaction, self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        # Wait for transaction receipt
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # Fund the new account with 0.001 ETH
        funding_amount = Web3.to_wei(0.001, 'ether')
        
        try:
            # Get pending nonce for funding transaction
            pending_nonce = self.w3.eth.get_transaction_count(
                self.account.address, 
                block_identifier='pending'
            )
            
            fund_transaction = {
                'from': self.account.address,
                'to': smart_account_address,
                'value': funding_amount,
                'gas': 21000,  # Standard transfer gas
                'nonce': pending_nonce,
                'chainId': self.chain_id,
                'gasPrice': gas_price
            }
            
            signed_fund_txn = self.w3.eth.account.sign_transaction(fund_transaction, self.private_key)
            fund_hash = self.w3.eth.send_raw_transaction(signed_fund_txn.rawTransaction)
            fund_receipt = self.w3.eth.wait_for_transaction_receipt(fund_hash)
            print(f"Funded {smart_account_address} with 0.001 ETH: {fund_hash.hex()}")
            
        except Exception as err:
            error_msg = str(err)
            if "nonce too low" in error_msg.lower():
                # Retry with updated nonce
                nonce2 = self.w3.eth.get_transaction_count(
                    self.account.address, 
                    block_identifier='pending'
                )
                
                fund_transaction['nonce'] = nonce2
                signed_fund_txn = self.w3.eth.account.sign_transaction(fund_transaction, self.private_key)
                fund_hash = self.w3.eth.send_raw_transaction(signed_fund_txn.rawTransaction)
                fund_receipt = self.w3.eth.wait_for_transaction_receipt(fund_hash)
                print(f"Funded on retry: {fund_hash.hex()}")
            else:
                raise err
        
        return {
            'address': smart_account_address,
            'receipt': receipt
        }
    
    async def get_expected_address(
        self, 
        salt: int, 
        owner_address: Optional[str] = None
    ) -> str:
        """
        Get the expected address for a smart account before creation
        
        Args:
            salt: Salt value for account creation
            owner_address: Optional owner address (defaults to account from private key)
            
        Returns:
            Expected smart account address
        """
        owner = owner_address if owner_address else self.account.address
        
        # Call the factory contract to get the expected address
        expected_address = self.factory_contract.functions.getAddress(owner, salt).call()
        
        return expected_address
    
    async def get_owner(self, contract_address: str) -> str:
        """
        Get the owner of a smart account contract
        
        Args:
            contract_address: Address of the smart account contract
            
        Returns:
            Owner address
        """
        # Call the getOwner function (selector: 0x8da5cb5b)
        result = self.w3.eth.call({
            'to': contract_address,
            'data': '0x8da5cb5b'
        })
        
        # Decode the result to get the owner address
        owner_address = self.w3.codec.decode_single('address', result)
        return owner_address
