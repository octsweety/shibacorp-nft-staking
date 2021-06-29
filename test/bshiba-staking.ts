import { expect, use } from 'chai';
import { solidity } from 'ethereum-waffle';

import * as hre from 'hardhat';
import { ShibaCorp } from '../types/ethers-contracts/ShibaCorp';
import { ShibaCorp__factory } from '../types/ethers-contracts/factories/ShibaCorp__factory';
import { BShibaNFT } from '../types/ethers-contracts/BShibaNFT';
import { BShibaNFT__factory } from '../types/ethers-contracts/factories/BShibaNFT__factory';
import { BShibaFactory } from '../types/ethers-contracts/BShibaFactory';
import { BShibaFactory__factory } from '../types/ethers-contracts/factories/BShibaFactory__factory';
import { BShibaStaking } from '../types/ethers-contracts/BShibaStaking';
import { BShibaStaking__factory } from '../types/ethers-contracts/factories/BShibaStaking__factory';

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
    let bshibaPool: BShibaStaking;
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

        const bshibaPoolFactory = new BShibaStaking__factory(deployer);
        // 15 upTime, 7 lockup, 50m
        bshibaPool = await bshibaPoolFactory.deploy(bshiba.address, 1624984072, 1296000, parseShiba('50000000'), 604800);

        console.log("ShibaCorp token address => ", bshiba.address);
        console.log("ShibaCorp NFT factory address => ", nftDeployer.address);
        // console.log("bShiba staking pool address => ", bshibaPool.address);
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

        await bshiba.connect(deployer).approve(bshibaPool.address, (await bshiba.totalSupply()));
        await bshiba.connect(account1).approve(bshibaPool.address, (await bshiba.totalSupply()));
        await bshiba.connect(account2).approve(bshibaPool.address, (await bshiba.totalSupply()));
    });

    it('Deploy NFT contracts', async() => {
        let tx = await (await nftDeployer.create(deployer.address, 10, baseURI)).wait();
        let nft = tx.events.filter(val => val.event == 'Creat')[0].args;
        nftInst1 = await bshibaNFTFactory.attach(nft.addr).connect(deployer.address);
        console.log("nft1: ", nft.addr);
        await bshibaPool.addCollectible(nft.addr);
        await nftInst1.connect(deployer).setMinter(bshibaPool.address, true);
        tx = await (await nftDeployer.create(account1.address, 20, baseURI)).wait();
        nft = tx.events.filter(val => val.event == 'Creat')[0].args;
        console.log("nft2: ", nft.addr);
        nftInst2 = await bshibaNFTFactory.attach(nft.addr).connect(account1.address);
        await nftInst2.connect(account1).setMinter(bshibaPool.address, true);
        await bshibaPool.addCollectible(nft.addr);
        tx = await (await nftDeployer.create(account2.address, 30, baseURI)).wait();
        nft = tx.events.filter(val => val.event == 'Creat')[0].args;
        console.log("nft3: ", nft.addr);
        nftInst3 = await bshibaNFTFactory.attach(nft.addr).connect(account2.address);
        await nftInst3.connect(account2).setMinter(bshibaPool.address, true);
        await bshibaPool.addCollectible(nft.addr);
    });

    it('Deposit', async() => {
        const beforeCandidates = await bshibaPool.candidateCount();
        const beforeBalance = await bshiba.balanceOf(deployer.address);
        try {
            await bshibaPool.deposit(parseShiba('40000000'));
        } catch (error) {
            if (error.message.indexOf("Invalid amount") == -1) {
                throw new Error(error.message);
            }
            console.log("Check staking unit when deposit (OK)");
        }
        await bshibaPool.deposit(parseShiba('51000000'));
        expect(await bshiba.balanceOf(deployer.address)).eq(beforeBalance.sub(parseShiba('50000000')));
        expect(await bshibaPool.balanceOf(deployer.address)).eq(parseShiba('50000000'));
        expect(await bshibaPool.candidateCount()).eq(beforeCandidates.add(1));
        await bshibaPool.deposit(parseShiba('100000000'));
        expect(await bshiba.balanceOf(deployer.address)).eq(beforeBalance.sub(parseShiba('150000000')));
        expect(await bshibaPool.balanceOf(deployer.address)).eq(parseShiba('150000000'));
        expect(await bshibaPool.candidateCount()).eq(beforeCandidates.add(3));
        expect(await bshibaPool.depositCount(deployer.address)).eq(3);
    });

    it('Deposit from multiple accounts', async() => {
        const beforeCandidates = await bshibaPool.candidateCount();
        await bshibaPool.connect(account1).deposit(parseShiba('50000000'));
        await bshibaPool.connect(account2).deposit(parseShiba('50000000'));
        expect(await bshibaPool.balanceOf(account1.address)).eq(parseShiba('50000000'));
        expect(await bshibaPool.balanceOf(account2.address)).eq(parseShiba('50000000'));
        expect(await bshibaPool.candidateCount()).eq(beforeCandidates.add(2));
        expect(await bshibaPool.depositCount(account1.address)).eq(1);
        expect(await bshibaPool.depositCount(account2.address)).eq(1);
    });

    it('Random drop', async() => {
        try {
            await bshibaPool.randomDrop(2);
        } catch (error) {
            if (error.message.indexOf("!started or expired") == -1) {
                throw new Error(error.message);
            }
            console.log("Check uptime (OK)");
        }
        await bshibaPool.setUpTime(1624921376);
        await bshibaPool.setLockupDuration(0);
        await bshibaPool.randomDrop(2);

        const count1 = (await bshibaPool.claimable(deployer.address)).toString();
        const count2 = (await bshibaPool.claimable(account1.address)).toString();
        const count3 = (await bshibaPool.claimable(account2.address)).toString();
        console.log("rewards1: ", count1);
        console.log("rewards2: ", count2);
        console.log("rewards3: ", count3);

        if (Number(count1) > 0) {
            const reward1 = await bshibaPool.rewards(deployer.address, 0);
            console.log("reward1: ", reward1.collectible, reward1.tokenId.toString());
        }

        if (Number(count2) > 0) {
            const reward2 = await bshibaPool.rewards(account1.address, 0);
            console.log("reward2: ", reward2.collectible, reward2.tokenId.toString());
        }

        if (Number(count3) > 0) {
            const reward3 = await bshibaPool.rewards(account2.address, 0);
            console.log("reward3: ", reward3.collectible, reward3.tokenId.toString());
        }
    });

    it('Withdraw', async() => {
        const beforeBalance = await bshiba.balanceOf(deployer.address);
        const beforeCandidates = await bshibaPool.candidateCount();
        // try {
        //     await bshibaPool.withdraw(parseShiba('40000000'));
        // } catch (error) {
        //     if (error.message.indexOf("Locked up") == -1) {
        //         throw new Error(error.message);
        //     }
        //     console.log("Check lockup when withdraw (OK)");
        // }
        
        // await bshibaPool.setLockupDuration(0);

        try {
            await bshibaPool.withdraw(parseShiba('40000000'));
        } catch (error) {
            if (error.message.indexOf("Invalid amount") == -1) {
                throw new Error(error.message);
            }
            console.log("Check staking unit when withdraw (OK)");
        }
        await bshibaPool.withdraw(parseShiba('51000000'));
        expect(await bshiba.balanceOf(deployer.address)).eq(beforeBalance.add(parseShiba('50000000')));
        expect(await bshibaPool.balanceOf(deployer.address)).eq(parseShiba('100000000'));
        expect(await bshibaPool.candidateCount()).eq(beforeCandidates.sub(1))
        expect(await bshibaPool.depositCount(deployer.address)).eq(2);
    });

    it('Check withdrawal fee', async() => {
        const beforeCandidates = await bshibaPool.candidateCount();
        const beforeBalance = await bshiba.balanceOf(deployer.address);
        const beforeBalance1 = await bshiba.balanceOf(account1.address);
        await bshibaPool.setFeeRecipient(account1.address);
        await bshibaPool.setWithdarwalFee(300);
        await bshibaPool.withdraw(parseShiba('50000000'));
        expect(await bshiba.balanceOf(deployer.address)).eq(beforeBalance.add(parseShiba('50000000')).sub(parseShiba('50000000').mul(300).div(10000)));
        expect(await bshiba.balanceOf(account1.address)).eq(beforeBalance1.add(parseShiba('50000000').mul(300).div(10000)));
        expect(await bshibaPool.candidateCount()).eq(beforeCandidates.sub(1));
        expect(await bshibaPool.depositCount(deployer.address)).eq(1);
        await bshibaPool.setWithdarwalFee(0);
    });

    it('WithdrawAll', async() => {
        const beforeCandidates = await bshibaPool.candidateCount();
        const beforeBalance = await bshiba.balanceOf(deployer.address);
        await bshibaPool.withdrawAll();
        expect(await bshiba.balanceOf(deployer.address)).eq(beforeBalance.add(parseShiba('50000000')));
        expect(await bshibaPool.balanceOf(deployer.address)).eq(0);
        expect(await bshibaPool.candidateCount()).eq(beforeCandidates.sub(1));
        expect(await bshibaPool.depositCount(deployer.address)).eq(0);
    });
});