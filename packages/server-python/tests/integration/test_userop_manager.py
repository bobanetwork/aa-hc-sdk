import pytest
import os
import time
from dotenv import load_dotenv
from hybrid_compute_sdk import UserOpManager

load_dotenv()

RPC_URL = "https://sepolia.boba.network"
BUNDLER_URL = "https://bundler-hc.sepolia.boba.network/rpc"
ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
CHAIN_ID = 28882
PRIVATE_KEY = os.getenv('CLIENT_PRIVATE_KEY') or os.getenv('OC_PRIVKEY')

@pytest.mark.skipif(not PRIVATE_KEY, reason="Requires CLIENT_PRIVATE_KEY or OC_PRIVKEY")
class TestUserOpManagerIntegration:

    @pytest.mark.asyncio
    async def test_create_smart_account(self):
        manager = UserOpManager(
            node_url=RPC_URL,
            bundler_url=BUNDLER_URL,
            entry_point=ENTRY_POINT,
            chain_id=CHAIN_ID,
            private_key=PRIVATE_KEY,
        )
        
        salt = int(time.time())
        expected_address = await manager.get_expected_address(salt)
        
        result = await manager.create_smart_account(salt)
        
        assert result['address'] == expected_address
        assert 'receipt' in result
        assert result['receipt']['status'] == 1
        
        print(f"\nCreated Simple Account: {result['address']}")
    
    @pytest.mark.asyncio
    async def test_create_hybrid_account(self):
        manager = UserOpManager(
            node_url=RPC_URL,
            bundler_url=BUNDLER_URL,
            entry_point=ENTRY_POINT,
            chain_id=CHAIN_ID,
            private_key=PRIVATE_KEY,
        )
        
        salt = int(time.time()) + 1
        expected_address = await manager.get_expected_address(salt, 'hybrid')
        
        result = await manager.create_hybrid_account(salt)
        
        assert result['address'] == expected_address
        assert 'receipt' in result
        assert result['receipt']['status'] == 1
        
        print(f"\nCreated Hybrid Account: {result['address']}")

