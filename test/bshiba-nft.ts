import { expect, use } from 'chai';
import { solidity } from 'ethereum-waffle';

import * as hre from 'hardhat';
import { ShibaCorp } from '../types/ethers-contracts/ShibaCorp';
import { ShibaCorp__factory } from '../types/ethers-contracts/factories/ShibaCorp__factory';
import { BShibaNFT } from '../types/ethers-contracts/BShibaNFT';
import { BShibaNFT__factory } from '../types/ethers-contracts/factories/BShibaNFT__factory';
import { BShibaFactory } from '../types/ethers-contracts/BShibaFactory';
import { BShibaFactory__factory } from '../types/ethers-contracts/factories/BShibaFactory__factory';

const { ethers } = hre;

use(solidity);

const parseEther = (val, unit = 18) => {
    return ethers.utils.parseUnits(val, unit);
}

const parseShiba = (val) => {
    return parseEther(val, 9);
}

const toEther = (val, unit = 9) => {
    return ethers.utils.formatUnits(val, unit);
}

const toShiba = (val) => {
    return toEther(val, 9);
}

describe('Testing ShibaCorp NFT ...', () => {
    const baseURI = 'https://drive.google.com/file/d';
    const tokenURI1 = '/1zrqL_yP3FLlT55TUHewzb7TN4yGxQBrp/view?usp=sharing';
    const tokenURI2 = '/1d71UxJFIHhd5efk2QoBYfGlg7KIxQi-m/view?usp=sharing';
    const tokenURI3 = '/1PZeVx0C_U6TFDopw-VHItWKQkuw3Ws61/view?usp=sharing';
    let deployer;
    let account1;
    let account2;
    let beforeBalance;
    let bshiba: ShibaCorp;
    let bshibaFactory: ShibaCorp__factory;
    let nftDeployer: BShibaFactory;
    let nftDeployerFactory: BShibaFactory__factory;
    let bshibaNFTFactory: BShibaNFT__factory;
    let nftInst1:BShibaNFT;
    let nftInst2:BShibaNFT;
    let nftInst3:BShibaNFT;
    let tokenId1;
    let tokenId2;

    before(async () => {
        let accounts  = await ethers.getSigners();

        deployer = accounts[0];
        account1 = accounts[1];
        account2 = accounts[2];
        console.log(`Deployer => ${deployer.address}`);
        beforeBalance = await deployer.getBalance();
        console.log("Deployer before balance => ", toEther(beforeBalance));
        
        bshibaFactory = new ShibaCorp__factory(deployer);
        bshiba = await bshibaFactory.deploy();

        nftDeployerFactory = new BShibaFactory__factory(deployer);
        nftDeployer = await nftDeployerFactory.deploy();

        bshibaNFTFactory = new BShibaNFT__factory(deployer);

        console.log("ShibaCorp token address =>", bshiba.address);
        console.log("ShibaCorp NFT factory address =>", nftDeployer.address);
    });

    after(async () => {
        [ deployer ] = await ethers.getSigners();
        const afterBalance = await deployer.getBalance();
        console.log('');
        console.log("Deployer after balance => ", ethers.utils.formatEther(afterBalance));
        const cost = beforeBalance.sub(afterBalance);
        console.log("Test Cost: ", ethers.utils.formatEther(cost));
    });

    it('Distribute 500m BSHIBAs to each accounts', async () => {
        const beforeBalance = await bshiba.balanceOf(deployer.address);
        await bshiba.transfer(account1.address, parseShiba('500000000'));
        await bshiba.transfer(account2.address, parseShiba('500000000'));
        expect(await bshiba.balanceOf(account1.address)).to.equal(parseShiba('500000000'));
        expect(await bshiba.balanceOf(account2.address)).to.equal(parseShiba('500000000'));
        const afterBalance = await bshiba.balanceOf(deployer.address);
        expect(afterBalance).to.equal(beforeBalance.sub(parseShiba('500000000').mul(2)));
    });

    it('Deploy NFT contracts', async() => {
        let tx = await (await nftDeployer.create(deployer.address, 10, baseURI)).wait();
        let nft = tx.events.filter(val => val.event == 'Creat')[0].args;
        // console.log(`Created new NFT (${nft.addr})`);
        let nftInfo = await nftDeployer.nftInfo(nft.addr);
        // console.log(nftInfo);
        expect(nftInfo.mintLimit).eq(10);
        expect(nftInfo.baseURI).eq(baseURI);
        expect(nftInfo.owner).eq(deployer.address);

        nftInst1 = await bshibaNFTFactory.attach(nft.addr).connect(deployer.address);
        expect(nft.addr).eq(nftInst1.address);

        tx = await (await nftDeployer.create(account1.address, 20, baseURI)).wait();
        nft = tx.events.filter(val => val.event == 'Creat')[0].args;
        nftInst2 = await bshibaNFTFactory.attach(nft.addr).connect(account1.address);
        expect(nft.addr).eq(nftInst2.address);
        nftInfo = await nftDeployer.nftInfo(nft.addr);
        expect(nftInfo.mintLimit).eq(20);
        expect(nftInfo.owner).eq(account1.address);

        tx = await (await nftDeployer.create(account2.address, 30, baseURI)).wait();
        nft = tx.events.filter(val => val.event == 'Creat')[0].args;
        nftInst3 = await bshibaNFTFactory.attach(nft.addr).connect(account2.address);
        expect(nft.addr).eq(nftInst3.address);
        nftInfo = await nftDeployer.nftInfo(nft.addr);
        expect(nftInfo.mintLimit).eq(30);
        expect(nftInfo.owner).eq(account2.address);

        const count = await nftDeployer.count();
        expect(count).eq(3);
    });

    it('Mint NFT', async() => {
        try {
            const tx = await (await nftInst1.connect(account1).mint(account1.address, tokenURI1)).wait();
        } catch (error) {
            if (error.message.indexOf("!minter") == -1) {
                throw new Error(error.message);
            }
            console.log("Check minter permission (OK)");
        }

        let tx = await (await nftInst1.connect(deployer).mint(account1.address, tokenURI1)).wait();
        const token1 = tx.events.filter(val => val.event == 'Mint')[0].args;
        expect(token1.recipient).eq(account1.address);
        expect(token1.tokenId).eq(1);
        expect(await nftInst1.tokenURI(token1.tokenId)).eq(baseURI + tokenURI1);

        tx = await (await nftInst1.connect(deployer).mint(account2.address, tokenURI2)).wait();
        const token2 = tx.events.filter(val => val.event == 'Mint')[0].args;
        expect(token2.recipient).eq(account2.address);
        expect(token2.tokenId).eq(2);
        expect(await nftInst1.tokenURI(token2.tokenId)).eq(baseURI + tokenURI2);
    });

    it('Existing check', async() => {
        expect(await nftInst1.exists(1)).eq(true);
        expect(await nftInst1.exists(2)).eq(true);
        expect(await nftInst1.exists(3)).eq(false);
    });

    it('How many left to mint more', async() => {
        expect(await nftInst1.left()).eq((await nftInst1.mintLimit()).sub(2));
    });

    it('Get token list by holder', async() => {
        await nftInst1.connect(deployer).mint(account1.address, tokenURI3);
        const tokens1 = await nftInst1.tokens(account1.address);
        const tokens2 = await nftInst1.tokens(account2.address);

        expect(await nftInst1.tokenURI(tokens1[0])).eq(baseURI+tokenURI1);
        expect(await nftInst1.tokenURI(tokens1[1])).eq(baseURI+tokenURI3);
        expect(await nftInst1.tokenURI(tokens2[0])).eq(baseURI+tokenURI2);
    });

    it('Transfer NFT', async() => {
        const tokens1 = await nftInst1.tokens(account1.address);
        expect(await nftInst1.ownerOf(tokens1[1])).eq(account1.address);
        expect((await nftInst1.tokens(account2.address)).length).eq(1);
        try {
            await nftInst1.connect(account2).transfer(account1.address, tokens1[1]);
        } catch (error) {
            if (error.message.indexOf("!owner") == -1) {
                throw new Error(error.message);
            }
            console.log("Check tranfering permission (OK)");
        }

        await nftInst1.connect(account1).transfer(account2.address, tokens1[1]);
        expect((await nftInst1.tokens(account2.address)).length).eq(2);
        expect(await nftInst1.ownerOf(tokens1[1])).eq(account2.address);
    });

    it('Setting NFT contract', async() => {
        let _baseURI = await nftInst3.baseURI();
        let mintLimit = await nftInst3.mintLimit();
        let nftInfo = await nftDeployer.nftInfo(nftInst3.address);

        expect(_baseURI).eq(baseURI);
        expect(mintLimit).eq(30);
        expect(nftInfo.baseURI).eq(baseURI);
        expect(nftInfo.mintLimit).eq(30);

        const newURI = "http://localhost";
        try {
            await nftInst3.setBaseURI(newURI);
            await nftInst3.setMintLimit(40);
        } catch (error) {
            if (error.message.indexOf("!factory") == -1) {
                throw new Error(error.message);
            }
            console.log("Check permission to set NFT contract (OK)");
        }
        await nftDeployer.setBaseURI(nftInst3.address, newURI);
        await nftDeployer.setMintLimit(nftInst3.address, 40);

        _baseURI = await nftInst3.baseURI();
        mintLimit = await nftInst3.mintLimit();
        nftInfo = await nftDeployer.nftInfo(nftInst3.address);

        expect(_baseURI).eq(newURI);
        expect(mintLimit).eq(40);
        expect(nftInfo.baseURI).eq(newURI);
        expect(nftInfo.mintLimit).eq(40);
    });

    it('Check mint limitation', async() => {
        await nftDeployer.setMintLimit(nftInst3.address, 2);
        await nftInst3.connect(account2).mint(deployer.address, tokenURI1);
        await nftInst3.connect(account2).mint(account1.address, tokenURI2);
        try {
            await nftInst3.connect(account2).mint(account2.address, tokenURI3);
        } catch (error) {
            if (error.message.indexOf("Exceeded mint limit") == -1) {
                throw new Error(error.message);
            }
            console.log("Check minting limitation (OK)");
        }
    });

    it('Remove NFT contract', async() => {
        let nftInfo = await nftDeployer.nftInfo(nftInst3.address);
        expect(nftInfo.owner).eq(account2.address);
        await nftDeployer.remove(nftInst3.address);
        nftInfo = await nftDeployer.nftInfo(nftInst3.address);
        expect(nftInfo.owner).eq(ethers.constants.AddressZero);
        const count = await nftDeployer.count();
        expect(count).eq(2);
    });
});