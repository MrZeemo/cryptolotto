const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log("Getting test POL for account:", process.env.WALLET_ADDRESS);

  // First check balance
  const balance = await hre.ethers.provider.getBalance(process.env.WALLET_ADDRESS);
  console.log("Current POL balance:", hre.ethers.formatEther(balance));

  if (balance > 0) {
    console.log("\nYou already have POL! No need to request more.");
    console.log("You can now run:");
    console.log("npx hardhat run scripts/get-test-usdt.js --network amoy");
    return;
  }

  console.log("\nTo get test POL:");
  console.log("1. Go to https://faucet.polygon.technology/");
  console.log("2. Select 'Amoy Testnet'");
  console.log("3. Enter your wallet address:", process.env.WALLET_ADDRESS);
  console.log("4. Complete the captcha and request tokens");
  console.log("\nAfter receiving POL, run:");
  console.log("npx hardhat run scripts/get-test-usdt.js --network amoy");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });