import pytest
import os
from unittest.mock import Mock, patch
from web3 import Web3
from eth_account import Account
from hybrid_compute_sdk.userop_manager import UserOpManager

class TestIntegration:
    """Integration tests to verify Python UserOpManager matches TypeScript behavior"""
    
    @pytest.fixture
    def mock_environment(self):
        """Mock environment variables and Web3 dependencies"""
        with patch.dict(os.environ, {
            'RPC_URL': 'https://sepolia.boba.network',
            'BUNDLER_RPC': 'https://bundler-hc.sepolia.boba.network',
            'ENTRY_POINTS': '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
            'CHAIN_ID': '28882',
            'OC_PRIVKEY': '0x' + '1' * 64
        }), \
        patch('hybrid_compute_sdk.userop_manager.Web3') as mock_web3_class, \
        patch('eth_account.Account.from_key') as mock_account:
            
            # Create mock Web3 instance
            mock_w3 = Mock()
            mock_w3.is_connected = True
            
            # Mock eth namespace
            mock_eth = Mock()
            mock_eth.gas_price = 20000000000
            mock_eth.get_transaction_count.return_value = 0
            mock_eth.estimate_gas.return_value = 100000
            mock_eth.send_raw_transaction.return_value = b'\x01' * 32
            mock_eth.wait_for_transaction_receipt.return_value = Mock(
                status=1,
                transactionHash=b'\x01' * 32
            )
            mock_eth.call.return_value = b'\x00' * 32
            
            # Mock codec for decoding
            mock_codec = Mock()
            mock_codec.decode_single.return_value = "0x" + "3" * 40
            
            mock_w3.eth = mock_eth
            mock_w3.codec = mock_codec
            
            mock_web3_class.return_value = mock_w3
            
            # Create mock account
            test_account = Account.from_key('0x' + '1' * 64)
            mock_account.return_value = test_account
            
            # Mock factory contract
            mock_factory_contract = Mock()
            mock_factory_contract.functions.getAddress.return_value.call.return_value = "0x" + "3" * 40
            mock_factory_contract.encodeABI.return_value = "0x" + "4" * 100
            
            mock_w3.eth.contract.return_value = mock_factory_contract
            
            return {
                'mock_w3': mock_w3,
                'mock_factory_contract': mock_factory_contract,
                'test_account': test_account
            }
    
    @pytest.mark.asyncio
    async def test_create_smart_account_flow(self, mock_environment):
        """Test the complete flow of creating a smart account matches TypeScript behavior"""
        mock_w3 = mock_environment['mock_w3']
        mock_factory_contract = mock_environment['mock_factory_contract']
        test_account = mock_environment['test_account']
        
        # Create UserOpManager instance
        manager = UserOpManager(
            'https://sepolia.boba.network',
            'https://bundler-hc.sepolia.boba.network',
            '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
            28882,
            '0x' + '1' * 64
        )
        
        # Test 1: Get expected address (should match TypeScript getExpectedAddress)
        expected_address = await manager.get_expected_address(12345)
        assert expected_address == "0x" + "3" * 40
        
        # Verify the contract was called with correct parameters
        mock_factory_contract.functions.getAddress.assert_called_with(
            test_account.address, 
            12345
        )
        
        # Test 2: Create smart account (should match TypeScript createSmartAccount)
        result = await manager.create_smart_account(12345)
        
        # Verify result structure matches TypeScript CreateResult
        assert 'address' in result
        assert 'receipt' in result
        assert result['address'] == "0x" + "3" * 40
        
        # Verify the account creation transaction was prepared correctly
        mock_factory_contract.encodeABI.assert_called_with(
            fn_name="createAccount",
            args=[test_account.address, 12345]
        )
        
        # Verify gas estimation was called
        mock_w3.eth.estimate_gas.assert_called()
        
        # Verify transaction was sent
        mock_w3.eth.send_raw_transaction.assert_called()
        
        # Verify funding transaction was also sent (0.001 ETH funding)
        assert mock_w3.eth.send_raw_transaction.call_count >= 2
    
    @pytest.mark.asyncio
    async def test_create_smart_account_with_custom_owner(self, mock_environment):
        """Test creating smart account with custom owner matches TypeScript behavior"""
        mock_factory_contract = mock_environment['mock_factory_contract']
        test_account = mock_environment['test_account']
        
        manager = UserOpManager(
            'https://sepolia.boba.network',
            'https://bundler-hc.sepolia.boba.network',
            '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
            28882,
            '0x' + '1' * 64
        )
        
        custom_owner = "0x" + "5" * 40
        
        # Test with custom owner (should match TypeScript behavior)
        result = await manager.create_smart_account(12345, custom_owner)
        
        # Verify the expected address was retrieved with custom owner
        mock_factory_contract.functions.getAddress.assert_called_with(
            custom_owner, 
            12345
        )
        
        # Verify the account creation transaction was prepared with custom owner
        mock_factory_contract.encodeABI.assert_called_with(
            fn_name="createAccount",
            args=[custom_owner, 12345]
        )
        
        assert result['address'] == "0x" + "3" * 40
    
    @pytest.mark.asyncio
    async def test_get_owner_functionality(self, mock_environment):
        """Test getOwner functionality matches TypeScript behavior"""
        mock_w3 = mock_environment['mock_w3']
        
        manager = UserOpManager(
            'https://sepolia.boba.network',
            'https://bundler-hc.sepolia.boba.network',
            '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
            28882,
            '0x' + '1' * 64
        )
        
        test_contract_address = "0x" + "6" * 40
        
        # Test getOwner (should match TypeScript getOwner)
        owner = await manager.get_owner(test_contract_address)
        
        # Verify the call was made with correct data (getOwner selector: 0x8da5cb5b)
        mock_w3.eth.call.assert_called_with({
            'to': test_contract_address,
            'data': '0x8da5cb5b'
        })
        
        assert owner == "0x" + "3" * 40
    
    def test_constants_match_typescript(self):
        """Test that constants match the TypeScript version"""
        # These should match the TypeScript UserOpManager constants
        expected_entrypoint_v7 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
        expected_factory_address = "0x9aC904d8DfeA0866aB341208700dCA9207834DeB"
        
        # Create a temporary instance to access constants
        with patch('hybrid_compute_sdk.userop_manager.Web3') as mock_web3_class, \
             patch('eth_account.Account.from_key'):
            
            mock_w3 = Mock()
            mock_w3.is_connected = True
            
            # Mock eth namespace
            mock_eth = Mock()
            mock_w3.eth = mock_eth
            
            mock_web3_class.return_value = mock_w3
            
            manager = UserOpManager(
                'https://sepolia.boba.network',
                'https://bundler-hc.sepolia.boba.network',
                '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
                28882,
                '0x' + '1' * 64
            )
            
            assert manager.entrypoint_v7 == expected_entrypoint_v7
            assert manager.factory_address == expected_factory_address
    
    def test_method_signatures_match_typescript(self):
        """Test that method signatures match the TypeScript version"""
        # Create a temporary instance to check method availability
        with patch('hybrid_compute_sdk.userop_manager.Web3') as mock_web3_class, \
             patch('eth_account.Account.from_key'):
            
            mock_w3 = Mock()
            mock_w3.is_connected = True
            
            # Mock eth namespace
            mock_eth = Mock()
            mock_w3.eth = mock_eth
            
            mock_web3_class.return_value = mock_w3
            
            manager = UserOpManager(
                'https://sepolia.boba.network',
                'https://bundler-hc.sepolia.boba.network',
                '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
                28882,
                '0x' + '1' * 64
            )
            
            # Verify all expected methods exist
            assert hasattr(manager, 'create_smart_account')
            assert hasattr(manager, 'get_expected_address')
            assert hasattr(manager, 'get_owner')
            assert hasattr(manager, 'selector')
            assert hasattr(manager, 'get_entrypoint')
            assert hasattr(manager, 'get_rpc')
            assert hasattr(manager, 'is_v7_entrypoint')
            
            # Verify method signatures (they should be async for the main operations)
            import inspect
            assert inspect.iscoroutinefunction(manager.create_smart_account)
            assert inspect.iscoroutinefunction(manager.get_expected_address)
            assert inspect.iscoroutinefunction(manager.get_owner)

if __name__ == "__main__":
    pytest.main([__file__])
