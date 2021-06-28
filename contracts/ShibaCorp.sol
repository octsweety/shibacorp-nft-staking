//Contract based on https://docs.openzeppelin.com/contracts/3.x/erc721
// SPDX-License-Identifier: MIT
pragma solidity >0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ShibaCorp is ERC20, Ownable {
    using Address for address;
    using SafeMath for uint256;

    uint256 public initialSupply = uint256(1000000 ether); // 1,000,000 * 1e9 (9 decimals)

    constructor() 
        ERC20("Shiba Corp", "BSHIBA")
    {
        _setupDecimals(9);
        _mint(msg.sender, initialSupply);
    }
}