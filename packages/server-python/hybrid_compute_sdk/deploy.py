import argparse
import base64
import json
import os
import re
import subprocess
import socket
import time
from web3 import Web3
from eth_abi import abi as ethabi

from hybrid_compute_sdk.aa_utils import AAUtils, selector

ETH_MIN = 50
BOBA_MIN = 500

class Deploy:
    """ Hepers to deploy a local HybridCompute system on top of a Boba local devnet"""
    def __init__(self, contracts_path):
        self.env_vars = {}
        self.boba_token = None
        self.entry_point = None
        self.contracts_path = contracts_path

        # Get the local IP (not localhost) of this machine
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("192.0.2.0", 1))
        self.local_ip = s.getsockname()[0]
        s.close()

        self.load_config()

        self.l1 = Web3(Web3.HTTPProvider(self.l1_url))
        assert self.l1.is_connected
        #self.l1.middleware_onion.inject(geth_poa_middleware, layer=0)

        # Special case, we want some functions from AAUtils but this script
        # runs before the Bundler is launched.
        self.aa = AAUtils(node_url=self.eth_url, bundler_url="deployer")

        self.w3 = Web3(Web3.HTTPProvider(self.eth_url))
        assert self.w3.is_connected

        self.l1_util = EthUtils(self.l1)
        self.l2_util = EthUtils(self.w3)

        self.contract_info = {}
        self.deployed = {}

    def load_config(self):
        """Process the CLI args, env variables, and Devnet config"""
        parser = argparse.ArgumentParser()
        parser.add_argument("--boba-path", required=True,
            help="Path to your local Boba/Optimism repository")
        parser.add_argument("--rundler-path", required=True,
            help="Path to your local rundler-hc repository")
        parser.add_argument("--deploy-salt", required=False,
            help="Salt value for contract deployment", default="0")
        parser.add_argument("--kms-port", required=False,
            help="Optional KMS server port (on localhost)", default=0)

        self.cli_args = parser.parse_args()

        # local.env contains fixed configuration for the local devnet. Additional env variables are
        # generated dynamically when contracts are self.deployed. Do not use any of the
        # local addr/privkey accounts on public networks.
        print("Reading local.env")
        with open("local.env", "r", encoding="ascii") as f:
            for line in f.readlines():
                if line.startswith('#'):
                    continue
                if self.cli_args.kms_port:
                    # Override the hardcoded keys
                    if line.startswith("SIGNER_PRIVATE_KEY") or line.startswith("BUNDLER_ADDR"):
                        continue
                k,v = line.strip().split('=')
                self.env_vars[k] = v

        self.deploy_addr = self.env_vars['DEPLOY_ADDR']
        self.deploy_key = self.env_vars['DEPLOY_PRIVKEY']
        if self.cli_args.kms_port:
            print("Generating local KMS keys")
            k1, a1 = self.make_kms_key()
            k2, a2 = self.make_kms_key()
            self.env_vars['BUNDLER_ADDR_LIST'] = a1 + "," + a2
            self.env_vars['SIGNER_AWS_KMS_KEY_IDS'] = k1 + "," + k2

        #For old devnet
        #with open(cli_args.boba_path + "/.devnet/addresses.json", "r", encoding="ascii") as f:
        #    jj = json.load(f)
        #    boba_l1_addr = Web3.to_checksum_address(jj['BOBA'])
        #    bridge_addr  = Web3.to_checksum_address(jj['L1StandardBridgeProxy'])
        #    portal_addr  = Web3.to_checksum_address(jj['OptimismPortalProxy'])
        with open(self.cli_args.boba_path + "/kurtosis-devnet/tests/boba-local-devnet.json",
            "r", encoding="ascii") as f:
            jj = json.load(f)
            #l1 = jj['l1']['addresses']
            l1a = jj['l2'][0]['l1_addresses']

            self.boba_l1_addr = self.env_vars['BOBA_L1']
            self.bridge_addr  = Web3.to_checksum_address(l1a['L1StandardBridgeProxy'])
            self.portal_addr  = Web3.to_checksum_address(l1a['OptimismPortalProxy'])

            l1_rpc_port = jj['l1']['nodes'][0]['services']['el']['endpoints']['rpc']['port']
            l2_rpc_port = jj['l2'][0]['nodes'][0]['services']['el']['endpoints']['rpc']['port']
            self.chain_id = jj['l2'][0]['id']
            print("l1_rpc_port", l1_rpc_port)
            print("l2_rpc_port", l2_rpc_port)

        local_url_prefix = "http://" + str(self.local_ip) + ":"
        self.l1_url = local_url_prefix + str(l1_rpc_port)
        self.eth_url = local_url_prefix + str(l2_rpc_port)

        with open(self.cli_args.boba_path + "/op-service/predeploys/addresses.go",
            "r", encoding="ascii") as f:
            for line in f.readlines():
                if re.search("BobaL2 = ", line):
                    self.boba_token = Web3.to_checksum_address(line.split('"')[1])
        print("Loaded devnet config:")
        print("  BOBA L1", self.boba_l1_addr)
        print("  Bridge", self.bridge_addr)
        print("  BOBA L2", self.boba_token)

    def make_kms_key(self):
        """Generate a key on the local KMS server and find its address"""
        # Expects to find "aws" cli in $PATH
        args = ["aws", "--endpoint", "http://127.0.0.1:4566", "kms", "create-key",
            "--key-usage", "SIGN_VERIFY", "--key-spec", "ECC_SECG_P256K1"]
        sys_env = os.environ.copy()

        out = subprocess.run(args, cwd=".", env=sys_env,
            capture_output=True, check=True)
        assert out.returncode == 0
        jstr = out.stdout.decode('ascii')
        key_json = json.loads(jstr)

        key_id = key_json['KeyMetadata']['KeyId']

        args = ["aws", "--endpoint", "http://127.0.0.1:4566", "kms", "get-public-key",
             "--key-id", key_id]
        out = subprocess.run(args, cwd=".", env=sys_env,
            capture_output=True, check=True)
        assert out.returncode == 0
        jstr = out.stdout.decode('ascii')
        key_json = json.loads(jstr)

        key_pub = key_json['PublicKey']
        key_asn = base64.b64decode(key_pub)

        # Assume fixed offsets rather than parsing ASN.1
        assert len(key_asn) == 88
        key_bytes = key_asn[24:]
        addr_bytes = Web3.keccak(key_bytes)[12:]

        key_addr = Web3.to_checksum_address(Web3.to_hex(addr_bytes))
        print("    ", key_id, key_addr)
        return key_id, key_addr

    def load_contract(self, name, address, path=None):
        """Loads a contract's JSON ABI"""
        if not path:
            path = f"{self.contracts_path}/out/{name}.sol/{name}.json"

        with open(path, "r", encoding="ascii") as f:
            j = json.loads(f.read())

        self.contract_info[name] = {}

        self.contract_info[name]['abi'] = j['abi']

        self.deployed[name] = {}
        self.deployed[name]['abi'] = self.contract_info[name]['abi']
        self.deployed[name]['address'] = address

        return self.w3.eth.contract(abi=self.contract_info[name]['abi'], address=address)

    def submit_as_v7_op(self, addr, calldata, signer_key):
        """
        Wrapper to build and submit a UserOperation directly to the EntryPoint. We don't
        have a Bundler to run gas estimation so the values are hard-coded. It might be
        necessary to change these values e.g. if simulating different L1 prices on the
        local devnet
        """

        gas_limits = "0x00000000000000000000000000016ed900000000000000000000000000053652"
        gas_fees   = "0x00000000000000000000000039d106800000000000000000000000025b9c274c"

        op = {
            'sender':addr,
            'nonce': self.aa.aa_nonce(addr, 1235),
            'initCode':"0x",
            'callData': Web3.to_hex(calldata),
            'accountGasLimits': gas_limits,
            'preVerificationGas': "0xF0000",
            'gasFees': gas_fees,
            'paymasterAndData':"0x",
            'signature': '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c' # pylint: disable=line-too-long
        }

        op = self.aa.sign_v7_op(op, signer_key)

        # Because the bundler is not running yet we must call the EntryPoint directly.
        ho = self.entry_point.functions.handleOps([(
            op['sender'],
            Web3.to_int(hexstr=op['nonce']),
            op['initCode'],
            op['callData'],
            Web3.to_bytes(hexstr=op['accountGasLimits']),
            Web3.to_int(hexstr=op['preVerificationGas']),
            Web3.to_bytes(hexstr=op['gasFees']),
            op['paymasterAndData'],
            op['signature'],
        )], self.deploy_addr).build_transaction({
            'from': self.deploy_addr,
            'value': 0,
        })
        ho['gas'] = int(self.w3.eth.estimate_gas(ho) * 1.2)

        return self.l2_util.sign_and_submit(ho, self.deploy_key)

    def permit_caller(self, addr, caller):
        """Whitelist a contract to call a HybridAccount. Now implemented as
           a UserOperation rather than requiring the Owner to be an EOA."""
        calldata = selector("PermittedCallers(address)") + \
            ethabi.encode(['address'],[addr])
        ret = self.w3.eth.call({'to':addr,'data':calldata})
        (registered,) = ethabi.decode(['bool'], ret)

        if not registered:
            print(f"Permit caller {caller} on {addr}")
            calldata = selector("PermitCaller(address,bool)") + \
              ethabi.encode(['address','bool'], [caller, True])
            self.submit_as_v7_op(addr, calldata, self.env_vars['OC_PRIVKEY'])

    def register_url(self, helper, caller, url):
        """Associates a URL with the address of a HybridAccount contract"""
        if helper.functions.RegisteredCallers(caller).call()[1] != url:
            print("Calling RegisterUrl()")
            tx = helper.functions.RegisterUrl(caller, url).build_transaction({
                'from': self.deploy_addr,
            })
            self.l2_util.sign_and_submit(tx, self.deploy_key)

        print("Credit balance =", helper.functions.RegisteredCallers(caller).call()[2])
        if helper.functions.RegisteredCallers(caller).call()[2] == 0:
            print("Calling AddCredit()")
            tx = helper.functions.AddCredit(caller, 100).build_transaction({
                'from': self.deploy_addr,
            })
            self.l2_util.sign_and_submit(tx, self.deploy_key)

    def fund_addr(self, addr):
        """Transfer funds to an address directly"""
        if self.w3.eth.get_balance(addr) == 0:
            print("Funding acct (direct)", addr)
            tx = {
                'from': self.deploy_addr,
                'to': addr,
                'value': Web3.to_wei(1.001, 'ether')
            }
            if self.w3.eth.gas_price > 1000000:
                tx['gasPrice'] = self.w3.eth.gas_price
            else:
                tx['gasPrice'] = Web3.to_wei(1, 'gwei')
            self.l2_util.sign_and_submit(tx, self.deploy_key)

    def deploy_account(self, factory, owner):
        """Deploy an account using a Factory contract"""
        calldata = selector("createAccount(address,uint256)") + \
            ethabi.encode(['address','uint256'],[owner,0])
        acct_addr_hex = Web3.to_hex(self.w3.eth.call({'to': factory, 'data':calldata}))
        acct_addr = Web3.to_checksum_address("0x" + str(acct_addr_hex)[26:])

        if len(self.w3.eth.get_code(acct_addr)) == 0:
            tx = {
                'to': factory,
                'data': calldata,
                'from': self.deploy_addr,
            }
            self.l2_util.sign_and_submit(tx, self.deploy_key)
        return acct_addr

    def build_forge(self, contract_dir):
        """
        Compile the contracts using Forge. Uses a "foundry.toml" to specify some options,
        but the remappings are supplied via CLI.
        """
        cmd_env = {}
        print("Building contracts...")
        args = ["forge", "build", "--root", self.contracts_path ]
        args.append("--contracts")
        args.append(contract_dir)
        args.append("--remappings")
        args.append("@account-abstraction/=" + self.cli_args.rundler_path + "/crates/contracts/contracts/v0_7/lib/account-abstraction/contracts")
        args.append("--remappings")
        args.append("@openzeppelin/=" + self.cli_args.rundler_path + "/crates/contracts/contracts/v0_7/lib/openzeppelin-contracts")
        args.append("--remappings")
        args.append("@forge-std/=" + self.cli_args.rundler_path + "/crates/contracts/contracts/common/lib/forge-std/")

        sys_env = os.environ.copy()

        cmd_env['PATH'] = sys_env['PATH']
        out = subprocess.run(args, cwd=".", env=cmd_env,
            capture_output=True, check=True)

        if out.returncode != 0:
            print(out)
        assert out.returncode == 0
        print("Done")

    def deploy_forge(self, contract_dir, script, cmd_env):
        """Construct parameters and then call 'forge script' to deploy contracts"""

        args = ["forge", "script", "--json", "--broadcast", "--via-ir", "--root", self.contracts_path]
        args.append("--rpc-url=" + self.eth_url)
        args.append("--contracts")

        args.append(contract_dir)
        args.append("--remappings")
        args.append("@account-abstraction/=" + self.cli_args.rundler_path + "/crates/contracts/contracts/v0_7/lib/account-abstraction/contracts")
        args.append("--remappings")
        args.append("@openzeppelin/=" + self.cli_args.rundler_path + "/crates/contracts/contracts/v0_7/lib/openzeppelin-contracts")
        args.append("--remappings")
        args.append("@forge-std/=" + self.cli_args.rundler_path + "/crates/contracts/contracts/common/lib/forge-std/")

        args.append(script)
        sys_env = os.environ.copy()

        cmd_env['PATH'] = sys_env['PATH']
        cmd_env['PRIVATE_KEY'] = self.deploy_key
        cmd_env['DEPLOY_ADDR'] = self.deploy_addr
        cmd_env['DEPLOY_SALT'] = self.cli_args.deploy_salt  # Update to force redeployment

        if 'ENTRY_POINTS' in self.env_vars:
            cmd_env['ENTRY_POINTS'] = self.env_vars['ENTRY_POINTS']
        else:
            cmd_env['ENTRY_POINTS'] = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
        print("Using EntryPoint address:", cmd_env['ENTRY_POINTS'])

        out = subprocess.run(args, cwd=".", env=cmd_env,
            capture_output=True, check=True)

        # Subprocess will fail if contracts were previously self.deployed but those addresses were
        # not passed in as env variables.
        # Retry on a cleanly self.deployed devnet or change deploy_salt.
        if out.returncode != 0:
            print(out)
        assert out.returncode == 0

        jstr = out.stdout.split(b'\n')[0].decode('ascii')
        # Currently using Forge v1.0.0
        # Previously assumed Forge 2044faec
        # Forge 9d74675b is broken, no longer gives a clean .json output.
        # Newer versions were more broken.

        ret_json = json.loads(jstr)
        addrs_raw = ret_json['returns']['0']['value']
        # Need to parse the 'internal_type': 'address[5]' value
        addrs = addrs_raw[1:-1].replace(' ','')
        return addrs

    def get_contract(self, cname, deployed_addr):
        """Creates a web3.py interface to a self.deployed contract"""
        c = self.w3.eth.contract(abi=self.contract_info[cname]['abi'], address=deployed_addr)
        self.deployed[cname] = {}
        self.deployed[cname]['abi'] = self.contract_info[cname]['abi']
        self.deployed[cname]['address'] = deployed_addr
        return c

    def boba_balance(self, addr):
        """Returns the Boba token balance of an address"""
        bal_calldata = selector("balanceOf(address)") + ethabi.encode(['address'], [addr])
        bal = self.w3.eth.call({'to':self.boba_token, 'data':bal_calldata})
        return Web3.to_int(bal)

    def fund_deployer(self):
        """Fund the deployer account with ETH and Boba, bridging if necessary"""
        l1_eth_bal = self.l1.eth.get_balance(self.deploy_addr)
        print("l1_eth_bal", l1_eth_bal)
        assert l1_eth_bal >= Web3.to_wei(2 * ETH_MIN, 'ether')

        print("Deployer balance:", self.w3.eth.get_balance(self.deploy_addr))

        if self.w3.eth.get_balance(self.deploy_addr) < Web3.to_wei(ETH_MIN, 'ether'):
            tx = {
                'from': self.deploy_addr,
                'to': Web3.to_checksum_address(self.portal_addr),
                'value': Web3.to_wei(2 * ETH_MIN, 'ether')
            }
            print("Funding L2 Deployer (ETH)")
            self.l1_util.sign_and_submit(tx, self.deploy_key)

            print("Sleep...")
            while self.w3.eth.get_balance(self.deploy_addr) == 0:
                time.sleep(2)
            print("Continuing")


        if self.boba_balance(self.deploy_addr) < Web3.to_wei(BOBA_MIN, 'ether'):
            self.l1_util.approve_token(self.boba_l1_addr, self.bridge_addr,
                self.deploy_addr, self.deploy_key)

            deposit_calldata = selector("depositERC20(address,address,uint256,uint32,bytes)") + \
                    ethabi.encode(
                    ['address','address','uint256','uint32','bytes'], [
                      self.boba_l1_addr,
                      self.boba_token,
                      Web3.to_wei(2 * BOBA_MIN,'ether'),
                      4000000,
                      Web3.to_bytes(hexstr="0x")
                    ]
                )
            tx = {
                'from': self.deploy_addr,
                'data': Web3.to_hex(deposit_calldata),
                'to': self.bridge_addr,
            }
            tx['gas'] = int(self.l1.eth.estimate_gas(tx) * 1.5)
            print("Funding L2 Deployer (BOBA)")
            self.l1_util.sign_and_submit(tx, self.deploy_key)

            print("Sleep...")
            while self.boba_balance(self.deploy_addr) == 0:
                time.sleep(2)
            print("Continuing")

    def approve_boba(self, client_addr, approval_address):
        """ERC20 approval for Boba tokens"""
        approve_calldata = selector("approve(address,uint256)") + \
            ethabi.encode(['address','uint256'], [approval_address, Web3.to_int(hexstr="0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")]) # pylint: disable=line-too-long
        ex_calldata = selector("execute(address,uint256,bytes)") + \
            ethabi.encode(['address','uint256','bytes'], [self.boba_token, 0, approve_calldata])
        self.submit_as_v7_op(client_addr, ex_calldata, self.env_vars['CLIENT_PRIVATE_KEY'])

    def save_env(self, env_dict=None):
        if not env_dict:
            env_dict = self.env_vars

        if os.path.exists(".env"):
            # .env.old is left as a backup
            os.rename(".env", ".env.old")
        with open(".env", "w", encoding="ascii") as f:
            for k in env_dict.items():
                f.write(f"{k[0]}={k[1]}\n")

    def save_deployed(self):    
        with open("./contracts.json", "w", encoding="ascii") as f:
            f.write(json.dumps(self.deployed))

