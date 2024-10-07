from aiohttp import web

class JsonRpcServerInstance:
    def __init__(self):
        self.app = web.Application()
        self.app.router.add_post("/hc", self.handle)
        self.runner = None
        self.site = None
        self.methods = {}

    def add_server_action(self, name, action):
        self.methods[name] = action
        return self

    async def handle(self, request):
        request_data = await request.json()
        method = request_data.get('method')
        params = request_data.get('params')
        if method in self.methods:
            result = await self.methods[method](params)
            return web.json_response({"jsonrpc": "2.0", "result": result, "id": request_data.get('id')})
        else:
            return web.json_response({"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method not found"}, "id": request_data.get('id')}, status=400)

    async def listen_at(self, port):
        self.runner = web.AppRunner(self.app)
        await self.runner.setup()
        self.site = web.TCPSite(self.runner, 'localhost', port)
        await self.site.start()
        print(f"Server started at http://localhost:{port}")

    async def stop(self):
        if self.site:
            await self.site.stop()
        if self.runner:
            await self.runner.cleanup()

class HybridComputeSDK:
    def __init__(self):
        self.server_instance = None

    def create_json_rpc_server_instance(self):
        self.server_instance = JsonRpcServerInstance()
        return self

    def add_server_action(self, selector_name, action):
        if self.server_instance:
            self.server_instance.add_server_action(selector_name, action)
        return self

    async def listen_at(self, port):
        if self.server_instance:
            await self.server_instance.listen_at(port)
        return self

    def is_server_healthy(self):
        return self.server_instance is not None and self.server_instance.site is not None

    def get_app(self):
        return self.server_instance.app if self.server_instance else None

    def get_server(self):
        return self.server_instance