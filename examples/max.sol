// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

//        // https://bscscan.com/token/0xf6d2657ebb5602bf823901412c5e41e030f3ece2#code
contract Max is AccessControl {
    uint256 maxBuyTransaction;
    uint256 maxSellTransaction;
    uint256 maxWalletAmount;

    mapping(address => bool) private _isExcludedFromMaxWallet;
    mapping(address => bool) private _isExcludedFromMaxTransaction;

    event UpdateMaxBuyTransaction(uint256 _maxBuyTransaction);
    event UpdateMaxSellTransaction(uint256 maxSellTransaction);
    event UpdateMaxWalletAmount(uint256 maxWalletAmount);

    event ExcludedFromMaxWallet(address user, bool isExcluded);
    event ExcludedFromMaxTransaction(address user, bool isExcluded);

    function excludeFromMaxTransaction(
        address _user,
        bool _isExcluded
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _isExcludedFromMaxTransaction[_user] = _isExcluded;

        emit ExcludedFromMaxTransaction(_user, _isExcluded);
    }

    function excludeFromMaxWallet(
        address _user,
        bool _isExcluded
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _isExcludedFromMaxWallet[_user] = _isExcluded;

        emit ExcludedFromMaxWallet(_user, _isExcluded);
    }

    function updateMaxBuyTransaction(
        uint256 _maxBuyTransaction
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxBuyTransaction = _maxBuyTransaction;

        emit UpdateMaxBuyTransaction(_maxBuyTransaction);
    }

    function updateMaxSellTransaction(
        uint256 _maxSellTransaction
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxSellTransaction = _maxSellTransaction;

        emit UpdateMaxSellTransaction(_maxSellTransaction);
    }

    function updateMaxWalletAmount(
        uint256 _maxWalletAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxWalletAmount = _maxWalletAmount;

        emit UpdateMaxWalletAmount(_maxWalletAmount);
    }

    function isExcludedFromMaxWallet(address _user) public view returns (bool) {
        return _isExcludedFromMaxWallet[_user];
    }

    function isExcludedFromMaxTransaction(
        address _user
    ) public view returns (bool) {
        return _isExcludedFromMaxTransaction[_user];
    }
}
