import { expect, use } from 'chai';
import { solidity } from 'ethereum-waffle';

import * as hre from 'hardhat';
import { Agency } from '../types/ethers-contracts/Agency';
import { Agency__factory } from '../types/ethers-contracts/factories/Agency__factory';
import { FeeDistributor } from '../types/ethers-contracts/FeeDistributor';
import { FeeDistributor__factory } from '../types/ethers-contracts/factories/FeeDistributor__factory';

const { ethers } = hre;

use(solidity);

const parseEther = (val, unit = 18) => {
    return ethers.utils.parseUnits(val, unit);
}

const toEther = (val, unit = 18) => {
    return ethers.utils.formatUnits(val, unit);
}

describe('Testing Agency...', () => {
    let deployer;
    let account1;
    let account2;
    let account3
    let beforeBalance;
    let agency: Agency;
    let distributor: FeeDistributor;

    before(async () => {
        let accounts  = await ethers.getSigners();

        deployer = accounts[0];
        account1 = accounts[1];
        account2 = accounts[2];
        account3 = accounts[3];
        console.log(`Deployer => ${deployer.address}`);
        beforeBalance = await deployer.getBalance();
        console.log("Deployer before balance => ", toEther(beforeBalance));
        
        const distributorFactory = new FeeDistributor__factory(deployer);
        distributor = await distributorFactory.deploy(account2.address, account3.address);
        console.log("Fee distributor address =>", distributor.address);

        const agencyFactory = new Agency__factory(deployer);
        agency = await agencyFactory.deploy(distributor.address);
        await distributor.setAgencyToken(agency.address);

        console.log("Agency address =>", agency.address);
    });

    after(async () => {
        [ deployer ] = await ethers.getSigners();
        const afterBalance = await deployer.getBalance();
        console.log('');
        console.log("Deployer after balance => ", ethers.utils.formatEther(afterBalance));
        const cost = beforeBalance.sub(afterBalance);
        console.log("Test Cost: ", ethers.utils.formatEther(cost));
    });

    it('Transfer', async () => {
        const deployerBalance = await agency.balanceOf(deployer.address);
        const account2Balance = await agency.balanceOf(account2.address);
        const distributorBalance = await agency.balanceOf(account3.address);

        const txAmount = parseEther('10000');
        await agency.transfer(account1.address, txAmount);
        await agency.connect(account1).transfer(account2.address, txAmount);

        const taxFee = await agency._taxFee();

        expect(await agency.balanceOf(deployer.address)).eq(deployerBalance.sub(txAmount));
        expect(await agency.balanceOf(account2.address)).eq(account2Balance.add(txAmount.sub(txAmount.mul(taxFee).div(10000))));
        expect(await agency.balanceOf(distributor.address)).eq(distributorBalance.add(txAmount.mul(taxFee).div(10000)));
    });

    it('Distribute fees', async () => {
        const curFees = await agency.balanceOf(distributor.address);
        const devBalance = await agency.balanceOf(account2.address);
        const poolBalance = await agency.balanceOf(account3.address);
        const burnBalance = await agency.balanceOf("0x000000000000000000000000000000000000dEaD");

        try {
            await distributor.connect(account3).distribute();
        } catch (error) {
            if (error.message.indexOf("!permission") == -1) {
                throw new Error(error.message);
            }
            console.log("Check permission (OK)");
        }

        const devAlloc = await distributor.devAllocation();
        const poolAlloc = await distributor.poolAllocation();
        const burnAlloc = await distributor.burnAllocation();

        await distributor.setWhiteList(account3.address, true);

        try {
            await distributor.connect(account3).distribute();
        } catch (error) {
            if (error.message.indexOf("still unavailable to distribute") == -1) {
                throw new Error(error.message);
            }
            console.log("Check locked (OK)");
        }
        await distributor.setLockDuration(0);
        await distributor.connect(account3).distribute();

        expect(await agency.balanceOf(distributor.address)).eq(0);
        expect(await agency.balanceOf(account2.address)).eq(devBalance.add(curFees.mul(devAlloc).div(100)));
        expect(await agency.balanceOf(account3.address)).eq(poolBalance.add(curFees.mul(poolAlloc).div(100)));
        expect(await agency.balanceOf("0x000000000000000000000000000000000000dEaD")).eq(burnBalance.add(curFees.mul(burnAlloc).div(100)));
    });
});