import pytest
import sys
import os
from unittest.mock import Mock, patch

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hybrid_compute_sdk.server import HybridComputeSDK

def test_add_server_action():
    # Mock the environment variables
    with patch.dict('os.environ', {
        'ENTRY_POINTS': '0x' + '1' * 40,
        'CHAIN_ID': '1',
        'HC_HELPER_ADDR': '0x' + '2' * 40,
        'OC_HYBRID_ACCOUNT': '0x' + '3' * 40,
        'OC_OWNER': '0x' + '4' * 40,
        'OC_PRIVKEY': '0x' + '5' * 64,
    }):
        sdk = HybridComputeSDK()
        sdk.create_json_rpc_server_instance()

        # Mock the server's register_function method
        sdk.server.register_function = Mock()

        # Define a dummy action
        def dummy_action():
            pass

        # Call add_server_action
        sdk.add_server_action("test_action", dummy_action)

        # Check if register_function was called with correct arguments
        sdk.server.register_function.assert_called_once_with(
            dummy_action,
            sdk.selector("test_action")
        )