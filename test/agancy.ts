import { expect, use } from 'chai';
import { solidity } from 'ethereum-waffle';

import * as hre from 'hardhat';
import { Agency } from '../types/ethers-contracts/Agency';
import { Agency__factory } from '../types/ethers-contracts/factories/Agency__factory';

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

    before(async () => {
        let accounts  = await ethers.getSigners();

        deployer = accounts[0];
        account1 = accounts[1];
        account2 = accounts[2];
        account3 = accounts[3];
        console.log(`Deployer => ${deployer.address}`);
        beforeBalance = await deployer.getBalance();
        console.log("Deployer before balance => ", toEther(beforeBalance));
        
        
        const agencyFactory = new Agency__factory(deployer);
        agency = await agencyFactory.deploy(account2.address);

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
        const account1Balance = await agency.balanceOf(account1.address);

        const txAmount = parseEther('10000');
        await agency.transfer(account1.address, txAmount);

        expect(await agency.balanceOf(deployer.address)).eq(deployerBalance.sub(txAmount));
        expect(await agency.balanceOf(account1.address)).eq(account1Balance.add(txAmount));
    });

    it('Transfer from', async () => {
        const deployerBalance = await agency.balanceOf(deployer.address);
        const account1Balance = await agency.balanceOf(account1.address);

        const txAmount = parseEther('10000');
        await agency.approve(account1.address, txAmount);
        await agency.connect(account1).transferFrom(deployer.address, account1.address, txAmount);

        expect(await agency.balanceOf(deployer.address)).eq(deployerBalance.sub(txAmount));
        expect(await agency.balanceOf(account1.address)).eq(account1Balance.add(txAmount));
    });

    it('Check tax fee', async () => {
        const account1Balance = await agency.balanceOf(account1.address);
        const account2Balance = await agency.balanceOf(account2.address);
        const account3Balance = await agency.balanceOf(account3.address);

        const txAmount = parseEther('10000');
        await agency.connect(deployer).setFeeRecipient(account3.address);
        await agency.connect(account1).transfer(account2.address, txAmount);

        const taxFee = await agency._taxFee();

        expect(await agency.balanceOf(account1.address)).eq(account1Balance.sub(txAmount));
        expect(await agency.balanceOf(account2.address)).eq(account2Balance.add(txAmount.sub(txAmount.mul(taxFee).div(10000))));
        expect(await agency.balanceOf(account3.address)).eq(account3Balance.add(txAmount.mul(taxFee).div(10000)));
    });

    it('Exclude tax fee', async () => {
        const account1Balance = await agency.balanceOf(account1.address);
        const account2Balance = await agency.balanceOf(account2.address);

        const txAmount = parseEther('8000');
        await agency.connect(deployer).excludeFromFee(account2.address);
        await agency.connect(account2).transfer(account1.address, txAmount);

        expect(await agency.balanceOf(account2.address)).eq(account2Balance.sub(txAmount));
        expect(await agency.balanceOf(account1.address)).eq(account1Balance.add(txAmount));
    });
});