//SPDX-License-Identifier: Unlicense
pragma solidity >0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract BShibaToAgency is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable agency;
    address public immutable bshiba;
    uint public bshibaDecimals = 9;
    uint public swapRate = 2000000; // 2M
    uint public txFee;
    uint public constant MAX_FEE = 10000;
    address public constant burnAddress = address(0x000000000000000000000000000000000000dEaD);

    constructor (address _agency, address _bshiba) public {
        agency = _agency;
        bshiba = _bshiba;
    }

    function swap(uint _amount) external {
        uint curBal = IERC20(agency).balanceOf(address(this));
        uint toAmount = _amount.mul(MAX_FEE-txFee).div(MAX_FEE).mul(18-bshibaDecimals).div(swapRate);
        
        require(toAmount <= curBal, "insufficient balance");

        IERC20(bshiba).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(agency).safeTransfer(msg.sender, toAmount);

        uint bshibaBal = IERC20(bshiba).balanceOf(address(this));
        IERC20(bshiba).safeTransfer(burnAddress, bshibaBal);
    }

    function setTxFee(uint _fee) external onlyOwner {
        require(_fee < MAX_FEE, "!fee");
        txFee = _fee;
    }

    function setBShibaDecimals(uint _decimals) external onlyOwner {
        require(_decimals >= 3 && _decimals <= 18, "!decimals");
        bshibaDecimals = _decimals;
    }

    function setSwapRate(uint _rate) external onlyOwner {
        require(_rate > 0, "!rate");
        swapRate = _rate;
    }

    function withdraw(uint _amount) external onlyOwner {
        uint curBal = IERC20(agency).balanceOf(address(this));
        require(_amount <= curBal, "insufficient balance");
        IERC20(agency).safeTransfer(msg.sender, _amount);
    }
}