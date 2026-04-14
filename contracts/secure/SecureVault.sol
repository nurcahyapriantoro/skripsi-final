// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title SecureVault
 * @author Research PoC — Nurcahya Priantoro (G6401221049)
 * @notice Supply chain escrow contract secured using the Checks-Effects-Interactions (CEI) pattern.
 * @dev This contract is the PRIMARY MITIGATION in the research.
 *
 * Security implementation:
 *   - NO external libraries used — CEI is implemented MANUALLY through code restructuring.
 *   - The withdrawFunds() function follows the strict CEI order:
 *       1. CHECKS:   Validate all preconditions (require statements)
 *       2. EFFECTS:  Update all state variables (balance zeroed BEFORE external call)
 *       3. INTERACTIONS: Execute external ETH transfer
 *
 * Why CEI defeats reentrancy:
 *   When the attacker's receive() re-enters withdrawFunds(), the CHECKS step fails
 *   because EFFECTS has already zeroed balances[msg.sender]. No extra SSTORE/SLOAD
 *   operations are required compared to InsecureVault — only the ORDER of existing
 *   operations changes. This is the basis for the gas efficiency hypothesis (H₁).
 *
 * Research note on gas efficiency:
 *   CEI does NOT add new state variables. MutexVault (ReentrancyGuard) adds a
 *   _status lock variable that requires 2 additional SSTORE and 1 additional SLOAD
 *   per withdrawFunds() call. Therefore CEI is expected to be more gas-efficient.
 */
contract SecureVault {

    // =========================================================================
    // STATE VARIABLES (identical to InsecureVault — no additions for CEI)
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

    /// @dev Seller balance ledger — updated FIRST in withdrawFunds() (CEI effect step)
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
        require(_seller != address(0), "SecureVault: seller cannot be zero address");
        require(_seller != msg.sender, "SecureVault: buyer and seller cannot be the same");

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

        require(order.buyer == msg.sender, "SecureVault: only buyer can deposit");
        require(order.status == OrderStatus.CREATED, "SecureVault: order must be in CREATED state");
        require(msg.value > 0, "SecureVault: deposit must be greater than zero");

        order.amount = msg.value;
        order.status = OrderStatus.LOCKED;
        balances[order.seller] += msg.value;

        emit FundsDeposited(_orderId, msg.sender, msg.value);
    }

    function confirmDelivery(uint256 _orderId) external {
        Order storage order = orders[_orderId];

        require(order.buyer == msg.sender, "SecureVault: only buyer can confirm delivery");
        require(order.status == OrderStatus.LOCKED, "SecureVault: order must be in LOCKED state");

        order.status = OrderStatus.RELEASED;

        emit DeliveryConfirmed(_orderId, msg.sender);
    }

    // =========================================================================
    // SECURE WITHDRAWAL — CEI PATTERN
    // =========================================================================

    /**
     * @notice Seller withdraws their earned funds using the CEI pattern.
     *
     * @dev ✅ SECURE IMPLEMENTATION — Checks-Effects-Interactions order:
     *
     *   STEP 1 — CHECKS: Validate that caller has funds to withdraw.
     *     require(amount > 0) — standard precondition check
     *
     *   STEP 2 — EFFECTS: Zero out the caller's balance BEFORE the external call.
     *     balances[msg.sender] = 0
     *     This is the critical security operation. If an attacker's receive() re-enters
     *     withdrawFunds(), the CHECKS step in the re-entrant call will fail because
     *     balances[msg.sender] is now 0. No re-entrancy possible.
     *
     *   STEP 3 — INTERACTIONS: Execute the external ETH transfer AFTER state update.
     *     (bool success, ) = msg.sender.call{value: amount}("")
     *     Even though .call can trigger receive(), the state has already been finalized.
     *
     * @dev No external library dependency. CEI is purely architectural.
     */
    function withdrawFunds() external {
        // =====================================================================
        // STEP 1: CHECKS — Validate preconditions
        // =====================================================================
        uint256 amount = balances[msg.sender];
        require(amount > 0, "SecureVault: no funds to withdraw");

        // =====================================================================
        // STEP 2: EFFECTS — Update state BEFORE external call
        // ⟵ THIS IS THE KEY DIFFERENCE FROM InsecureVault
        // If attacker re-enters here, balances[msg.sender] is already 0 → require fails
        // =====================================================================
        balances[msg.sender] = 0;

        // =====================================================================
        // STEP 3: INTERACTIONS — Safe to call externally now, state is finalized
        // =====================================================================
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "SecureVault: ETH transfer failed");

        emit FundsWithdrawn(msg.sender, amount);
    }

    // =========================================================================
    // VIEW FUNCTIONS (identical to InsecureVault)
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
