import { UserOpManager } from "../src/userop";

describe('Custom User Operation SDK Tests', () => {
    const RPC = "https://boba-sepolia.gateway.tenderly.co"
    const BUNDLER = "https://bundler-hc.sepolia.boba.network/rpc"
    const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
    const CHAIN_ID = 28882

    const userOperationManager = new UserOpManager(
        RPC, 
        BUNDLER, 
        ENTRY_POINT,
        CHAIN_ID
    );

    it('should return correct entrypoint address', async () => {
        const result = userOperationManager.getEntrypoint();
        expect(result).toBe(ENTRY_POINT);
    });

    it('should return correct RPC URL', async () => {
        const result = userOperationManager.getRpc();
        expect(result).toBe(RPC);
    });

    it('should correctly identify V7 entrypoint', async () => {
        const result = userOperationManager.isV7Entrypoint();
        expect(result).toBe(true);
    });

    it('should generate correct function selector', async () => {
        const signature = 'execute(address,uint256,bytes)';
        const result = userOperationManager.selector(signature);
        console.log('Function selector for', signature, ':', result);
        
        expect(result).toMatch(/^0x[0-9a-fA-F]{8}$/);
        expect(result.length).toBe(10);
    });
});