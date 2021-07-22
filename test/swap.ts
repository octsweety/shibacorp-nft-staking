import { expect, use } from 'chai';
import { solidity } from 'ethereum-waffle';

import * as hre from 'hardhat';
import { Agency } from '../types/ethers-contracts/Agency';
import { Agency__factory } from '../types/ethers-contracts/factories/Agency__factory';
import { ShibaCorp } from '../types/ethers-contracts/ShibaCorp';
import { ShibaCorp__factory } from '../types/ethers-contracts/factories/ShibaCorp__factory';
import { BShibaToAgency } from '../types/ethers-contracts/BShibaToAgency';
import { BShibaToAgency__factory } from '../types/ethers-contracts/factories/BShibaToAgency__factory';

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
    const burnAddr = "0x000000000000000000000000000000000000dEaD";
    let agency: Agency;
    let bshiba: ShibaCorp;
    let swap: BShibaToAgency;

    before(async () => {
        let accounts  = await ethers.getSigners();

        deployer = accounts[0];
        account1 = accounts[1];
        account2 = accounts[2];
        account3 = accounts[3];
        console.log(`Deployer => ${deployer.address}`);
        beforeBalance = await deployer.getBalance();
        console.log("Deployer before balance => ", toEther(beforeBalance));
        
        const bshibaFactory = new ShibaCorp__factory(deployer);
        bshiba = await bshibaFactory.deploy();
        
        const agencyFactory = new Agency__factory(deployer);
        agency = await agencyFactory.deploy(account2.address);

        const swapFactory = new BShibaToAgency__factory(deployer);
        swap = await swapFactory.deploy(agency.address, bshiba.address);
        await agency.excludeFromFee(swap.address);
        await bshiba.approve(swap.address, parseEther('1000000000000', 9));

        console.log("Agency address =>", agency.address);
        console.log("bShiba address =>", bshiba.address);
        console.log("Swap address =>", swap.address);
    });

    after(async () => {
        [ deployer ] = await ethers.getSigners();
        const afterBalance = await deployer.getBalance();
        console.log('');
        console.log("Deployer after balance => ", ethers.utils.formatEther(afterBalance));
        const cost = beforeBalance.sub(afterBalance);
        console.log("Test Cost: ", ethers.utils.formatEther(cost));
    });

    it('Swap', async () => {
        const bshibaBal = await bshiba.balanceOf(deployer.address);
        const burnBal = await bshiba.balanceOf(burnAddr);

        const swapRate = await swap.swapRate();
        const toSwap = parseEther('10000', 9);
        
        try {
            await swap.swap(toSwap);
        }  catch (error) {
            if (error.message.indexOf("insufficient balance") == -1) {
                throw new Error(error.message);
            }
            console.log("Check Agency balance (OK)");
        }
        await agency.transfer(swap.address, parseEther('1000000'));
        const agencyBal = await agency.balanceOf(deployer.address);
        await swap.swap(toSwap);

        expect(await bshiba.balanceOf(deployer.address)).eq(bshibaBal.sub(toSwap));
        expect(await bshiba.balanceOf(burnAddr)).eq(burnBal.add(toSwap));
        expect(await agency.balanceOf(deployer.address)).eq(agencyBal.add(toSwap.mul(9).div(swapRate)));
    });
});