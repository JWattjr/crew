// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Crew} from "../Crew.sol";
import {CrewFactory} from "../CrewFactory.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

/// @dev Shared base for all Crew test suites.
abstract contract CrewTestBase is Test {
    // ── canonical USDC address (matches contract constant) ──────────────────
    address internal constant USDC_ADDR = 0x3600000000000000000000000000000000000000;

    // ── actors ───────────────────────────────────────────────────────────────
    address internal owner   = makeAddr("owner");
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");
    address internal charlie = makeAddr("charlie");
    address internal payer   = makeAddr("payer");

    // ── contracts ────────────────────────────────────────────────────────────
    MockERC20    internal usdc;
    CrewFactory  internal factory;
    Crew         internal crew;

    // ── split: founder 5000, tax 2000, payroll 3000 ─────────────────────────
    address[] internal defaultRecipients;
    uint16[]  internal defaultBps;
    uint16    internal defaultPayrollBps = 3000;

    uint256 internal constant ONE_WEEK = 1 weeks; // 604800

    // ────────────────────────────────────────────────────────────────────────
    function setUp() public virtual {
        // 1. Deploy mock ERC-20 and etch it at the canonical USDC address
        MockERC20 impl = new MockERC20("Mock USDC", "mUSDC", 6);
        vm.etch(USDC_ADDR, address(impl).code);
        usdc = MockERC20(USDC_ADDR);

        // 2. Factory (deploys Crew implementation internally)
        factory = new CrewFactory(USDC_ADDR);

        // 3. Default split arrays
        defaultRecipients = new address[](2);
        defaultRecipients[0] = owner;   // founder – receives dust
        defaultRecipients[1] = charlie; // tax / secondary

        defaultBps = new uint16[](2);
        defaultBps[0] = 5000;
        defaultBps[1] = 2000;
        // payroll = 3000 → sum = 10000 ✓

        // 4. Deploy crew via factory
        vm.prank(owner);
        crew = Crew(factory.createCrew(
            "Test Crew",
            defaultRecipients,
            defaultBps,
            defaultPayrollBps
        ));

        // 5. Seed payer with USDC
        usdc.mint(payer, 10_000e6);
        vm.prank(payer);
        usdc.approve(address(crew), type(uint256).max);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /// @dev Give `who` some USDC and approve the crew to spend it.
    function _giveAndApprove(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(crew), type(uint256).max);
    }

    /// @dev Direct transfer of USDC to the crew contract (simulating raw transfer).
    function _directTransfer(uint256 amount) internal {
        usdc.mint(address(this), amount);
        usdc.transfer(address(crew), amount);
    }

    /// @dev Build a single-recipient split: recipient gets (10000 - _payrollBps) bps.
    function _singleSplit(address recipient, uint16 _payrollBps)
        internal
        pure
        returns (address[] memory rs, uint16[] memory bps)
    {
        rs = new address[](1);
        rs[0] = recipient;
        bps = new uint16[](1);
        bps[0] = uint16(10_000 - _payrollBps);
    }
}
