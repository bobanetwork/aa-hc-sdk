This directory contains contracts moved from the rundler-hc repo.
The ones in "hc_src" can be deployed on a local devnet to provide
the core functionality while the ones in "hc_example" correspond to
the set of standard examples and tests from rundler-hc.

The lib/chainlink/VRF.sol contract is provided to support the VRF
TestRandom example. An upstream copy may be found at:
https://github.com/smartcontractkit/chainlink-brownie-contracts/blob/main/contracts/src/v0.8/vrf/VRF.sol
The file is copied to avoid the overhead of importing the whole upstream
tree as a submodule.
