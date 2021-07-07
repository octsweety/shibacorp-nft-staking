//SPDX-License-Identifier: Unlicense
pragma solidity >0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interface/IBShibaNFT.sol";


contract BShibaStaking is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;

    struct UserInfo {
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
    mapping(uint => address) private deposits;
    mapping(address => EnumerableSet.UintSet) private userDeposits;
    EnumerableSet.UintSet candidates;
    EnumerableSet.UintSet workset;
    EnumerableSet.AddressSet winners;

    IERC20 public stakingToken;
    uint public totalSupply;
    uint public upTime;
    uint public expiration;
    uint public stakingUnit = uint(1e9) * 50000000000; // 50 billions (9 decimals)
    uint public lockupDuration = 7 days;

    address public feeRecipient;
    uint public withdrawalFee;
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
        uint _upTime,
        uint _expiration,
        uint _stakingUnit,
        uint _lockupDuration
    ) public {
        stakingToken = IERC20(_stakingToken);
        upTime = _upTime;
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

    function deposit(uint _amount) external nonReentrant checkAmount(_amount) updateUserList {
        _amount -= _amount % stakingUnit; // Should be x times of stakingUnit
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        totalSupply += _amount;
        userInfo[msg.sender].amount += _amount;
        userInfo[msg.sender].lastDeposited = block.timestamp;

        for (uint i = 0; i < _amount/stakingUnit; i++) {
            uint lastIndex = candidates.length() == 0 ? 0 : (candidates.at(candidates.length()-1) + 1);
            candidates.add(lastIndex);
            deposits[lastIndex] = msg.sender;
            userDeposits[msg.sender].add(lastIndex);
        }
    }

    function withdraw(uint _amount) public checkLocked checkAmount(_amount) updateUserList {
        UserInfo storage user = userInfo[msg.sender];

        if (user.amount < _amount) _amount = user.amount;
        _amount -= _amount % stakingUnit; // Should be withdarwn x times of stakingUnit
        totalSupply -= _amount;
        user.amount -= _amount;
        user.lastDeposited = block.timestamp;

        for (uint i = 0; i < _amount/stakingUnit; i++) {
            if (userDeposits[msg.sender].length() == 0) break;

            uint index = userDeposits[msg.sender].at(0);
            userDeposits[msg.sender].remove(index);
            delete deposits[index];
            if (candidates.contains(index)) candidates.remove(index);
        }

        
        if (stakingToken.balanceOf(address(this)) < _amount) _amount = stakingToken.balanceOf(address(this));

        uint feeAmount = _amount.mul(withdrawalFee).div(MAX_FEE);
        if (feeAmount > 0) {
            _amount -= feeAmount;
            _safeTransfer(feeRecipient, feeAmount);
        }

        _safeTransfer(msg.sender, _amount);
    }

    function withdrawAll() external {
        withdraw(balanceOf(msg.sender));
    }

    function claim() external nonReentrant checkUpTime {
        for (uint i = 0; i < rewards[msg.sender].length; i++) {
            uint tokenId = rewards[msg.sender][i].tokenId;
            IBShibaNFT collectible = IBShibaNFT(rewards[msg.sender][i].collectible);
            collectible.transfer(msg.sender, tokenId);
        }
        delete rewards[msg.sender];
    }

    function claimable(address _user) external view returns (uint) {
        return rewards[_user].length;
    }

    function randomDrop(uint8 _maxChances) external onlyKeeper checkUpTime {
        if (_maxChances > users.length()) _maxChances = uint8(users.length());

        _clearWinners();
        _clearWorkset();
        _makeAvailableCandidates();
        uint8 candidateCount = uint8(workset.length());
        uint8 count = 0;
        while (winners.length() < _maxChances && workset.length() > 0) {
            uint8 randomIndex = _random(candidateCount-count, uint8(candidates.length()) + count);
            uint candidateIndex = workset.at(randomIndex);
            address user = deposits[candidateIndex];
            if (!winners.contains(user)) {
                winners.add(user);
                userInfo[user].lastDeposited = block.timestamp;
            }
            workset.remove(candidateIndex);
            count++;
        }

        _clearWorkset();
        _makeAvailableCollectibles();
        for (uint i = 0; i < winners.length(); i++) {
            address winner = winners.at(i);
            uint8 randomIndex = _random(uint8(workset.length()), uint8(candidates.length()) + i);
            IBShibaNFT collectible = IBShibaNFT(collectibles[workset.at(randomIndex)]);
            uint tokenId = collectible.mintWithoutURI(address(this));
            rewards[winner].push(Reward(address(collectible), tokenId));
        }
    }

    function _random(uint8 _max, uint _seed) internal returns (uint8) {
        return uint8(uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, _seed)))%_max);
    }

    function _clearWinners() internal {
        for (uint i = 0; i < winners.length(); i++) {
            winners.remove(winners.at(0));
        }
    }

    function _clearWorkset() internal {
        for (uint i = 0; i < workset.length(); i++) {
            workset.remove(workset.at(0));
        }
    }

    function _makeAvailableCandidates() internal {
        for (uint i = 0; i < candidates.length(); i++) {
            uint candidateIndex = candidates.at(i);
            address user = deposits[candidateIndex];
            if (block.timestamp - userInfo[user].lastDeposited >= lockupDuration) {
                workset.add(candidateIndex);
            }
        }
    }

    function _makeAvailableCollectibles() internal {
        for (uint i = 0; i < collectibles.length; i++) {
            if (IBShibaNFT(collectibles[i]).left() > 0) {
                workset.add(i);
            }
        }
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

    function _safeTransfer(address _to, uint _amount) internal returns (uint) {
        _amount -= _amount.mul(txFee).div(MAX_FEE);
        if (stakingToken.balanceOf(address(this)) < _amount) {
            _amount = stakingToken.balanceOf(address(this));
        }
        stakingToken.safeTransfer(_to, _amount);
    }

    function userCount() external view returns (uint) {
        return users.length();
    }

    function userList() external view onlyKeeper returns (address[] memory) {
        address[] memory list = new address[](users.length());

        for (uint256 i = 0; i < users.length(); i++) {
            list[i] = users.at(i);
        }

        return list;
    }

    function candidateCount() external view returns (uint) {
        return candidates.length();
    }

    function depositCount(address _user) external view returns (uint) {
        return userDeposits[_user].length();
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

    function withrawRestFunds() external onlyOwner {
        uint currentBal = stakingToken.balanceOf(address(this));
        uint currentFunds = totalSupply - totalSupply.mul(txFee).div(MAX_FEE);
        if (currentBal > currentFunds) {
            stakingToken.safeTransfer(msg.sender, currentBal.sub(currentFunds));
        }
    }
}