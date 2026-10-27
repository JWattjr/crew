// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CrewTestBase} from "./Crew.Base.t.sol";
import {Crew} from "../Crew.sol";

/// @dev Scenario 10 – fuzz tests for split distribution arithmetic.
contract CrewFuzzTest is CrewTestBase {

    // ── Fuzz: sum(recipientAmounts) + toPayroll == newRevenue ────────────────
    //
    // We use a simpler 2-recipient + payroll setup driven by fuzz inputs.
    // recipient0 gets (10000 - payrollBps - bps1), recipient1 gets bps1.
    //
    function testFuzz_DistributionConservation(
        uint256 amount,
        uint16  bps1,      // bps for recipient[1]
        uint16  payrollBps_
    ) public {
        // ── bound inputs to valid split ──────────────────────────────────────
        // payrollBps_ in [0, 9999], bps1 in [0, 10000 - payrollBps_ - 1]
        payrollBps_ = uint16(bound(payrollBps_, 0, 9999));
        uint16 remaining = uint16(10_000 - payrollBps_);
        // bps1 in [0, remaining-1] so bps0 = remaining - bps1 >= 1
        bps1 = uint16(bound(bps1, 0, remaining > 0 ? remaining - 1 : 0));
        uint16 bps0 = remaining - bps1;

        // amount in [0, 1_000_000e6]
        amount = bound(amount, 0, 1_000_000e6);

        // ── set the new split ────────────────────────────────────────────────
        address[] memory rs = new address[](2);
        rs[0] = alice;
        rs[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = bps0;
        bps[1] = bps1;

        vm.prank(owner);
        crew.setSplit(rs, bps, payrollBps_);

        // ── seed payer ───────────────────────────────────────────────────────
        _giveAndApprove(payer, amount);

        uint256 aliceBefore   = usdc.balanceOf(alice);
        uint256 bobBefore     = usdc.balanceOf(bob);
        uint256 poolBefore    = crew.payrollPool();

        if (amount == 0) {
            // pay(0) should not revert and produce no change
            vm.prank(payer);
            crew.pay(0, "fuzz");
            assertEq(usdc.balanceOf(alice) - aliceBefore, 0);
            assertEq(usdc.balanceOf(bob)   - bobBefore,   0);
            assertEq(crew.payrollPool() - poolBefore,     0);
            return;
        }

        vm.prank(payer);
        crew.pay(amount, "fuzz");

        uint256 aliceGot = usdc.balanceOf(alice) - aliceBefore;
        uint256 bobGot   = usdc.balanceOf(bob)   - bobBefore;
        uint256 poolGot  = crew.payrollPool()     - poolBefore;

        // Conservation: every USDC that came in is accounted for
        assertEq(aliceGot + bobGot + poolGot, amount, "conservation violated");

        // Payroll portion is correct (may be zero)
        uint256 expectedPayroll = (amount * payrollBps_) / 10_000;
        assertEq(poolGot, expectedPayroll, "payroll bps wrong");

        // bob (non-dust recipient) gets exact bps share
        uint256 toSplit      = amount - expectedPayroll;
        uint256 expectedBob  = (toSplit * bps1) / 10_000;
        assertEq(bobGot, expectedBob, "bob bps wrong");

        // alice (dust recipient) gets the rest
        assertEq(aliceGot, toSplit - expectedBob, "alice dust wrong");
    }

    // ── Fuzz: single-recipient split ─────────────────────────────────────────
    function testFuzz_SingleRecipientConservation(
        uint256 amount,
        uint16  payrollBps_
    ) public {
        payrollBps_ = uint16(bound(payrollBps_, 0, 10_000));
        amount      = bound(amount, 0, 1_000_000e6);

        address[] memory rs = new address[](1);
        rs[0] = alice;
        uint16[] memory bps = new uint16[](1);
        bps[0] = uint16(10_000 - payrollBps_);

        vm.prank(owner);
        crew.setSplit(rs, bps, payrollBps_);

        _giveAndApprove(payer, amount);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 poolBefore  = crew.payrollPool();

        vm.prank(payer);
        crew.pay(amount, "fuzz single");

        uint256 aliceGot = usdc.balanceOf(alice) - aliceBefore;
        uint256 poolGot  = crew.payrollPool()     - poolBefore;

        assertEq(aliceGot + poolGot, amount, "single conservation");
    }

    // ── Fuzz: fundPayroll always increases pool by exact amount ──────────────
    function testFuzz_FundPayrollExact(uint256 amount) public {
        amount = bound(amount, 0, 1_000_000e6);
        _giveAndApprove(alice, amount);

        uint256 poolBefore = crew.payrollPool();
        vm.prank(alice);
        crew.fundPayroll(amount);

        assertEq(crew.payrollPool(), poolBefore + amount, "fund payroll exact");
    }

    // ── Fuzz: claim never pays more than poolBalance ──────────────────────────
    function testFuzz_ClaimNeverExceedsPool(uint256 fundAmount, uint256 elapsed) public {
        fundAmount = bound(fundAmount, 0, 500e6);
        elapsed    = bound(elapsed, 0, ONE_WEEK * 10);

        if (fundAmount > 0) {
            _giveAndApprove(owner, fundAmount);
            vm.prank(owner);
            crew.fundPayroll(fundAmount);
        }

        vm.prank(owner);
        crew.addMember(alice, "eng", 100e6);

        vm.warp(block.timestamp + elapsed);

        uint256 poolBefore  = crew.payrollPool();
        uint256 aliceBefore = usdc.balanceOf(alice);

        crew.claim(alice);

        uint256 paid = usdc.balanceOf(alice) - aliceBefore;
        // Paid cannot exceed what was in the pool
        assertLe(paid, poolBefore, "paid > pool");
        // Pool correctly reduced
        assertEq(crew.payrollPool(), poolBefore - paid, "pool accounting");
    }

    // ── Fuzz: setRate mid-stream — accrual from old rate always preserved ─────
    function testFuzz_SetRatePreservesAccrual(uint256 elapsed, uint256 newRate) public {
        elapsed = bound(elapsed, 0, ONE_WEEK * 4);
        newRate = bound(newRate, 0, 1_000e6);

        _giveAndApprove(owner, 1_000e6);
        vm.prank(owner);
        crew.fundPayroll(1_000e6);

        vm.prank(owner);
        crew.addMember(alice, "eng", 100e6);

        vm.warp(block.timestamp + elapsed);

        // Expected accrual at old rate
        uint256 expectedOwed = (100e6 * elapsed) / ONE_WEEK;

        vm.prank(owner);
        crew.setRate(alice, newRate);

        Crew.MemberView[] memory members = crew.getMembers();
        assertEq(members[0].owed, expectedOwed, "owed before rate change");
    }
}
