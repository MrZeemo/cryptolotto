const hre = require("hardhat");

// Full ERC20 ABI including faucet function
const USDT_CONFIG = {
  address: process.env.AMOY_USDT_ADDRESS,
  abi: [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function faucet()"
  ]
};

// Complete Lottery ABI with all function signatures
const LOTTERY_CONFIG = {
  abi: [
    "function initialize() external",
    "function createLottery(uint256 _entryFee, uint256 _targetPrizePool) external",
    "function enterLottery(uint256 lotteryId, uint256 numEntries) external",
    "function requestRandomWords(uint256 _lotteryId) external",
    "function claimPrize(uint256 _lotteryId) external",
    "function pause() external",
    "function unpause() external",
    "function owner() view returns (address)",
    "function tether() view returns (address)",
    "function currentLotteryId() view returns (uint256)",
    "function lotteries(uint256) view returns (uint256 id, uint256 entryFee, uint256 targetPrizePool, uint256 totalPrizePool, uint256 thresholdAmount, bool thresholdMet, uint256 deadlineTime, bool lotteryEnded, bool prizeDistributed, uint256 totalEntries)",
    "function entries(uint256 lotteryId, address user) view returns (uint256)",
    "function winningsMap(uint256 lotteryId, address user) view returns (uint256)",
    "event LotteryCreated(uint256 indexed lotteryId, uint256 entryFee, uint256 targetPrizePool)",
    "event LotteryEntered(uint256 indexed lotteryId, address indexed player, uint256 amount, uint256 numEntries)",
    "event ThresholdMet(uint256 indexed lotteryId, uint256 thresholdAmount, uint256 deadlineTime)",
    "event LotteryEnded(uint256 indexed lotteryId, uint256 totalPrizePool)",
    "event WinnersSelected(uint256 indexed lotteryId, address[] winners)",
    "event PrizeClaimed(uint256 indexed lotteryId, address indexed winner, uint256 amount)",
    "event FeeCollected(uint256 indexed lotteryId, address indexed owner, uint256 amount)",
    "event PrizeDistributed(uint256 indexed lotteryId, uint256 prizePoolAfterFee)"
  ]
};

// Gas configuration for Polygon Amoy testnet
const GAS_CONFIG = {
  maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
  maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei")
};

async function getContracts(signer) {
  try {
    // Verify environment variables
    const lotteryAddress = process.env.LOTTERY_CONTRACT_ADDRESS;
    const usdtAddress = process.env.AMOY_USDT_ADDRESS;

    if (!lotteryAddress) {
      throw new Error("LOTTERY_CONTRACT_ADDRESS not set in .env file");
    }
    if (!usdtAddress) {
      throw new Error("AMOY_USDT_ADDRESS not set in .env file");
    }

    console.log("\nInitializing contracts with addresses:");
    console.log("- USDT:", usdtAddress);
    console.log("- Lottery:", lotteryAddress);

    // Get USDT contract instance
    const usdt = new hre.ethers.Contract(
      usdtAddress,
      USDT_CONFIG.abi,
      signer
    );

    // Get Lottery contract instance
    const lottery = new hre.ethers.Contract(
      lotteryAddress,
      LOTTERY_CONFIG.abi,
      signer
    );

    // Verify contracts are deployed
    console.log("\nVerifying contract deployments...");
    
    const code = await signer.provider.getCode(usdtAddress);
    if (code === "0x") {
      throw new Error("USDT contract not deployed at specified address");
    }
    console.log("✓ USDT contract verified");

    const lotteryCode = await signer.provider.getCode(lotteryAddress);
    if (lotteryCode === "0x") {
      throw new Error("Lottery contract not deployed at specified address");
    }
    console.log("✓ Lottery contract verified");

    // Get USDT decimals with retry
    let decimals = 6; // Default to 6 for USDT
    try {
      for (let i = 0; i < 3; i++) {
        try {
          decimals = await usdt.decimals();
          console.log("\nUSDT decimals:", decimals);
          break;
        } catch (e) {
          if (i === 2) console.log("Warning: Failed to get decimals, using default:", decimals);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    } catch (error) {
      console.log("Warning: Failed to get decimals, using default:", decimals);
    }

    // Verify lottery contract USDT address
    try {
      const tetherAddress = await lottery.tether();
      if (tetherAddress.toLowerCase() !== usdtAddress.toLowerCase()) {
        console.warn("\nWarning: Lottery contract USDT address mismatch!");
        console.warn("Expected:", usdtAddress);
        console.warn("Got:", tetherAddress);
      } else {
        console.log("✓ Lottery USDT address verified");
      }
    } catch (error) {
      console.warn("\nWarning: Could not verify lottery USDT address");
    }

    // Get current lottery ID
    try {
      const currentLotteryId = await lottery.currentLotteryId();
      console.log("\nCurrent lottery ID:", currentLotteryId.toString());
      
      // Get lottery info if ID exists
      if (currentLotteryId > 0) {
        const lotteryInfo = await lottery.lotteries(1);
        console.log("Lottery #1 info:", {
          entryFee: lotteryInfo.entryFee.toString(),
          targetPrizePool: lotteryInfo.targetPrizePool.toString()
        });
      }
    } catch (error) {
      console.warn("\nWarning: Could not get lottery information");
    }

    return { usdt, lottery, decimals };
  } catch (error) {
    throw new Error(`Contract initialization failed: ${error.message}`);
  }
}

module.exports = {
  getContracts,
  GAS_CONFIG,
  USDT_CONFIG,
  LOTTERY_CONFIG
};