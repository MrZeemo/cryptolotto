const hre = require("hardhat");

async function main() {
  try {
    const [signer] = await hre.ethers.getSigners();
    console.log("Testing lottery entries with account:", signer.address);

    // Verify environment variables
    if (!process.env.LOTTERY_CONTRACT_ADDRESS) {
      throw new Error("LOTTERY_CONTRACT_ADDRESS not set in .env file");
    }
    if (!process.env.AMOY_USDT_ADDRESS) {
      throw new Error("AMOY_USDT_ADDRESS not set in .env file");
    }

    // Get contract instances
    console.log("\nInitializing contracts...");
    
    const USDT = await hre.ethers.getContractFactory("MockUSDT");
    const usdt = USDT.attach(process.env.AMOY_USDT_ADDRESS);
    
    const Lottery = await hre.ethers.getContractFactory("Lottery");
    const lottery = Lottery.attach(process.env.LOTTERY_CONTRACT_ADDRESS);

    console.log("\nContract addresses:");
    console.log("- USDT:", await usdt.getAddress());
    console.log("- Lottery:", await lottery.getAddress());

    // Verify contracts are deployed
    console.log("\nVerifying contract deployments...");
    
    const usdtCode = await hre.ethers.provider.getCode(process.env.AMOY_USDT_ADDRESS);
    if (usdtCode === "0x") {
      throw new Error("USDT contract not deployed at specified address");
    }
    console.log("✓ USDT contract verified");

    const lotteryCode = await hre.ethers.provider.getCode(process.env.LOTTERY_CONTRACT_ADDRESS);
    if (lotteryCode === "0x") {
      throw new Error("Lottery contract not deployed at specified address");
    }
    console.log("✓ Lottery contract verified");

    // Check USDT balance
    const balance = await usdt.balanceOf(signer.address);
    console.log("\nUSDT Balance:", hre.ethers.formatUnits(balance, 6), "USDT");

    // Check if we need test USDT
    if (balance < hre.ethers.parseUnits("100", 6)) {
      console.log("\nRequesting test USDT...");
      const faucetTx = await usdt.faucet({
        maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
        maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei"),
        gasLimit: 100000
      });
      await faucetTx.wait();
      console.log("✓ Received test USDT");
    }

    // Approve USDT spending
    console.log("\nApproving USDT spending...");
    const approveTx = await usdt.approve(
      lottery.getAddress(),
      hre.ethers.MaxUint256,
      {
        maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
        maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei"),
        gasLimit: 100000
      }
    );
    await approveTx.wait();
    console.log("✓ USDT spending approved");

    // Get current lottery info
    const currentLotteryId = await lottery.currentLotteryId();
    console.log("\nCurrent lottery ID:", currentLotteryId.toString());

    if (currentLotteryId === 0n) {
      throw new Error("No active lotteries found");
    }

    const lotteryInfo = await lottery.lotteries(currentLotteryId);
    console.log("\nLottery info:");
    console.log("- Entry fee:", hre.ethers.formatUnits(lotteryInfo.entryFee, 6), "USDT");
    console.log("- Target prize pool:", hre.ethers.formatUnits(lotteryInfo.targetPrizePool, 6), "USDT");
    console.log("- Current prize pool:", hre.ethers.formatUnits(lotteryInfo.totalPrizePool, 6), "USDT");
    console.log("- Total entries:", lotteryInfo.totalEntries.toString());

    // Enter lottery
    console.log("\nEntering lottery...");
    const enterTx = await lottery.enterLottery(currentLotteryId, 1, {
      maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
      maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei"),
      gasLimit: 500000
    });
    
    console.log("Transaction hash:", enterTx.hash);
    await enterTx.wait();
    console.log("✓ Successfully entered lottery");

    // Get updated entry count
    const entries = await lottery.entries(currentLotteryId, signer.address);
    console.log("\nYour total entries:", entries.toString());

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