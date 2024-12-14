const hre = require("hardhat");

async function main() {
  try {
    const [signer] = await hre.ethers.getSigners();
    console.log("Getting test USDT for account:", signer.address);

    // First check if we have enough POL for gas
    const balance = await hre.ethers.provider.getBalance(signer.address);
    console.log("\nPOL Balance:", hre.ethers.formatEther(balance), "POL");

    if (balance < hre.ethers.parseEther("0.01")) {
      console.log("\nWarning: Low POL balance. Please get test POL first from:");
      console.log("https://faucet.polygon.technology/");
      process.exit(1);
    }

    // Deploy a new TestUSDT contract if one doesn't exist
    const TestUSDT = await hre.ethers.getContractFactory("TestUSDT");
    let usdt;
    
    const usdtAddress = process.env.AMOY_USDT_ADDRESS;
    if (!usdtAddress) {
      console.log("\nNo USDT address found in .env, deploying new TestUSDT contract...");
      usdt = await TestUSDT.deploy({
        maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
        maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei"),
        gasLimit: 5000000
      });
      await usdt.waitForDeployment();
      console.log("TestUSDT deployed to:", await usdt.getAddress());
      console.log("\nIMPORTANT: Update your .env file with:");
      console.log(`AMOY_USDT_ADDRESS=${await usdt.getAddress()}`);
    } else {
      console.log("\nUsing existing USDT contract at:", usdtAddress);
      usdt = TestUSDT.attach(usdtAddress);
    }

    // Check initial balance
    console.log("\nChecking initial balance...");
    const initialBalance = await usdt.balanceOf(signer.address);
    console.log("Initial USDT balance:", hre.ethers.formatUnits(initialBalance, 6));

    if (initialBalance >= hre.ethers.parseUnits("100", 6)) {
      console.log("\nYou already have sufficient test USDT!");
      return;
    }

    console.log("\nRequesting test USDT...");
    const tx = await usdt.faucet({
      gasLimit: 200000,
      maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
      maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei")
    });
    
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    await tx.wait();
    console.log("Transaction confirmed!");

    // Wait a bit for balance to update
    console.log("\nWaiting for balance to update...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check final balance
    const finalBalance = await usdt.balanceOf(signer.address);
    console.log("Final USDT balance:", hre.ethers.formatUnits(finalBalance, 6), "USDT");

    if (finalBalance > initialBalance) {
      console.log("\nSuccessfully received test USDT!");
      console.log("Amount received:", hre.ethers.formatUnits(finalBalance - initialBalance, 6), "USDT");
    } else {
      console.log("\nWarning: Balance did not increase. This could mean:");
      console.log("1. You already claimed test USDT recently");
      console.log("2. The faucet is temporarily out of funds");
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