import * as hre from 'hardhat';
import { BShibaStakingMVPFlatten } from '../types/ethers-contracts/BShibaStakingMVPFlatten';
import { BShibaStakingMVPFlatten__factory } from '../types/ethers-contracts/factories/BShibaStakingMVPFlatten__factory';
import { BShibaNFT } from '../types/ethers-contracts/BShibaNFT';
import { BShibaNFT__factory } from '../types/ethers-contracts/factories/BShibaNFT__factory';
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
    const bshibaPoolAddress = mainnet ? address.mainnet.bshibaPoolMVP : address.testnet.bshibaPoolMVP;
    const bshibaAddress = mainnet ? address.mainnet.bshiba : address.testnet.bshiba;
    const nftAddress = mainnet ? address.mainnet.nft : address.testnet.nft;

    const nftFactory: BShibaNFT__factory = new BShibaNFT__factory(deployer);
    const nft: BShibaNFT = await nftFactory.attach(nftAddress).connect(deployer);

    const factory: BShibaStakingMVPFlatten__factory = new BShibaStakingMVPFlatten__factory(deployer);
    let bshibaPool: BShibaStakingMVPFlatten = await factory.attach(bshibaPoolAddress).connect(deployer);
    if ("redeploy" && true) {
        // 15 days expireation, 50b staking uint, 5 mins lockup duration
        bshibaPool = await factory.deploy(bshibaAddress, 1296000, parseShiba('50000000'), 300);
        
    }
    console.log(`Deployed BShibaStakingMVPFlatten Pool... (${bshibaPool.address})`);

    if (mainnet) {
        await bshibaPool.setTxFee(1000);
    }
    await bshibaPool.addCollectible(nft.address);
    await nft.setMinter(bshibaPool.address, true);

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