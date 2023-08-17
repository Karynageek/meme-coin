import hre, { ethers } from "hardhat";
import { Contract } from 'ethers';

async function main() {
    const delay = (ms: any) => new Promise((res) => setTimeout(res, ms));

    let token: Contract;
    const name = 'BarbieAlienDogeheimer';
    const symbol = 'WORLDCOIN';
    const admin = '0x2183991423fd25f0b4D3167801FAC259722AB770';
    const router = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    const marketingWallet = '0x4Dda5aEA6956A2974e956dd6dFac5479fb4E4708';

    const MemeCoin = await ethers.getContractFactory('MemeCoin');
    token = await MemeCoin.deploy(name, symbol, admin, router, marketingWallet);
    await token.deployed();

    console.log("MemeCoin deployed to:", token.address);

    await delay(35000);

    await hre.run("verify:verify", {
        address: token.address,
        constructorArguments: [name, symbol, admin, router, marketingWallet],
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
