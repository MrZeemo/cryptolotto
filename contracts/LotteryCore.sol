// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "./interfaces/ILotteryEvents.sol";
import "./libraries/LotteryStructs.sol";
import "./libraries/Constants.sol";
import "./libraries/PrizeDistributor.sol";

contract LotteryCore is 
    ILotteryEvents, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable, 
    PausableUpgradeable, 
    VRFConsumerBaseV2 
{
    using SafeERC20 for IERC20;
    using LotteryStructs for LotteryStructs.LotteryInfo;

    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_keyHash;
    uint32 private immutable i_callbackGasLimit;

    IERC20 public tether;
    mapping(uint256 => LotteryStructs.LotteryInfo) public lotteries;
    uint256 public currentLotteryId;
    mapping(uint256 => mapping(address => uint256)) public entries;
    mapping(uint256 => mapping(address => uint256)) public winningsMap;
    mapping(uint256 => uint256) public requestToLotteryId;

    uint256 private _notEntered = 1;
    address private _emergencyAdmin;
    bool private _emergencyMode;

    modifier onlyEmergencyAdmin() {
        require(msg.sender == _emergencyAdmin, "Not emergency admin");
        _;
    }

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
        _emergencyAdmin = msg.sender;
    }

    function setEmergencyAdmin(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "Invalid address");
        _emergencyAdmin = newAdmin;
    }

    function emergencyWithdraw() external onlyEmergencyAdmin {
        require(_emergencyMode, "Not in emergency mode");
        uint256 balance = tether.balanceOf(address(this));
        tether.safeTransfer(_emergencyAdmin, balance);
    }

    function createLottery(uint256 _entryFee, uint256 _targetPrizePool) 
        external 
        onlyOwner 
        whenNotPaused 
    {
        require(_entryFee > 0, "Entry fee must be greater than zero");
        require(_targetPrizePool > 0, "Target prize pool must be greater than zero");
        require(
            _targetPrizePool == 10_000 * 10**6 || 
            _targetPrizePool == 100_000 * 10**6 || 
            _targetPrizePool == 1_000_000 * 10**6,
            "Invalid prize pool amount"
        );

        currentLotteryId++;

        lotteries[currentLotteryId] = LotteryStructs.LotteryInfo({
            id: currentLotteryId,
            entryFee: _entryFee,
            targetPrizePool: _targetPrizePool,
            totalPrizePool: 0,
            lotteryEnded: false,
            prizeDistributed: false,
            totalEntries: 0,
            winners: new address[](0),
            uniqueUsers: new address[](0)
        });

        emit LotteryCreated(currentLotteryId, _entryFee, _targetPrizePool);
    }

    function enterLottery(uint256 _lotteryId, uint256 _numEntries) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(!_emergencyMode, "Emergency mode active");
        LotteryStructs.LotteryInfo storage lottery = lotteries[_lotteryId];
        
        require(_lotteryId > 0 && _lotteryId <= currentLotteryId, "Invalid lottery ID");
        require(!lottery.lotteryEnded, "Lottery has ended");
        require(_numEntries > 0, "Must enter at least one entry");
        require(_numEntries <= 1000, "Max 1000 entries per transaction");

        uint256 totalCost = lottery.entryFee * _numEntries;
        require(totalCost <= type(uint256).max, "Cost overflow");

        tether.safeTransferFrom(msg.sender, address(this), totalCost);

        if (entries[_lotteryId][msg.sender] == 0) {
            lottery.uniqueUsers.push(msg.sender);
        }

        entries[_lotteryId][msg.sender] += _numEntries;
        lottery.totalEntries += _numEntries;
        lottery.totalPrizePool += totalCost;

        emit LotteryEntered(_lotteryId, msg.sender, totalCost, _numEntries);
    }

    function requestRandomWords(uint256 _lotteryId) 
        external 
        onlyOwner 
        whenNotPaused 
    {
        require(!_emergencyMode, "Emergency mode active");
        LotteryStructs.LotteryInfo storage lottery = lotteries[_lotteryId];
        
        require(lottery.totalEntries > 0, "No entries in the lottery");
        require(!lottery.lotteryEnded, "Lottery already ended");

        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_keyHash,
            i_subscriptionId,
            Constants.REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            Constants.NUM_WORDS
        );

        requestToLotteryId[requestId] = _lotteryId;
        lottery.lotteryEnded = true;

        emit LotteryEnded(_lotteryId, lottery.totalPrizePool);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) 
        internal 
        override 
    {
        uint256 lotteryId = requestToLotteryId[requestId];
        LotteryStructs.LotteryInfo storage lottery = lotteries[lotteryId];

        require(!lottery.prizeDistributed, "Prizes already distributed");

        uint256 winnersCount = lottery.totalEntries / Constants.WINNERS_PERCENTAGE;
        for (uint256 i = 0; i < winnersCount; i++) {
            uint256 winningIndex = uint256(
                keccak256(abi.encode(randomWords[0], i))
            ) % lottery.uniqueUsers.length;
            lottery.winners.push(lottery.uniqueUsers[winningIndex]);
        }

        emit WinnersSelected(lotteryId, lottery.winners);

        uint256 prizePoolAfterFee = PrizeDistributor.distributePrizes(
            tether,
            lottery.totalPrizePool,
            lottery.winners,
            winningsMap,
            lotteryId
        );

        lottery.prizeDistributed = true;
        emit PrizeDistributed(lotteryId, prizePoolAfterFee);
    }

    function claimPrize(uint256 _lotteryId) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(!_emergencyMode, "Emergency mode active");
        require(lotteries[_lotteryId].prizeDistributed, "Prizes not yet distributed");
        
        uint256 winningAmount = winningsMap[_lotteryId][msg.sender];
        require(winningAmount > 0, "No prize to claim");

        winningsMap[_lotteryId][msg.sender] = 0;
        tether.safeTransfer(msg.sender, winningAmount);

        emit PrizeClaimed(_lotteryId, msg.sender, winningAmount);
    }

    function getLotteryInfo(uint256 _lotteryId) 
        external 
        view 
        returns (LotteryStructs.LotteryInfo memory) 
    {
        return lotteries[_lotteryId];
    }

    function getUserEntries(uint256 _lotteryId, address _user) 
        external 
        view 
        returns (uint256) 
    {
        return entries[_lotteryId][_user];
    }

    function getUserWinnings(uint256 _lotteryId, address _user) 
        external 
        view 
        returns (uint256) 
    {
        return winningsMap[_lotteryId][_user];
    }

    function enableEmergencyMode() external onlyEmergencyAdmin {
        _emergencyMode = true;
        _pause();
    }

    function disableEmergencyMode() external onlyEmergencyAdmin {
        _emergencyMode = false;
        _unpause();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        require(!_emergencyMode, "Cannot unpause in emergency mode");
        _unpause();
    }
}