// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {Crew} from "./Crew.sol";

/// @notice Factory that deploys clone-initialized Crew treasuries for one-person companies.
contract CrewFactory {
    error ZeroAddress();

    address public immutable usdc;
    address public immutable implementation;

    mapping(address => address[]) private _crewsOf;
    address[] private _allCrews;

    event CrewCreated(address indexed crew, address indexed owner, string name);

    constructor(address _usdc) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = _usdc;
        implementation = address(new Crew());
    }

    function createCrew(
        string calldata name,
        address[] calldata recipients,
        uint16[] calldata recipientBps,
        uint16 payrollBps
    ) external returns (address crew) {
        crew = Clones.clone(implementation);
        Crew(crew).initialize(usdc, msg.sender, name, recipients, recipientBps, payrollBps);

        _crewsOf[msg.sender].push(crew);
        _allCrews.push(crew);

        emit CrewCreated(crew, msg.sender, name);
    }

    function crewsOf(address owner) external view returns (address[] memory) {
        return _crewsOf[owner];
    }

    function crewCount() external view returns (uint256) {
        return _allCrews.length;
    }

    function crewAt(uint256 index) external view returns (address) {
        return _allCrews[index];
    }
}
