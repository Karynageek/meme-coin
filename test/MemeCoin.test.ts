import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseUnits, parseEther } from "ethers/lib/utils";
import { Contract } from 'ethers';
import { MemeCoin__factory } from "../typechain/factories/contracts/MemeCoin.sol/MemeCoin__factory";

describe('MemeCoin contract', () => {
  const delay = (ms: any) => new Promise((res) => setTimeout(res, ms));
  const zeroAddress = '0x0000000000000000000000000000000000000000';
  const name = 'Meme Coin';
  const symbol = 'MC';
  const router = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // BSC Pancake Testnet Router
  const totalSupply = parseUnits('19000000000', 18);
  let WETHAddress: string;
  let token: Contract;
  let busdMock: Contract;
  let uniswapRouter: Contract;
  let uniswapFactory: Contract;
  let pairContract: Contract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let marketingWallet: SignerWithAddress;
  let addrs: SignerWithAddress[];

  async function impersonate(account: string): Promise<SignerWithAddress> {
    await ethers.provider.send("hardhat_impersonateAccount", [account]);
    return ethers.getSigner(account)
  }

  async function getReserves() {
    let reserves = [...(await pairContract.callStatic.getReserves())];
    {
      [reserves[0], reserves[1]] = [reserves[1], reserves[0]];
    }
    return reserves;
  }

  async function buyTokens(signer: any, amount: any) {
    const reserves = await getReserves();

    let requiredETH = await uniswapRouter.connect(signer).callStatic.getAmountIn(
      parseEther(String(amount)),
      reserves[0],
      reserves[1]
    );

    await uniswapRouter.connect(signer).swapETHForExactTokens(
      parseEther(String(amount)),
      [WETHAddress, token.address],
      signer.address,
      Math.floor(Date.now() / 1000) + 3600 * 72 * 30,
      { value: requiredETH.mul(11).div(10) }
    );
  }

  async function sellTokens(signer: any, amount: any) {
    await token.connect(signer).approve(
      router,
      parseEther(String(amount))
    );
    await uniswapRouter.connect(
      signer
    ).swapExactTokensForETHSupportingFeeOnTransferTokens(
      parseEther(String(amount)),
      0,
      [token.address, WETHAddress],
      signer.address,
      Math.floor(Date.now() / 1000) + 3600 * 72 * 30
    );
  }

  beforeEach(async () => {
    [owner, addr1, addr2, marketingWallet, ...addrs] = await ethers.getSigners();

    const MemeCoin = await ethers.getContractFactory('MemeCoin') as MemeCoin__factory;
    token = await MemeCoin.deploy(name, symbol, owner.address, router, marketingWallet.address);
    await token.deployed();

    const BUSDMock = await ethers.getContractFactory('BUSDMock');
    busdMock = await BUSDMock.deploy();
    await busdMock.deployed();

    uniswapRouter = await ethers.getContractAt(
      "IUniswapV2Router02",
      router
    );
    uniswapFactory = await ethers.getContractAt(
      "IUniswapV2Factory",
      await uniswapRouter.factory()
    );
    const pair = await token.uniswapV2Pair();

    pairContract = await ethers.getContractAt(
      "IUniswapV2Pair",
      pair
    );
    WETHAddress = await uniswapRouter.WETH();
  });

  describe('initial values', async () => {
    it('should set initial values successfully', async () => {
      /* ASSERT */
      expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), owner.address)).to.true;
      expect(await token.name()).to.equal(name);
      expect(await token.symbol()).to.equal(symbol);
      expect(await token.isExcludedFromFees(owner.address)).to.true;
      expect(await token.isExcludedFromFees(token.address)).to.true;
      expect(await token.isExcludedFromFees('0x000000000000000000000000000000000000dead')).to.true;
      expect(await token.isExcludedFromFees(marketingWallet.address)).to.true;
      expect(await token.balanceOf(owner.address)).to.equal(totalSupply);
      expect(await token.uniswapV2Router()).to.equal(router);
      expect(await token.uniswapV2Pair()).to.not.empty;
      expect(await token.allowance(token.address, await token.uniswapV2Router())).to.equal(ethers.constants.MaxUint256);
      expect(await token.totalSupply()).to.equal(totalSupply);
      expect(await token.marketingWallet()).to.equal(marketingWallet.address);
    })
  });

  describe('_transfer', async () => {
    it("should revert if transferring to the zero address", async () => {
      /* SETUP */
      const recipient = ethers.constants.AddressZero;
      const amount = parseEther("100");

      /* ASSERT */
      await expect(
        token.connect(addr1).transfer(recipient, amount)
      ).to.be.revertedWith("ERC20: transfer to the zero address");
    });

    it("should revert if transfer amount is zero", async () => {
      /* SETUP */
      const recipient = addr2.address;

      /* ASSERT */
      await expect(
        token.connect(addr1).transfer(recipient, 0)
      ).to.be.revertedWith("Transfer amount must be greater than zero");
    });

    it("should revert if trading is not yet enabled", async () => {
      /* SETUP */
      const recipient = addr2.address;
      const amount = parseEther("100");

      await token.enableTrading(false);

      /* ASSERT */
      await expect(
        token.connect(addr1).transfer(recipient, amount)
      ).to.be.revertedWith("Trading not yet enabled");
    });

    it("should revert if sender is an abuser", async () => {
      /* SETUP */
      const recipient = addr2.address;
      const amount = parseEther("100");

      await token.addAbusers([addr1.address]);

      /* ASSERT */
      await expect(
        token.connect(addr1).transfer(recipient, amount)
      ).to.be.revertedWith("Address is abuser");
    });

    it("should revert if recipient is an abuser", async () => {
      const recipient = addr2.address;
      const amount = parseEther("100");

      await token.addAbusers([recipient]);

      /* ASSERT */
      await expect(
        token.connect(addr1).transfer(recipient, amount)
      ).to.be.revertedWith("Address is abuser");
    });

    it("should revert if sell transfer amount exceeds maxSellTransaction", async () => {
      /* SETUP */
      const recipient = await token.uniswapV2Pair();
      const amount = parseEther("100");

      await token.enableTrading(true);
      await token.updateMaxSellTransaction(parseUnits("1", 18));

      /* ASSERT */
      await expect(
        token.connect(addr1).transfer(recipient, amount)
      ).to.be.revertedWith("Sell transfer amount exceeds the maxTransactionAmount.");
    });

    it("should revert if buy transfer amount exceeds maxBuyTransaction", async () => {
      /* SETUP */
      const supply = parseEther('1');

      await token.approve(router, ethers.constants.MaxUint256);
      await uniswapRouter.addLiquidityETH(token.address, supply, supply, supply, owner.address, ethers.constants.MaxUint256, { value: supply });

      await token.enableTrading(true);
      await token.excludeFromMaxTransaction(owner.address, false);
      await token.updateMaxBuyTransaction(parseUnits("1", 18));
      await token.updateMaxSellTransaction(parseUnits("1000", 18));
      await token.updateMaxWalletAmount(ethers.utils.parseEther("100000"));

      /* ASSERT */
      await expect(buyTokens(owner, 1)).to.be.reverted;
    });

    it("should revert if sell transfer exceeds maxWalletAmount", async () => {
      /* SETUP */
      const recipient = addr2.address;
      const amount = parseEther("100");

      await token.enableTrading(true);
      await token.updateMaxBuyTransaction(parseUnits("1000", 18));
      await token.updateMaxWalletAmount(parseUnits("1", 18));

      /* ASSERT */
      await expect(
        token.connect(addr1).transfer(recipient, amount)
      ).to.be.revertedWith("Max wallet exceeded");
    });

    it("should revert if buy transfer amount exceeds maxWalletAmount", async () => {
      /* SETUP */
      const supply = parseEther('1');

      await token.approve(router, ethers.constants.MaxUint256);
      await uniswapRouter.addLiquidityETH(token.address, supply, supply, supply, owner.address, ethers.constants.MaxUint256, { value: supply });

      await token.enableTrading(true);
      await token.excludeFromMaxTransaction(owner.address, false);
      await token.updateMaxBuyTransaction(parseUnits("1000", 18));
      await token.updateMaxSellTransaction(parseUnits("1000", 18));
      await token.updateMaxWalletAmount(ethers.utils.parseEther("1"));

      /* ASSERT */
      await expect(buyTokens(owner, 1)).to.be.reverted;
    });

    it("should transfer tokens without fees", async () => {
      /* SETUP */
      const amount = parseEther("100");

      await token.enableTrading(true);
      await token.updateMaxBuyTransaction(parseUnits("1000", 18));
      await token.updateMaxSellTransaction(parseUnits("1000", 18));
      await token.updateMaxWalletAmount(ethers.utils.parseEther("100000"));

      const ownerBalanceBefore = await token.balanceOf(owner.address);
      const addr1BalanceBefore = await token.balanceOf(addr1.address);
      const addr2BalanceBefore = await token.balanceOf(addr2.address);

      /* EXECUTE */
      await expect(
        token.connect(owner).transfer(addr1.address, amount)
      ).to.emit(token, "Transfer");

      await expect(
        token.connect(addr1).transfer(addr2.address, amount)
      ).to.emit(token, "Transfer");

      /* ASSERT */
      const ownerBalanceAfter = await token.balanceOf(owner.address);
      const addr1BalanceAfter = await token.balanceOf(addr1.address);
      const addr2BalanceAfter = await token.balanceOf(addr2.address);

      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore.sub(amount));
      expect(addr1BalanceAfter).to.equal(addr1BalanceBefore.add(amount).sub(amount));
      expect(addr2BalanceAfter).to.equal(addr2BalanceBefore.add(amount));
    });

    it("should transfer tokens without fees when excluded from fees", async () => {
      /* SETUP */
      const amount = parseEther("100");

      await token.enableTrading(true);
      await token.updateMaxBuyTransaction(parseUnits("1000", 18));
      await token.updateMaxSellTransaction(parseUnits("1000", 18));
      await token.updateMaxWalletAmount(ethers.utils.parseEther("100000"));
      await token.updateWalletToWalletTransferFee(1);
      await token.excludeFromFees(owner.address, false);
      await token.excludeFromFees(addr1.address, true);
      await token.excludeFromFees(addr2.address, true);

      const ownerBalanceBefore = await token.balanceOf(owner.address);
      const addr1BalanceBefore = await token.balanceOf(addr1.address);
      const addr2BalanceBefore = await token.balanceOf(addr2.address);

      /* EXECUTE */
      await expect(
        token.connect(owner).transfer(addr1.address, amount)
      ).to.emit(token, "Transfer");

      await expect(
        token.connect(addr1).transfer(addr2.address, amount)
      ).to.emit(token, "Transfer");

      /* ASSERT */
      const ownerBalanceAfter = await token.balanceOf(owner.address);
      const addr1BalanceAfter = await token.balanceOf(addr1.address);
      const addr2BalanceAfter = await token.balanceOf(addr2.address);

      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore.sub(amount));
      expect(addr1BalanceAfter).to.equal(addr1BalanceBefore.add(amount).sub(amount));
      expect(addr2BalanceAfter).to.equal(addr2BalanceBefore.add(amount));
    });

    it("should transfer tokens with fees", async () => {
      /* SETUP */
      const amount = parseEther("100");

      await token.enableTrading(true);
      await token.updateMaxBuyTransaction(parseUnits("1000", 18));
      await token.updateMaxSellTransaction(parseUnits("1000", 18));
      await token.updateMaxWalletAmount(ethers.utils.parseEther("100000"));

      const fee = 1;
      const feeAmount = amount.mul(fee).div(100);

      await token.updateWalletToWalletTransferFee(fee);//1%

      const ownerBalanceBefore = await token.balanceOf(owner.address);
      const addr1BalanceBefore = await token.balanceOf(addr1.address);
      const addr2BalanceBefore = await token.balanceOf(addr2.address);
      const tokenBalanceBefore = await token.balanceOf(token.address);

      /* EXECUTE */
      await expect(
        token.connect(owner).transfer(addr1.address, amount)
      ).to.emit(token, "Transfer");

      await expect(
        token.connect(addr1).transfer(addr2.address, amount)
      ).to.emit(token, "Transfer");

      /* ASSERT */
      const ownerBalanceAfter = await token.balanceOf(owner.address);
      const addr1BalanceAfter = await token.balanceOf(addr1.address);
      const addr2BalanceAfter = await token.balanceOf(addr2.address);
      const tokenBalanceAfter = await token.balanceOf(token.address);

      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore.sub(amount));
      expect(addr1BalanceAfter).to.equal(addr1BalanceBefore.add(amount).sub(amount));
      expect(addr2BalanceAfter).to.equal(addr2BalanceBefore.add(amount).sub(feeAmount));
      expect(tokenBalanceAfter).to.equal(tokenBalanceBefore.add(feeAmount));
    });

    it("should transfer tokens with fees if sell and not excluded from fee", async () => {
      /* SETUP */
      const supply = parseEther('1000');

      await token.approve(router, ethers.constants.MaxUint256);
      await uniswapRouter.addLiquidityETH(token.address, supply, supply, supply, owner.address, ethers.constants.MaxUint256, { value: supply });

      const pairAddress = await token.uniswapV2Pair();
      const amount = parseEther("100");

      await token.enableTrading(true);
      await token.updateMaxBuyTransaction(parseUnits("1000", 18));
      await token.updateMaxSellTransaction(parseUnits("1000", 18));
      await token.updateMaxWalletAmount(ethers.utils.parseEther("100000"));

      const newLiquidityFee = 1;
      const newMarketingFee = 2;

      await token.updateSellFees(newLiquidityFee, newMarketingFee);
      await token.updateWalletToWalletTransferFee(1);

      const fee = newLiquidityFee + newMarketingFee;
      const feeAmount = amount.mul(fee).div(100);

      await token.connect(owner).transfer(addr1.address, amount.mul(2));
      await token.connect(addr1).transfer(addr2.address, amount);

      const WETHBalanceBefore = await ethers.provider.getBalance(WETHAddress);
      const marketingBalanceBefore = await ethers.provider.getBalance(marketingWallet.address);

      const addr1BalanceBefore = await token.balanceOf(addr1.address);
      const contractBalanceBefore = await token.balanceOf(token.address);
      const pairBefore = await token.balanceOf(pairAddress);

      /* EXECUTE */
      const tx = token.connect(addr1).transfer(pairAddress, amount);
      await delay(100);

      /* ASSERT */
      const WETHBalanceAfter = await ethers.provider.getBalance(WETHAddress);
      const marketingBalanceAfter = await ethers.provider.getBalance(marketingWallet.address);

      const addr1BalanceAfter = await token.balanceOf(addr1.address);
      const contractBalanceAfter = await token.balanceOf(token.address);
      const pairAfter = await token.balanceOf(pairAddress);

      expect(WETHBalanceAfter).to.be.lt(WETHBalanceBefore);
      expect(marketingBalanceAfter).to.be.gt(marketingBalanceBefore);
      expect(contractBalanceAfter).to.be.gt(contractBalanceBefore);
      expect(pairAfter).to.be.gt(pairBefore);
      expect(addr1BalanceAfter).to.equal(addr1BalanceBefore.sub(amount));

      await expect(tx).to.emit(token, "Transfer");
      await expect(tx).to.emit(token, 'SwapAndLiquify');
    });
  });

  describe('sets marketing wallet', async () => {
    it('sets marketing wallet successfully', async () => {
      /* SETUP */
      const marketingWalletBefore = await token.marketingWallet();

      /* EXECUTE */
      await token.connect(owner).setMarketingWallet(addr2.address);

      /* ASSERT */
      const marketingWalletAfter = await token.marketingWallet();

      expect(marketingWalletAfter).to.not.equal(marketingWalletBefore);
      expect(marketingWalletAfter).to.equal(addr2.address);
    });

    it('rejects setting while zero address', async () => {
      /* ASSERT */
      await expect(token.connect(owner).setMarketingWallet(zeroAddress)).to.be.revertedWith('ZeroAddress()');
    });

    it('rejects if not default admin role', async () => {
      /* ASSERT */
      await expect(token.connect(addr1).setMarketingWallet(addr2.address)).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('enableTrading', async () => {
    it('should enable trading', async () => {
      /* SETUP */
      const newStatus = true;
      const statusBefore = await token.tradingEnabled();

      /* EXECUTE */
      const tx = await token.enableTrading(newStatus);

      /* ASSERT */
      const fstatusAfter = await token.tradingEnabled();

      expect(fstatusAfter).to.not.equal(statusBefore);
      expect(fstatusAfter).to.equal(newStatus);
      expect(tx).to.emit(token, "TradingEnabled").withArgs(newStatus);
    });

    it('should disable trading', async () => {
      /* SETUP */
      await token.enableTrading(true);

      const newStatus = false;
      const statusBefore = await token.tradingEnabled();

      /* EXECUTE */
      const tx = await token.enableTrading(newStatus);

      /* ASSERT */
      const fstatusAfter = await token.tradingEnabled();

      expect(fstatusAfter).to.not.equal(statusBefore);
      expect(fstatusAfter).to.equal(newStatus);
      expect(tx).to.emit(token, "TradingEnabled").withArgs(newStatus);
    });

    it('rejects if not default admin role', async () => {
      /* SETUP */
      const newStatus = true;

      /* ASSERT */
      await expect(token.connect(addr1).enableTrading(newStatus)).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('excludeFromFees', async () => {
    it('should exclude accounts from fees', async function () {
      /* SETUP */
      const user = addr1.address;
      const isExcluded = true;

      expect(await token.isExcludedFromFees(user)).to.be.false;

      /* EXECUTE */
      const tx = await token.excludeFromFees(user, isExcluded);

      /* ASSERT */
      expect(await token.isExcludedFromFees(user)).to.be.true;
      await expect(tx).to.emit(token, 'ExcludeFromFees')
        .withArgs(user, isExcluded);
    });

    it('should include accounts to fees', async function () {
      /* SETUP */
      const user = addr1.address;
      const isExcluded = false;

      await token.excludeFromFees(user, true);
      expect(await token.isExcludedFromFees(user)).to.be.true;

      /* EXECUTE */
      const tx = await token.excludeFromFees(user, isExcluded);

      /* ASSERT */
      expect(await token.isExcludedFromFees(user)).to.be.false;
      await expect(tx).to.emit(token, 'ExcludeFromFees')
        .withArgs(user, isExcluded);
    });

    it('rejects if not default admin role', async () => {
      /* SETUP */
      const user = addr1.address;
      const isExcluded = false;

      /* ASSERT */
      await expect(token.connect(addr1).excludeFromFees(user, isExcluded)).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('isExcludedFromFees', async () => {
    it('user is not excluded from fees', async () => {
      /* SETUP */
      const user = addr1.address;

      /* ASSERT */
      expect(await token.isExcludedFromFees(user)).to.be.false;
    })

    it('user is excluded from fees', async () => {
      /* SETUP */
      const user = addr1.address;
      const isExcluded = true;

      await token.excludeFromFees(user, isExcluded);

      /* ASSERT */
      expect(await token.isExcludedFromFees(user)).to.be.true;
    });
  });

  describe('isExcludedFromMaxTransaction', async () => {
    it('user is not excluded from max transaction', async () => {
      /* SETUP */
      const user = addr1.address;

      /* ASSERT */
      expect(await token.isExcludedFromMaxTransaction(user)).to.be.false;
    })

    it('user is excluded from max transaction', async () => {
      /* SETUP */
      const user = addr1.address;
      const isExcluded = true;

      await token.excludeFromMaxTransaction(user, isExcluded);

      /* ASSERT */
      expect(await token.isExcludedFromMaxTransaction(user)).to.be.true;
    });
  });

  describe('updateBuyFees', async () => {
    it('should update buy fees', async () => {
      /* SETUP */
      const newLiquidityFee = 1;
      const newMarketingFee = 2;

      const liquidityFeeBefore = await token.liquidityFeeOnBuy();
      const marketingFeeBefore = await token.marketingFeeOnBuy();

      /* EXECUTE */
      const tx = await token.updateBuyFees(newLiquidityFee, newMarketingFee);

      /* ASSERT */
      const liquidityFeeAfter = await token.liquidityFeeOnBuy();
      const marketingFeeAfter = await token.marketingFeeOnBuy();

      expect(liquidityFeeAfter).to.not.equal(liquidityFeeBefore);
      expect(marketingFeeAfter).to.not.equal(marketingFeeBefore);
      expect(newLiquidityFee).to.equal(liquidityFeeAfter);
      expect(newMarketingFee).to.equal(marketingFeeAfter);
      expect(tx).to.emit(token, "UpdateBuyFees").withArgs(newLiquidityFee, newMarketingFee);
    });

    it('rejects if not default admin role', async () => {
      /* SETUP */
      const newLiquidityFee = 1;
      const newMarketingFee = 2;

      /* ASSERT */
      await expect(token.connect(addr1).updateBuyFees(newLiquidityFee, newMarketingFee)).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('updateSellFees', async () => {
    it('should update sell fees', async () => {
      /* SETUP */
      const newLiquidityFee = 1;
      const newMarketingFee = 2;

      const liquidityFeeBefore = await token.liquidityFeeOnSell();
      const marketingFeeBefore = await token.marketingFeeOnSell();

      /* EXECUTE */
      const tx = await token.updateSellFees(newLiquidityFee, newMarketingFee);

      /* ASSERT */
      const liquidityFeeAfter = await token.liquidityFeeOnSell();
      const marketingFeeAfter = await token.marketingFeeOnSell();

      expect(liquidityFeeAfter).to.not.equal(liquidityFeeBefore);
      expect(marketingFeeAfter).to.not.equal(marketingFeeBefore);
      expect(newLiquidityFee).to.equal(liquidityFeeAfter);
      expect(newMarketingFee).to.equal(marketingFeeAfter);
      expect(tx).to.emit(token, "UpdateSellFees").withArgs(newLiquidityFee, newMarketingFee);
    });

    it('rejects if not default admin role', async () => {
      /* SETUP */
      const newLiquidityFee = 1;
      const newMarketingFee = 2;

      /* ASSERT */
      await expect(token.connect(addr1).updateSellFees(newLiquidityFee, newMarketingFee)).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('updateWalletToWalletTransferFee', async () => {
    it('should update wallet to wallet transfer fee', async () => {
      /* SETUP */
      const newFee = 1;
      const feeBefore = await token.walletToWalletTransferFee();

      /* EXECUTE */
      const tx = await token.updateWalletToWalletTransferFee(newFee);

      /* ASSERT */
      const feeAfter = await token.walletToWalletTransferFee();

      expect(feeAfter).to.not.equal(feeBefore);
      expect(feeAfter).to.equal(newFee);
      expect(tx).to.emit(token, "UpdateWalletToWalletTransferFee").withArgs(newFee);
    });

    it('rejects if not default admin role', async () => {
      /* SETUP */
      const newFee = 1;

      /* ASSERT */
      await expect(token.connect(addr1).updateWalletToWalletTransferFee(newFee)).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('excludeFromMaxTransaction', async () => {
    it('should exclude from max transaction', async function () {
      /* SETUP */
      const user = addr1.address;
      const isExcluded = true;

      expect(await token.isExcludedFromMaxTransaction(user)).to.be.false;

      /* EXECUTE */
      const tx = await token.excludeFromMaxTransaction(user, isExcluded);

      /* ASSERT */
      expect(await token.isExcludedFromMaxTransaction(user)).to.be.true;
      await expect(tx).to.emit(token, 'ExcludedFromMaxTransaction')
        .withArgs(user, isExcluded);
    });

    it('should include to max transaction', async function () {
      /* SETUP */
      const user = addr1.address;
      const isExcluded = false;

      await token.excludeFromMaxTransaction(user, true);
      expect(await token.isExcludedFromMaxTransaction(user)).to.be.true;

      /* EXECUTE */
      const tx = await token.excludeFromMaxTransaction(user, isExcluded);

      /* ASSERT */
      expect(await token.isExcludedFromMaxTransaction(user)).to.be.false;
      await expect(tx).to.emit(token, 'ExcludedFromMaxTransaction')
        .withArgs(user, isExcluded);
    });

    it('rejects if not default admin role', async () => {
      /* SETUP */
      const user = addr1.address;
      const isExcluded = false;

      /* ASSERT */
      await expect(token.connect(addr1).excludeFromMaxTransaction(user, isExcluded)).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('isAbuser', async () => {
    it('user is not abuser', async () => {
      /* ASSERT */
      expect(await token.isAbuser(addr1.address)).to.equal(false);
    })

    it('user is abuser', async () => {
      /* SETUP */
      await token.addAbusers([addr1.address]);

      /* ASSERT */
      expect(await token.isAbuser(addr1.address)).to.equal(true);
    });
  });

  describe('addAbusers', async () => {
    it('adds abuser successfully', async () => {
      /* SETUP */
      expect(await token.isAbuser(addr1.address)).to.equal(false);
      expect(await token.isAbuser(addr1.address)).to.equal(false);

      /* EXECUTE */
      const tx = await token.addAbusers([addr1.address, addr2.address]);

      /* ASSERT */
      expect(await token.isAbuser(addr1.address)).to.equal(true);
      expect(await token.isAbuser(addr2.address)).to.equal(true);
      expect(tx).to.emit(token, "AddedToAbusers").withArgs([addr1.address, addr2.address]);
    });

    it('rejects zero address', async () => {
      /* ASSERT */
      await expect(token.addAbusers([zeroAddress])).to.be.revertedWith('ZeroAddress()');
    });

    it('rejects re-adding already abuser user', async () => {
      /* SETUP */
      await token.addAbusers([addr1.address]);

      /* ASSERT */
      await expect(token.addAbusers([addr1.address])).to.be.revertedWith('UserIsAbuser()');
    });

    it('rejects if not default admin role', async () => {
      /* ASSERT */
      await expect(token.connect(addr1).addAbusers([addr1.address, addr2.address])).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('removeAbusers', async () => {
    it('removes abusers successfully', async () => {
      /* SETUP */
      await token.addAbusers([addr1.address, addr2.address]);
      expect(await token.isAbuser(addr1.address)).to.equal(true);
      expect(await token.isAbuser(addr2.address)).to.equal(true);

      /* EXECUTE */
      const tx = await token.removeAbusers([addr1.address]);

      /* ASSERT */
      expect(await token.isAbuser(addr1.address)).to.equal(false);
      expect(await token.isAbuser(addr2.address)).to.equal(true);
      expect(tx).to.emit(token, "RemovedFromAbusers").withArgs([addr1.address]);
    });

    it('rejects zero address', async () => {
      /* ASSERT */
      await expect(token.removeAbusers([zeroAddress])).to.be.revertedWith('ZeroAddress()');
    });

    it('rejects re-deletion already !abuser user', async () => {
      /* ASSERT */
      await expect(token.removeAbusers([addr1.address])).to.be.revertedWith('UserIsNotAbuser()');
    });

    it('rejects if not default admin role', async () => {
      /* SETUP */
      await token.addAbusers([addr1.address, addr2.address]);

      /* ASSERT */
      await expect(token.connect(addr1).removeAbusers([addr1.address, addr2.address])).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('updateSwapEnabled', async () => {
    it('should enable swap', async () => {
      /* SETUP */
      const newStatus = true;
      const statusBefore = await token.swapEnabled();

      /* EXECUTE */
      const tx = await token.updateSwapEnabled(newStatus);

      /* ASSERT */
      const statusAfter = await token.swapEnabled();

      expect(statusAfter).to.not.equal(statusBefore);
      expect(statusAfter).to.equal(newStatus);
      expect(tx).to.emit(token, "SwapEnabled").withArgs(newStatus);
    });

    it('should disable swap', async () => {
      /* SETUP */
      await token.updateSwapEnabled(true);

      const newStatus = false;
      const statusBefore = await token.swapEnabled();

      /* EXECUTE */
      const tx = await token.updateSwapEnabled(newStatus);

      /* ASSERT */
      const statusAfter = await token.swapEnabled();

      expect(statusAfter).to.not.equal(statusBefore);
      expect(statusAfter).to.equal(newStatus);
      expect(tx).to.emit(token, "SwapEnabled").withArgs(newStatus);
    });

    it('rejects if not default admin role', async () => {
      /* SETUP */
      const newStatus = true;

      /* ASSERT */
      await expect(token.connect(addr1).updateSwapEnabled(newStatus)).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('updateSwapTokensAtAmount', async () => {
    it('should update swap tokens at amoun', async () => {
      /* SETUP */
      const newAmount = 1;
      const amountBefore = await token.swapTokensAtAmount();

      /* EXECUTE */
      const tx = await token.updateSwapTokensAtAmount(newAmount);

      /* ASSERT */
      const amountAfter = await token.swapTokensAtAmount();

      expect(amountAfter).to.not.equal(amountBefore);
      expect(amountAfter).to.equal(newAmount);
      expect(tx).to.emit(token, "UpdateSwapTokensAtAmount").withArgs(newAmount);
    });

    it('rejects if not default admin role', async () => {
      /* SETUP */
      const newAmount = 1;

      /* ASSERT */
      await expect(token.connect(addr1).updateSwapTokensAtAmount(newAmount)).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('updateMaxBuyTransaction', async () => {
    it('should update max buy transaction', async () => {
      /* SETUP */
      const newValue = 1;
      const valueBefore = await token.maxBuyTransaction();

      /* EXECUTE */
      const tx = await token.updateMaxBuyTransaction(newValue);

      /* ASSERT */
      const valueAfter = await token.maxBuyTransaction();

      expect(valueAfter).to.not.equal(valueBefore);
      expect(valueAfter).to.equal(newValue);
      expect(tx).to.emit(token, "UpdateMaxBuyTransaction").withArgs(newValue);
    });

    it('rejects if not default admin role', async () => {
      /* SETUP */
      const newFee = 1;

      /* ASSERT */
      await expect(token.connect(addr1).updateMaxBuyTransaction(newFee)).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('updateMaxSellTransaction', async () => {
    it('should update max sell transaction', async () => {
      /* SETUP */
      const newValue = 1;
      const valueBefore = await token.maxSellTransaction();

      /* EXECUTE */
      const tx = await token.updateMaxSellTransaction(newValue);

      /* ASSERT */
      const valueAfter = await token.maxSellTransaction();

      expect(valueAfter).to.not.equal(valueBefore);
      expect(valueAfter).to.equal(newValue);
      expect(tx).to.emit(token, "UpdateMaxSellTransaction").withArgs(newValue);
    });

    it('rejects if not default admin role', async () => {
      /* SETUP */
      const newFee = 1;

      /* ASSERT */
      await expect(token.connect(addr1).updateMaxSellTransaction(newFee)).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('updateMaxWalletAmount', async () => {
    it('should update max wallet amount', async () => {
      /* SETUP */
      const newValue = 1;
      const valueBefore = await token.maxWalletAmount();

      /* EXECUTE */
      const tx = await token.updateMaxWalletAmount(newValue);

      /* ASSERT */
      const valueAfter = await token.maxWalletAmount();

      expect(valueAfter).to.not.equal(valueBefore);
      expect(valueAfter).to.equal(newValue);
      expect(tx).to.emit(token, "UpdateMaxWalletAmount").withArgs(newValue);
    });

    it('rejects if not default admin role', async () => {
      /* SETUP */
      const newFee = 1;

      /* ASSERT */
      await expect(token.connect(addr1).updateMaxWalletAmount(newFee)).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('withdrawStuckTokens', async () => {
    it('should allow the owner to withdraw stuck tokens', async function () {
      /* SETUP */
      const to = owner.address;
      const amount = parseUnits('1', 18);

      // Transfer some tokens to the contract
      await busdMock.mint(token.address, amount);

      expect(await busdMock.balanceOf(token.address)).to.equal(amount);

      const ownerBalanceBefore = await busdMock.balanceOf(to);

      await token.connect(owner).withdrawStuckTokens(busdMock.address, to);

      const ownerBalanceAfter = await busdMock.balanceOf(to);

      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore.add(amount));
      expect(await busdMock.balanceOf(token.address)).to.equal(0);
    });

    it('should prevent zero address from withdrawing stuck tokens', async function () {
      /* ASSERT */
      await expect(token.connect(owner).withdrawStuckTokens(zeroAddress, addr2.address)).to.be.revertedWith(
        `_token address cannot be 0`
      );
    });

    it('should prevent own contract address from withdrawing stuck tokens', async function () {
      /* ASSERT */
      await expect(token.connect(owner).withdrawStuckTokens(token.address, addr2.address)).to.be.revertedWith(
        `Owner cannot claim contract's balance of its own tokens`
      );
    });

    it('should prevent non-admin from withdrawing stuck tokens', async function () {
      /* ASSERT */
      await expect(token.connect(addr1).withdrawStuckTokens(busdMock.address, addr2.address)).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });

  describe('withdrawStuckBNB', async () => {
    it('should allow the owner to withdraw stuck BNB', async function () {
      /* SETUP */
      const to = owner.address;
      const amount = parseUnits('1');

      // Send BNB to the contract address
      await owner.sendTransaction({
        to: token.address,
        value: amount
      });

      const ownerBalanceBefore = await ethers.provider.getBalance(to);

      const tx = await token.connect(owner).withdrawStuckBNB(to);
      const minedTx = await tx.wait();
      const fee = minedTx.gasUsed.mul(minedTx.effectiveGasPrice);

      const ownerBalanceAfter = await ethers.provider.getBalance(to);

      /* ASSERT */
      expect(ownerBalanceAfter).to.be.equal(ownerBalanceBefore.add(amount).sub(fee));
    });

    it('should prevent non-admin from withdrawing stuck BNB', async function () {
      /* ASSERT */
      await expect(token.connect(addr1).withdrawStuckBNB(addr2.address)).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`
      );
    });
  });
}); 