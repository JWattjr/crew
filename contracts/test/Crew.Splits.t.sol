// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CrewTestBase} from "./Crew.Base.t.sol";
import {Crew} from "../Crew.sol";

contract CrewSplitsTest is CrewTestBase {

    // ── 2a. sum != 10000 reverts InvalidSplit ────────────────────────────────
    function test_InvalidSplit_WrongSum() public {
        address[] memory rs = new address[](1);
        rs[0] = alice;
        uint16[] memory bps = new uint16[](1);
        bps[0] = 9000; // sum = 9000 + 0 payroll = 9000 ≠ 10000

        vm.prank(owner);
        vm.expectRevert(Crew.InvalidSplit.selector);
        crew.setSplit(rs, bps, 0);
    }

    // ── 2b. 0 recipients reverts InvalidSplit ────────────────────────────────
    function test_InvalidSplit_ZeroRecipients() public {
        address[] memory rs  = new address[](0);
        uint16[]  memory bps = new uint16[](0);

        vm.prank(owner);
        vm.expectRevert(Crew.InvalidSplit.selector);
        crew.setSplit(rs, bps, 0);
    }

    // ── 2c. 11 recipients reverts TooManyRecipients ──────────────────────────
    function test_InvalidSplit_TooManyRecipients() public {
        address[] memory rs  = new address[](11);
        uint16[]  memory bps = new uint16[](11);
        for (uint256 i = 0; i < 11; i++) {
            rs[i]  = makeAddr(string(abi.encodePacked("r", i)));
            bps[i] = 900;
        }
        // sum = 9900, payrollBps = 100; but should revert before sum check
        vm.prank(owner);
        vm.expectRevert(Crew.TooManyRecipients.selector);
        crew.setSplit(rs, bps, 100);
    }

    // ── 2d. zero address in recipients reverts ZeroAddress ───────────────────
    function test_InvalidSplit_ZeroAddress() public {
        address[] memory rs  = new address[](2);
        rs[0] = alice;
        rs[1] = address(0);
        uint16[] memory bps = new uint16[](2);
        bps[0] = 5000;
        bps[1] = 5000;

        vm.prank(owner);
        vm.expectRevert(Crew.ZeroAddress.selector);
        crew.setSplit(rs, bps, 0);
    }

    // ── 2e. duplicate recipient reverts DuplicateRecipient ───────────────────
    function test_InvalidSplit_DuplicateRecipient() public {
        address[] memory rs  = new address[](2);
        rs[0] = alice;
        rs[1] = alice; // duplicate
        uint16[] memory bps = new uint16[](2);
        bps[0] = 5000;
        bps[1] = 5000;

        vm.prank(owner);
        vm.expectRevert(Crew.DuplicateRecipient.selector);
        crew.setSplit(rs, bps, 0);
    }

    // ── 2f. mismatched arrays length reverts InvalidSplit ────────────────────
    function test_InvalidSplit_ArrayLengthMismatch() public {
        address[] memory rs  = new address[](2);
        rs[0] = alice;
        rs[1] = bob;
        uint16[] memory bps = new uint16[](1);
        bps[0] = 10_000;

        vm.prank(owner);
        vm.expectRevert(Crew.InvalidSplit.selector);
        crew.setSplit(rs, bps, 0);
    }

    // ── 2g. non-owner cannot call setSplit ───────────────────────────────────
    function test_SetSplit_NonOwnerReverts() public {
        address[] memory rs;
        uint16[]  memory bps;
        (rs, bps) = _singleSplit(alice, 0);

        vm.prank(alice);
        vm.expectRevert(Crew.NotOwner.selector);
        crew.setSplit(rs, bps, 0);
    }

    // ── 2h. setSplitEmergency: non-owner reverts ─────────────────────────────
    function test_SetSplitEmergency_NonOwnerReverts() public {
        address[] memory rs;
        uint16[]  memory bps;
        (rs, bps) = _singleSplit(alice, 0);

        vm.prank(alice);
        vm.expectRevert(Crew.NotOwner.selector);
        crew.setSplitEmergency(rs, bps, 0);
    }

    // ── 2i. setSplitEmergency: emits EmergencySplitUsed + SplitUpdated ───────
    function test_SetSplitEmergency_EmitsCorrectEvents() public {
        address[] memory rs;
        uint16[]  memory bps;
        (rs, bps) = _singleSplit(alice, 0);

        vm.prank(owner);
        vm.expectEmit(false, false, false, false, address(crew));
        emit Crew.SplitUpdated(rs, bps, 0);
        vm.expectEmit(false, false, false, false, address(crew));
        emit Crew.EmergencySplitUsed();
        crew.setSplitEmergency(rs, bps, 0);
    }

    // ── 2j. getSplit returns the updated values ───────────────────────────────
    function test_SetSplit_UpdatesStorage() public {
        address[] memory rs;
        uint16[]  memory bps;
        (rs, bps) = _singleSplit(bob, 500);

        vm.prank(owner);
        crew.setSplit(rs, bps, 500);

        (address[] memory gr, uint16[] memory gb, uint16 gpb) = crew.getSplit();
        assertEq(gr[0], bob);
        assertEq(gb[0], 9500);
        assertEq(gpb, 500);
    }

    // ── Scenario 8: setSplit distributes pending with OLD split first ─────────
    function test_SetSplit_DistributesWithOldSplitFirst() public {
        // Set 50/50 split (no payroll)
        address[] memory rs2 = new address[](2);
        rs2[0] = alice;
        rs2[1] = bob;
        uint16[] memory bps2 = new uint16[](2);
        bps2[0] = 5000;
        bps2[1] = 5000;

        vm.prank(owner);
        crew.setSplit(rs2, bps2, 0);

        // Transfer 1000e6 directly (undistributed)
        _directTransfer(1000e6);

        // Now setSplit with 90/10 split → should distribute 1000e6 under OLD 50/50 first
        address[] memory rs3 = new address[](2);
        rs3[0] = alice;
        rs3[1] = bob;
        uint16[] memory bps3 = new uint16[](2);
        bps3[0] = 9000;
        bps3[1] = 1000;

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore   = usdc.balanceOf(bob);

        vm.prank(owner);
        crew.setSplit(rs3, bps3, 0);

        // Old split: alice 5000/10000 * 1000e6 = 500e6, bob 500e6
        // alice gets dust (recipients[0]), bob gets exact bps
        // bob = 1000e6 * 5000/10000 = 500e6
        // alice = 1000e6 - 500e6 = 500e6
        assertEq(usdc.balanceOf(alice) - aliceBefore, 500e6);
        assertEq(usdc.balanceOf(bob)   - bobBefore,   500e6);

        // New split is now 90/10
        (, uint16[] memory nb,) = crew.getSplit();
        assertEq(nb[0], 9000);
        assertEq(nb[1], 1000);
    }
}
