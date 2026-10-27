// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CrewTestBase} from "./Crew.Base.t.sol";
import {Crew} from "../Crew.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

/// @dev Invariant handler — drives random state transitions on the Crew contract.
///      Inherits Test so it can use vm.* cheatcodes and bound().
contract CrewHandler is Test {
    Crew        public crew;
    MockERC20   public usdc;
    address     public crewOwner;

    address public alice;
    address public bob;

    bool    public aliceAdded;
    bool    public bobAdded;

    uint256 public ghost_totalFunded;

    constructor(Crew _crew, MockERC20 _usdc, address _owner) {
        crew      = _crew;
        usdc      = _usdc;
        crewOwner = _owner;
        alice     = makeAddr("alice-handler");
        bob       = makeAddr("bob-handler");
    }

    function distribute() external {
        crew.distribute();
    }

    function pay(uint256 amount) external {
        amount = bound(amount, 1, 10_000e6);
        usdc.mint(address(this), amount);
        usdc.approve(address(crew), amount);
        crew.pay(amount, "handler");
    }

    function fundPayroll(uint256 amount) external {
        amount = bound(amount, 1, 10_000e6);
        usdc.mint(address(this), amount);
        usdc.approve(address(crew), amount);
        crew.fundPayroll(amount);
        ghost_totalFunded += amount;
    }

    function claimAlice() external {
        if (!aliceAdded) return;
        try crew.claim(alice) {} catch {}
    }

    function claimBob() external {
        if (!bobAdded) return;
        try crew.claim(bob) {} catch {}
    }

    function addAlice(uint256 rate) external {
        if (aliceAdded) return;
        rate = bound(rate, 0, 1000e6);
        vm.prank(crewOwner);
        try crew.addMember(alice, "alice", rate) {
            aliceAdded = true;
        } catch {}
    }

    function addBob(uint256 rate) external {
        if (bobAdded) return;
        rate = bound(rate, 0, 1000e6);
        vm.prank(crewOwner);
        try crew.addMember(bob, "bob", rate) {
            bobAdded = true;
        } catch {}
    }

    function warpForward(uint256 secs) external {
        secs = bound(secs, 0, 7 days);
        vm.warp(block.timestamp + secs);
    }
}

/// @dev Scenario 11 – invariant tests.
contract CrewInvariantTest is CrewTestBase {
    CrewHandler internal handler;

    function setUp() public override {
        super.setUp();

        handler = new CrewHandler(crew, usdc, owner);

        // Target only the handler so forge doesn't call into Crew directly
        targetContract(address(handler));
    }

    // ── INV-1: usdc.balanceOf(crew) >= payrollPool at all times ─────────────
    function invariant_BalanceGeqPayrollPool() public view {
        assertGe(
            usdc.balanceOf(address(crew)),
            crew.payrollPool(),
            "INV: balance < payrollPool"
        );
    }

    // ── INV-2: payrollPool never goes negative (implicit in uint256, but
    //           we check it stays <= actual USDC balance) ────────────────────
    function invariant_PayrollPoolLeqBalance() public view {
        assertLe(
            crew.payrollPool(),
            usdc.balanceOf(address(crew)),
            "INV: payrollPool > balance"
        );
    }

    // ── INV-3: totalAccruedNow() <= payrollPool (the invariant that
    //           withdrawPayroll enforces — after any sequence of ops the
    //           accounting must stay consistent) ────────────────────────────
    // NOTE: This is NOT always true — accrual can exceed pool if pool is empty.
    //       So we only check: if we were to withdraw 0, it should not revert.
    function invariant_WithdrawZeroNeverReverts() public {
        // Calling withdrawPayroll(0, owner) should never revert for any pool state
        vm.prank(owner);
        try crew.withdrawPayroll(0, owner) {} catch {
            // withdrawPayroll(0, ...) should never revert unless zero address
            revert("invariant: withdrawPayroll(0) reverted");
        }
    }
}
