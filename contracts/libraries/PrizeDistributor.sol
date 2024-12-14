// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Constants.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

library PrizeDistributor {
    using SafeERC20 for IERC20;

    struct PrizeRange {
        uint256[] payouts;
        uint256[][] positions;
    }

    function distributePrizes(
        IERC20 tether,
        uint256 totalPrizePool,
        address[] memory winners,
        mapping(uint256 => mapping(address => uint256)) storage winningsMap,
        uint256 lotteryId
    ) external returns (uint256) {
        uint256 feeAmount = (totalPrizePool * Constants.FEE_PERCENT) / 100;
        uint256 prizePoolAfterFee = totalPrizePool - feeAmount;

        tether.safeTransfer(Constants.FEE_RECIPIENT, feeAmount);

        PrizeRange memory prizeRange = calculatePrizeRanges(prizePoolAfterFee);
        
        for (uint256 i = 0; i < prizeRange.positions.length; i++) {
            uint256 startPos = prizeRange.positions[i][0];
            uint256 endPos = prizeRange.positions[i][1];
            
            for (uint256 j = startPos; j <= endPos && j <= winners.length; j++) {
                address winner = winners[j - 1];
                winningsMap[lotteryId][winner] += prizeRange.payouts[i];
            }
        }

        return prizePoolAfterFee;
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
        payouts[0] = 1000 * 10**6;   // 1st: 1,000 USDT
        payouts[1] = 850 * 10**6;    // 2nd: 850 USDT
        payouts[2] = 750 * 10**6;    // 3rd: 750 USDT
        payouts[3] = 650 * 10**6;    // 4th: 650 USDT
        payouts[4] = 600 * 10**6;    // 5th: 600 USDT
        payouts[5] = 550 * 10**6;    // 6th: 550 USDT
        payouts[6] = 500 * 10**6;    // 7th: 500 USDT
        payouts[7] = 475 * 10**6;    // 8th: 475 USDT
        payouts[8] = 450 * 10**6;    // 9th: 450 USDT
        payouts[9] = 425 * 10**6;    // 10th: 425 USDT
        payouts[10] = 400 * 10**6;   // 11-22: 400 USDT
        payouts[11] = 375 * 10**6;   // 23-35: 375 USDT
        payouts[12] = 350 * 10**6;   // 36-50: 350 USDT
        payouts[13] = 325 * 10**6;   // 51-100: 325 USDT
        payouts[14] = 300 * 10**6;   // 101-200: 300 USDT
        payouts[15] = 275 * 10**6;   // 201-300: 275 USDT
        payouts[16] = 250 * 10**6;   // 301-400: 250 USDT
        payouts[17] = 225 * 10**6;   // 401-500: 225 USDT
        payouts[18] = 200 * 10**6;   // 501-600: 200 USDT
        payouts[19] = 175 * 10**6;   // 601-700: 175 USDT
        payouts[20] = 150 * 10**6;   // 701-800: 150 USDT
        payouts[21] = 125 * 10**6;   // 801-900: 125 USDT
        payouts[22] = 100 * 10**6;   // 901-1000: 100 USDT

        positions[0] = toArray(1, 1);
        positions[1] = toArray(2, 2);
        positions[2] = toArray(3, 3);
        positions[3] = toArray(4, 4);
        positions[4] = toArray(5, 5);
        positions[5] = toArray(6, 6);
        positions[6] = toArray(7, 7);
        positions[7] = toArray(8, 8);
        positions[8] = toArray(9, 9);
        positions[9] = toArray(10, 10);
        positions[10] = toArray(11, 22);
        positions[11] = toArray(23, 35);
        positions[12] = toArray(36, 50);
        positions[13] = toArray(51, 100);
        positions[14] = toArray(101, 200);
        positions[15] = toArray(201, 300);
        positions[16] = toArray(301, 400);
        positions[17] = toArray(401, 500);
        positions[18] = toArray(501, 600);
        positions[19] = toArray(601, 700);
        positions[20] = toArray(701, 800);
        positions[21] = toArray(801, 900);
        positions[22] = toArray(901, 1000);

        return PrizeRange(payouts, positions);
    }

    function getHundredThousandPool() internal pure returns (PrizeRange memory) {
        uint256[] memory payouts = new uint256[](23);
        uint256[][] memory positions = new uint256[][](23);

        // 100,000 USDT Pool Payouts
        payouts[0] = 10000 * 10**6;  // 1st: 10,000 USDT
        payouts[1] = 8500 * 10**6;   // 2nd: 8,500 USDT
        payouts[2] = 7500 * 10**6;   // 3rd: 7,500 USDT
        payouts[3] = 6500 * 10**6;   // 4th: 6,500 USDT
        payouts[4] = 6000 * 10**6;   // 5th: 6,000 USDT
        payouts[5] = 5500 * 10**6;   // 6th: 5,500 USDT
        payouts[6] = 5000 * 10**6;   // 7th: 5,000 USDT
        payouts[7] = 4750 * 10**6;   // 8th: 4,750 USDT
        payouts[8] = 4500 * 10**6;   // 9th: 4,500 USDT
        payouts[9] = 4250 * 10**6;   // 10-100: 4,250 USDT
        payouts[10] = 4000 * 10**6;  // 101-225: 4,000 USDT
        payouts[11] = 3750 * 10**6;  // 226-350: 3,750 USDT
        payouts[12] = 3500 * 10**6;  // 351-500: 3,500 USDT
        payouts[13] = 3250 * 10**6;  // 501-1000: 3,250 USDT
        payouts[14] = 3000 * 10**6;  // 1001-2000: 3,000 USDT
        payouts[15] = 2750 * 10**6;  // 2001-3000: 2,750 USDT
        payouts[16] = 2500 * 10**6;  // 3001-4000: 2,500 USDT
        payouts[17] = 2250 * 10**6;  // 4001-5000: 2,250 USDT
        payouts[18] = 2000 * 10**6;  // 5001-6000: 2,000 USDT
        payouts[19] = 1750 * 10**6;  // 6001-7000: 1,750 USDT
        payouts[20] = 1500 * 10**6;  // 7001-8000: 1,500 USDT
        payouts[21] = 1250 * 10**6;  // 8001-9000: 1,250 USDT
        payouts[22] = 1000 * 10**6;  // 9001-10000: 1,000 USDT

        positions[0] = toArray(1, 1);
        positions[1] = toArray(2, 2);
        positions[2] = toArray(3, 3);
        positions[3] = toArray(4, 4);
        positions[4] = toArray(5, 5);
        positions[5] = toArray(6, 6);
        positions[6] = toArray(7, 7);
        positions[7] = toArray(8, 8);
        positions[8] = toArray(9, 9);
        positions[9] = toArray(10, 100);
        positions[10] = toArray(101, 225);
        positions[11] = toArray(226, 350);
        positions[12] = toArray(351, 500);
        positions[13] = toArray(501, 1000);
        positions[14] = toArray(1001, 2000);
        positions[15] = toArray(2001, 3000);
        positions[16] = toArray(3001, 4000);
        positions[17] = toArray(4001, 5000);
        positions[18] = toArray(5001, 6000);
        positions[19] = toArray(6001, 7000);
        positions[20] = toArray(7001, 8000);
        positions[21] = toArray(8001, 9000);
        positions[22] = toArray(9001, 10000);

        return PrizeRange(payouts, positions);
    }

    function getMillionPool() internal pure returns (PrizeRange memory) {
        uint256[] memory payouts = new uint256[](23);
        uint256[][] memory positions = new uint256[][](23);

        // 1,000,000 USDT Pool Payouts
        payouts[0] = 100000 * 10**6;  // 1st: 100,000 USDT
        payouts[1] = 85000 * 10**6;   // 2nd: 85,000 USDT
        payouts[2] = 75000 * 10**6;   // 3rd: 75,000 USDT
        payouts[3] = 65000 * 10**6;   // 4th: 65,000 USDT
        payouts[4] = 60000 * 10**6;   // 5th: 60,000 USDT
        payouts[5] = 55000 * 10**6;   // 6th: 55,000 USDT
        payouts[6] = 50000 * 10**6;   // 7th: 50,000 USDT
        payouts[7] = 47500 * 10**6;   // 8th: 47,500 USDT
        payouts[8] = 45000 * 10**6;   // 9th: 45,000 USDT
        payouts[9] = 42500 * 10**6;   // 10-100: 42,500 USDT
        payouts[10] = 40000 * 10**6;  // 101-250: 40,000 USDT
        payouts[11] = 37500 * 10**6;  // 251-500: 37,500 USDT
        payouts[12] = 35000 * 10**6;  // 501-1000: 35,000 USDT
        payouts[13] = 32500 * 10**6;  // 1001-10000: 32,500 USDT
        payouts[14] = 30000 * 10**6;  // 10001-20000: 30,000 USDT
        payouts[15] = 27500 * 10**6;  // 20001-30000: 27,500 USDT
        payouts[16] = 25000 * 10**6;  // 30001-40000: 25,000 USDT
        payouts[17] = 22500 * 10**6;  // 40001-50000: 22,500 USDT
        payouts[18] = 20000 * 10**6;  // 50001-60000: 20,000 USDT
        payouts[19] = 17500 * 10**6;  // 60001-70000: 17,500 USDT
        payouts[20] = 15000 * 10**6;  // 70001-80000: 15,000 USDT
        payouts[21] = 12500 * 10**6;  // 80001-90000: 12,500 USDT
        payouts[22] = 10000 * 10**6;  // 90001-100000: 10,000 USDT

        positions[0] = toArray(1, 1);
        positions[1] = toArray(2, 2);
        positions[2] = toArray(3, 3);
        positions[3] = toArray(4, 4);
        positions[4] = toArray(5, 5);
        positions[5] = toArray(6, 6);
        positions[6] = toArray(7, 7);
        positions[7] = toArray(8, 8);
        positions[8] = toArray(9, 9);
        positions[9] = toArray(10, 100);
        positions[10] = toArray(101, 250);
        positions[11] = toArray(251, 500);
        positions[12] = toArray(501, 1000);
        positions[13] = toArray(1001, 10000);
        positions[14] = toArray(10001, 20000);
        positions[15] = toArray(20001, 30000);
        positions[16] = toArray(30001, 40000);
        positions[17] = toArray(40001, 50000);
        positions[18] = toArray(50001, 60000);
        positions[19] = toArray(60001, 70000);
        positions[20] = toArray(70001, 80000);
        positions[21] = toArray(80001, 90000);
        positions[22] = toArray(90001, 100000);

        return PrizeRange(payouts, positions);
    }

    function toArray(uint256 start, uint256 end) internal pure returns (uint256[] memory) {
        uint256[] memory arr = new uint256[](2);
        arr[0] = start;
        arr[1] = end;
        return arr;
    }
}