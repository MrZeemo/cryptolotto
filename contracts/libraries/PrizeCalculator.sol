// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library PrizeCalculator {
    struct PrizeRange {
        uint256[] payouts;
        uint256[][] positions;
    }

    function calculatePrizeRanges(uint256 prizePoolAfterFee) internal pure returns (PrizeRange memory) {
        if (prizePoolAfterFee == 10_000 * 10**6) {
            return getTenThousandPool();
        } else if (prizePoolAfterFee == 100_000 * 10**6) {
            return getHundredThousandPool();
        } else if (prizePoolAfterFee == 1_000_000 * 10**6) {
            return getMillionPool();
        } else {
            revert("Invalid prize pool amount");
        }
    }

    function getTenThousandPool() internal pure returns (PrizeRange memory) {
        uint256[] memory payouts = new uint256[](23);
        uint256[][] memory positions = new uint256[][](23);

        // 10,000 USDT Pool Payouts
        payouts[0] = 1000 * 10**6;   // 1st
        payouts[1] = 850 * 10**6;    // 2nd
        payouts[2] = 750 * 10**6;    // 3rd
        // ... rest of payouts for 10k pool
        
        positions[0] = toArray(1, 1);
        positions[1] = toArray(2, 2);
        // ... rest of positions for 10k pool

        return PrizeRange(payouts, positions);
    }

    function getHundredThousandPool() internal pure returns (PrizeRange memory) {
        uint256[] memory payouts = new uint256[](23);
        uint256[][] memory positions = new uint256[][](23);

        // 100,000 USDT Pool Payouts
        payouts[0] = 10000 * 10**6;  // 1st
        payouts[1] = 8500 * 10**6;   // 2nd
        // ... rest of payouts for 100k pool

        positions[0] = toArray(1, 1);
        positions[1] = toArray(2, 2);
        // ... rest of positions for 100k pool

        return PrizeRange(payouts, positions);
    }

    function getMillionPool() internal pure returns (PrizeRange memory) {
        uint256[] memory payouts = new uint256[](23);
        uint256[][] memory positions = new uint256[][](23);

        // 1,000,000 USDT Pool Payouts
        payouts[0] = 100000 * 10**6;  // 1st
        payouts[1] = 85000 * 10**6;   // 2nd
        // ... rest of payouts for 1M pool

        positions[0] = toArray(1, 1);
        positions[1] = toArray(2, 2);
        // ... rest of positions for 1M pool

        return PrizeRange(payouts, positions);
    }

    function toArray(uint256 start, uint256 end) internal pure returns (uint256[] memory) {
        uint256[] memory arr = new uint256[](2);
        arr[0] = start;
        arr[1] = end;
        return arr;
    }
}