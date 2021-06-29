// SPDX-License-Identifier: MIT
pragma solidity >0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "./BShibaNFT.sol";

contract BShibaFactoryOld is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    struct NftInfo {
        address addr;
        uint mintLimit;
        string baseURI;
        address owner;
        uint created;
    }

    mapping(address => NftInfo) public nftInfo;
    EnumerableSet.AddressSet nfts;

    event Creat(address indexed addr, address indexed owner, uint mintLimit, string baseURI);
    event Remove(address indexed nft);
    event Update(address indexed nft);

    function create(address _owner, uint _mintLimit, string memory _baseURI) external onlyOwner returns (address) {
        address nft = address(new BShibaNFT(_mintLimit, _baseURI));
        Ownable(nft).transferOwnership(_owner);

        nftInfo[nft].addr = nft;
        nftInfo[nft].mintLimit = _mintLimit;
        nftInfo[nft].baseURI = _baseURI;
        nftInfo[nft].owner = _owner;
        nftInfo[nft].created = block.timestamp;

        _checkOrAdd(nft);
        emit Creat(nft, _owner, _mintLimit, _baseURI);

        return nft;
    }

    function remove(address _nft) external onlyOwner {
        if (nfts.contains(_nft) == true) {
            nfts.remove(_nft);
        }
        delete nftInfo[_nft];

        emit Remove(_nft);
    }

    function setBaseURI(address _nft, string memory _baseURI) external onlyOwner {
        nftInfo[_nft].baseURI = _baseURI;
        BShibaNFT(_nft).setBaseURI(_baseURI);

        emit Update(_nft);
    }

    function setMintLimit(address _nft, uint _mintLimit) external onlyOwner {
        nftInfo[_nft].mintLimit = _mintLimit;
        BShibaNFT(_nft).setMintLimit(_mintLimit);

        emit Update(_nft);
    }

    function count() external view returns (uint) {
        return nfts.length();
    }

    // function nftInfoByIndex(uint _index) external returns (NftInfo memory) {
    //     require(_index < nfts.length(), "Invalid index");
    //     return nftInfo[nfts.at(_index)];
    // }

    function _checkOrAdd(address _nft) internal {
        if (nfts.contains(_nft) == false) {
            nfts.add(_nft);
        }
    }
}