//Contract based on https://docs.openzeppelin.com/contracts/3.x/erc721
// SPDX-License-Identifier: MIT
pragma solidity >0.6.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract BShibaNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    address public factory;

    mapping (address => bool) public minters;
    uint public mintLimit;

    event Mint(address indexed recipient, uint tokenId);

    modifier whiteListed {
        require(minters[msg.sender] == true || msg.sender == owner(), "!minter");
        _;
    }

    modifier onlyFactory {
        require(msg.sender == factory, "!factory");
        _;
    }

    modifier checkOwner(uint _tokenId) {
        require(_exists(_tokenId), "!exists");
        require(msg.sender == ownerOf(_tokenId), "!owner");
        _;
    }

    modifier checkLimited {
        require(totalSupply() < mintLimit, "Exceeded mint limit");
        _;
    }

    constructor(uint _mintLimit, string memory _baseURI) public 
        ERC721("Shiba Corp NFT", "bshibaNFT")
    {
        factory = msg.sender;
        minters[msg.sender] = true;
        mintLimit = _mintLimit;
        _setBaseURI(_baseURI);
    }

    function setMinter(address _minter, bool _flag) external onlyOwner {
        require(_minter != address(0), "Invalid address");
        minters[_minter] = _flag;
    }

    function setMintLimit(uint _limit) external onlyFactory {
        mintLimit = _limit;
    }

    function setBaseURI(string memory _uri) external onlyFactory {
        _setBaseURI(_uri);
    }

    function mint(address recipient, string memory tokenURI)
        public whiteListed checkLimited
        returns (uint256 newItemId)
    {
        _tokenIds.increment();

        newItemId = _tokenIds.current();
        _mint(recipient, newItemId);
        _setTokenURI(newItemId, tokenURI);

        emit Mint(recipient, newItemId);
    }

    function setTokenURI(uint256 _tokenId, string memory _tokenURI) external whiteListed {
        require(_exists(_tokenId), "!exists");
        _setTokenURI(_tokenId, _tokenURI);
    }

    function transfer(address recipient, uint256 _tokenId) external checkOwner(_tokenId) {
        require(ownerOf(_tokenId) != recipient, "Invalid recipient");
        safeTransferFrom(msg.sender, recipient, _tokenId);
        emit Transfer(msg.sender, recipient, _tokenId);
    }

    function exists(uint256 _tokenId) public view returns (bool) {
        return _exists(_tokenId);
    }

    function tokens(address _holder) public view returns (uint256[] memory) {
        uint256 holderBal = balanceOf(_holder);
        uint256[] memory tokenIds = new uint256[](holderBal);
        for (uint i = 0; i < holderBal; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(_holder, i);
        }

        return tokenIds;
    }

    function left() external view returns (uint) {
        return totalSupply() > mintLimit ? 0 : mintLimit - totalSupply();
    }
}