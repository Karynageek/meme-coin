import hre, { ethers } from "hardhat";
import { Contract } from 'ethers';

async function main() {
    const delay = (ms: any) => new Promise((res) => setTimeout(res, ms));

    let token: Contract;
    const name = 'Test Token';
    const symbol = 'TT';
    const admin = '0x131D1697d2cFB060493C14A4e6Fa72892770588E';
    const router = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // BSC Pancake Testnet Router
    const marketingWallet = '0x131D1697d2cFB060493C14A4e6Fa72892770588E';

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
