const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Lottery", function () {
  let lottery, mockUSDT, mockVRF;
  let owner, user1, user2;
  const USDT_DECIMALS = 6;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock VRF Coordinator
    const MockVRFCoordinator = await ethers.getContractFactory("MockVRFCoordinatorV2");
    mockVRF = await MockVRFCoordinator.deploy();

    // Deploy mock USDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();

    // Deploy Lottery with explicit path
    const Lottery = await ethers.getContractFactory("contracts/Lottery.sol:Lottery");
    lottery = await Lottery.deploy(
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

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await lottery.owner()).to.equal(owner.address);
    });

    it("Should set the correct USDT address", async function () {
      expect(await lottery.tether()).to.equal(await mockUSDT.getAddress());
    });
  });

  describe("Create Lottery", function () {
    it("Should create a new lottery", async function () {
      const entryFee = ethers.parseUnits("1", USDT_DECIMALS);
      const targetPool = ethers.parseUnits("10000", USDT_DECIMALS);
      
      await expect(lottery.createLottery(entryFee, targetPool))
        .to.emit(lottery, "LotteryCreated")
        .withArgs(1n, entryFee, targetPool);
    });

    it("Should fail to create a lottery with zero entry fee", async function () {
      await expect(lottery.createLottery(0, ethers.parseUnits("10000", USDT_DECIMALS)))
        .to.be.revertedWith("Entry fee must be greater than zero");
    });

    it("Should fail to create a lottery with zero target prize pool", async function () {
      await expect(lottery.createLottery(ethers.parseUnits("1", USDT_DECIMALS), 0))
        .to.be.revertedWith("Target prize pool must be greater than zero");
    });
  });

  // Add more test cases as needed
});