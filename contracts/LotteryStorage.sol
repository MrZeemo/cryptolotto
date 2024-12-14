// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ILottery.sol";

contract LotteryStorage {
    uint256 public constant ONE_YEAR = 365 days;
    uint256 public constant THRESHOLD_PERCENT = 33;
    uint256 public constant FEE_PERCENT = 5;
    
    mapping(uint256 => ILottery.LotteryInfo) public lotteries;
    uint256 public currentLotteryId;
    mapping(uint256 => mapping(address => uint256)) public entries;
    mapping(uint256 => mapping(address => uint256)) public winningsMap;
    mapping(uint256 => uint256) public requestToLotteryId;
}