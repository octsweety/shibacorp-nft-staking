import * as hre from 'hardhat';
import { BShibaStaking } from '../types/ethers-contracts/BShibaStaking';
import { BShibaStaking__factory } from '../types/ethers-contracts/factories/BShibaStaking__factory';
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

const parseEther = (val, unit = 18) => {
    return ethers.utils.parseUnits(val, unit);
}

const toEther = (val) => {
    return ethers.utils.formatEther(val);
}

const parseShiba = (val) => {
    return parseEther(val, 9);
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
    const bshibaPoolAddress = mainnet ? address.mainnet.bshibaPool : address.testnet.bshibaPool;
    const bshibaAddress = mainnet ? address.mainnet.bshiba : address.testnet.bshiba;

    const factory: BShibaStaking__factory = new BShibaStaking__factory(deployer);
    let bshibaPool: BShibaStaking = await factory.attach(bshibaPoolAddress).connect(deployer);
    if ("redeploy" && true) {
        // 15 days expireation, 50b staking uint, 60 secs lockup duration
        bshibaPool = await factory.deploy(bshibaAddress, 1624984072, 1296000, parseShiba('50000000'), 60);
        
    }
    console.log(`Deployed BShibaStaking Pool... (${bshibaPool.address})`);

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