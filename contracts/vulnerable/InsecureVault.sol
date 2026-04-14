// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title InsecureVault
 * @author Research PoC — Nurcahya Priantoro (G6401221049)
 * @notice Supply chain escrow contract DELIBERATELY VULNERABLE to reentrancy.
 * @dev This contract intentionally violates the CEI pattern to serve as the
 *      control variable in the reentrancy mitigation experiment.
 *      DO NOT USE IN PRODUCTION.
 *
 * VULNERABILITY: withdrawFunds() follows Interactions-before-Effects pattern.
 * The external call (.call{value: amount}("")) executes BEFORE balances[msg.sender]
 * is set to zero. An attacker's receive() or fallback() function can recursively
 * re-enter withdrawFunds() before the balance update occurs.
 */
contract InsecureVault {

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    /// @dev Enum representing the supply chain order lifecycle states
    enum OrderStatus {
        CREATED,    // Order created, no funds deposited
        LOCKED,     // Funds deposited, goods in transit
        RELEASED,   // Delivery confirmed by buyer, funds authorized for release
        COMPLETED   // Funds withdrawn by seller
    }

    /// @dev Struct representing a supply chain order
    struct Order {
        address buyer;
        address seller;
        uint256 amount;
        OrderStatus status;
    }

    /// @dev Maps order ID to Order struct
    mapping(uint256 => Order) public orders;

    /// @dev Maps address to withdrawable balance (seller balance ledger)
    /// @notice THIS IS THE VULNERABLE STATE VARIABLE — updated too late in withdrawFunds()
    mapping(address => uint256) public balances;

    /// @dev Order ID counter
    uint256 public orderCount;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 amount);
    event FundsDeposited(uint256 indexed orderId, address indexed buyer, uint256 amount);
    event DeliveryConfirmed(uint256 indexed orderId, address indexed buyer);
    event FundsWithdrawn(address indexed seller, uint256 amount);

    // =========================================================================
    // SUPPLY CHAIN FUNCTIONS
    // =========================================================================

    /**
     * @notice Create a new supply chain order.
     * @param _seller The address of the seller/supplier.
     * @return orderId The ID of the newly created order.
     */
    function createOrder(address _seller) external returns (uint256 orderId) {
        require(_seller != address(0), "InsecureVault: seller cannot be zero address");
        require(_seller != msg.sender, "InsecureVault: buyer and seller cannot be the same");

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

    /**
     * @notice Buyer deposits ETH to lock funds in escrow.
     * @param _orderId The ID of the order to fund.
     * @dev Transitions order status from CREATED to LOCKED.
     */
    function depositFunds(uint256 _orderId) external payable {
        Order storage order = orders[_orderId];

        require(order.buyer == msg.sender, "InsecureVault: only buyer can deposit");
        require(order.status == OrderStatus.CREATED, "InsecureVault: order must be in CREATED state");
        require(msg.value > 0, "InsecureVault: deposit must be greater than zero");

        order.amount = msg.value;
        order.status = OrderStatus.LOCKED;

        // Credit the seller's withdrawable balance
        balances[order.seller] += msg.value;

        emit FundsDeposited(_orderId, msg.sender, msg.value);
    }

    /**
     * @notice Buyer confirms receipt of goods, releasing funds for seller withdrawal.
     * @param _orderId The ID of the order.
     * @dev Transitions order status from LOCKED to RELEASED.
     */
    function confirmDelivery(uint256 _orderId) external {
        Order storage order = orders[_orderId];

        require(order.buyer == msg.sender, "InsecureVault: only buyer can confirm delivery");
        require(order.status == OrderStatus.LOCKED, "InsecureVault: order must be in LOCKED state");

        order.status = OrderStatus.RELEASED;

        emit DeliveryConfirmed(_orderId, msg.sender);
    }

    /**
     * @notice Seller withdraws their earned funds from the escrow vault.
     *
     * @dev !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
     * @dev !! VULNERABLE FUNCTION — REENTRANCY ATTACK VECTOR                !!
     * @dev !!                                                                !!
     * @dev !! This function follows Interactions-before-Effects:             !!
     * @dev !!   1. CHECK:    balances[msg.sender] > 0                       !!
     * @dev !!   2. INTERACT: .call{value: amount}("") ← EXTERNAL CALL FIRST !!
     * @dev !!   3. EFFECT:   balances[msg.sender] = 0 ← STATE UPDATE LAST  !!
     * @dev !!                                                                !!
     * @dev !! Between steps 2 and 3, the attacker's receive() can re-enter  !!
     * @dev !! this function. The balance check in step 1 still passes        !!
     * @dev !! because step 3 has not yet executed.                           !!
     * @dev !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
     */
    function withdrawFunds() external {
        // STEP 1: CHECK — Validate caller has a non-zero balance
        uint256 amount = balances[msg.sender];
        require(amount > 0, "InsecureVault: no funds to withdraw");

        // STEP 2: INTERACT — Send ETH to the caller BEFORE updating state
        // ⚠️ BUG: This external call can trigger attacker's receive() function.
        // ⚠️ At this point, balances[msg.sender] is STILL the original amount.
        // ⚠️ A recursive re-entry into withdrawFunds() will pass the check above.
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "InsecureVault: ETH transfer failed");

        // STEP 3: EFFECT — Update state AFTER the external call (TOO LATE)
        // ⚠️ By the time execution reaches here after a reentrancy attack,
        // ⚠️ the attacker has already drained the contract.
        balances[msg.sender] = 0;

        emit FundsWithdrawn(msg.sender, amount);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    /**
     * @notice Returns the current ETH balance of this contract.
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Returns the withdrawable balance of a given address.
     */
    function getBalance(address _account) external view returns (uint256) {
        return balances[_account];
    }

    /**
     * @notice Returns details of a specific order.
     */
    function getOrder(uint256 _orderId) external view returns (
        address buyer,
        address seller,
        uint256 amount,
        OrderStatus status
    ) {
        Order storage order = orders[_orderId];
        return (order.buyer, order.seller, order.amount, order.status);
    }

    // =========================================================================
    // FALLBACK
    // =========================================================================

    /// @notice Allow contract to receive ETH (for testing honeypot setup)
    receive() external payable {}
}
