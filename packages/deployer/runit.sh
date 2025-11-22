#!/bin/bash

# Wrapper script to run rundler-hc locally, outside of a Docker container
# Other configuration parameters are taken from environment variables.
# Changes here should be synced with docker-wrapper.sh in the rundler-hc repo

set -a
source .env

if [ -z "${RUNDLER_PATH}" ] ; then
  echo "RUNDLER_PATH is not set"
  exit 1
fi

RUST_BACKTRACE=1 \
  ${RUNDLER_PATH}/target/debug/rundler node \
  --signer.redis_uri=redis://127.0.0.1:6379 \
  --min_stake_value 1000000000000000 \
  --min_unstake_delay 60 \
  --rpc.port 3300 \
  --metrics.port 8380 \
  --pool.chain_poll_interval_millis 500 \
  --builder.max_blocks_to_wait_for_mine 8 \
  --chain_spec ${RUNDLER_PATH}/bin/rundler/chain_specs/boba_sepolia.toml \
  --base_fee_accept_percent 100 \
  $@ 2>&1
