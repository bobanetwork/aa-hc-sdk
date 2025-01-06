import pytest
import sys
import os
import socket
from web3 import Web3
from unittest.mock import Mock, patch, MagicMock
from jsonrpclib.SimpleJSONRPCServer import SimpleJSONRPCServer

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hybrid_compute_sdk.server import HybridComputeSDK

@pytest.fixture
def valid_env_vars():
    return {
        'ENTRY_POINTS': '0x' + '1' * 40,
        'CHAIN_ID': '1',
        'HC_HELPER_ADDR': '0x' + '2' * 40,
        'OC_HYBRID_ACCOUNT': '0x' + '3' * 40,
        'OC_OWNER': '0x' + '4' * 40,
        'OC_PRIVKEY': '0x' + '5' * 64,
    }

@pytest.fixture
def mock_server():
    mock_server = MagicMock(spec=SimpleJSONRPCServer)
    mock_server.serve_forever = Mock()
    mock_server.handle_request = Mock()
    mock_server.shutdown = Mock()
    mock_server.server_close = Mock()
    mock_server.register_function = Mock()
    mock_server.server_address = ('127.0.0.1', 1234)
    mock_server.funcs = {}

    def mock_server_constructor(*args, **kwargs):
        return mock_server

    with patch('jsonrpclib.SimpleJSONRPCServer.SimpleJSONRPCServer',
               side_effect=mock_server_constructor) as mock:
        mock.return_value = mock_server
        yield mock_server

@pytest.fixture
def sdk_instance(valid_env_vars, mock_server):
    with patch.dict(os.environ, valid_env_vars):
        sdk = HybridComputeSDK()
        yield sdk

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port

class TestHybridComputeSDK:
    def test_init_with_valid_env_vars(self, valid_env_vars):
        with patch.dict(os.environ, valid_env_vars):
            sdk = HybridComputeSDK()
            assert sdk.EP_ADDR == valid_env_vars['ENTRY_POINTS']
            assert sdk.HC_CHAIN == int(valid_env_vars['CHAIN_ID'])
            assert sdk.HH_ADDR == valid_env_vars['HC_HELPER_ADDR']
            assert sdk.HA_ADDR == valid_env_vars['OC_HYBRID_ACCOUNT']
            assert sdk.HA_OWNER == valid_env_vars['OC_OWNER']
            assert sdk.hc1_key == valid_env_vars['OC_PRIVKEY']

    def test_init_missing_env_vars(self):
        with pytest.raises(EnvironmentError) as exc_info:
            HybridComputeSDK()
        assert "Missing required environment variable" in str(exc_info.value)

    def test_init_invalid_chain_id(self, valid_env_vars):
        invalid_env = valid_env_vars.copy()
        invalid_env['CHAIN_ID'] = '0'
        with patch.dict(os.environ, invalid_env):
            with pytest.raises(ValueError) as exc_info:
                HybridComputeSDK()
            assert "CHAIN_ID must not be 0" in str(exc_info.value)

    def test_init_invalid_address_length(self, valid_env_vars):
        invalid_env = valid_env_vars.copy()
        invalid_env['HC_HELPER_ADDR'] = '0x123'  # Too short
        with patch.dict(os.environ, invalid_env):
            with pytest.raises(ValueError) as exc_info:
                HybridComputeSDK()
            assert "HC_HELPER_ADDR must be 42 characters long" in str(exc_info.value)

    def test_server_creation(self, sdk_instance, mock_server):
        port = get_free_port()
        sdk_instance.create_json_rpc_server_instance(port=port)
        assert sdk_instance.server.server_address[1] == port

    def test_selector(self, sdk_instance):
        selector = sdk_instance.selector("test_function")
        assert len(selector) == 8
        assert all(c in "0123456789abcdef" for c in selector)

    def test_selector_hex(self, sdk_instance):
        selector_hex = sdk_instance.selector_hex("test_function")
        assert isinstance(selector_hex, bytes)
        assert len(selector_hex) == 4

    def test_parse_req(self, sdk_instance):
        test_data = {
            'sk': '0x' + '1' * 64,
            'src_addr': '0x' + '2' * 40,
            'src_nonce': '0x1',
            'oo_nonce': '0x2',
            'payload': '0x' + '3' * 64
        }

        req = sdk_instance.parse_req(
            test_data['sk'],
            test_data['src_addr'],
            test_data['src_nonce'],
            test_data['oo_nonce'],
            test_data['payload']
        )

        assert isinstance(req['skey'], bytes)
        assert Web3.is_checksum_address(req['srcAddr'])
        assert isinstance(req['srcNonce'], int)
        assert isinstance(req['opNonce'], int)
        assert isinstance(req['reqBytes'], bytes)

    def test_gen_response(self, sdk_instance):
        test_req = {
            'skey': Web3.to_bytes(hexstr='0x' + '1' * 64),
            'srcAddr': Web3.to_checksum_address('0x' + '2' * 40),
            'srcNonce': 1,
            'opNonce': 2,
            'reqBytes': Web3.to_bytes(hexstr='0x' + '3' * 64)
        }

        response = sdk_instance.gen_response(
            test_req,
            0,  # err_code
            Web3.to_bytes(hexstr='0x' + '4' * 64)  # resp_payload
        )

        assert isinstance(response, dict)
        assert 'success' in response
        assert 'response' in response
        assert 'signature' in response
        assert isinstance(response['success'], bool)
        assert response['response'].startswith('0x')
        assert response['signature'].startswith('0x')

    def test_server_health_check(self, sdk_instance, mock_server):
        assert not sdk_instance.is_server_healthy()  # Server not created yet
        port = get_free_port()
        sdk_instance.create_json_rpc_server_instance(port=port)
        assert sdk_instance.is_server_healthy()

    def test_get_server(self, sdk_instance, mock_server):
        assert sdk_instance.get_server() is None
        port = get_free_port()
        sdk_instance.create_json_rpc_server_instance(port=port)
        assert sdk_instance.get_server() is not None

    def test_gen_response_v7_match(self, sdk_instance):
        # Set up the same environment variables as TypeScript test
        os.environ['HC_HELPER_ADDR'] = '0x11c4DbbaC4A0A47a7c76b5603bc219c5dAe752D6'
        os.environ['OC_HYBRID_ACCOUNT'] = '0x77fbd8f873e9361241161de136ad47883722b971'
        os.environ['CHAIN_ID'] = '28882'
        os.environ['OC_PRIVKEY'] = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
        os.environ['ENTRY_POINTS'] = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

        # Create test request matching TypeScript test
        test_req = {
            'srcAddr': "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
            'reqBytes': Web3.to_bytes(hexstr="0x1234567890abcdef"),
            'srcNonce': 123456,
            'skey': bytes([
                0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
                0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
                0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
                0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20
            ]),
            'opNonce': 789012
        }

        # Convert "payload" to hex bytes like in TypeScript test
        payload = Web3.to_bytes(text="payload")

        # Call gen_response with same parameters
        response = sdk_instance.gen_response(test_req, 0, payload)

        # Match the TypeScript test expectations exactly
        assert response['success'] == True
        assert response['signature'] == "0x9c87d771f6f93673e01509641b37c17234aada309781fd514a212fe2d299d1b8358c0ab63513f51512cfe3f9d0b68b11ce8c984677bf292c8d7aa0e3606937731c"
        assert response['response'] == "0x7061796c6f6164"

if __name__ == '__main__':
    pytest.main(['-v'])