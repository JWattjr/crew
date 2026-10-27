// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice USDC blocklisting on this contract address will freeze all distributions and payroll. There is no admin override and no upgrade path.
contract Crew is Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error NotOwner();
    error NotPendingOwner();
    error InvalidSplit();
    error ZeroAddress();
    error DuplicateRecipient();
    error TooManyRecipients();
    error TooManyMembers();
    error MemberNotFound();
    error MemberAlreadyExists();
    error InsufficientPayrollPool();
    error SalariesEarned(uint256 requested, uint256 available);

    event Distributed(uint256 newRevenue, uint256 toPayroll);
    event Paid(address indexed recipient, uint256 amount);
    event Revenue(address indexed payer, uint256 amount, string memo);
    event Claimed(address indexed wallet, uint256 paid, uint256 stillOwed);
    event MemberAdded(address indexed wallet, string label, uint256 weeklyRate);
    event MemberRemoved(address indexed wallet);
    event RateChanged(address indexed wallet, uint256 newWeeklyRate);
    event PayrollFunded(address indexed from, uint256 amount);
    event PayrollWithdrawn(address indexed to, uint256 amount);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SplitUpdated(address[] recipients, uint16[] bps, uint16 payrollBps);
    event EmergencySplitUsed();

    uint256 public constant MAX_RECIPIENTS = 10;
    uint256 public constant MAX_MEMBERS = 20;
    uint256 public constant BPS_TOTAL = 10_000;
    uint256 public constant ONE_WEEK = 1 weeks;

    IERC20 public usdc;
    address public owner;
    address public pendingOwner;
    string public name;

    uint16[] public recipientBps;
    address[] public recipients;
    uint16 public payrollBps;

    uint256 public payrollPool;

    struct Member {
        address wallet;
        string label;
        uint256 weeklyRate;
        uint256 owed;
        uint256 lastAccrual;
        uint256 accrualRemainder;
        bool active;
    }

    struct MemberView {
        address wallet;
        string label;
        uint256 weeklyRate;
        uint256 owed;
        uint256 accruedNow;
        bool active;
    }

    Member[] private _members;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _usdc,
        address _owner,
        string calldata _name,
        address[] calldata _recipients,
        uint16[] calldata _recipientBps,
        uint16 _payrollBps
    ) external initializer {
        if (_usdc == address(0) || _owner == address(0)) revert ZeroAddress();

        _validateSplit(_recipients, _recipientBps, _payrollBps);

        usdc = IERC20(_usdc);
        owner = _owner;
        name = _name;
        recipients = _recipients;
        recipientBps = _recipientBps;
        payrollBps = _payrollBps;

        emit OwnershipTransferred(address(0), _owner);
        emit SplitUpdated(_recipients, _recipientBps, _payrollBps);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    function distribute() public nonReentrant {
        _distribute();
    }

    function pay(uint256 amount, string calldata memo) external nonReentrant {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Revenue(msg.sender, amount, memo);
        _distribute();
    }

    function setSplit(
        address[] calldata _recipients,
        uint16[] calldata _bps,
        uint16 _payrollBps
    ) external onlyOwner {
        try this.distribute() {} catch {}
        _validateSplit(_recipients, _bps, _payrollBps);

        recipients = _recipients;
        recipientBps = _bps;
        payrollBps = _payrollBps;

        emit SplitUpdated(_recipients, _bps, _payrollBps);
    }

    /// @notice Use only when the normal setSplit is blocked (e.g. a recipient is blocklisted). Any undistributed revenue at the time of this call will be distributed under the NEW split, not the old one.
    function setSplitEmergency(
        address[] calldata _recipients,
        uint16[] calldata _bps,
        uint16 _payrollBps
    ) external onlyOwner {
        _validateSplit(_recipients, _bps, _payrollBps);

        recipients = _recipients;
        recipientBps = _bps;
        payrollBps = _payrollBps;

        emit SplitUpdated(_recipients, _bps, _payrollBps);
        emit EmergencySplitUsed();
    }

    function fundPayroll(uint256 amount) external nonReentrant {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        payrollPool += amount;
        emit PayrollFunded(msg.sender, amount);
    }

    /// @notice Each wallet can only ever be a member once. Use a different wallet address to re-hire the same person.
    function addMember(address wallet, string calldata label, uint256 weeklyRate) external onlyOwner {
        if (wallet == address(0)) revert ZeroAddress();
        if (_members.length >= MAX_MEMBERS) revert TooManyMembers();

        uint256 len = _members.length;
        for (uint256 i = 0; i < len; i++) {
            if (_members[i].wallet == wallet) {
                revert MemberAlreadyExists();
            }
        }

        _members.push(
            Member({
                wallet: wallet,
                label: label,
                weeklyRate: weeklyRate,
                owed: 0,
                lastAccrual: block.timestamp,
                accrualRemainder: 0,
                active: true
            })
        );

        emit MemberAdded(wallet, label, weeklyRate);
    }

    function setRate(address wallet, uint256 newWeeklyRate) external onlyOwner {
        (bool found, uint256 idx) = _findMember(wallet);
        if (!found || !_members[idx].active) revert MemberNotFound();

        _settleAccrual(idx);
        _members[idx].weeklyRate = newWeeklyRate;

        emit RateChanged(wallet, newWeeklyRate);
    }

    function removeMember(address wallet) external onlyOwner {
        (bool found, uint256 idx) = _findMember(wallet);
        if (!found) revert MemberNotFound();

        Member storage m = _members[idx];
        if (!m.active) revert MemberNotFound();

        _settleAccrual(idx);
        m.active = false;
        m.weeklyRate = 0;

        emit MemberRemoved(wallet);
    }

    function claim(address wallet) external nonReentrant {
        (bool found, uint256 idx) = _findMember(wallet);
        if (!found) revert MemberNotFound();

        _settleAccrual(idx);

        Member storage m = _members[idx];
        uint256 toPay = Math.min(m.owed, payrollPool);

        m.owed -= toPay;
        payrollPool -= toPay;

        if (toPay > 0) {
            usdc.safeTransfer(m.wallet, toPay);
        }

        emit Claimed(wallet, toPay, m.owed);
    }

    function withdrawPayroll(uint256 amount, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();

        uint256 totalAccrued = totalAccruedNow();
        uint256 withdrawable = payrollPool > totalAccrued ? payrollPool - totalAccrued : 0;
        if (amount > withdrawable) revert SalariesEarned(amount, withdrawable);

        payrollPool -= amount;
        usdc.safeTransfer(to, amount);

        emit PayrollWithdrawn(to, amount);
    }

    function undistributed() external view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        return balance > payrollPool ? balance - payrollPool : 0;
    }

    function totalAccruedNow() public view returns (uint256) {
        uint256 total = 0;
        uint256 len = _members.length;

        for (uint256 i = 0; i < len; i++) {
            Member storage m = _members[i];
            uint256 elapsed = block.timestamp - m.lastAccrual;
            uint256 rateSeconds = (m.weeklyRate * elapsed) + m.accrualRemainder;
            uint256 accruedNow = rateSeconds / ONE_WEEK;
            total += m.owed + accruedNow;
        }

        return total;
    }

    function weeklyBurn() public view returns (uint256) {
        uint256 burn = 0;
        uint256 len = _members.length;

        for (uint256 i = 0; i < len; i++) {
            if (_members[i].active) {
                burn += _members[i].weeklyRate;
            }
        }

        return burn;
    }

    function runwaySeconds() external view returns (uint256) {
        uint256 burn = weeklyBurn();
        if (burn == 0) return type(uint256).max;
        return (payrollPool * ONE_WEEK) / burn;
    }

    function getSplit() external view returns (address[] memory, uint16[] memory, uint16) {
        return (recipients, recipientBps, payrollBps);
    }

    function getMembers() external view returns (MemberView[] memory members) {
        uint256 len = _members.length;
        members = new MemberView[](len);

        for (uint256 i = 0; i < len; i++) {
            Member storage m = _members[i];
            uint256 elapsed = block.timestamp - m.lastAccrual;
            uint256 rateSeconds = (m.weeklyRate * elapsed) + m.accrualRemainder;
            uint256 accruedNow = rateSeconds / ONE_WEEK;

            members[i] = MemberView({
                wallet: m.wallet,
                label: m.label,
                weeklyRate: m.weeklyRate,
                owed: m.owed,
                accruedNow: accruedNow,
                active: m.active
            });
        }
    }

    function _distribute() internal {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance <= payrollPool) return;

        uint256 newRevenue = balance - payrollPool;

        uint256 toPayroll = (newRevenue * payrollBps) / BPS_TOTAL;
        payrollPool += toPayroll;

        uint256 toSplit = newRevenue - toPayroll;

        uint256 paid = 0;
        uint256 len = recipients.length;

        for (uint256 i = 1; i < len; i++) {
            uint256 amt = (toSplit * recipientBps[i]) / BPS_TOTAL;
            paid += amt;
            usdc.safeTransfer(recipients[i], amt);
            emit Paid(recipients[i], amt);
        }

        uint256 first = toSplit - paid;
        usdc.safeTransfer(recipients[0], first);
        emit Paid(recipients[0], first);

        emit Distributed(newRevenue, toPayroll);
    }

    function _validateSplit(
        address[] calldata _recipients,
        uint16[] calldata _recipientBps,
        uint16 _payrollBps
    ) internal pure {
        uint256 len = _recipients.length;
        if (len == 0) revert InvalidSplit();
        if (len > MAX_RECIPIENTS) revert TooManyRecipients();
        if (_recipientBps.length != len) revert InvalidSplit();

        uint256 sum = _payrollBps;
        for (uint256 i = 0; i < len; i++) {
            if (_recipients[i] == address(0)) revert ZeroAddress();
            sum += _recipientBps[i];

            for (uint256 j = i + 1; j < len; j++) {
                if (_recipients[i] == _recipients[j]) revert DuplicateRecipient();
            }
        }

        if (sum != BPS_TOTAL) revert InvalidSplit();
    }

    function _findMember(address wallet) internal view returns (bool found, uint256 idx) {
        uint256 len = _members.length;
        for (uint256 i = 0; i < len; i++) {
            if (_members[i].wallet == wallet) {
                return (true, i);
            }
        }
        return (false, 0);
    }

    function _settleAccrual(uint256 idx) internal {
        Member storage m = _members[idx];
        uint256 elapsed = block.timestamp - m.lastAccrual;
        uint256 rateSeconds = (m.weeklyRate * elapsed) + m.accrualRemainder;
        uint256 accrued = rateSeconds / ONE_WEEK;
        m.accrualRemainder = rateSeconds % ONE_WEEK;
        m.owed += accrued;
        m.lastAccrual = block.timestamp;
    }
}
