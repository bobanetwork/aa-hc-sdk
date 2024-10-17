import pytest
from aiohttp import ClientSession
from server import HybridComputeSDK

@pytest.fixture(scope="function")
def sdk():
    return HybridComputeSDK()

@pytest.fixture(scope="function")
def server(sdk):
    server = sdk.create_json_rpc_server_instance()

    async def mock_method(params):
        return f"Received: {params}"

    server.add_server_action("test_method", mock_method)
    return server

@pytest.mark.asyncio
async def test_server_creation(sdk):
    assert sdk.is_server_healthy() == False
    sdk.create_json_rpc_server_instance()
    assert sdk.is_server_healthy() == False  # Server is not listening yet

@pytest.mark.asyncio
async def test_add_server_action(server):
    assert "test_method" in server.server_instance.methods

@pytest.mark.asyncio
async def test_server_listening(server):
    port = 8080

    await server.listen_at(port)
    assert server.is_server_healthy() == True

    async with ClientSession() as session:
        async with session.post(f'http://localhost:{port}/hc',
                                json={"jsonrpc": "2.0", "method": "test_method", "params": ["test"], "id": 1}) as response:
            assert response.status == 200
            json_response = await response.json()
            assert json_response["result"] == "Received: ['test']"

    await server.server_instance.stop()

@pytest.mark.asyncio
async def test_nonexistent_method(server):
    port = 8081

    await server.listen_at(port)
    assert server.is_server_healthy() == True

    async with ClientSession() as session:
        async with session.post(f'http://localhost:{port}/hc',
                                json={"jsonrpc": "2.0", "method": "nonexistent_method", "params": ["test"], "id": 1}) as response:
            assert response.status == 400
            json_response = await response.json()
            assert json_response["error"]["message"] == "Method not found"

    await server.server_instance.stop()