const hre = require("hardhat");
const { getContracts } = require("./utils/contracts");
const { enterLottery, approveUSDTSpending } = require("./utils/transactions");

async function main() {
  try {
    const [signer] = await hre.ethers.getSigners();
    console.log("Testing complete lottery flow with account:", signer.address);

    // Get contract instances
    const { lottery, usdt } = await getContracts(signer);

    // 1. Check initial state
    console.log("\n1. Checking initial state...");
    const currentLotteryId = await lottery.currentLotteryId();
    console.log("Current lottery ID:", currentLotteryId.toString());

    // 2. Create lottery if needed
    if (currentLotteryId === 0n) {
      console.log("\n2. Creating test lottery...");
      const tx = await lottery.createLottery(
        hre.ethers.parseUnits("1", 6),    // 1 USDT entry fee
        hre.ethers.parseUnits("10000", 6), // 10,000 USDT prize pool
        {
          maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
          maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei"),
          gasLimit: 500000
        }
      );
      await tx.wait();
      console.log("Lottery created successfully!");
    }

    // 3. Get lottery info
    const targetLotteryId = 1n;
    const lotteryInfo = await lottery.lotteries(targetLotteryId);
    
    console.log("\n3. Lottery details:");
    console.log("- Entry fee:", hre.ethers.formatUnits(lotteryInfo.entryFee, 6), "USDT");
    console.log("- Target prize pool:", hre.ethers.formatUnits(lotteryInfo.targetPrizePool, 6), "USDT");
    console.log("- Current prize pool:", hre.ethers.formatUnits(lotteryInfo.totalPrizePool, 6), "USDT");
    console.log("- Total entries:", lotteryInfo.totalEntries.toString());
    console.log("- Threshold amount:", hre.ethers.formatUnits(lotteryInfo.thresholdAmount, 6), "USDT");
    console.log("- Threshold met:", lotteryInfo.thresholdMet);
    console.log("- Lottery ended:", lotteryInfo.lotteryEnded);

    // 4. Check USDT balance
    const balance = await usdt.balanceOf(signer.address);
    console.log("\n4. USDT Balance:", hre.ethers.formatUnits(balance, 6), "USDT");

    // 5. Approve USDT spending if needed
    console.log("\n5. Approving USDT spending...");
    await approveUSDTSpending(usdt, await lottery.getAddress(), signer);

    // 6. Enter lottery
    const numEntries = 10000; // Test with 10,000 entries
    console.log(`\n6. Entering lottery with ${numEntries} entries...`);
    await enterLottery(lottery, targetLotteryId, numEntries);

    // 7. Check updated lottery state
    const updatedInfo = await lottery.lotteries(targetLotteryId);
    console.log("\n7. Updated lottery state:");
    console.log("- Total entries:", updatedInfo.totalEntries.toString());
    console.log("- Current prize pool:", hre.ethers.formatUnits(updatedInfo.totalPrizePool, 6), "USDT");
    console.log("- Threshold met:", updatedInfo.thresholdMet);

    // 8. Check if we can end the lottery
    if (updatedInfo.thresholdMet && !updatedInfo.lotteryEnded) {
      console.log("\n8. Threshold met! Requesting random words to select winners...");
      const tx = await lottery.requestRandomWords(targetLotteryId, {
        maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
        maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei"),
        gasLimit: 500000
      });
      
      console.log("Transaction hash:", tx.hash);
      await tx.wait();
      console.log("Lottery ended successfully!");
    }

    // 9. Check for winnings
    const winnings = await lottery.winningsMap(targetLotteryId, signer.address);
    if (winnings > 0n) {
      console.log("\n9. You won:", hre.ethers.formatUnits(winnings, 6), "USDT");
      
      // Claim prize
      console.log("Claiming prize...");
      const tx = await lottery.claimPrize(targetLotteryId, {
        maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
        maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei"),
        gasLimit: 300000
      });
      
      await tx.wait();
      console.log("Prize claimed successfully!");
    } else {
      console.log("\n9. No winnings found yet. This could mean:");
      console.log("- Winners haven't been selected yet");
      console.log("- You didn't win in this lottery");
      console.log("- The lottery hasn't ended");
    }

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