// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILottery {
    struct LotteryInfo {
        uint256 id;
        uint256 entryFee;
        uint256 targetPrizePool;
        uint256 totalPrizePool;
        uint256 thresholdAmount;
        bool thresholdMet;
        uint256 startTime;
        uint256 endTime;
        bool lotteryEnded;
        bool prizeDistributed;
        bool refunded;
        uint256 totalEntries;
        address[] winners;
        address[] uniqueUsers;
    }

    event LotteryCreated(uint256 indexed lotteryId, uint256 entryFee, uint256 targetPrizePool, uint256 endTime);
    event LotteryEntered(uint256 indexed lotteryId, address indexed player, uint256 amount, uint256 numEntries);
    event ThresholdMet(uint256 indexed lotteryId, uint256 thresholdAmount);
    event LotteryEnded(uint256 indexed lotteryId, uint256 totalPrizePool);
    event WinnersSelected(uint256 indexed lotteryId, address[] winners);
    event PrizeClaimed(uint256 indexed lotteryId, address indexed winner, uint256 amount);
    event FeeCollected(uint256 indexed lotteryId, address indexed owner, uint256 amount);
    event PrizeDistributed(uint256 indexed lotteryId, uint256 prizePoolAfterFee);
    event RefundsEnabled(uint256 indexed lotteryId);
    event RefundClaimed(uint256 indexed lotteryId, address indexed player, uint256 amount);

    function createLottery(uint256 _entryFee, uint256 _targetPrizePool) external;
    function enterLottery(uint256 _lotteryId, uint256 _numEntries) external;
    function requestRandomWords(uint256 _lotteryId) external;
    function claimPrize(uint256 _lotteryId) external;
    function claimRefund(uint256 _lotteryId) external;
}