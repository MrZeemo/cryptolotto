// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILotteryEvents {
    event LotteryCreated(uint256 indexed lotteryId, uint256 entryFee, uint256 targetPrizePool);
    event LotteryEntered(uint256 indexed lotteryId, address indexed player, uint256 amount, uint256 numEntries);
    event LotteryEnded(uint256 indexed lotteryId, uint256 totalPrizePool);
    event WinnersSelected(uint256 indexed lotteryId, address[] winners);
    event PrizeClaimed(uint256 indexed lotteryId, address indexed winner, uint256 amount);
    event FeeCollected(uint256 indexed lotteryId, address indexed owner, uint256 amount);
    event PrizeDistributed(uint256 indexed lotteryId, uint256 prizePoolAfterFee);
}