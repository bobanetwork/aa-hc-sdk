(TODO: reorganize and add missing entries)

# Add-Sub Example
The `count` function in the `TestCounter` smart contract takes two integers, `a` and `b`, as inputs. These integers are sent to an off-chain function, which performs arithmetic operations and returns a pair of numbers representing the sum and difference of the two parameters.

## Overview
**1. Smart Contract**: A smart contract that includes a function (count) to perform arithmetic operations by making off-chain calls.

**2. Off-chain Function**: A function that calculates the sum and difference of two integers. If the second integer is greater than the first, it returns an error due to subtraction underflow.

**3. Integration**: The smart contract makes an off-chain call to the arithmetic function, which processes the integers and returns the results (sum and difference) or an error.

# KYC Example

This example demonstrates how to integrate a **Know Your Customer (KYC)** verification process into a smart contract. The smart contract function takes an address and makes an off-chain call with that address. For simplicity, the off-chain function returns true, but in a real-world scenario, one would implement comprehensive KYC logic in this function.

## Overview
**1. Smart Contract**: A smart contract that includes a function to initiate KYC verification for a given address.

**2. Off-chain Function**: A function that performs KYC verification logic. In this example, it simply returns true if the address exists in an array.

**3. Integration**: The smart contract makes an off-chain call to the KYC function, which processes the address and returns the verification result.

# Word-Guessing Game Example
## Overview
This example demonstrates a word-guessing game. The game involves the following steps:

**1.** The user picks a four-letter word as their guess.

**2.** The user pays an amount based on the number of entries they wish to purchase. This wager is added to a pool.

**3.** An off-chain provider generates a random array of words and returns it as a string[].

**4.** If the user's guess appears in the list returned from the server, they win the entire pool.

**5.** A boolean flag allows the user to cheat by guaranteeing that the word "frog" will appear in the list.
