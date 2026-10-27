// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CrewTestBase} from "./Crew.Base.t.sol";
import {Crew} from "../Crew.sol";

/// @dev Tests for two-step ownership transfer (Scenario 9).
contract CrewOwnershipTest is CrewTestBase {

    // ── transferOwnership ────────────────────────────────────────────────────

    function test_TransferOwnership_SetsPendingOwner() public {
        vm.prank(owner);
        crew.transferOwnership(bob);
        assertEq(crew.pendingOwner(), bob);
    }

    function test_TransferOwnership_EmitsOwnershipTransferStarted() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, false, address(crew));
        emit Crew.OwnershipTransferStarted(owner, bob);
        crew.transferOwnership(bob);
    }

    function test_TransferOwnership_NonOwnerReverts() public {
        vm.prank(alice);
        vm.expectRevert(Crew.NotOwner.selector);
        crew.transferOwnership(bob);
    }

    function test_TransferOwnership_ZeroAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert(Crew.ZeroAddress.selector);
        crew.transferOwnership(address(0));
    }

    // ── acceptOwnership ──────────────────────────────────────────────────────

    function test_AcceptOwnership_WrongCallerReverts() public {
        vm.prank(owner);
        crew.transferOwnership(bob);

        vm.prank(alice); // not pendingOwner
        vm.expectRevert(Crew.NotPendingOwner.selector);
        crew.acceptOwnership();
    }

    function test_AcceptOwnership_TransfersOwnership() public {
        vm.prank(owner);
        crew.transferOwnership(bob);

        vm.prank(bob);
        crew.acceptOwnership();

        assertEq(crew.owner(), bob);
        assertEq(crew.pendingOwner(), address(0));
    }

    function test_AcceptOwnership_EmitsOwnershipTransferred() public {
        vm.prank(owner);
        crew.transferOwnership(bob);

        vm.prank(bob);
        vm.expectEmit(true, true, false, false, address(crew));
        emit Crew.OwnershipTransferred(owner, bob);
        crew.acceptOwnership();
    }

    // ── onlyOwner gates ──────────────────────────────────────────────────────

    function test_NonOwner_CannotAddMember() public {
        vm.prank(alice);
        vm.expectRevert(Crew.NotOwner.selector);
        crew.addMember(bob, "eng", 100e6);
    }

    function test_NonOwner_CannotSetSplit() public {
        address[] memory rs;
        uint16[]  memory bps;
        (rs, bps) = _singleSplit(alice, 0);

        vm.prank(alice);
        vm.expectRevert(Crew.NotOwner.selector);
        crew.setSplit(rs, bps, 0);
    }

    function test_NonOwner_CannotSetSplitEmergency() public {
        address[] memory rs;
        uint16[]  memory bps;
        (rs, bps) = _singleSplit(alice, 0);

        vm.prank(alice);
        vm.expectRevert(Crew.NotOwner.selector);
        crew.setSplitEmergency(rs, bps, 0);
    }

    function test_NonOwner_CannotRemoveMember() public {
        vm.prank(owner);
        crew.addMember(alice, "eng", 100e6);

        vm.prank(bob);
        vm.expectRevert(Crew.NotOwner.selector);
        crew.removeMember(alice);
    }

    function test_NonOwner_CannotSetRate() public {
        vm.prank(owner);
        crew.addMember(alice, "eng", 100e6);

        vm.prank(bob);
        vm.expectRevert(Crew.NotOwner.selector);
        crew.setRate(alice, 200e6);
    }

    function test_NonOwner_CannotWithdrawPayroll() public {
        vm.prank(alice);
        vm.expectRevert(Crew.NotOwner.selector);
        crew.withdrawPayroll(0, alice);
    }

    function test_NonOwner_CannotTransferOwnership() public {
        vm.prank(alice);
        vm.expectRevert(Crew.NotOwner.selector);
        crew.transferOwnership(bob);
    }

    // ── Initialize cannot be called twice (on clone) ─────────────────────────

    function test_Initialize_CannotBeCalledTwice() public {
        address[] memory rs = new address[](1);
        rs[0] = alice;
        uint16[] memory bps = new uint16[](1);
        bps[0] = 10_000;

        vm.expectRevert();
        crew.initialize(USDC_ADDR, alice, "Duplicate", rs, bps, 0);
    }

    function test_Initialize_ZeroUsdcReverts() public {
        // Deploy a fresh clone and try to init with zero usdc
        Crew impl = Crew(factory.implementation());
        address clone = _deployRawClone(address(impl));

        address[] memory rs = new address[](1);
        rs[0] = alice;
        uint16[] memory bps = new uint16[](1);
        bps[0] = 10_000;

        vm.expectRevert(Crew.ZeroAddress.selector);
        Crew(clone).initialize(address(0), alice, "X", rs, bps, 0);
    }

    function test_Initialize_ZeroOwnerReverts() public {
        Crew impl = Crew(factory.implementation());
        address clone = _deployRawClone(address(impl));

        address[] memory rs = new address[](1);
        rs[0] = alice;
        uint16[] memory bps = new uint16[](1);
        bps[0] = 10_000;

        vm.expectRevert(Crew.ZeroAddress.selector);
        Crew(clone).initialize(USDC_ADDR, address(0), "X", rs, bps, 0);
    }

    // ── internal helper ──────────────────────────────────────────────────────

    /// @dev Deploy a minimal proxy clone pointing at `impl` without initializing.
    function _deployRawClone(address impl) internal returns (address clone) {
        bytes20 implBytes = bytes20(impl);
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), implBytes)
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            clone := create(0, ptr, 0x37)
        }
    }
}
