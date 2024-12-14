const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying Lottery contract with account:", deployer.address);

  // Check deployer balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("\nDeployer balance:", hre.ethers.formatEther(balance), "POL");

  if (balance < hre.ethers.parseEther("0.5")) {
    console.log("\nWarning: Low POL balance. Please get more POL from the faucet:");
    console.log("https://faucet.polygon.technology/");
    process.exit(1);
  }

  // Verify environment variables
  if (!process.env.CHAINLINK_VRF_SUBSCRIPTION_ID) {
    throw new Error("CHAINLINK_VRF_SUBSCRIPTION_ID not set in .env file");
  }
  if (!process.env.AMOY_USDT_ADDRESS) {
    throw new Error("AMOY_USDT_ADDRESS not set in .env file");
  }

  // Parse subscription ID - handle both decimal and hex formats
  let subscriptionId;
  try {
    const subId = process.env.CHAINLINK_VRF_SUBSCRIPTION_ID;
    // Remove any non-numeric characters and take first 10 digits
    const cleanedId = subId.replace(/[^0-9]/g, '').slice(0, 10);
    subscriptionId = BigInt(cleanedId);
  } catch (error) {
    console.error("Invalid subscription ID:", error.message);
    process.exit(1);
  }

  // Polygon Amoy testnet addresses and config
  const vrfCoordinator = "0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed";
  const tetherAddress = process.env.AMOY_USDT_ADDRESS;
  const keyHash = "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f";
  const callbackGasLimit = 2500000;

  console.log("\nDeployment Configuration:");
  console.log("- VRF Coordinator:", vrfCoordinator);
  console.log("- USDT Address:", tetherAddress);
  console.log("- VRF Subscription ID:", subscriptionId.toString());
  console.log("- Key Hash:", keyHash);
  console.log("- Callback Gas Limit:", callbackGasLimit);

  // Get current gas prices
  const feeData = await hre.ethers.provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas || hre.ethers.parseUnits("100", "gwei");
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || hre.ethers.parseUnits("30", "gwei");

  // Deploy Lottery contract with optimized gas settings
  console.log("\nDeploying Lottery contract...");
  const Lottery = await hre.ethers.getContractFactory("Lottery");
  const lottery = await Lottery.deploy(
    vrfCoordinator,
    subscriptionId,
    keyHash,
    callbackGasLimit,
    tetherAddress,
    {
      gasLimit: 5000000,
      maxFeePerGas: maxFeePerGas * 2n, // Double the current gas price to ensure it goes through
      maxPriorityFeePerGas: maxPriorityFeePerGas * 2n
    }
  );

  await lottery.waitForDeployment();
  const lotteryAddress = await lottery.getAddress();
  console.log("Lottery deployed to:", lotteryAddress);

  // Initialize the lottery with optimized gas settings
  console.log("\nInitializing lottery...");
  const tx = await lottery.initialize({
    gasLimit: 200000,
    maxFeePerGas: maxFeePerGas * 2n,
    maxPriorityFeePerGas: maxPriorityFeePerGas * 2n
  });
  await tx.wait();
  console.log("Lottery initialized");

  console.log("\nIMPORTANT: Update your .env file with:");
  console.log(`LOTTERY_CONTRACT_ADDRESS=${lotteryAddress}`);

  console.log("\nIMPORTANT NEXT STEPS:");
  console.log("1. Go to https://vrf.chain.link");
  console.log("2. Find your subscription");
  console.log("3. Add the lottery contract as a consumer with address:", lotteryAddress);

  // Verify contract if we have an API key
  if (process.env.POLYGONSCAN_API_KEY) {
    console.log("\nWaiting for 5 block confirmations before verification...");
    await tx.wait(5);

    console.log("Verifying contract on Polygonscan...");
    try {
      await hre.run("verify:verify", {
        address: lotteryAddress,
        constructorArguments: [
          vrfCoordinator,
          subscriptionId,
          keyHash,
          callbackGasLimit,
          tetherAddress
        ],
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }

  return lotteryAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });