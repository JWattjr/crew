// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CrewTestBase} from "./Crew.Base.t.sol";
import {Crew} from "../Crew.sol";
import {CrewFactory} from "../CrewFactory.sol";

contract CrewFactoryTest is CrewTestBase {

    // ── 1a. implementation address is non-zero ───────────────────────────────
    function test_ImplementationIsNonZero() public view {
        assertTrue(factory.implementation() != address(0));
    }

    // ── 1b. implementation cannot be initialized twice ───────────────────────
    function test_ImplementationCannotBeInitializedTwice() public {
        Crew impl = Crew(factory.implementation());
        // First call on the locked implementation must revert (Initializable)
        address[] memory rs = new address[](1);
        rs[0] = alice;
        uint16[] memory bps = new uint16[](1);
        bps[0] = 10_000;
        vm.expectRevert();
        impl.initialize(USDC_ADDR, alice, "X", rs, bps, 0);
    }

    // ── 1c. clone created by createCrew can be initialized (already done in factory) ─
    function test_CloneIsInitialized() public view {
        // The crew from setUp was created via factory, so initialize already ran.
        assertEq(crew.owner(), owner);
        assertEq(address(crew.usdc()), USDC_ADDR);
        assertEq(crew.name(), "Test Crew");
    }

    // ── 1d. two createCrew calls from same deployer produce different addresses ─
    function test_TwoCrewsHaveDifferentAddresses() public {
        address[] memory rs;
        uint16[] memory bps;
        (rs, bps) = _singleSplit(alice, 0);

        vm.startPrank(alice);
        address c1 = factory.createCrew("Alpha", rs, bps, 0);
        address c2 = factory.createCrew("Beta",  rs, bps, 0);
        vm.stopPrank();

        assertTrue(c1 != c2);
    }

    // ── 1e. crewsOf returns correct crews ────────────────────────────────────
    function test_CrewsOf() public {
        address[] memory rs;
        uint16[] memory bps;
        (rs, bps) = _singleSplit(alice, 0);

        vm.startPrank(alice);
        address c1 = factory.createCrew("Alpha", rs, bps, 0);
        address c2 = factory.createCrew("Beta",  rs, bps, 0);
        vm.stopPrank();

        address[] memory listed = factory.crewsOf(alice);
        assertEq(listed.length, 2);
        assertEq(listed[0], c1);
        assertEq(listed[1], c2);
    }

    // ── 1f. crewCount and crewAt ──────────────────────────────────────────────
    function test_CrewCountAndCrewAt() public {
        // setUp already created one crew (owner)
        uint256 before = factory.crewCount();

        address[] memory rs;
        uint16[] memory bps;
        (rs, bps) = _singleSplit(alice, 0);

        vm.prank(alice);
        address c = factory.createCrew("Alpha", rs, bps, 0);

        assertEq(factory.crewCount(), before + 1);
        assertEq(factory.crewAt(before), c);
    }

    // ── 1g. factory rejects zero usdc address ────────────────────────────────
    function test_FactoryRejectsZeroUsdc() public {
        vm.expectRevert(CrewFactory.ZeroAddress.selector);
        new CrewFactory(address(0));
    }

    // ── 1h. CrewCreated event is emitted ─────────────────────────────────────
    function test_CrewCreatedEventEmitted() public {
        address[] memory rs;
        uint16[] memory bps;
        (rs, bps) = _singleSplit(alice, 0);

        vm.prank(alice);
        // We can only check topic1 (crew unknown) and topic2 (indexed owner)
        vm.expectEmit(false, true, false, true);
        emit CrewFactory.CrewCreated(address(0), alice, "Alpha");
        factory.createCrew("Alpha", rs, bps, 0);
    }
}
