// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// https://bscscan.com/token/0xf6d2657ebb5602bf823901412c5e41e030f3ece2#code
contract Fee is AccessControl {
    error UserIsAbuser();
    error UserIsNotAbuser();
    
    error ZeroAddress();

    mapping(address => bool) private _isAbuser;

    event AddedToAbusers(address[] _users);
    event RemovedFromAbusers(address[] _users);

    function addAbusers(
        address[] calldata _users
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _addAbusers(_users);
    }

    function removeAbusers(
        address[] calldata _users
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 length = _users.length;

        for (uint256 i = 0; i < length; i++) {
            address user = _users[i];
            if (user == address(0)) {
                revert ZeroAddress();
            }
            if (_isAbuser[user] == false) {
                revert UserIsNotAbuser();
            }
            _isAbuser[user] = false;
        }

        emit RemovedFromAbusers(_users);
    }

    function isAbuser(address _user) external view returns (bool) {
        return _isAbuser[_user];
    }

    function _addAbusers(address[] memory _users) private {
        uint256 length = _users.length;

        for (uint256 i = 0; i < length; i++) {
            address user = _users[i];
            if (user == address(0)) {
                revert ZeroAddress();
            }
            if (_isAbuser[user] == true) {
                revert UserIsAbuser();
            }
            _isAbuser[user] = true;
        }

        emit AddedToAbusers(_users);
    }
}
