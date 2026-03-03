// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@forge-std/Script.sol";
import "@account-abstraction/core/EntryPoint.sol";
import "hc_src/HybridAccount.sol";
import "@account-abstraction/samples/SimpleAccountFactory.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract HelperUpgrade is Script {
   function run() external
        returns (address[1] memory) {

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        uint256 deploySalt = vm.envOr("DEPLOY_SALT",uint256(0)); // Change this to force redeployment of contracts

        bytes32 salt_val = bytes32(deploySalt);

        vm.startBroadcast(deployerPrivateKey);
        address ept = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
        address helper = 0x11c4DbbaC4A0A47a7c76b5603bc219c5dAe752D6;

        HybridAccount haImpl = new HybridAccount{salt: salt_val}(IEntryPoint(ept), helper);
        UUPSUpgradeable haProxy = UUPSUpgradeable(payable(0x534022aC2a78b65A4d0f3bF5D07244Fb1D2C7056));

        bytes memory initCall;

        haProxy.upgradeToAndCall(address(haImpl), initCall);

        vm.stopBroadcast();
        return [address(haImpl)];
    }
}
