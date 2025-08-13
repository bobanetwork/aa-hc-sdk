import pytest
import os
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from web3 import Web3
from eth_account import Account
from hybrid_compute_sdk.userop_manager import UserOpManager, ACCOUNT_FACTORY_ABI

# Test constants
TEST_NODE_URL = "https://sepolia.boba.network"
TEST_BUNDLER_URL = "https://bundler-hc.sepolia.boba.network"
TEST_ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
TEST_CHAIN_ID = 28882  # Boba Sepolia
TEST_PRIVATE_KEY = "0x" + "1" * 64
TEST_ACCOUNT = Account.from_key(TEST_PRIVATE_KEY)
TEST_FACTORY_ADDRESS = "0x9aC904d8DfeA0866aB341208700dCA9207834DeB"
TEST_SALT = 12345
TEST_OWNER_ADDRESS = "0x" + "2" * 40

class TestUserOpManager:
    """Test suite for UserOpManager class"""
    
    @pytest.fixture
    def mock_w3(self):
        """Mock Web3 instance"""
        mock_w3 = Mock()
        mock_w3.is_connected = True
        
        # Mock eth namespace
        mock_eth = Mock()
        mock_eth.gas_price = 20000000000  # 20 gwei
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
        
        return mock_w3
    
    @pytest.fixture
    def mock_factory_contract(self):
        """Mock factory contract instance"""
        mock_contract = Mock()
        mock_contract.functions.getAddress.return_value.call.return_value = "0x" + "3" * 40
        mock_contract.encodeABI.return_value = "0x" + "4" * 100
        return mock_contract
    
    @pytest.fixture
    def userop_manager(self, mock_w3, mock_factory_contract):
        """Create UserOpManager instance with mocked dependencies"""
        with patch('hybrid_compute_sdk.userop_manager.Web3') as mock_web3_class, \
             patch('eth_account.Account.from_key') as mock_account:
            
            # Mock the Web3 constructor to return our mock instance
            mock_web3_class.return_value = mock_w3
            mock_account.return_value = TEST_ACCOUNT
            
            # Mock the contract creation
            mock_w3.eth.contract.return_value = mock_factory_contract
            
            manager = UserOpManager(
                TEST_NODE_URL,
                TEST_BUNDLER_URL,
                TEST_ENTRY_POINT,
                TEST_CHAIN_ID,
                TEST_PRIVATE_KEY
            )
            
            return manager
    
    def test_init(self, userop_manager):
        """Test UserOpManager initialization"""
        assert userop_manager.node_url == TEST_NODE_URL
        assert userop_manager.bundler_url == TEST_BUNDLER_URL
        assert userop_manager.entry_point == TEST_ENTRY_POINT
        assert userop_manager.chain_id == TEST_CHAIN_ID
        assert userop_manager.private_key == TEST_PRIVATE_KEY
        assert userop_manager.entrypoint_v7 == "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
        assert userop_manager.factory_address == TEST_FACTORY_ADDRESS
    
    def test_selector(self, userop_manager):
        """Test function selector generation"""
        # Test with a known function signature
        selector = userop_manager.selector("createAccount(address,uint256)")
        assert len(selector) == 10  # 0x + 8 hex chars
        assert selector.startswith("0x")
    
    def test_get_entrypoint(self, userop_manager):
        """Test getting entry point address"""
        assert userop_manager.get_entrypoint() == TEST_ENTRY_POINT
    
    def test_get_rpc(self, userop_manager):
        """Test getting RPC URL"""
        assert userop_manager.get_rpc() == TEST_NODE_URL
    
    def test_is_v7_entrypoint(self, userop_manager):
        """Test v0.7 entry point detection"""
        # Test with v0.7 entry point
        assert userop_manager.is_v7_entrypoint() is True
        
        # Test with non-v0.7 entry point
        userop_manager.entry_point = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
        assert userop_manager.is_v7_entrypoint() is False
    
    @pytest.mark.asyncio
    async def test_get_expected_address_default_owner(self, userop_manager, mock_factory_contract):
        """Test getting expected address with default owner (from private key)"""
        expected_address = await userop_manager.get_expected_address(TEST_SALT)
        
        # Verify the contract was called with correct parameters
        mock_factory_contract.functions.getAddress.assert_called_once_with(
            TEST_ACCOUNT.address, 
            TEST_SALT
        )
        assert expected_address == "0x" + "3" * 40
    
    @pytest.mark.asyncio
    async def test_get_expected_address_custom_owner(self, userop_manager, mock_factory_contract):
        """Test getting expected address with custom owner address"""
        expected_address = await userop_manager.get_expected_address(TEST_SALT, TEST_OWNER_ADDRESS)
        
        # Verify the contract was called with custom owner
        mock_factory_contract.functions.getAddress.assert_called_once_with(
            TEST_OWNER_ADDRESS, 
            TEST_SALT
        )
        assert expected_address == "0x" + "3" * 40
    
    @pytest.mark.asyncio
    async def test_create_smart_account_default_owner(self, userop_manager, mock_w3, mock_factory_contract):
        """Test creating smart account with default owner"""
        result = await userop_manager.create_smart_account(TEST_SALT)
        
        # Verify the expected address was retrieved
        mock_factory_contract.functions.getAddress.assert_called_once_with(
            TEST_ACCOUNT.address, 
            TEST_SALT
        )
        
        # Verify the account creation transaction was prepared
        mock_factory_contract.encodeABI.assert_called_once_with(
            fn_name="createAccount",
            args=[TEST_ACCOUNT.address, TEST_SALT]
        )
        
        # Verify gas estimation
        mock_w3.eth.estimate_gas.assert_called_once()
        
        # Verify transaction was sent
        mock_w3.eth.send_raw_transaction.assert_called()
        
        # Verify result structure
        assert 'address' in result
        assert 'receipt' in result
        assert result['address'] == "0x" + "3" * 40
    
    @pytest.mark.asyncio
    async def test_create_smart_account_custom_owner(self, userop_manager, mock_w3, mock_factory_contract):
        """Test creating smart account with custom owner"""
        result = await userop_manager.create_smart_account(TEST_SALT, TEST_OWNER_ADDRESS)
        
        # Verify the expected address was retrieved with custom owner
        mock_factory_contract.functions.getAddress.assert_called_once_with(
            TEST_OWNER_ADDRESS, 
            TEST_SALT
        )
        
        # Verify the account creation transaction was prepared with custom owner
        mock_factory_contract.encodeABI.assert_called_once_with(
            fn_name="createAccount",
            args=[TEST_OWNER_ADDRESS, TEST_SALT]
        )
        
        # Verify result structure
        assert 'address' in result
        assert 'receipt' in result
    
    @pytest.mark.asyncio
    async def test_create_smart_account_funding_success(self, userop_manager, mock_w3, mock_factory_contract):
        """Test successful funding of new smart account"""
        # Mock successful funding transaction
        mock_w3.eth.get_transaction_count.return_value = 1  # Different nonce for funding
        
        result = await userop_manager.create_smart_account(TEST_SALT)
        
        # Verify funding transaction was sent
        assert mock_w3.eth.send_raw_transaction.call_count >= 2  # Creation + funding
        
        # Verify result structure
        assert 'address' in result
        assert 'receipt' in result
    
    @pytest.mark.asyncio
    async def test_create_smart_account_funding_retry(self, userop_manager, mock_w3, mock_factory_contract):
        """Test funding retry on nonce too low error"""
        # Mock first funding attempt to fail with nonce too low
        mock_w3.eth.send_raw_transaction.side_effect = [
            b'\x01' * 32,  # First call (account creation) succeeds
            Exception("nonce too low"),  # Second call (funding) fails
            b'\x02' * 32   # Third call (funding retry) succeeds
        ]
        
        result = await userop_manager.create_smart_account(TEST_SALT)
        
        # Verify funding was retried
        assert mock_w3.eth.send_raw_transaction.call_count >= 3
        
        # Verify result structure
        assert 'address' in result
        assert 'receipt' in result
    
    @pytest.mark.asyncio
    async def test_create_smart_account_funding_failure(self, userop_manager, mock_w3, mock_factory_contract):
        """Test handling of funding failure (non-nonce error)"""
        # Mock first funding attempt to fail with non-nonce error
        mock_w3.eth.send_raw_transaction.side_effect = [
            b'\x01' * 32,  # First call (account creation) succeeds
            Exception("insufficient funds")  # Second call (funding) fails with different error
        ]
        
        # Should raise the non-nonce error
        with pytest.raises(Exception, match="insufficient funds"):
            await userop_manager.create_smart_account(TEST_SALT)
    
    @pytest.mark.asyncio
    async def test_get_owner(self, userop_manager, mock_w3):
        """Test getting owner of smart account contract"""
        test_contract_address = "0x" + "5" * 40
        mock_owner_address = "0x" + "6" * 40
        
        # Mock the eth_call response
        mock_w3.eth.call.return_value = mock_owner_address.encode()
        
        # Mock the codec decode
        mock_w3.codec.decode_single.return_value = mock_owner_address
        
        owner = await userop_manager.get_owner(test_contract_address)
        
        # Verify the call was made with correct data (getOwner selector)
        mock_w3.eth.call.assert_called_once_with({
            'to': test_contract_address,
            'data': '0x8da5cb5b'
        })
        
        assert owner == mock_owner_address
    
    def test_account_factory_abi_structure(self):
        """Test that the ABI structure matches the TypeScript version"""
        # Verify createAccount function
        create_account_func = next(f for f in ACCOUNT_FACTORY_ABI if f['name'] == 'createAccount')
        assert create_account_func['inputs'] == [
            {"internalType": "address", "name": "owner", "type": "address"},
            {"internalType": "uint256", "name": "salt", "type": "uint256"}
        ]
        assert create_account_func['outputs'] == [
            {"internalType": "contract SimpleAccount", "name": "ret", "type": "address"}
        ]
        
        # Verify getAddress function
        get_address_func = next(f for f in ACCOUNT_FACTORY_ABI if f['name'] == 'getAddress')
        assert get_address_func['inputs'] == [
            {"internalType": "address", "name": "owner", "type": "address"},
            {"internalType": "uint256", "name": "salt", "type": "uint256"}
        ]
        assert get_address_func['outputs'] == [
            {"internalType": "address", "name": "", "type": "address"}
        ]
    
    def test_connection_failure_handling(self):
        """Test handling of connection failure during initialization"""
        with patch('hybrid_compute_sdk.userop_manager.Web3') as mock_web3_class:
            
            mock_w3 = Mock()
            mock_w3.is_connected = False
            mock_web3_class.return_value = mock_w3
            
            with pytest.raises(ConnectionError, match="Failed to connect to node"):
                UserOpManager(
                    TEST_NODE_URL,
                    TEST_BUNDLER_URL,
                    TEST_ENTRY_POINT,
                    TEST_CHAIN_ID,
                    TEST_PRIVATE_KEY
                )

if __name__ == "__main__":
    pytest.main([__file__])
