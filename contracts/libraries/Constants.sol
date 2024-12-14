// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library Constants {
    uint256 public constant FEE_PERCENT = 5;
    uint256 public constant WINNERS_PERCENTAGE = 10; // 10% of entries become winners
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant NUM_WORDS = 1;
    address public constant FEE_RECIPIENT = 0xB55948e70B8Ef500878F7E75c599CeDd01246acE;
}