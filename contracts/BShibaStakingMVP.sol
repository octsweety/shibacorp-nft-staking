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
        uint points;
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
    mapping(address => Reward[]) public rewards;

    IERC20 public stakingToken;
    uint public totalSupply;
    uint public upTime;
    uint public expiration;
    uint public stakingUnit = uint(1e9) * 50000000000; // 50 billions (9 decimals)
    uint public lockupDuration = 7 days;

    address public feeRecipient;
    uint public withdrawalFee;
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

    modifier onlyKeeper {
        require(msg.sender == keeper || msg.sender == owner(), "!keeper");
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
        feeRecipient = msg.sender;
        keeper = msg.sender;
    }

    function addCollectible(address _collectible) external onlyKeeper {
        collectibles.push(_collectible);
    }

    function balanceOf(address _user) public view returns (uint) {
        return userInfo[_user].amount;
    }

    function deposit(uint _amount) external checkAmount(_amount) updateUserList {
        _amount -= _amount % stakingUnit; // Should be x times of stakingUnit
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        totalSupply += _amount;
        userInfo[msg.sender].amount += _amount;
        userInfo[msg.sender].lastDeposited = block.timestamp;
    }

    function withdraw(uint _amount) public checkLocked checkAmount(_amount) updateUserList {
        UserInfo storage user = userInfo[msg.sender];

        if (user.amount < _amount) _amount = user.amount;
        _amount -= _amount % stakingUnit; // Should be withdarwn x times of stakingUnit
        totalSupply -= _amount;
        user.amount -= _amount;
        user.lastDeposited = block.timestamp;

        stakingToken.safeTransfer(msg.sender, _amount);
    }

    function withdrawAll() external {
        withdraw(balanceOf(msg.sender));
    }

    function claim() external checkUpTime {
        require(collectibles.length > 0, "no collectibles");
        require (userInfo[msg.sender].lastDeposited > 0 &&
                block.timestamp - userInfo[msg.sender].lastDeposited >= lockupDuration, "unavailable to claim");

        for (uint i = 0; i < userInfo[msg.sender].amount/stakingUnit; i++) {
            IBShibaNFT collectible = IBShibaNFT(collectibles[0]);
            collectible.mintWithoutURI(msg.sender);
        }

        userInfo[msg.sender].lastDeposited = block.timestamp;
    }

    function claimable(address _user) external view returns (uint) {
        if (userInfo[msg.sender].lastDeposited > 0 && block.timestamp - userInfo[msg.sender].lastDeposited >= lockupDuration) {
            return userInfo[_user].amount/stakingUnit;
        }

        return 0;
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

    function setUpTime(uint _time) external onlyOwner {
        upTime = _time;
    }

    function setWithdarwalFee(uint _fee) external onlyOwner {
        require(_fee < MAX_FEE, "Invalid fee");
        withdrawalFee = _fee;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        feeRecipient = _recipient;
    }

    function setKeeper(address _keeper) external onlyOwner {
        keeper = _keeper;
    }

    function pause() external onlyOwner {
        upTime = 0;
    }
}