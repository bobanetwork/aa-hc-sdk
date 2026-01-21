import pytest
from hybrid_compute_sdk import CONTRACT_CONFIG
import re


class TestContractConfiguration:
    def test_has_boba_sepolia_configuration(self):
        assert 'boba_sepolia' in CONTRACT_CONFIG
    
    def test_has_boba_mainnet_configuration(self):
        assert 'boba_mainnet' in CONTRACT_CONFIG
    
    def test_has_simple_account_factory_for_boba_sepolia(self):
        assert 'simpleAccountFactory' in CONTRACT_CONFIG['boba_sepolia']
    
    def test_has_hybrid_account_factory_for_boba_sepolia(self):
        assert 'hybridAccountFactory' in CONTRACT_CONFIG['boba_sepolia']
    
    def test_has_simple_account_factory_for_boba_mainnet(self):
        assert 'simpleAccountFactory' in CONTRACT_CONFIG['boba_mainnet']
    
    def test_has_hybrid_account_factory_for_boba_mainnet(self):
        assert 'hybridAccountFactory' in CONTRACT_CONFIG['boba_mainnet']
    
    def test_valid_ethereum_address_format_boba_sepolia_simple(self):
        address = CONTRACT_CONFIG['boba_sepolia']['simpleAccountFactory']
        assert re.match(r'^0x[0-9a-fA-F]{40}$', address)
    
    def test_valid_ethereum_address_format_boba_sepolia_hybrid(self):
        address = CONTRACT_CONFIG['boba_sepolia']['hybridAccountFactory']
        assert re.match(r'^0x[0-9a-fA-F]{40}$', address)
    
    def test_valid_ethereum_address_format_boba_mainnet_simple(self):
        address = CONTRACT_CONFIG['boba_mainnet']['simpleAccountFactory']
        assert re.match(r'^0x[0-9a-fA-F]{40}$', address)
    
    def test_valid_ethereum_address_format_boba_mainnet_hybrid(self):
        address = CONTRACT_CONFIG['boba_mainnet']['hybridAccountFactory']
        assert re.match(r'^0x[0-9a-fA-F]{40}$', address)
    
    def test_correct_simple_account_factory_for_boba_sepolia(self):
        assert CONTRACT_CONFIG['boba_sepolia']['simpleAccountFactory'] == '0x9aC904d8DfeA0866aB341208700dCA9207834DeB'
    
    def test_correct_hybrid_account_factory_for_boba_sepolia(self):
        assert CONTRACT_CONFIG['boba_sepolia']['hybridAccountFactory'] == '0xFe90bCD7e5E3F88383A216B050ce4E513A8178Ae'
    
    def test_correct_simple_account_factory_for_boba_mainnet(self):
        assert CONTRACT_CONFIG['boba_mainnet']['simpleAccountFactory'] == '0x584960A850D74400280c436a07BE738C1c96195B'
    
    def test_correct_hybrid_account_factory_for_boba_mainnet(self):
        assert CONTRACT_CONFIG['boba_mainnet']['hybridAccountFactory'] == '0xFe90bCD7e5E3F88383A216B050ce4E513A8178Ae'
    
    def test_different_simple_account_factory_addresses_mainnet_sepolia(self):
        sepolia_address = CONTRACT_CONFIG['boba_sepolia']['simpleAccountFactory']
        mainnet_address = CONTRACT_CONFIG['boba_mainnet']['simpleAccountFactory']
        assert sepolia_address != mainnet_address
    
    def test_same_hybrid_account_factory_address_mainnet_sepolia(self):
        sepolia_address = CONTRACT_CONFIG['boba_sepolia']['hybridAccountFactory']
        mainnet_address = CONTRACT_CONFIG['boba_mainnet']['hybridAccountFactory']
        assert sepolia_address == mainnet_address
    
    def test_exactly_two_network_configurations(self):
        networks = list(CONTRACT_CONFIG.keys())
        assert len(networks) == 2
    
    def test_boba_sepolia_is_a_key(self):
        assert 'boba_sepolia' in CONTRACT_CONFIG
    
    def test_boba_mainnet_is_a_key(self):
        assert 'boba_mainnet' in CONTRACT_CONFIG
    
    def test_both_factory_types_for_each_network(self):
        for network in CONTRACT_CONFIG.values():
            assert 'simpleAccountFactory' in network
            assert 'hybridAccountFactory' in network
    
    def test_non_empty_factory_addresses(self):
        for network in CONTRACT_CONFIG.values():
            assert len(network['simpleAccountFactory']) > 0
            assert len(network['hybridAccountFactory']) > 0
