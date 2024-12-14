const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing lottery with account:", deployer.address);

  // Get the deployed lottery contract
  const lotteryAddress = process.env.LOTTERY_CONTRACT_ADDRESS;
  if (!lotteryAddress) {
    throw new Error("LOTTERY_CONTRACT_ADDRESS not set in .env file");
  }

  const Lottery = await hre.ethers.getContractFactory("Lottery");
  const lottery = Lottery.attach(lotteryAddress);

  console.log("\nCreating lotteries...");

  // Lottery 1: 1 USDT entry fee, 10,000 USDT prize pool
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

  // Lottery 2: 1 USDT entry fee, 100,000 USDT prize pool
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

  // Lottery 3: 1 USDT entry fee, 1,000,000 USDT prize pool
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

  // Get current lottery ID
  const currentLotteryId = await lottery.currentLotteryId();
  console.log("\nTotal lotteries created:", currentLotteryId.toString());

  // Display details for all lotteries
  console.log("\nLottery Details:");
  for (let i = 1; i <= currentLotteryId; i++) {
    const lotteryInfo = await lottery.lotteries(i);
    console.log(`\nLottery #${i}:`);
    console.log("Entry Fee:", hre.ethers.formatUnits(lotteryInfo.entryFee, 6), "USDT");
    console.log("Target Prize Pool:", hre.ethers.formatUnits(lotteryInfo.targetPrizePool, 6), "USDT");
    console.log("Threshold Amount:", hre.ethers.formatUnits(lotteryInfo.thresholdAmount, 6), "USDT");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });