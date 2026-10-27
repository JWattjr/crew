// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CrewTestBase} from "./Crew.Base.t.sol";
import {Crew} from "../Crew.sol";

/// @dev Tests for pay(), distribute(), and fundPayroll() flow.
contract CrewPayDistributeTest is CrewTestBase {

    // setUp has: owner 5000bps, charlie 2000bps, payrollBps 3000
    // So toSplit = 7000/10000 of newRevenue
    //    recipients[0]=owner gets dust = toSplit - charlie_amount
    //    recipients[1]=charlie gets toSplit*2000/10000

    // ── Scenario 3: pay() with 50/20/30 split ────────────────────────────────

    function test_Pay_DistributesCorrectly() public {
        uint256 amount = 1000e6;

        uint256 ownerBefore   = usdc.balanceOf(owner);
        uint256 charlieBefore = usdc.balanceOf(charlie);
        uint256 poolBefore    = crew.payrollPool();

        vm.prank(payer);
        crew.pay(amount, "invoice");

        // toPayroll = 1000e6 * 3000/10000 = 300e6
        // toSplit   = 700e6
        // charlie   = 700e6 * 2000/10000 = 140e6
        // owner     = 700e6 - 140e6 = 560e6  (dust goes to recipients[0])
        assertEq(usdc.balanceOf(charlie) - charlieBefore, 140e6, "charlie wrong");
        assertEq(usdc.balanceOf(owner)   - ownerBefore,   560e6, "owner wrong");
        assertEq(crew.payrollPool() - poolBefore,         300e6, "pool wrong");
    }

    function test_Pay_EmitsRevenueEvent() public {
        vm.prank(payer);
        vm.expectEmit(true, false, false, true, address(crew));
        emit Crew.Revenue(payer, 1000e6, "invoice");
        crew.pay(1000e6, "invoice");
    }

    function test_Pay_EmitsPaidEvents() public {
        // Paid(charlie, 140e6) and Paid(owner, 560e6) should both be emitted.
        // We check charlie (non-dust, exact amount).
        vm.prank(payer);
        vm.expectEmit(true, false, false, true, address(crew));
        emit Crew.Paid(charlie, 140e6);
        crew.pay(1000e6, "invoice");
    }

    function test_Pay_EmitsDistributedEvent() public {
        vm.prank(payer);
        vm.expectEmit(false, false, false, true, address(crew));
        emit Crew.Distributed(1000e6, 300e6);
        crew.pay(1000e6, "invoice");
    }

    function test_Pay_PayrollPoolRoseByToPayroll() public {
        uint256 poolBefore = crew.payrollPool();
        vm.prank(payer);
        crew.pay(1000e6, "invoice");
        assertEq(crew.payrollPool(), poolBefore + 300e6);
    }

    function test_Pay_DustGoesToFirstRecipient() public {
        // Use an amount that creates dust: 7 USDC — toSplit=4.9, charlie=0.98, owner=3.92
        // At 6 decimals: 7e6 * 3000/10000=2.1e6 (2100000), toSplit=4900000
        // charlie = 4900000 * 2000/10000 = 980000
        // owner   = 4900000 - 980000 = 3920000 (absorbs all dust)
        uint256 amount = 7e6;
        uint256 ownerBefore = usdc.balanceOf(owner);

        vm.prank(payer);
        crew.pay(amount, "dust test");

        uint256 toPayroll = (amount * 3000) / 10_000; // 2100000
        uint256 toSplit   = amount - toPayroll;       // 4900000
        uint256 charlieAmt = (toSplit * 2000) / 10_000; // 980000
        uint256 ownerAmt  = toSplit - charlieAmt;       // 3920000

        assertEq(usdc.balanceOf(owner) - ownerBefore, ownerAmt, "dust to owner");
    }

    // ── Scenario 4: plain transfer + distribute() ────────────────────────────

    function test_Distribute_AfterDirectTransfer() public {
        uint256 amount = 1000e6;
        _directTransfer(amount);

        uint256 ownerBefore   = usdc.balanceOf(owner);
        uint256 charlieBefore = usdc.balanceOf(charlie);

        crew.distribute();

        assertEq(usdc.balanceOf(charlie) - charlieBefore, 140e6, "charlie");
        assertEq(usdc.balanceOf(owner)   - ownerBefore,   560e6, "owner");
        assertEq(crew.payrollPool(), 300e6, "pool");
    }

    function test_Distribute_NoopWhenNothingNew() public {
        // Pay first so payrollPool absorbs balance
        vm.prank(payer);
        crew.pay(1000e6, "invoice");

        // Now balance == payrollPool, distribute() should be a no-op
        uint256 poolBefore = crew.payrollPool();
        // No revert expected
        crew.distribute();
        assertEq(crew.payrollPool(), poolBefore, "pool should not change");
    }

    function test_Distribute_AnyoneCanCall() public {
        _directTransfer(100e6);
        // bob (not owner) calls distribute — should succeed
        vm.prank(bob);
        crew.distribute(); // no revert
    }

    // ── fundPayroll ──────────────────────────────────────────────────────────

    function test_FundPayroll_IncreasesPool() public {
        _giveAndApprove(alice, 500e6);
        uint256 poolBefore = crew.payrollPool();

        vm.prank(alice);
        crew.fundPayroll(200e6);

        assertEq(crew.payrollPool(), poolBefore + 200e6, "pool after fund");
    }

    function test_FundPayroll_EmitsEvent() public {
        _giveAndApprove(alice, 500e6);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(crew));
        emit Crew.PayrollFunded(alice, 200e6);
        crew.fundPayroll(200e6);
    }

    function test_FundPayroll_AnyoneCanFund() public {
        _giveAndApprove(bob, 100e6);
        uint256 poolBefore = crew.payrollPool();

        vm.prank(bob);
        crew.fundPayroll(50e6);

        assertEq(crew.payrollPool(), poolBefore + 50e6);
    }

    // ── undistributed() view ─────────────────────────────────────────────────

    function test_Undistributed_BeforeAndAfter() public {
        assertEq(crew.undistributed(), 0);
        _directTransfer(200e6);
        assertEq(crew.undistributed(), 200e6);
        crew.distribute();
        assertEq(crew.undistributed(), 0);
    }

    // ── weeklyBurn and runwaySeconds ─────────────────────────────────────────

    function test_WeeklyBurn_NoMembers() public view {
        assertEq(crew.weeklyBurn(), 0);
    }

    function test_RunwaySeconds_NoMembers_IsMaxUint() public view {
        assertEq(crew.runwaySeconds(), type(uint256).max);
    }
}
