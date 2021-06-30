import * as hre from 'hardhat';
import { BShibaFactoryFlatten } from '../types/ethers-contracts/BShibaFactoryFlatten';
import { BShibaFactoryFlatten__factory } from '../types/ethers-contracts/factories/BShibaFactoryFlatten__factory';
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
    const nftFactoryAddress = mainnet ? address.mainnet.nftFactory : address.testnet.nftFactory;

    const factory: BShibaFactoryFlatten__factory = new BShibaFactoryFlatten__factory(deployer);
    let nftFactory: BShibaFactoryFlatten = await factory.attach(nftFactoryAddress).connect(deployer);
    if ("redeploy" && true) {
        nftFactory = await factory.deploy();
        
    }
    console.log(`Deployed BShibaNFTFactory... (${nftFactory.address})`);

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