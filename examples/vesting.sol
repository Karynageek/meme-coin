// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

//        // https://bscscan.com/token/0xf6d2657ebb5602bf823901412c5e41e030f3ece2#code
contract Max is ERC20, AccessControl {
    error DataLengthsNotMatch();
    error DataLengthsIsZero();
    error TotalAmountLessThanClaimed();
    error NotEnoughFunds();
    error ClaimAmountIsZero();
    error InsufficientTokens();
    error IncorrectAmount();
    error DurationIsZero();
    error IncorrectTGE();
    error ZeroAddress();
    error NotStarted();

    error ExceededMaxTokenSupply();
    error InvalidValue();

    uint256 public constant MAX_TOTAL_SUPPLY = 19000000000e18;

    uint128 public startAt;
    uint256 public vestingSchedulesTotalAmount;
    uint256 public mintedCount;

    mapping(address => VestingSchedule) public vestingSchedules;

    struct VestingSchedule {
        uint128 startAt; // The start date of vesting.
        uint128 cliffInSeconds; //The duration while token locks.
        uint128 vestingInSeconds; // The duration of vesting in seconds.
        uint256 totalAmount; // The amount of vesting token.
        uint16 tge; // The unlock percent of tokens which available in any time.
        uint256 claimed; // The amount of vesting token which was claimed.
    }

    event Claimed(address account, uint256 amount, uint128 createdAt);
    event BatchVestingCreated(
        address[] accounts,
        uint256[] amounts,
        uint128 cliff,
        uint128 vesting,
        uint128 createdAt,
        uint16 tge
    );
    event Minted(address indexed _user, uint256 _amount);

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(
        string memory name_,
        string memory symbol_,
        address admin_,
        address minter_
    ) ERC20(name_, symbol_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(MINTER_ROLE, minter_);
    }

    /**
     * @notice Mints tokens to a specified user.
     *
     * @param _user The address of the user to mint tokens for.
     * @param _amount The amount of tokens to mint.
     *
     * @dev Reverts if the mint amount is zero, or the total supply exceeds the maximum limit.
     * @dev Mints new tokens to the specified user's address.
     * @dev Emits a `Minted` event with minting details.
     */
    function mint(
        address _user,
        uint256 _amount
    ) external onlyRole(MINTER_ROLE) {
        if (_amount == 0) {
            revert InvalidValue();
        }
        if (mintedCount + _amount + vestingSchedulesTotalAmount > MAX_TOTAL_SUPPLY) {
            revert ExceededMaxTokenSupply();
        }
        mintedCount += _amount;

        _mint(_user, _amount);

        emit Minted(_user, _amount);
    }

    function setStartAt() external onlyRole(DEFAULT_ADMIN_ROLE) {
        startAt = uint128(block.timestamp);
    }

    /**
     * @notice Sets vest for user.
     * @param _accounts The array of users.
     * @param _amounts The array of amounts.
     * @param _tge The unlock percent of tokens which available in any time.
     * @param _cliff The duration in seconds when token locks.
     * @param _vesting The duration of vesting in seconds.
     */
    function setForClaim(
        address[] calldata _accounts,
        uint256[] calldata _amounts,
        uint16 _tge,
        uint128 _cliff,
        uint128 _vesting
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _batchVestFor(_accounts, _amounts, startAt, _tge, _cliff, _vesting);
    }

    /**
     * @notice Claims available vested tokens for all vesting schedules of the user.
     * If there are no tokens available, the transaction will revert.
     * Emits a `Claimed` event.
     * Transfers the total claimed amount to the user.
     */
    function claim() external {
        uint256 totalVestedAmount = 0;
        VestingSchedule memory schedule = vestingSchedules[msg.sender];
        // Calculate the available amount of tokens for the current vesting schedule.
        uint256 vestedAmount = _vestedAmount(schedule);

        if (vestedAmount > 0) {
            // Increases released amount in vesting.
            vestingSchedules[msg.sender].claimed =
                vestedAmount +
                schedule.claimed;

            emit Claimed(msg.sender, vestedAmount, uint128(block.timestamp));
        }

        totalVestedAmount += vestedAmount;

        if (totalVestedAmount == 0) {
            revert ClaimAmountIsZero();
        }

        // Current amount of tokens in vesting.
        vestingSchedulesTotalAmount -= totalVestedAmount;

        _mint(msg.sender, totalVestedAmount);
    }

    /**
     * @notice Returns the total vesting information for a given account.
     * @param _account The user address.
     * @return totalAmount The total amount of tokens in vesting schedules.
     * @return unlockedAmount The amount of tokens currently unlocked.
     * @return claimedAmount The amount of tokens already claimed.
     * @return lockedAmount The amount of tokens still locked.
     */
    function getTotalVestingInfo(
        address _account
    )
        external
        view
        returns (
            uint256 totalAmount,
            uint256 unlockedAmount,
            uint256 claimedAmount,
            uint256 lockedAmount
        )
    {
        VestingSchedule memory schedule = vestingSchedules[_account];

        unlockedAmount += _vestedAmount(schedule);
        totalAmount += schedule.totalAmount;
        claimedAmount += schedule.claimed;

        lockedAmount = totalAmount - claimedAmount - unlockedAmount;
    }

    /**
     * @notice Creates vesting schedules for user.
     * @param _account The user address.
     * @param _amount The amount of vesting token.
     * @param _startAt The start date of vesting.
     * @param _tge The unlock percent of tokens which available in any time.
     * @param _cliff The duration in seconds when token locks.
     * @param _vesting The duration of vesting in seconds.
     */
    function _vestFor(
        address _account,
        uint256 _amount,
        uint128 _startAt,
        uint16 _tge,
        uint128 _cliff,
        uint128 _vesting
    ) private {
        if (MAX_TOTAL_SUPPLY - mintedCount - vestingSchedulesTotalAmount < _amount) {
            revert InsufficientTokens();
        }
        if (_amount == 0) {
            revert IncorrectAmount();
        }
        if (_vesting == 0) {
            revert DurationIsZero();
        }
        if (_tge > 10000) {
            revert IncorrectTGE();
        }
        if (_account == address(0)) {
            revert ZeroAddress();
        }
        if (_startAt == 0) {
            revert NotStarted();
        }

        uint256 totalAmount = vestingSchedules[_account].totalAmount;
        uint256 claimed = vestingSchedules[_account].claimed;

        if (totalAmount == 0) {
            vestingSchedules[_account].startAt = _startAt;

            // Current amount of tokens in vesting.
            vestingSchedulesTotalAmount += _amount;
        } else {
            if (_amount < claimed) {
                revert TotalAmountLessThanClaimed();
            }

            // Current amount of tokens in vesting if totalAmount was modified.
            vestingSchedulesTotalAmount =
                vestingSchedulesTotalAmount -
                (totalAmount - claimed) +
                _amount;
        }
        vestingSchedules[_account].cliffInSeconds = _cliff;
        vestingSchedules[_account].vestingInSeconds = _vesting;
        vestingSchedules[_account].totalAmount = _amount;
        vestingSchedules[_account].tge = _tge;
        vestingSchedules[_account].claimed = claimed;
    }

    /**
     * @notice Creates vesting schedules for users.
     * @param _accounts The array of users.
     * @param _amounts The array of amounts.
     * @param _startAt The start date of vesting.
     * @param _tge The unlock percent of tokens which available in any time.
     * @param _cliff The duration in seconds when token locks.
     * @param _vesting The duration of vesting in seconds.
     */
    function _batchVestFor(
        address[] calldata _accounts,
        uint256[] calldata _amounts,
        uint128 _startAt,
        uint16 _tge,
        uint128 _cliff,
        uint128 _vesting
    ) private {
        uint16 accountsCount = uint16(_accounts.length);

        if (accountsCount == 0) {
            revert DataLengthsIsZero();
        }

        if (accountsCount != _amounts.length) {
            revert DataLengthsNotMatch();
        }

        for (uint16 i = 0; i < accountsCount; i++) {
            _vestFor(
                _accounts[i],
                _amounts[i],
                _startAt,
                _tge,
                _cliff,
                _vesting
            );
        }

        emit BatchVestingCreated(
            _accounts,
            _amounts,
            _cliff,
            _vesting,
            uint128(block.timestamp),
            _tge
        );
    }

    /**
     * @notice Returns available amount of tokens.
     * @param _vestingSchedule The vesting schedule structure.
     */
    function _vestedAmount(
        VestingSchedule memory _vestingSchedule
    ) private view returns (uint256) {
        uint256 totalAmount = _vestingSchedule.totalAmount;

        if (totalAmount == 0) {
            return 0;
        }

        uint256 claimed = _vestingSchedule.claimed;
        // The unlock amount of tokens which available in any time.
        uint256 tgeAmount = (totalAmount * _vestingSchedule.tge) / 1e4;
        // Duration in seconds from starting vesting.
        uint128 passedTimeInSeconds = uint128(block.timestamp) -
            _vestingSchedule.startAt;

        uint128 cliffInSeconds = _vestingSchedule.cliffInSeconds;
        uint128 vestingInSeconds = _vestingSchedule.vestingInSeconds;
        uint128 maxPossibleTime = vestingInSeconds + cliffInSeconds;

        if (passedTimeInSeconds > maxPossibleTime) {
            passedTimeInSeconds = maxPossibleTime;
        }

        if (passedTimeInSeconds <= cliffInSeconds) {
            passedTimeInSeconds = 0;
        } else {
            passedTimeInSeconds = passedTimeInSeconds - cliffInSeconds;
        }

        uint256 payout = tgeAmount +
            ((totalAmount - tgeAmount) * passedTimeInSeconds) /
            vestingInSeconds;

        if (claimed >= payout) {
            return 0;
        } else {
            return payout - claimed;
        }
    }
}
