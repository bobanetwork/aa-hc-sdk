#!/usr/bin/env python3
"""
Example script demonstrating the UserOpManager functionality.
This mirrors the TypeScript UserOpManager usage patterns.
"""

import asyncio
import os
from hybrid_compute_sdk.userop_manager import UserOpManager

async def main():
    """Main function demonstrating UserOpManager usage"""
    
    print("=== UserOpManager Example ===")
    print("This example uses environment variables for configuration:")
    print("- RPC_URL: Boba Sepolia RPC endpoint")
    print("- BUNDLER_RPC: Boba Sepolia bundler endpoint") 
    print("- ENTRY_POINTS: Entry point contract address")
    print("- CHAIN_ID: Blockchain chain ID (28882 for Boba Sepolia)")
    print("- OC_PRIVKEY or CLIENT_PRIVATE_KEY: Your private key")
    print()
    
    try:
        # Initialize UserOpManager with environment variables
        # You can also override any parameter if needed:
        userop_manager = UserOpManager(
            # node_url="https://sepolia.boba.network",  # Optional override
            # bundler_url="https://bundler-hc.sepolia.boba.network",  # Optional override
            # entry_point="0x0000000071727De22E5E9d8BAf0edAc6f37da032",  # Optional override
            # chain_id=28882,  # Optional override
            # private_key="0x...",  # Optional override
        )
        
        print("Configuration:")
        print(f"Node URL: {userop_manager.get_rpc()}")
        print(f"Bundler URL: {userop_manager.bundler_url}")
        print(f"Entry Point: {userop_manager.get_entrypoint()}")
        print(f"Chain ID: {userop_manager.chain_id}")
        print(f"Account Address: {userop_manager.account.address}")
        print()
        
        # Check if this is a v0.7 entry point
        is_v7 = userop_manager.is_v7_entrypoint()
        print(f"Is v0.7 Entry Point: {is_v7}")
        print(f"Factory Address: {userop_manager.factory_address}")
        print()
        
        # Example 1: Get expected address for a smart account
        print("=== Example 1: Get Expected Address ===")
        salt = 12345
        expected_address = await userop_manager.get_expected_address(salt)
        print(f"Expected address for salt {salt}: {expected_address}")
        print()
        
        # Example 2: Get expected address with custom owner
        print("=== Example 2: Get Expected Address with Custom Owner ===")
        custom_owner = "0x" + "5" * 40  # Example custom owner address
        expected_address_custom = await userop_manager.get_expected_address(salt, custom_owner)
        print(f"Expected address for salt {salt} with custom owner {custom_owner}: {expected_address_custom}")
        print()
        
        # Example 3: Create smart account (commented out to avoid actual transactions)
        print("=== Example 3: Create Smart Account (Simulated) ===")
        print("Note: This would create an actual smart account on the blockchain.")
        print("Uncomment the code below to run this example.")
        print()
        
        # Uncomment the following lines to actually create a smart account:
        # try:
        #     print("Creating smart account...")
        #     result = await userop_manager.create_smart_account(salt)
        #     print(f"Smart account created successfully!")
        #     print(f"Address: {result['address']}")
        #     print(f"Transaction Hash: {result['receipt']['transactionHash'].hex()}")
        #     print()
        #     
        #     # Example 4: Get owner of the created account
        #     print("=== Example 4: Get Account Owner ===")
        #     owner = await userop_manager.get_owner(result['address'])
        #     print(f"Owner of {result['address']}: {owner}")
        #     print()
        #     
        # except Exception as e:
        #     print(f"Error creating smart account: {e}")
        #     print("This is expected if running without proper blockchain access.")
        
        # Example 5: Function selector generation
        print("=== Example 5: Function Selector Generation ===")
        function_signature = "createAccount(address,uint256)"
        selector = userop_manager.selector(function_signature)
        print(f"Function: {function_signature}")
        print(f"Selector: {selector}")
        print()
        
        print("=== Example Complete ===")
        print("All UserOpManager functionality demonstrated successfully!")
        print()
        print("To create actual smart accounts, ensure you have:")
        print("1. A .env file with your private key (OC_PRIVKEY or CLIENT_PRIVATE_KEY)")
        print("2. Sufficient ETH balance on Boba Sepolia")
        print("3. Uncomment the smart account creation code above")
        
    except Exception as e:
        print(f"Error: {e}")
        print()
        print("Make sure you have:")
        print("1. A .env file with your private key")
        print("2. Proper blockchain access to Boba Sepolia")
        print("3. All required environment variables set")

if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())
