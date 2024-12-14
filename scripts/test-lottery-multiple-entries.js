const hre = require("hardhat");
const { getContracts } = require("./utils/contracts");
const { enterLottery, approveUSDTSpending } = require("./utils/transactions");

async function main() {
  try {
    const [signer] = await hre.ethers.getSigners();
    console.log("Testing multiple lottery entries with account:", signer.address);

    // Get contract instances
    const { lottery, usdt } = await getContracts(signer);

    // First create the lotteries if they don't exist
    const currentLotteryId = await lottery.currentLotteryId();
    
    if (currentLotteryId === 0n) {
      console.log("\nCreating lotteries...");
      
      // Create Lottery #1: 1 USDT entry fee, 10,000 USDT prize pool
      console.log("\nCreating Lottery #1 (10,000 USDT pool)...");
      let tx = await lottery.createLottery(
        hre.ethers.parseUnits("1", 6),    // 1 USDT entry fee
        hre.ethers.parseUnits("10000", 6), // 10,000 USDT prize pool
        {
          maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
          maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei"),
          gasLimit: 500000
        }
      );
      await tx.wait();
      console.log("Lottery #1 created!");

      // Create Lottery #2: 1 USDT entry fee, 100,000 USDT prize pool
      console.log("\nCreating Lottery #2 (100,000 USDT pool)...");
      tx = await lottery.createLottery(
        hre.ethers.parseUnits("1", 6),     // 1 USDT entry fee
        hre.ethers.parseUnits("100000", 6), // 100,000 USDT prize pool
        {
          maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
          maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei"),
          gasLimit: 500000
        }
      );
      await tx.wait();
      console.log("Lottery #2 created!");

      // Create Lottery #3: 1 USDT entry fee, 1,000,000 USDT prize pool
      console.log("\nCreating Lottery #3 (1,000,000 USDT pool)...");
      tx = await lottery.createLottery(
        hre.ethers.parseUnits("1", 6),      // 1 USDT entry fee
        hre.ethers.parseUnits("1000000", 6), // 1,000,000 USDT prize pool
        {
          maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
          maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei"),
          gasLimit: 500000
        }
      );
      await tx.wait();
      console.log("Lottery #3 created!");
    }

    // Get current lottery info after creation
    const updatedLotteryId = await lottery.currentLotteryId();
    console.log("\nCurrent lottery ID:", updatedLotteryId.toString());

    // Let's enter Lottery #1 (smallest pool) with 10,000 entries
    const targetLotteryId = 1n;
    const lotteryInfo = await lottery.lotteries(targetLotteryId);
    
    console.log("\nTarget lottery info:");
    console.log("- Entry fee:", hre.ethers.formatUnits(lotteryInfo.entryFee, 6), "USDT");
    console.log("- Target prize pool:", hre.ethers.formatUnits(lotteryInfo.targetPrizePool, 6), "USDT");
    console.log("- Current prize pool:", hre.ethers.formatUnits(lotteryInfo.totalPrizePool, 6), "USDT");
    console.log("- Total entries:", lotteryInfo.totalEntries.toString());
    console.log("- Threshold amount:", hre.ethers.formatUnits(lotteryInfo.thresholdAmount, 6), "USDT");

    // Approve USDT spending
    console.log("\nApproving USDT spending...");
    await approveUSDTSpending(usdt, await lottery.getAddress(), signer);

    // Enter with multiple entries
    const numEntries = 10000; // Enter with 10,000 entries
    console.log(`\nEntering lottery with ${numEntries} entries...`);

    // Enter lottery
    await enterLottery(lottery, targetLotteryId, numEntries);

    // Get updated lottery info
    const updatedInfo = await lottery.lotteries(targetLotteryId);
    console.log("\nUpdated lottery info:");
    console.log("- Total entries:", updatedInfo.totalEntries.toString());
    console.log("- Current prize pool:", hre.ethers.formatUnits(updatedInfo.totalPrizePool, 6), "USDT");
    console.log("- Threshold met:", updatedInfo.thresholdMet);
    
    if (updatedInfo.thresholdMet) {
      console.log("- Deadline time:", new Date(Number(updatedInfo.deadlineTime) * 1000).toLocaleString());
    }

    // Get user entries
    const userEntries = await lottery.entries(targetLotteryId, signer.address);
    console.log("\nYour total entries:", userEntries.toString());

    // Calculate percentage of pool
    const percentage = (Number(userEntries) / Number(updatedInfo.totalEntries)) * 100;
    console.log("Your percentage of total entries:", percentage.toFixed(2) + "%");

  } catch (error) {
    console.error("\nError details:", {
      message: error.message,
      code: error.code,
      data: error.data,
      transaction: error.transaction
    });
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });