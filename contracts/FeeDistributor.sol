//SPDX-License-Identifier: Unlicense
pragma solidity >0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract FeeDistributor is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public agencyToken;
    address public devWallet;
    address public poolWallet;
    address public constant burnWallet = address(0x000000000000000000000000000000000000dEaD);

    uint public devAllocation = 30;
    uint public poolAllocation = 60;
    uint public burnAllocation = 10;
    uint public MAX_ALLOCATION = 100;

    uint public lockDuration = uint(90 days);
    uint public lastDistributed;

    mapping(address => bool) public whiteList;

    modifier checkLocked {
        require(lastDistributed.add(lockDuration) < block.timestamp, "still unavailable to distribute");
        _;
    }

    modifier checkWhiteList {
        require(whiteList[msg.sender] == true, "!permission");
        _;
    }

    constructor (
        address _devWallet,
        address _poolWallet
    ) public {
        devWallet = _devWallet;
        poolWallet = _poolWallet;
        lastDistributed = block.timestamp;
        whiteList[msg.sender] = true;
        whiteList[_devWallet] = true;
    }

    function distribute() external checkWhiteList checkLocked {
        require(agencyToken != address(0), "invalid agency token");

        uint curBal = IERC20(agencyToken).balanceOf(address(this));
        require(curBal > 0, "no balance");

        IERC20(agencyToken).safeTransfer(devWallet, curBal.mul(devAllocation).div(MAX_ALLOCATION));
        IERC20(agencyToken).safeTransfer(poolWallet, curBal.mul(poolAllocation).div(MAX_ALLOCATION));
        IERC20(agencyToken).safeTransfer(burnWallet, curBal.mul(burnAllocation).div(MAX_ALLOCATION));

        lastDistributed = block.timestamp;
    }

    function setAgencyToken(address _token) external onlyOwner {
        agencyToken = _token;
    }

    function setWhiteList(address _user, bool _flag) external onlyOwner {
        whiteList[_user] = _flag;
    }

    function setLockDuration(uint _duration) external onlyOwner {
        lockDuration = _duration;
    }

    function setAllocation(uint _devAllocation, uint _poolAllocation, uint _burnAllocation) external onlyOwner {
        require(_devAllocation+_poolAllocation+_burnAllocation == MAX_ALLOCATION, "invalid allocations");

        devAllocation = _devAllocation;
        poolAllocation = _poolAllocation;
        burnAllocation = _burnAllocation;
    }

    function emergencyWithdraw(uint _amount) external onlyOwner {
        require(agencyToken != address(0), "invalid agency token");

        uint curBal = IERC20(agencyToken).balanceOf(address(this));
        if (curBal < _amount) _amount = curBal;
        IERC20(agencyToken).safeTransfer(msg.sender, _amount);
    }
}