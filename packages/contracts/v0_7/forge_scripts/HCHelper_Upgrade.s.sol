// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@forge-std/Script.sol";
import "hc_src/HCHelper.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {Options} from "openzeppelin-foundry-upgrades/Options.sol";

contract HelperUpgrade is Script {
   function run() external
        returns (address[1] memory) {

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        uint256 deploySalt = vm.envOr("DEPLOY_SALT",uint256(0)); // Change this to force redeployment of contracts

        bytes32 salt_val = bytes32(deploySalt);

        vm.startBroadcast(deployerPrivateKey);

        HCHelper helperImpl = new HCHelper{salt: salt_val}();
        address helperProxy = 0x11c4DbbaC4A0A47a7c76b5603bc219c5dAe752D6; // Boba Sepolia and Mainnet

        bytes memory initCall;

        Options memory opts;

        Upgrades.upgradeProxy(helperProxy, "HCHelper.sol", initCall, opts);

        vm.stopBroadcast();
        return [address(helperImpl)];
    }
}
