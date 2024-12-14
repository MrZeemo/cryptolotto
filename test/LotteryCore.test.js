const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("LotteryCore", function () {
  let lottery, mockUSDT, mockVRF;
  let owner, user1, user2, emergencyAdmin;
  const USDT_DECIMALS = 6;

  beforeEach(async function () {
    [owner, user1, user2, emergencyAdmin] = await ethers.getSigners();

    // Deploy mock VRF Coordinator
    const MockVRFCoordinator = await ethers.getContractFactory("MockVRFCoordinatorV2");
    mockVRF = await MockVRFCoordinator.deploy();

    // Deploy mock USDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();

    // Deploy Lottery
    const LotteryCore = await ethers.getContractFactory("LotteryCore");
    lottery = await LotteryCore.deploy(
      await mockVRF.getAddress(),
      1234n, // subscriptionId
      "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f", // keyHash
      200000n, // callbackGasLimit
      await mockUSDT.getAddress()
    );

    await lottery.initialize();
    
    // Fund users with USDT
    const amount = ethers.parseUnits("10000", USDT_DECIMALS);
    await mockUSDT.transfer(user1.address, amount);
    await mockUSDT.transfer(user2.address, amount);
    
    // Approve USDT spending
    await mockUSDT.connect(user1).approve(await lottery.getAddress(), ethers.MaxUint256);
    await mockUSDT.connect(user2).approve(await lottery.getAddress(), ethers.MaxUint256);
  });

  describe("Initialization", function () {
    it("Should initialize with correct owner", async function () {
      expect(await lottery.owner()).to.equal(owner.address);
    });

    it("Should set correct USDT address", async function () {
      expect(await lottery.tether()).to.equal(await mockUSDT.getAddress());
    });
  });

  describe("Lottery Creation", function () {
    it("Should create lottery with valid parameters", async function () {
      const entryFee = ethers.parseUnits("1", USDT_DECIMALS);
      const targetPool = ethers.parseUnits("10000", USDT_DECIMALS);
      
      await expect(lottery.createLottery(entryFee, targetPool))
        .to.emit(lottery, "LotteryCreated")
        .withArgs(1n, entryFee, targetPool);

      const lotteryInfo = await lottery.getLotteryInfo(1);
      expect(lotteryInfo.entryFee).to.equal(entryFee);
      expect(lotteryInfo.targetPrizePool).to.equal(targetPool);
    });

    it("Should fail with invalid prize pool", async function () {
      const entryFee = ethers.parseUnits("1", USDT_DECIMALS);
      const invalidPool = ethers.parseUnits("20000", USDT_DECIMALS);
      
      await expect(lottery.createLottery(entryFee, invalidPool))
        .to.be.revertedWith("Invalid prize pool amount");
    });
  });

  describe("Lottery Entry", function () {
    beforeEach(async function () {
      await lottery.createLottery(
        ethers.parseUnits("1", USDT_DECIMALS),
        ethers.parseUnits("10000", USDT_DECIMALS)
      );
    });

    it("Should allow valid entry", async function () {
      await expect(lottery.connect(user1).enterLottery(1, 10))
        .to.emit(lottery, "LotteryEntered")
        .withArgs(1, user1.address, ethers.parseUnits("10", USDT_DECIMALS), 10n);
    });

    it("Should track user entries correctly", async function () {
      await lottery.connect(user1).enterLottery(1, 10);
      expect(await lottery.getUserEntries(1, user1.address)).to.equal(10);
    });

    it("Should emit ThresholdMet when threshold reached", async function () {
      const entries = 3400; // 34% of pool
      await expect(lottery.connect(user1).enterLottery(1, entries))
        .to.emit(lottery, "ThresholdMet");
    });
  });

  describe("Random Number Generation", function () {
    beforeEach(async function () {
      await lottery.createLottery(
        ethers.parseUnits("1", USDT_DECIMALS),
        ethers.parseUnits("10000", USDT_DECIMALS)
      );
      await lottery.connect(user1).enterLottery(1, 3400); // Meet threshold
    });

    it("Should request random words after deadline", async function () {
      await time.increase(24 * 60 * 60); // 24 hours
      await expect(lottery.requestRandomWords(1))
        .to.emit(lottery, "LotteryEnded");
    });

    it("Should fail before deadline", async function () {
      await expect(lottery.requestRandomWords(1))
        .to.be.revertedWith("Deadline not reached");
    });
  });

  describe("Prize Distribution", function () {
    beforeEach(async function () {
      await lottery.createLottery(
        ethers.parseUnits("1", USDT_DECIMALS),
        ethers.parseUnits("10000", USDT_DECIMALS)
      );
      await lottery.connect(user1).enterLottery(1, 10000);
      await time.increase(24 * 60 * 60);
      await lottery.requestRandomWords(1);
    });

    it("Should distribute prizes correctly", async function () {
      // Simulate VRF callback
      await mockVRF.fulfillRandomWords(0, [123456]);
      
      const winnings = await lottery.getUserWinnings(1, user1.address);
      expect(winnings).to.be.gt(0);
    });

    it("Should allow winners to claim prizes", async function () {
      await mockVRF.fulfillRandomWords(0, [123456]);
      
      const initialBalance = await mockUSDT.balanceOf(user1.address);
      await lottery.connect(user1).claimPrize(1);
      const finalBalance = await mockUSDT.balanceOf(user1.address);
      
      expect(finalBalance).to.be.gt(initialBalance);
    });
  });

  describe("Emergency Controls", function () {
    it("Should enable emergency mode", async function () {
      await lottery.setEmergencyAdmin(emergencyAdmin.address);
      await lottery.connect(emergencyAdmin).enableEmergencyMode();
      
      await expect(lottery.connect(user1).enterLottery(1, 10))
        .to.be.revertedWith("Emergency mode active");
    });

    it("Should allow emergency withdrawal", async function () {
      await lottery.setEmergencyAdmin(emergencyAdmin.address);
      await lottery.connect(emergencyAdmin).enableEmergencyMode();
      
      const balance = await mockUSDT.balanceOf(await lottery.getAddress());
      if (balance > 0) {
        await lottery.connect(emergencyAdmin).emergencyWithdraw();
        expect(await mockUSDT.balanceOf(await lottery.getAddress())).to.equal(0);
      }
    });
  });
});