// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestUSDT is ERC20 {
    constructor() ERC20("Test USDT", "tUSDT") {
        _mint(msg.sender, 1000000 * 10**6); // Mint 1M USDT to deployer
    }

    function decimals() public pure override returns (uint8) {
        return 6; // USDT uses 6 decimals
    }

    function faucet() external {
        _mint(msg.sender, 1000 * 10**6); // Give 1000 USDT to caller
    }
}