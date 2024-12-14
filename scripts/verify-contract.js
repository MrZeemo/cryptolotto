const hre = require("hardhat");

async function main() {
  const address = "0xA02f6adc7926efeBBd59Fd43A84f4E0c0c91e832";
  console.log("Checking contract at address:", address);

  const code = await hre.ethers.provider.getCode(address);
  console.log("\nContract bytecode:", code);
  
  if (code === "0x") {
    console.log("\nNo contract found at this address!");
    console.log("This means either:");
    console.log("1. The address is incorrect");
    console.log("2. The contract hasn't been deployed yet");
    console.log("3. The contract was deployed but has been removed");
  } else {
    console.log("\nContract exists at this address");
    console.log("Bytecode length:", (code.length - 2) / 2, "bytes");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });