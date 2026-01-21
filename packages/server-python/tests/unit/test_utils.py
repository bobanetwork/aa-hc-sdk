import pytest
import os
from dotenv import load_dotenv
from hybrid_compute_sdk import UserOpManager

load_dotenv()

PRIVATE_KEY = os.getenv('CLIENT_PRIVATE_KEY') or os.getenv('OC_PRIVKEY')


class TestSelectorFunction:
    def setup_method(self):
        self.manager = UserOpManager(
            node_url="https://sepolia.boba.network",
            bundler_url="https://bundler-hc.sepolia.boba.network/rpc",
            entry_point="0x0000000071727De22E5E9d8BAf0edAc6f37da032",
            chain_id=28882,
            private_key=PRIVATE_KEY,
        )
    
    def test_generate_correct_selector_for_simple_function(self):
        result = self.manager.selector("transfer(address,uint256)")
        assert result == "0xa9059cbb"
        assert len(result) == 10
    
    def test_generate_correct_selector_for_execute_function(self):
        result = self.manager.selector("execute(address,uint256,bytes)")
        assert result == "0xb61d27f6"
    
    def test_generate_correct_selector_for_put_response(self):
        result = self.manager.selector("PutResponse(bytes32,bytes)")
        assert result == "0xdfc98ae8"
    
    def test_generate_correct_selector_for_get_nonce(self):
        result = self.manager.selector("getNonce(address,uint192)")
        assert result.startswith("0x")
        assert len(result) == 10
    
    def test_handle_function_with_no_parameters(self):
        result = self.manager.selector("test()")
        assert result.startswith("0x")
        assert len(result) == 10
    
    def test_deterministic_for_same_input(self):
        result1 = self.manager.selector("myFunction(string)")
        result2 = self.manager.selector("myFunction(string)")
        assert result1 == result2
    
    def test_different_selectors_for_different_functions(self):
        result1 = self.manager.selector("functionA(uint256)")
        result2 = self.manager.selector("functionB(uint256)")
        assert result1 != result2
