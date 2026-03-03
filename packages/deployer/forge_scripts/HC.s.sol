// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@forge-std/src/Script.sol";
import "@account-abstraction/core/EntryPoint.sol";
import "packages/contracts/v0_7/hc_src/HCHelper.sol";
import "@account-abstraction/samples/SimpleAccountFactory.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

contract HelperUpgrade is Script {
    function run() external
        returns (address[1] memory) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        uint256 deploySalt = vm.envOr("DEPLOY_SALT",uint256(0)); // Change this to force redeployment of contracts

        // EntryPointAddr is hard-coded for the v0.7 implementation
        EntryPoint ept = EntryPoint(payable(0x0000000071727De22E5E9d8BAf0edAc6f37da032));

        bytes32 salt_val = bytes32(deploySalt);

        vm.startBroadcast(deployerPrivateKey);

        HCHelper helperImpl = new HCHelper{salt: salt_val}(address(ept));
        
        address hcSysOwner = 0x59d70e7fd06B39f4e28eB82370d8A2a519700658;
        bytes memory initCall = abi.encodeCall(HCHelper.initialize, hcSysOwner);

        ProxyAdmin pAdmin = ProxyAdmin(0x5c5456DC6265264742c212305DBA383B43Ed81ed);
        
        address helperProxy = 0x11c4DbbaC4A0A47a7c76b5603bc219c5dAe752D6;
        
        pAdmin.upgradeAndCall(ITransparentUpgradeableProxy(helperProxy), address(helperImpl), initCall);

        vm.stopBroadcast();
        return [address(helperImpl)];
    }
}
