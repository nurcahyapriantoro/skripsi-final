pragma solidity 0.8.28;

contract SecureVault {
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

    function withdrawFunds() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "SecureVault: no funds to withdraw");

        balances[msg.sender] = 0;
        emit FundsWithdrawn(msg.sender, amount);

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "SecureVault: ETH transfer failed");
        
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
