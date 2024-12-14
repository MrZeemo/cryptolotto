const hre = require("hardhat");
const { GAS_CONFIG } = require("./contracts");

async function requestTestUSDT(usdt, signer) {
  try {
    console.log("\nRequesting test USDT...");
    
    // Use faucet function for Amoy testnet
    const tx = await usdt.faucet({
      ...GAS_CONFIG,
      gasLimit: 200000
    });
    
    console.log("Faucet transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    if (!receipt.status) {
      throw new Error("Faucet transaction failed");
    }
    console.log("Received test USDT!");
    
    // Wait for balance update
    console.log("Waiting for balance update...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify balance update
    const balance = await usdt.balanceOf(signer.address);
    console.log("New balance:", hre.ethers.formatUnits(balance, 6), "USDT");
  } catch (error) {
    console.log("\nWarning: Failed to get test USDT");
    console.log("Error:", error.message);
    if (error.receipt) {
      console.log("Transaction receipt:", error.receipt);
    }
    throw error;
  }
}

async function approveUSDTSpending(usdt, spenderAddress, signer) {
  if (!spenderAddress) {
    throw new Error("Spender address is required for approval");
  }

  try {
    console.log("\nApproving USDT spending for address:", spenderAddress);
    
    // Check current allowance first
    const currentAllowance = await usdt.allowance(signer.address, spenderAddress);
    if (currentAllowance > 0) {
      console.log("Current allowance:", hre.ethers.formatUnits(currentAllowance, 6), "USDT");
      return;
    }
    
    const tx = await usdt.approve(
      spenderAddress,
      hre.ethers.MaxUint256,
      {
        ...GAS_CONFIG,
        gasLimit: 200000
      }
    );
    
    console.log("Approval transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    if (!receipt.status) {
      throw new Error("Approval transaction failed");
    }
    console.log("USDT spending approved!");

    // Verify approval
    const newAllowance = await usdt.allowance(signer.address, spenderAddress);
    console.log("New allowance:", hre.ethers.formatUnits(newAllowance, 6), "USDT");
  } catch (error) {
    throw new Error(`Failed to approve USDT spending: ${error.message}`);
  }
}

async function enterLottery(lottery, lotteryId, numEntries) {
  try {
    // Get signer from contract
    const signer = lottery.runner;
    if (!signer) {
      throw new Error("No signer available on lottery contract");
    }

    // Verify lottery exists and get details
    console.log("\nVerifying lottery details...");
    const lotteryInfo = await lottery.lotteries(lotteryId);
    console.log("Lottery info:", {
      entryFee: hre.ethers.formatUnits(lotteryInfo.entryFee, 6),
      targetPrizePool: hre.ethers.formatUnits(lotteryInfo.targetPrizePool, 6),
      totalPrizePool: hre.ethers.formatUnits(lotteryInfo.totalPrizePool, 6),
      totalEntries: lotteryInfo.totalEntries.toString(),
      lotteryEnded: lotteryInfo.lotteryEnded,
      thresholdMet: lotteryInfo.thresholdMet
    });

    if (!lotteryInfo || lotteryInfo.entryFee === 0n) {
      throw new Error(`Lottery #${lotteryId} does not exist or is invalid`);
    }

    if (lotteryInfo.lotteryEnded) {
      throw new Error(`Lottery #${lotteryId} has already ended`);
    }

    const totalCost = lotteryInfo.entryFee * BigInt(numEntries);
    console.log(`Total cost for ${numEntries} entries:`, hre.ethers.formatUnits(totalCost, 6), "USDT");

    // Verify USDT balance and allowance
    const tetherAddress = await lottery.tether();
    const tether = new hre.ethers.Contract(
      tetherAddress,
      ["function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"],
      signer
    );

    const balance = await tether.balanceOf(signer.address);
    console.log("Current USDT balance:", hre.ethers.formatUnits(balance, 6));
    if (balance < totalCost) {
      throw new Error(`Insufficient USDT balance. Need ${hre.ethers.formatUnits(totalCost, 6)} but have ${hre.ethers.formatUnits(balance, 6)}`);
    }

    const allowance = await tether.allowance(signer.address, await lottery.getAddress());
    console.log("Current USDT allowance:", hre.ethers.formatUnits(allowance, 6));
    if (allowance < totalCost) {
      throw new Error(`Insufficient USDT allowance. Need ${hre.ethers.formatUnits(totalCost, 6)} but have ${hre.ethers.formatUnits(allowance, 6)}`);
    }

    console.log(`\nEntering Lottery #${lotteryId}...`);
    console.log(`Entering with ${numEntries} entries...`);
    
    // Estimate gas first
    const gasEstimate = await lottery.enterLottery.estimateGas(
      lotteryId,
      numEntries,
      {
        ...GAS_CONFIG
      }
    );
    console.log("Estimated gas:", gasEstimate.toString());
    
    const tx = await lottery.enterLottery(
      lotteryId,
      numEntries,
      {
        ...GAS_CONFIG,
        gasLimit: Math.floor(Number(gasEstimate) * 1.2) // Add 20% buffer
      }
    );
    
    console.log("Entry transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    if (!receipt.status) {
      throw new Error("Entry transaction failed");
    }
    console.log("Entered successfully!");

    // Verify entry was recorded
    const entries = await lottery.entries(lotteryId, signer.address);
    console.log("Verified entries:", entries.toString());

    // Get updated lottery info
    const updatedInfo = await lottery.lotteries(lotteryId);
    console.log("\nUpdated lottery info:", {
      totalEntries: updatedInfo.totalEntries.toString(),
      totalPrizePool: hre.ethers.formatUnits(updatedInfo.totalPrizePool, 6),
      thresholdMet: updatedInfo.thresholdMet
    });

    return receipt;
  } catch (error) {
    console.error("\nDetailed error information:");
    console.error("- Message:", error.message);
    if (error.receipt) {
      console.error("- Transaction receipt:", {
        status: error.receipt.status,
        gasUsed: error.receipt.gasUsed.toString(),
        blockNumber: error.receipt.blockNumber,
        logs: error.receipt.logs
      });
    }
    if (error.transaction) {
      console.error("- Transaction:", {
        from: error.transaction.from,
        to: error.transaction.to,
        data: error.transaction.data,
        value: error.transaction.value
      });
    }
    throw new Error(`Failed to enter lottery: ${error.message}`);
  }
}

module.exports = {
  requestTestUSDT,
  approveUSDTSpending,
  enterLottery
};