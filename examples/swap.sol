// // SPDX-License-Identifier: MIT
// pragma solidity 0.8.19;

// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
// import "@openzeppelin/contracts/access/AccessControl.sol";
// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// // https://bscscan.com/token/0xf6d2657ebb5602bf823901412c5e41e030f3ece2#code
// contract Fee is AccessControl {
//     // IUniswapV2Router02 public uniswapV2Router;
//     // address public  uniswapV2Pair;

//     bool public swapEnabled = false;
//     uint256 swapTokensAtAmount;

//     event SwapEnabled(bool enabled);
//     event UpdateSwapTokensAtAmount(uint256 swapTokensAtAmount);
//     event SetAutomatedMarketMakerPair(address indexed pair, bool indexed value);

//     function updateSwapEnabled(
//         bool _enabled
//     ) external onlyRole(DEFAULT_ADMIN_ROLE) {
//         swapEnabled = _enabled;

//         emit SwapEnabled(_enabled);
//     }

//     function updateSwapTokensAtAmount(
//         uint256 _newAmount
//     ) external onlyRole(DEFAULT_ADMIN_ROLE) {
//         swapTokensAtAmount = _newAmount;

//         emit UpdateSwapTokensAtAmount(_newAmount);
//     }

//     function transfer() external {}

//     function transferFrom() external {}

//     //https://bscscan.com/token/0xcf9f706a794c1811c0b9c988388c6bf423f345ad#code
//     //https://bscscan.com/token/0x44ff116ccf4f72c0529a55a756509b385aa9fb87#code
//     //https://bscscan.com/token/0x47454e54643061c24d833a41625547406e356554#code
//     function withdrawStuckTokens(
//         address _token,
//         address _to
//     ) external onlyRole(DEFAULT_ADMIN_ROLE) {
//         require(_token != address(0), "_token address cannot be 0");
//         uint256 balance = IERC20(_token).balanceOf(address(this));
//         IERC20(_token).transfer(_to, balance);
//     }

//     function withdrawStuckBNB(
//         address _to
//     ) external onlyRole(DEFAULT_ADMIN_ROLE) {
//         payable(_to).sendValue(address(this).balance);
//     }
// }