class EthUtils:
    """
    Provides some helper functions for EOA transactions and general utilities.
    Used by deploy-local.py
    """
    def __init__(self, _w3):
        self.w3 = _w3
        self.chain_id = self.w3.eth.chain_id

    def sign_and_submit(self, tx, key):
        """Wrapper to sign and submit an Eth transaction from an EOA (e.g. the deployer account)
           Will populate some fields automatically while allowing the original Tx to override."""
        if 'nonce' not in tx:
            tx['nonce'] = self.w3.eth.get_transaction_count(tx['from'])
        if 'chainId' not in tx:
            tx['chainId'] = self.chain_id
        est = self.w3.eth.estimate_gas(tx)
        if 'gas' not in tx or tx['gas'] < est:
            tx['gas'] = est
        if 'gasPrice' not in tx and 'maxFeePerGas' not in tx:
            tx['gasPrice'] = self.w3.eth.gas_price

        signed_txn = self.w3.eth.account.sign_transaction(tx, key)
        ret = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        rcpt = self.w3.eth.wait_for_transaction_receipt(ret)
        if rcpt.status != 1:
            print("Transaction failed, txhash =", Web3.to_hex(ret))
        assert rcpt.status == 1
        return rcpt

    def approve_token(self, token, spender, deploy_addr, deploy_key):
        """Perform an unlimited ERC20 token approval"""
        approve_calldata = selector("approve(address,uint256)") + ethabi.encode(
            ['address','uint256'],
            [spender, Web3.to_int(hexstr=\
                "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")])

        tx = {
            'from': deploy_addr,
            'data': approve_calldata,
            'to': token,
        }
        print("ERC20 approval of", token, "for", spender)
        self.sign_and_submit(tx, deploy_key)

