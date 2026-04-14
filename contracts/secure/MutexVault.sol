// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MutexVault
 * @author Research PoC — Nurcahya Priantoro (G6401221049)
 * @notice Supply chain escrow contract secured using OpenZeppelin's ReentrancyGuard (mutex lock).
 * @dev This contract is the EXPERIMENTAL COMPARATOR — used for gas cost comparison against SecureVault.
 *
 * Security implementation:
 *   - Uses OpenZeppelin's ReentrancyGuard which implements a mutex lock via a _status state variable.
 *   - The nonReentrant modifier sets _status = ENTERED (SSTORE) on function entry and
 *     resets _status = NOT_ENTERED (SSTORE) on function exit.
 *   - Any re-entrant call during function execution reverts because _status == ENTERED.
 *
 * Gas overhead analysis (basis for H₁ hypothesis):
 *   ReentrancyGuard._status variable occupies one storage slot.
 *   Each withdrawFunds() call requires:
 *     - 1 SSTORE to set _status = ENTERED (~2200 gas if slot cold, 100 gas if warm)
 *     - 1 SSTORE to reset _status = NOT_ENTERED (~2900 gas)
 *     - 1 SLOAD to check _status in the modifier (~100 gas if warm)
 *   These operations are ABSENT in SecureVault (CEI), which only reorders existing writes.
 *   This structural difference is expected to result in statistically higher gas for MutexVault.
 *
 * Note: This contract uses Interactions-before-Effects on purpose to isolate the mutex effect.
 *       The ReentrancyGuard modifier prevents exploitation even with the anti-pattern.
 *       This faithfully represents "industry standard mutex lock" practice.
 */
contract MutexVault is ReentrancyGuard {

    // =========================================================================
    // STATE VARIABLES (identical to InsecureVault + inherited _status from ReentrancyGuard)
    // =========================================================================

    enum OrderStatus {
        CREATED,
        LOCKED,
        RELEASED,
        COMPLETED
    }

    struct Order {
        address buyer;
        address seller;
        uint256 amount;
        OrderStatus status;
    }

    mapping(uint256 => Order) public orders;
    mapping(address => uint256) public balances;
    uint256 public orderCount;

    // =========================================================================
    // EVENTS (identical to InsecureVault)
    // =========================================================================

    event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 amount);
    event FundsDeposited(uint256 indexed orderId, address indexed buyer, uint256 amount);
    event DeliveryConfirmed(uint256 indexed orderId, address indexed buyer);
    event FundsWithdrawn(address indexed seller, uint256 amount);

    // =========================================================================
    // SUPPLY CHAIN FUNCTIONS (identical to InsecureVault)
    // =========================================================================

    function createOrder(address _seller) external returns (uint256 orderId) {
        require(_seller != address(0), "MutexVault: seller cannot be zero address");
        require(_seller != msg.sender, "MutexVault: buyer and seller cannot be the same");

        orderId = orderCount;
        orders[orderId] = Order({
            buyer: msg.sender,
            seller: _seller,
            amount: 0,
            status: OrderStatus.CREATED
        });
        orderCount++;

        emit OrderCreated(orderId, msg.sender, _seller, 0);
    }

    function depositFunds(uint256 _orderId) external payable {
        Order storage order = orders[_orderId];

        require(order.buyer == msg.sender, "MutexVault: only buyer can deposit");
        require(order.status == OrderStatus.CREATED, "MutexVault: order must be in CREATED state");
        require(msg.value > 0, "MutexVault: deposit must be greater than zero");

        order.amount = msg.value;
        order.status = OrderStatus.LOCKED;
        balances[order.seller] += msg.value;

        emit FundsDeposited(_orderId, msg.sender, msg.value);
    }

    function confirmDelivery(uint256 _orderId) external {
        Order storage order = orders[_orderId];

        require(order.buyer == msg.sender, "MutexVault: only buyer can confirm delivery");
        require(order.status == OrderStatus.LOCKED, "MutexVault: order must be in LOCKED state");

        order.status = OrderStatus.RELEASED;

        emit DeliveryConfirmed(_orderId, msg.sender);
    }

    // =========================================================================
    // SECURE WITHDRAWAL — MUTEX LOCK (nonReentrant modifier)
    // =========================================================================

    /**
     * @notice Seller withdraws earned funds using the mutex lock pattern.
     * @dev Protected by OpenZeppelin's nonReentrant modifier.
     *      The modifier sets _status=ENTERED before execution and resets to NOT_ENTERED after.
     *      This adds 2 SSTORE + 1 SLOAD operations per call — the source of gas overhead.
     *
     *      Note: This deliberately uses Interactions-before-Effects (same as InsecureVault)
     *      to demonstrate that ReentrancyGuard prevents attacks even with the anti-pattern.
     *      This ensures the gas comparison isolates the effect of the mutex mechanism itself.
     */
    function withdrawFunds() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "MutexVault: no funds to withdraw");

        // Intentionally uses Interactions-before-Effects to isolate mutex effect
        // The nonReentrant modifier prevents exploitation regardless
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "MutexVault: ETH transfer failed");

        balances[msg.sender] = 0;

        emit FundsWithdrawn(msg.sender, amount);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getBalance(address _account) external view returns (uint256) {
        return balances[_account];
    }

    function getOrder(uint256 _orderId) external view returns (
        address buyer,
        address seller,
        uint256 amount,
        OrderStatus status
    ) {
        Order storage order = orders[_orderId];
        return (order.buyer, order.seller, order.amount, order.status);
    }

    receive() external payable {}
}
