"""Test runner"""

import time

from test_utils import TestUtils

from tests.add_sub_2_test import test_add_sub_2
from tests.vrf_test import test_random_request
from tests.ramble_test import test_word_guess
from tests.auction_system_test import test_auction
from tests.sports_betting_test import test_sports_betting
from tests.check_kyc_test import test_kyc

t = TestUtils()

# ===============================================

test_add_sub_2(t, 2, 1)   # Success
test_add_sub_2(t, 2, 10, False)  # Underflow error, asserted
test_add_sub_2(t, 2, 3)   # Underflow error, handled internally
test_add_sub_2(t, 7, 0)   # Not HC
test_add_sub_2(t, 4, 1)   # Success again

test_random_request(t, True)
test_random_request(t, False)

test_word_guess(t, 1, False)
test_word_guess(t, 10, False)
test_word_guess(t, 2, True)

print("\n\n\n*** TestHybrid finished, will continue with extended tests in 5s ***")
time.sleep(5)

test_auction(t)
test_sports_betting(t)
test_kyc(t,False)
test_kyc(t,True)
#Broken
#policy_id = test_rainfall_insurance_purchase(aa)
#test_rainfall_insurance_payout(aa, policy_id)  # Calls external API; disabled by default
#TestCaptcha("0x123")
#TestTokenPrice(aa, "ETH") # Calls external API; disabled by default
# ===============================================

print("\nBalance Details:")
t.show_balance_details()

print("\nBalance Summary:")
t.show_end_balances()
