import pytest
import os
from dotenv import load_dotenv
from hybrid_compute_sdk import UserOpManager

load_dotenv()

RPC_MAINNET = "https://mainnet.boba.network"
RPC_TESTNET = "https://gateway.tenderly.co/public/boba-sepolia"
BUNDLER_TESTNET = "https://bundler-hc.sepolia.boba.network/rpc"
BUNDLER_MAINNET = "https://bundler-hc.mainnet.boba.network"
ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
ACCOUNT_FACTORY_TESTNET = '0x9aC904d8DfeA0866aB341208700dCA9207834DeB'
ACCOUNT_FACTORY_MAINNET = '0x584960A850D74400280c436a07BE738C1c96195B'
CHAIN_ID_TESTNET = 28882
CHAIN_ID_MAINNET = 288
PRIVATE_KEY = os.getenv('CLIENT_PRIVATE_KEY') or os.getenv('OC_PRIVKEY')

# UserOpManager basic configuration
class TestUserOperationManager:
    def test_instantiate_testnet_manager(self):
        manager = UserOpManager(
            node_url=RPC_TESTNET,
            bundler_url=BUNDLER_TESTNET,
            entry_point=ENTRY_POINT,
            chain_id=CHAIN_ID_TESTNET,
            private_key=PRIVATE_KEY,
        )
        assert manager.get_entrypoint() == ENTRY_POINT
        assert manager.get_rpc() == RPC_TESTNET
        assert manager.get_bundler_url() == BUNDLER_TESTNET
        assert manager.get_account_factory_address() == ACCOUNT_FACTORY_TESTNET
    
    def test_instantiate_mainnet_manager(self):
        manager = UserOpManager(
            node_url=RPC_MAINNET,
            bundler_url=BUNDLER_MAINNET,
            entry_point=ENTRY_POINT,
            chain_id=CHAIN_ID_MAINNET,
            private_key=PRIVATE_KEY,
        )
        assert manager.get_entrypoint() == ENTRY_POINT
        assert manager.get_rpc() == RPC_MAINNET
        assert manager.get_bundler_url() == BUNDLER_MAINNET
        assert manager.get_account_factory_address() == ACCOUNT_FACTORY_MAINNET
    
    def test_return_correct_entrypoint(self):
        manager = UserOpManager(
            node_url=RPC_TESTNET,
            bundler_url=BUNDLER_TESTNET,
            entry_point=ENTRY_POINT,
            chain_id=CHAIN_ID_TESTNET,
            private_key=PRIVATE_KEY,
        )
        result = manager.get_entrypoint()
        assert result == ENTRY_POINT
    
    def test_return_correct_rpc_url(self):
        manager = UserOpManager(
            node_url=RPC_TESTNET,
            bundler_url=BUNDLER_TESTNET,
            entry_point=ENTRY_POINT,
            chain_id=CHAIN_ID_TESTNET,
            private_key=PRIVATE_KEY,
        )
        result = manager.get_rpc()
        assert result == RPC_TESTNET
    
    def test_correctly_identify_v7_entrypoint(self):
        manager = UserOpManager(
            node_url=RPC_TESTNET,
            bundler_url=BUNDLER_TESTNET,
            entry_point=ENTRY_POINT,
            chain_id=CHAIN_ID_TESTNET,
            private_key=PRIVATE_KEY,
        )
        result = manager.is_v7_entrypoint()
        assert result == True
    
    def test_generate_correct_function_selector(self):
        manager = UserOpManager(
            node_url=RPC_TESTNET,
            bundler_url=BUNDLER_TESTNET,
            entry_point=ENTRY_POINT,
            chain_id=CHAIN_ID_TESTNET,
            private_key=PRIVATE_KEY,
        )
        signature = "execute(address,uint256,bytes)"
        result = manager.selector(signature)
        
        assert result.startswith('0x')
        assert len(result) == 10
