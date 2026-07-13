pragma solidity 0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
contract MutexVault is ReentrancyGuard {

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

    event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 amount);
    event FundsDeposited(uint256 indexed orderId, address indexed buyer, uint256 amount);
    event DeliveryConfirmed(uint256 indexed orderId, address indexed buyer);
    event FundsWithdrawn(address indexed seller, uint256 amount);

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

    function withdrawFunds() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "MutexVault: no funds to withdraw");

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "MutexVault: ETH transfer failed");

        balances[msg.sender] = 0;

        emit FundsWithdrawn(msg.sender, amount);
    }

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
