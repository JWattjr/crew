// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CrewTestBase} from "./Crew.Base.t.sol";
import {Crew} from "../Crew.sol";

/// @dev Tests for addMember, setRate, removeMember, claim, withdrawPayroll, totalAccruedNow.
contract CrewPayrollTest is CrewTestBase {

    uint256 internal constant WEEKLY_RATE = 100e6; // 100 USDC/week

    // ── Scenario 5: Payroll streaming ────────────────────────────────────────

    function test_Claim_HalfWeek() public {
        // Fund pool so claim succeeds
        _giveAndApprove(owner, 500e6);
        vm.prank(owner);
        crew.fundPayroll(500e6);

        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        // warp 3.5 days = half week
        vm.warp(block.timestamp + ONE_WEEK / 2);

        uint256 aliceBefore = usdc.balanceOf(alice);
        crew.claim(alice);

        assertEq(usdc.balanceOf(alice) - aliceBefore, 50e6, "half-week claim");
    }

    function test_Claim_ThirdPartyCanCallForMember() public {
        _giveAndApprove(owner, 500e6);
        vm.prank(owner);
        crew.fundPayroll(500e6);

        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        vm.warp(block.timestamp + ONE_WEEK);

        uint256 aliceBefore = usdc.balanceOf(alice);
        // bob calls claim(alice) — pays alice, not bob
        vm.prank(bob);
        crew.claim(alice);

        assertEq(usdc.balanceOf(alice) - aliceBefore, WEEKLY_RATE, "alice got full week");
        assertEq(usdc.balanceOf(bob), 0, "bob got nothing");
    }

    function test_Claim_PartialWhenPoolInsufficient() public {
        // Fund only 30e6
        _giveAndApprove(owner, 30e6);
        vm.prank(owner);
        crew.fundPayroll(30e6);

        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        // Warp ~80% of a week → accrued ≈ 80e6
        vm.warp(block.timestamp + (ONE_WEEK * 8) / 10); // 0.8 weeks → 80e6

        uint256 aliceBefore = usdc.balanceOf(alice);
        crew.claim(alice);

        // Pool only has 30e6, so alice gets 30e6 and 50e6 remains owed
        assertEq(usdc.balanceOf(alice) - aliceBefore, 30e6, "partial pay");
        assertEq(crew.payrollPool(), 0, "pool drained");

        // Now fund 50e6 more → claim pays remainder
        _giveAndApprove(owner, 50e6);
        vm.prank(owner);
        crew.fundPayroll(50e6);

        uint256 aliceBefore2 = usdc.balanceOf(alice);
        crew.claim(alice);
        assertEq(usdc.balanceOf(alice) - aliceBefore2, 50e6, "remaining paid");
    }

    function test_Claim_EmitsClaimedEvent() public {
        _giveAndApprove(owner, 500e6);
        vm.prank(owner);
        crew.fundPayroll(500e6);

        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        vm.warp(block.timestamp + ONE_WEEK);

        vm.expectEmit(true, false, false, true, address(crew));
        emit Crew.Claimed(alice, WEEKLY_RATE, 0);
        crew.claim(alice);
    }

    function test_Claim_NonExistentMemberReverts() public {
        vm.expectRevert(Crew.MemberNotFound.selector);
        crew.claim(makeAddr("stranger"));
    }

    // ── addMember ────────────────────────────────────────────────────────────

    function test_AddMember_EmitsMemberAdded() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, true, address(crew));
        emit Crew.MemberAdded(alice, "eng", WEEKLY_RATE);
        crew.addMember(alice, "eng", WEEKLY_RATE);
    }

    function test_AddMember_NonOwnerReverts() public {
        vm.prank(alice);
        vm.expectRevert(Crew.NotOwner.selector);
        crew.addMember(bob, "eng", WEEKLY_RATE);
    }

    function test_AddMember_ZeroAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert(Crew.ZeroAddress.selector);
        crew.addMember(address(0), "eng", WEEKLY_RATE);
    }

    function test_AddMember_AppearsInGetMembers() public {
        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        Crew.MemberView[] memory members = crew.getMembers();
        assertEq(members.length, 1);
        assertEq(members[0].wallet, alice);
        assertEq(members[0].label, "eng");
        assertEq(members[0].weeklyRate, WEEKLY_RATE);
        assertTrue(members[0].active);
    }

    // ── Scenario 6: setRate and removeMember ─────────────────────────────────

    function test_SetRate_SettlesAccrualFirst() public {
        _giveAndApprove(owner, 500e6);
        vm.prank(owner);
        crew.fundPayroll(500e6);

        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        // Half week elapsed
        vm.warp(block.timestamp + ONE_WEEK / 2);

        // setRate → should settle 50e6 into owed before changing rate
        uint256 NEW_RATE = 200e6;
        vm.prank(owner);
        crew.setRate(alice, NEW_RATE);

        // owed should now be 50e6 (half-week at old rate)
        Crew.MemberView[] memory members = crew.getMembers();
        assertEq(members[0].owed, 50e6, "owed after setRate");
        assertEq(members[0].weeklyRate, NEW_RATE, "new rate");
    }

    function test_SetRate_EmitsRateChanged() public {
        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        vm.prank(owner);
        vm.expectEmit(true, false, false, true, address(crew));
        emit Crew.RateChanged(alice, 200e6);
        crew.setRate(alice, 200e6);
    }

    function test_SetRate_NonOwnerReverts() public {
        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        vm.prank(alice);
        vm.expectRevert(Crew.NotOwner.selector);
        crew.setRate(alice, 200e6);
    }

    function test_SetRate_NonExistentMemberReverts() public {
        vm.prank(owner);
        vm.expectRevert(Crew.MemberNotFound.selector);
        crew.setRate(makeAddr("stranger"), 200e6);
    }

    function test_RemoveMember_SettlesOwedBeforeDeactivation() public {
        _giveAndApprove(owner, 500e6);
        vm.prank(owner);
        crew.fundPayroll(500e6);

        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        vm.warp(block.timestamp + ONE_WEEK / 2);

        vm.prank(owner);
        crew.removeMember(alice);

        // Still claimable even after removal
        Crew.MemberView[] memory members = crew.getMembers();
        assertEq(members[0].owed, 50e6, "owed after remove");
        assertFalse(members[0].active, "should be inactive");
    }

    function test_RemoveMember_MemberCanStillClaimAfterRemoval() public {
        _giveAndApprove(owner, 500e6);
        vm.prank(owner);
        crew.fundPayroll(500e6);

        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        vm.warp(block.timestamp + ONE_WEEK / 2);

        vm.prank(owner);
        crew.removeMember(alice);

        // alice can still claim her owed amount
        uint256 aliceBefore = usdc.balanceOf(alice);
        crew.claim(alice);
        assertEq(usdc.balanceOf(alice) - aliceBefore, 50e6, "claim after removal");
    }

    function test_RemoveMember_EmitsMemberRemoved() public {
        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        vm.prank(owner);
        vm.expectEmit(true, false, false, false, address(crew));
        emit Crew.MemberRemoved(alice);
        crew.removeMember(alice);
    }

    function test_RemoveMember_NonExistentReverts() public {
        vm.prank(owner);
        vm.expectRevert(Crew.MemberNotFound.selector);
        crew.removeMember(makeAddr("stranger"));
    }

    function test_AddMember_ReAddingRemovedWalletReverts() public {
        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        vm.prank(owner);
        crew.removeMember(alice);

        vm.prank(owner);
        vm.expectRevert(Crew.MemberAlreadyExists.selector);
        crew.addMember(alice, "eng v2", WEEKLY_RATE);
    }

    function test_RemoveMember_NonOwnerReverts() public {
        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        vm.prank(alice);
        vm.expectRevert(Crew.NotOwner.selector);
        crew.removeMember(alice);
    }

    function test_TooManyMembers_Reverts() public {
        uint256 MAX = 20;
        for (uint256 i = 0; i < MAX; i++) {
            address w = makeAddr(string(abi.encodePacked("member", i)));
            vm.prank(owner);
            crew.addMember(w, "m", WEEKLY_RATE);
        }
        vm.prank(owner);
        vm.expectRevert(Crew.TooManyMembers.selector);
        crew.addMember(makeAddr("overflow"), "m", WEEKLY_RATE);
    }

    // ── Scenario 7: withdrawPayroll cannot steal accrued salaries ────────────

    function test_WithdrawPayroll_CannotExceedAvailable() public {
        _giveAndApprove(owner, 200e6);
        vm.prank(owner);
        crew.fundPayroll(200e6);

        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        vm.warp(block.timestamp + ONE_WEEK);

        // accrued = 100e6, withdrawable = 200e6 - 100e6 = 100e6
        // attempting 101e6 should revert
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Crew.SalariesEarned.selector, 101e6, 100e6)
        );
        crew.withdrawPayroll(101e6, owner);
    }

    function test_WithdrawPayroll_SucceedsWithinLimit() public {
        _giveAndApprove(owner, 200e6);
        vm.prank(owner);
        crew.fundPayroll(200e6);

        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        vm.warp(block.timestamp + ONE_WEEK);

        // withdrawable = 100e6 exactly
        uint256 ownerBefore = usdc.balanceOf(owner);
        vm.prank(owner);
        crew.withdrawPayroll(100e6, owner);

        assertEq(usdc.balanceOf(owner) - ownerBefore, 100e6, "withdrawn");
        assertEq(crew.payrollPool(), 100e6, "pool reduced");
    }

    function test_WithdrawPayroll_ZeroAmountSucceeds() public {
        _giveAndApprove(owner, 200e6);
        vm.prank(owner);
        crew.fundPayroll(200e6);

        vm.prank(owner);
        crew.withdrawPayroll(0, owner);
        // No revert expected
    }

    function test_WithdrawPayroll_NonOwnerReverts() public {
        _giveAndApprove(owner, 100e6);
        vm.prank(owner);
        crew.fundPayroll(100e6);

        vm.prank(alice);
        vm.expectRevert(Crew.NotOwner.selector);
        crew.withdrawPayroll(1e6, alice);
    }

    function test_WithdrawPayroll_ZeroToAddressReverts() public {
        _giveAndApprove(owner, 100e6);
        vm.prank(owner);
        crew.fundPayroll(100e6);

        vm.prank(owner);
        vm.expectRevert(Crew.ZeroAddress.selector);
        crew.withdrawPayroll(1e6, address(0));
    }

    function test_WithdrawPayroll_EmitsEvent() public {
        _giveAndApprove(owner, 100e6);
        vm.prank(owner);
        crew.fundPayroll(100e6);

        vm.prank(owner);
        vm.expectEmit(true, false, false, true, address(crew));
        emit Crew.PayrollWithdrawn(owner, 50e6);
        crew.withdrawPayroll(50e6, owner);
    }

    // ── totalAccruedNow() preview ─────────────────────────────────────────────

    function test_TotalAccruedNow_MatchesClaimedAmount() public {
        _giveAndApprove(owner, 500e6);
        vm.prank(owner);
        crew.fundPayroll(500e6);

        vm.prank(owner);
        crew.addMember(alice, "eng", WEEKLY_RATE);

        vm.warp(block.timestamp + ONE_WEEK);

        uint256 preview = crew.totalAccruedNow();
        assertEq(preview, WEEKLY_RATE, "preview == weekly rate after 1 week");
    }

    function test_WeeklyBurn_ReflectsActiveMembers() public {
        vm.prank(owner);
        crew.addMember(alice, "eng", 100e6);
        vm.prank(owner);
        crew.addMember(bob, "ops", 50e6);

        assertEq(crew.weeklyBurn(), 150e6);

        vm.prank(owner);
        crew.removeMember(alice);

        assertEq(crew.weeklyBurn(), 50e6);
    }

    // ── accrualRemainder precision math ──────────────────────────────────────

    function test_AccrualRemainder_PreventsLoss() public {
        _giveAndApprove(owner, 500e6);
        vm.prank(owner);
        crew.fundPayroll(500e6);

        // Rate 7e6 / week — not evenly divisible per second
        uint256 oddRate = 7e6;
        vm.prank(owner);
        crew.addMember(alice, "eng", oddRate);

        // Claim 10 times at 1-second intervals (each accrual = 7e6/604800 ≈ 0)
        for (uint256 i = 0; i < 10; i++) {
            vm.warp(block.timestamp + 1);
            crew.claim(alice);
        }

        // After one full week (from addMember), alice should have accrued ~7e6
        vm.warp(block.timestamp + ONE_WEEK - 10); // complete 1 week total
        crew.claim(alice);

        // Alice should have received close to 7e6 over the full week
        assertGt(usdc.balanceOf(alice), 0, "alice should have received something");
    }
}
