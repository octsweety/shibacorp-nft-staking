import * as hre from 'hardhat';
import { ShibaCorp } from '../types/ethers-contracts/ShibaCorp';
import { ShibaCorp__factory } from '../types/ethers-contracts/factories/ShibaCorp__factory';
import address from '../address';

require("dotenv").config();

const { ethers } = hre;

const sleep = (milliseconds, msg='') => {
    console.log(`Wait ${milliseconds} ms... (${msg})`);
    const date = Date.now();
    let currentDate = null;
    do {
      currentDate = Date.now();
    } while (currentDate - date < milliseconds);
}

const toEther = (val) => {
    return ethers.utils.formatEther(val);
}

async function deploy() {
    console.log((new Date()).toLocaleString());
    
    const [deployer] = await ethers.getSigners();
    
    console.log(
        "Deploying contracts with the account:",
        deployer.address
    );

    const beforeBalance = await deployer.getBalance();
    console.log("Account balance:", (await deployer.getBalance()).toString());

    const mainnet = process.env.NETWORK == "mainnet" ? true : false;
    const bshibaAddress = mainnet ? address.mainnet.bshiba : address.testnet.bshiba;

    const factory: ShibaCorp__factory = new ShibaCorp__factory(deployer);
    let bshiba: ShibaCorp = await factory.attach(bshibaAddress).connect(deployer);
    if ("redeploy" && true) {
        bshiba = await factory.deploy();
        
    }
    console.log(`Deployed ShibaCorp... (${bshiba.address})`);

    const afterBalance = await deployer.getBalance();
    console.log(
        "Deployed cost:",
         (beforeBalance.sub(afterBalance)).toString()
    );
}

deploy()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })