// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// https://bscscan.com/token/0xf6d2657ebb5602bf823901412c5e41e030f3ece2#code
contract Fee is AccessControl {
    uint256 buyFee;
    uint256 sellFee;
    uint256 buybackFee;

    mapping(address => bool) private _isExcludedFromFees;

    event ExcludeFromFees(address user, bool isExcluded);

    event UpdateBuyFee(uint256 buyFee);
    event UpdateSellFee(uint256 sellFee);
    event UpdateBuybackFee(uint256 buybackFee);

    function excludeFromFees(
        address _user,
        bool _isExcluded
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _isExcludedFromFees[_user] = _isExcluded;

        emit ExcludeFromFees(_user, _isExcluded);
    }

    function isExcludedFromFees(address _user) public view returns (bool) {
        return _isExcludedFromFees[_user];
    }

    function updateBuyFees(
        uint256 _buyFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        buyFee = _buyFee;

        emit UpdateBuyFee(_buyFee);
    }

    function updateSellFees(
        uint256 _sellFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        sellFee = _sellFee;

        emit UpdateSellFee(_sellFee);
    }

    function updateBuybackFee(
        uint256 _buybackFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        buybackFee = _buybackFee;

        emit UpdateBuybackFee(_buybackFee);
    }
}
