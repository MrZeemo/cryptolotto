// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library LotteryStructs {
    struct LotteryInfo {
        uint256 id;
        uint256 entryFee;
        uint256 targetPrizePool;
        uint256 totalPrizePool;
        bool lotteryEnded;
        bool prizeDistributed;
        uint256 totalEntries;
        address[] winners;
        address[] uniqueUsers;
    }
}