//SPDX-License-Identifier: Unlicense
pragma solidity >0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "./interface/IBShibaNFT.sol";


contract BShibaStakingMVP is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;

    struct UserInfo {
        uint pendingReward;
        uint amount;
        uint lastDeposited;
    }

    struct Reward {
        address collectible;
        uint tokenId;
    }

    address[] public collectibles;
    mapping(address => UserInfo) public userInfo;
    EnumerableSet.AddressSet users;

    IERC20 public stakingToken;
    uint public totalSupply;
    uint public upTime;
    uint public expiration;
    uint public stakingUnit = uint(1e9) * 50000000000; // 50 billions (9 decimals)
    uint public lockupDuration = 7 days;

    uint public txFee = 0;
    uint public MAX_FEE = 10000;

    address public keeper;

    modifier checkUpTime {
        require(upTime > 0 && block.timestamp > upTime 
                && block.timestamp.sub(upTime) < expiration, 
                "!started or expired");
        _;
    }

    modifier checkAmount(uint _amount) {
        require(_amount >= stakingUnit, "Invalid amount");
        _;
    }

    modifier checkLocked {
        require(userInfo[msg.sender].lastDeposited > 0 
                && block.timestamp.sub(userInfo[msg.sender].lastDeposited) > lockupDuration,
                "Locked up");
        _;
    }

    modifier updateUserList {
        _;
        if (balanceOf(msg.sender) > 0) _checkOrAddUser(msg.sender);
        else _removeUser(msg.sender);
    }

    constructor(
        address _stakingToken,
        uint _expiration,
        uint _stakingUnit,
        uint _lockupDuration
    ) public {
        stakingToken = IERC20(_stakingToken);
        upTime = block.timestamp;
        expiration = _expiration;
        stakingUnit = _stakingUnit;
        lockupDuration = _lockupDuration;
    }

    function addCollectible(address _collectible) external onlyOwner {
        collectibles.push(_collectible);
    }

    function balanceOf(address _user) public view returns (uint) {
        return userInfo[_user].amount;
    }

    function updateReward(address _user) public {
        UserInfo storage user = userInfo[_user];
        if (user.lastDeposited == 0) {
            user.lastDeposited = block.timestamp;
            return;
        }

        if (lockupDuration == 0) {
            user.pendingReward += 1;
        } else {
            user.pendingReward += uint(user.amount / stakingUnit) * uint((block.timestamp - user.lastDeposited) / lockupDuration);
        }

        user.lastDeposited = block.timestamp;
    }

    function deposit(uint _amount) external checkAmount(_amount) updateUserList {
        updateReward(msg.sender);

        _amount -= _amount % stakingUnit; // Should be x times of stakingUnit
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        totalSupply += _amount;
        userInfo[msg.sender].amount += _amount;
    }

    function withdraw(uint _amount) public checkLocked checkAmount(_amount) updateUserList {
        updateReward(msg.sender);

        UserInfo storage user = userInfo[msg.sender];

        if (user.amount < _amount) _amount = user.amount;
        _amount -= _amount % stakingUnit; // Should be withdarwn x times of stakingUnit
        totalSupply -= _amount;
        user.amount -= _amount;

        _amount -= _amount.mul(txFee).div(MAX_FEE);
        if (stakingToken.balanceOf(address(this)) < _amount) _amount = stakingToken.balanceOf(address(this));

        stakingToken.safeTransfer(msg.sender, _amount);
    }

    function withdrawAll() external {
        withdraw(balanceOf(msg.sender));
    }

    function claim() external checkUpTime {
        require(collectibles.length > 0, "no collectibles");
        updateReward(msg.sender);

        uint mintedCount = 0;
        for (uint i = 0; i < userInfo[msg.sender].pendingReward; i++) {
            IBShibaNFT collectible = IBShibaNFT(collectibles[0]);
            if (collectible.left() > 0) {
                collectible.mintWithoutURI(msg.sender);
                mintedCount++;
            }
        }

        userInfo[msg.sender].pendingReward -= mintedCount;
    }

    function claimable(address _user) external view returns (uint) {
        UserInfo storage user = userInfo[_user];
        uint reward = 1;
        if (lockupDuration > 0) {
             reward = uint(user.amount / stakingUnit) * uint((block.timestamp - user.lastDeposited) / lockupDuration);
        }
        
        return user.pendingReward + reward;
    }

    function _removeUser(address _user) internal {
        if (users.contains(_user) == true) {
            users.remove(_user);
        }
    }

    function _checkOrAddUser(address _user) internal {
        if (users.contains(_user) == false) {
            users.add(_user);
        }
    }

    function userCount() external view returns (uint) {
        return users.length();
    }

    function setStakingToken(address _token) external onlyOwner {
        stakingToken = IERC20(_token);
    }

    function setExpiration(uint _expiration) external onlyOwner {
        expiration = _expiration;
    }

    function setStakingUnit(uint _unit) external onlyOwner {
        stakingUnit = _unit;
    }

    function setLockupDuration(uint _duration) external onlyOwner {
        lockupDuration = _duration;
    }

    function setTxFee(uint _fee) external onlyOwner {
        require(_fee < MAX_FEE, "Invalid fee");
        txFee = _fee;
    }
}