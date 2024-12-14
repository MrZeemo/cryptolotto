// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";

contract Lottery is OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, VRFConsumerBaseV2 {
    using SafeERC20 for IERC20;

    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_keyHash;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    uint256 public constant ONE_YEAR = 365 days;
    uint256 public constant THRESHOLD_PERCENT = 33;

    mapping(uint256 => uint256) public requestToLotteryId;
    IERC20 public tether;
    uint256 public constant FEE_PERCENT = 5;
    address public constant FEE_RECIPIENT = 0xB55948e70B8Ef500878F7E75c599CeDd01246acE;

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

    mapping(uint256 => LotteryInfo) public lotteries;
    uint256 public currentLotteryId;
    mapping(uint256 => mapping(address => uint256)) public entries;
    mapping(uint256 => mapping(address => uint256)) public winningsMap;

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

    constructor(
        address _vrfCoordinator,
        uint64 _subscriptionId,
        bytes32 _keyHash,
        uint32 _callbackGasLimit,
        address _tetherAddress
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        i_vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        i_subscriptionId = _subscriptionId;
        i_keyHash = _keyHash;
        i_callbackGasLimit = _callbackGasLimit;
        tether = IERC20(_tetherAddress);
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();
    }

    function createLottery(uint256 _entryFee, uint256 _targetPrizePool) external onlyOwner {
        require(_entryFee > 0, "Entry fee must be greater than zero");
        require(_targetPrizePool > 0, "Target prize pool must be greater than zero");

        currentLotteryId++;
        uint256 threshold = (_targetPrizePool * THRESHOLD_PERCENT) / 100;
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + ONE_YEAR;

        lotteries[currentLotteryId] = LotteryInfo({
            id: currentLotteryId,
            entryFee: _entryFee,
            targetPrizePool: _targetPrizePool,
            totalPrizePool: 0,
            thresholdAmount: threshold,
            thresholdMet: false,
            startTime: startTime,
            endTime: endTime,
            lotteryEnded: false,
            prizeDistributed: false,
            refunded: false,
            totalEntries: 0,
            winners: new address[](0),
            uniqueUsers: new address[](0)
        });

        emit LotteryCreated(currentLotteryId, _entryFee, _targetPrizePool, endTime);
    }

    function enterLottery(uint256 _lotteryId, uint256 _numEntries) external nonReentrant whenNotPaused {
        LotteryInfo storage lottery = lotteries[_lotteryId];
        require(_lotteryId > 0 && _lotteryId <= currentLotteryId, "Invalid lottery ID");
        require(!lottery.lotteryEnded, "Lottery has ended");
        require(!lottery.refunded, "Lottery has been refunded");
        require(_numEntries > 0, "Must enter at least one entry");
        require(block.timestamp <= lottery.endTime, "Lottery period has expired");

        uint256 totalCost = lottery.entryFee * _numEntries;
        tether.safeTransferFrom(msg.sender, address(this), totalCost);

        if (entries[_lotteryId][msg.sender] == 0) {
            lottery.uniqueUsers.push(msg.sender);
        }

        entries[_lotteryId][msg.sender] += _numEntries;
        lottery.totalEntries += _numEntries;
        lottery.totalPrizePool += totalCost;

        if (!lottery.thresholdMet && lottery.totalPrizePool >= lottery.thresholdAmount) {
            lottery.thresholdMet = true;
            emit ThresholdMet(_lotteryId, lottery.thresholdAmount);
        }

        emit LotteryEntered(_lotteryId, msg.sender, totalCost, _numEntries);
    }

    function _toArray(uint256 start, uint256 end) internal pure returns (uint256[] memory) {
        uint256[] memory arr = new uint256[](2);
        arr[0] = start;
        arr[1] = end;
        return arr;
    }

    function requestRandomWords(uint256 _lotteryId) external onlyOwner {
        LotteryInfo storage lottery = lotteries[_lotteryId];
        require(lottery.totalEntries > 0, "No entries in the lottery");
        require(!lottery.lotteryEnded, "Lottery already ended");
        require(
            lottery.thresholdMet || block.timestamp >= lottery.endTime,
            "Cannot end lottery before threshold or time limit"
        );

        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_keyHash,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );

        requestToLotteryId[requestId] = _lotteryId;
        lottery.lotteryEnded = true;

        emit LotteryEnded(_lotteryId, lottery.totalPrizePool);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        uint256 lotteryId = requestToLotteryId[requestId];
        LotteryInfo storage lottery = lotteries[lotteryId];

        if (lottery.thresholdMet) {
            uint256 winnersCount = lottery.totalEntries / 10;
            for (uint256 i = 0; i < winnersCount; i++) {
                uint256 winningIndex = uint256(keccak256(abi.encode(randomWords[0], i))) % lottery.uniqueUsers.length;
                lottery.winners.push(lottery.uniqueUsers[winningIndex]);
            }

            emit WinnersSelected(lotteryId, lottery.winners);
            _distributePrizes(lotteryId);
        } else {
            lottery.refunded = true;
            emit RefundsEnabled(lotteryId);
        }
    }

    function _distributePrizes(uint256 _lotteryId) internal {
        LotteryInfo storage lottery = lotteries[_lotteryId];
        uint256 totalPrizePool = lottery.totalPrizePool;

        uint256 feeAmount = (totalPrizePool * FEE_PERCENT) / 100;
        uint256 prizePoolAfterFee = totalPrizePool - feeAmount;

        tether.safeTransfer(FEE_RECIPIENT, feeAmount);
        emit FeeCollected(_lotteryId, FEE_RECIPIENT, feeAmount);

        uint256[] memory payouts;
        uint256[][] memory positions;

        if (prizePoolAfterFee == 10_000 * 10**6) {
            payouts = new uint256[](23);
            positions = new uint256[][](23);

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

            positions[0] = _toArray(1, 1);
            positions[1] = _toArray(2, 2);
            positions[2] = _toArray(3, 3);
            positions[3] = _toArray(4, 4);
            positions[4] = _toArray(5, 5);
            positions[5] = _toArray(6, 6);
            positions[6] = _toArray(7, 7);
            positions[7] = _toArray(8, 8);
            positions[8] = _toArray(9, 9);
            positions[9] = _toArray(10, 10);
            positions[10] = _toArray(11, 22);
            positions[11] = _toArray(23, 35);
            positions[12] = _toArray(36, 50);
            positions[13] = _toArray(51, 100);
            positions[14] = _toArray(101, 200);
            positions[15] = _toArray(201, 300);
            positions[16] = _toArray(301, 400);
            positions[17] = _toArray(401, 500);
            positions[18] = _toArray(501, 600);
            positions[19] = _toArray(601, 700);
            positions[20] = _toArray(701, 800);
            positions[21] = _toArray(801, 900);
            positions[22] = _toArray(901, 1000);

        } else if (prizePoolAfterFee == 100_000 * 10**6) {
            payouts = new uint256[](23);
            positions = new uint256[][](23);

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

            positions[0] = _toArray(1, 1);
            positions[1] = _toArray(2, 2);
            positions[2] = _toArray(3, 3);
            positions[3] = _toArray(4, 4);
            positions[4] = _toArray(5, 5);
            positions[5] = _toArray(6, 6);
            positions[6] = _toArray(7, 7);
            positions[7] = _toArray(8, 8);
            positions[8] = _toArray(9, 9);
            positions[9] = _toArray(10, 100);
            positions[10] = _toArray(101, 225);
            positions[11] = _toArray(226, 350);
            positions[12] = _toArray(351, 500);
            positions[13] = _toArray(501, 1000);
            positions[14] = _toArray(1001, 2000);
            positions[15] = _toArray(2001, 3000);
            positions[16] = _toArray(3001, 4000);
            positions[17] = _toArray(4001, 5000);
            positions[18] = _toArray(5001, 6000);
            positions[19] = _toArray(6001, 7000);
            positions[20] = _toArray(7001, 8000);
            positions[21] = _toArray(8001, 9000);
            positions[22] = _toArray(9001, 10000);

        } else if (prizePoolAfterFee == 1_000_000 * 10**6) {
            payouts = new uint256[](23);
            positions = new uint256[][](23);

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

            positions[0] = _toArray(1, 1);
            positions[1] = _toArray(2, 2);
            positions[2] = _toArray(3, 3);
            positions[3] = _toArray(4, 4);
            positions[4] = _toArray(5, 5);
            positions[5] = _toArray(6, 6);
            positions[6] = _toArray(7, 7);
            positions[7] = _toArray(8, 8);
            positions[8] = _toArray(9, 9);
            positions[9] = _toArray(10, 100);
            positions[10] = _toArray(101, 250);
            positions[11] = _toArray(251, 500);
            positions[12] = _toArray(501, 1000);
            positions[13] = _toArray(1001, 10000);
            positions[14] = _toArray(10001, 20000);
            positions[15] = _toArray(20001, 30000);
            positions[16] = _toArray(30001, 40000);
            positions[17] = _toArray(40001, 50000);
            positions[18] = _toArray(50001, 60000);
            positions[19] = _toArray(60001, 70000);
            positions[20] = _toArray(70001, 80000);
            positions[21] = _toArray(80001, 90000);
            positions[22] = _toArray(90001, 100000);
        } else {
            revert("Invalid prize pool amount");
        }

        // Distribute prizes according to positions
        for (uint256 i = 0; i < positions.length; i++) {
            uint256 start = positions[i][0];
            uint256 end = positions[i][1];
            
            for (uint256 pos = start; pos <= end && pos <= lottery.winners.length; pos++) {
                address winner = lottery.winners[pos - 1];
                winningsMap[_lotteryId][winner] += payouts[i];
            }
        }

        lottery.prizeDistributed = true;
        emit PrizeDistributed(_lotteryId, prizePoolAfterFee);
    }

    function claimPrize(uint256 _lotteryId) external nonReentrant {
        LotteryInfo storage lottery = lotteries[_lotteryId];
        require(lottery.prizeDistributed, "Prizes not yet distributed");
        uint256 winningAmount = winningsMap[_lotteryId][msg.sender];
        require(winningAmount > 0, "No prize to claim");

        winningsMap[_lotteryId][msg.sender] = 0;
        tether.safeTransfer(msg.sender, winningAmount);

        emit PrizeClaimed(_lotteryId, msg.sender, winningAmount);
    }

    function claimRefund(uint256 _lotteryId) external nonReentrant {
        LotteryInfo storage lottery = lotteries[_lotteryId];
        require(lottery.refunded, "Refunds not enabled");
        uint256 entryCount = entries[_lotteryId][msg.sender];
        require(entryCount > 0, "No entries to refund");

        uint256 refundAmount = entryCount * lottery.entryFee;
        entries[_lotteryId][msg.sender] = 0;
        tether.safeTransfer(msg.sender, refundAmount);

        emit RefundClaimed(_lotteryId, msg.sender, refundAmount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}