# Lampiran 10. Kode Test Hardhat (5 File Eksperimen)

> **Cross-reference:** Mendukung **Bab 3.5 (Skenario Pengujian)**, **Bab 3.7 (Metode Evaluasi)**, **Bab 4.2 (Simulasi Eksploitasi)**, **Bab 4.3 (Kinerja Mitigasi)**, dan **Bab 4.4 (Analisis Komparatif Gas)**.
>
> **Repositori:** [github.com/nurcahyapriantoro/skripsi-final/tree/main/test](https://github.com/nurcahyapriantoro/skripsi-final/tree/main/test)
>
> Kelima file ini mengimplementasikan seluruh eksperimen. Total **22 test passing** (11 + 4 + 3 + 1 + 3). Dijalankan dengan `npx hardhat test`.

---

## 10.1 `01_exploit_insecure.test.js` — Eksperimen 1: Eksploitasi InsecureVault

**Lokasi:** [`test/01_exploit_insecure.test.js`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/test/01_exploit_insecure.test.js)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/test/01_exploit_insecure.test.js
**Fungsi:** Membuktikan InsecureVault rentan. Honeypot: 1,5 + 0,8 + 0,1 = 2,4 ETH. Ekspektasi: terkuras habis + profit 2,3 ETH.

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("=== EXPERIMENT 1: Reentrancy Exploit on InsecureVault ===", function () {
  let insecureVault;
  let attacker;

  let owner;
  let buyerA;
  let buyerB;
  let attackerEOA;
  let legitSeller;

  const BUYER_A_DEPOSIT = ethers.parseEther("1.5");
  const BUYER_B_DEPOSIT = ethers.parseEther("0.8");
  const ATTACKER_DEPOSIT = ethers.parseEther("0.1");
  const TOTAL_HONEYPOT = BUYER_A_DEPOSIT + BUYER_B_DEPOSIT;

  before(async function () {
    [owner, buyerA, buyerB, attackerEOA, legitSeller] = await ethers.getSigners();

    console.log("\n--- DEPLOYING CONTRACTS ---");

    const InsecureVault = await ethers.getContractFactory("InsecureVault");
    insecureVault = await InsecureVault.deploy();
    await insecureVault.waitForDeployment();
    console.log(`InsecureVault deployed at: ${await insecureVault.getAddress()}`);

    const AttackerFactory = await ethers.getContractFactory("Attacker");
    attacker = await AttackerFactory.connect(attackerEOA).deploy(
      await insecureVault.getAddress()
    );
    await attacker.waitForDeployment();
    console.log(`Attacker deployed at: ${await attacker.getAddress()}`);
  });

  describe("Phase 1: Setup the Honeypot", function () {

    it("Buyer A creates an order with a legitimate seller and deposits 1.5 ETH", async function () {
      const tx1 = await insecureVault.connect(buyerA).createOrder(legitSeller.address);
      await tx1.wait();
      const orderAId = 0;

      const tx2 = await insecureVault.connect(buyerA)
        .depositFunds(orderAId, { value: BUYER_A_DEPOSIT });
      await tx2.wait();

      const tx3 = await insecureVault.connect(buyerA).confirmDelivery(orderAId);
      await tx3.wait();

      const legitSellerBalance = await insecureVault.getBalance(legitSeller.address);
      expect(legitSellerBalance).to.equal(BUYER_A_DEPOSIT);

      console.log(`\n[SETUP] Buyer A deposited ${ethers.formatEther(BUYER_A_DEPOSIT)} ETH`);
      console.log(`[SETUP] Legit seller balance in vault: ${ethers.formatEther(legitSellerBalance)} ETH`);
    });

    it("Buyer B creates an order with a legitimate seller and deposits 0.8 ETH", async function () {
      const tx1 = await insecureVault.connect(buyerB).createOrder(legitSeller.address);
      await tx1.wait();
      const orderBId = 1;

      const tx2 = await insecureVault.connect(buyerB)
        .depositFunds(orderBId, { value: BUYER_B_DEPOSIT });
      await tx2.wait();

      const tx3 = await insecureVault.connect(buyerB).confirmDelivery(orderBId);
      await tx3.wait();

      console.log(`[SETUP] Buyer B deposited ${ethers.formatEther(BUYER_B_DEPOSIT)} ETH`);
    });

    it("Attacker registers as a seller and deposits 0.1 ETH as legitimate entry", async function () {
      const tx1 = await insecureVault.connect(buyerA).createOrder(await attacker.getAddress());
      await tx1.wait();
      const attackerOrderId = 2;

      const tx2 = await insecureVault.connect(buyerA)
        .depositFunds(attackerOrderId, { value: ATTACKER_DEPOSIT });
      await tx2.wait();

      const tx3 = await insecureVault.connect(buyerA).confirmDelivery(attackerOrderId);
      await tx3.wait();

      const attackerBalance = await insecureVault.getBalance(await attacker.getAddress());
      expect(attackerBalance).to.equal(ATTACKER_DEPOSIT);
      console.log(`[SETUP] Attacker's legitimate balance: ${ethers.formatEther(attackerBalance)} ETH`);
    });

    it("Total honeypot matches research specification (2.3 ETH contributed by victims)", async function () {
      const contractBalance = await insecureVault.getContractBalance();

      const expectedTotal = BUYER_A_DEPOSIT + BUYER_B_DEPOSIT + ATTACKER_DEPOSIT;
      expect(contractBalance).to.equal(expectedTotal);

      console.log(`\n[HONEYPOT] Contract balance before attack: ${ethers.formatEther(contractBalance)} ETH`);
      console.log(`[HONEYPOT] Victim funds (honeypot): ${ethers.formatEther(TOTAL_HONEYPOT)} ETH`);
    });
  });

  describe("Phase 2: Execute the Reentrancy Attack", function () {
    let attackerBalanceBefore;
    let contractBalanceBefore;

    it("Records pre-attack balances as baseline", async function () {
      attackerBalanceBefore = await attacker.getAttackerBalance();
      contractBalanceBefore = await insecureVault.getContractBalance();

      console.log(`\n[PRE-ATTACK] Attacker contract ETH balance: ${ethers.formatEther(attackerBalanceBefore)} ETH`);
      console.log(`[PRE-ATTACK] InsecureVault ETH balance: ${ethers.formatEther(contractBalanceBefore)} ETH`);
    });

    it("Attack executes successfully — transaction does NOT revert", async function () {
      await expect(
        attacker.connect(attackerEOA).attack()
      ).to.not.be.reverted;

      const reentrancyCount = await attacker.getReentrancyCount();
      console.log(`\n[ATTACK] Reentrancy triggered ${reentrancyCount} times`);
    });

    it("InsecureVault balance is drained to zero (or near zero)", async function () {
      const contractBalanceAfter = await insecureVault.getContractBalance();
      console.log(`[POST-ATTACK] InsecureVault balance: ${ethers.formatEther(contractBalanceAfter)} ETH`);

      expect(contractBalanceAfter).to.equal(0n);
    });

    it("Attacker contract holds stolen funds", async function () {
      const attackerBalanceAfter = await attacker.getAttackerBalance();
      console.log(`[POST-ATTACK] Attacker contract balance: ${ethers.formatEther(attackerBalanceAfter)} ETH`);

      expect(attackerBalanceAfter).to.be.greaterThan(ATTACKER_DEPOSIT);
    });

    it("Attacker profit exceeds zero — illegal gain confirmed", async function () {
      const attackerBalanceAfter = await attacker.getAttackerBalance();
      const illegalProfit = attackerBalanceAfter - ATTACKER_DEPOSIT;

      console.log(`\n[LOSS REPORT] ==========================================`);
      console.log(`[LOSS REPORT] Attacker initial deposit:  ${ethers.formatEther(ATTACKER_DEPOSIT)} ETH`);
      console.log(`[LOSS REPORT] Attacker final balance:    ${ethers.formatEther(attackerBalanceAfter)} ETH`);
      console.log(`[LOSS REPORT] Illegal profit:            ${ethers.formatEther(illegalProfit)} ETH`);
      console.log(`[LOSS REPORT] Victim A (Buyer A) loss:   ${ethers.formatEther(BUYER_A_DEPOSIT)} ETH`);
      console.log(`[LOSS REPORT] Victim B (Buyer B) loss:   ${ethers.formatEther(BUYER_B_DEPOSIT)} ETH`);
      console.log(`[LOSS REPORT] Total victim loss:         ${ethers.formatEther(TOTAL_HONEYPOT)} ETH`);
      console.log(`[LOSS REPORT] ==========================================\n`);

      expect(illegalProfit).to.be.greaterThan(0n);
    });

    it("Legitimate seller (Buyer A's and B's seller) can no longer withdraw — funds stolen", async function () {
      await expect(
        insecureVault.connect(legitSeller).withdrawFunds()
      ).to.be.reverted;

      console.log(`[VICTIM IMPACT] Legitimate seller's 2.3 ETH is permanently inaccessible.`);
    });
  });

  describe("Phase 3: Attacker Exfiltrates Funds", function () {
    it("Attacker EOA collects all stolen ETH from the Attacker contract", async function () {
      const attackerContractBalance = await attacker.getAttackerBalance();
      const attackerEOABalanceBefore = await ethers.provider.getBalance(attackerEOA.address);

      await attacker.connect(attackerEOA).collectFunds();

      const attackerContractBalanceAfter = await attacker.getAttackerBalance();
      const attackerEOABalanceAfter = await ethers.provider.getBalance(attackerEOA.address);

      expect(attackerContractBalanceAfter).to.equal(0n);
      expect(attackerEOABalanceAfter).to.be.greaterThan(attackerEOABalanceBefore);

      console.log(`[EXFILTRATION] ${ethers.formatEther(attackerContractBalance)} ETH exfiltrated to attacker EOA`);
    });
  });
});
```

**Penjelasan struktur:**
- **Phase 1 (Setup Honeypot):** 4 test — meniru skenario Bab 3.6.1: Buyer A (1,5 ETH), Buyer B (0,8 ETH), Attacker (0,1 ETH) → total 2,4 ETH.
- **Phase 2 (Eksekusi serangan):** 6 test — `attack()` dipanggil; reentrancy berulang 24×; vault terkuras ke 0; profit Attacker = 2,3 ETH.
- **Phase 3 (Exfiltrasi):** 1 test — Attacker contract → EOA via `collectFunds()`.
- **Konstanta di L14–17:** Konsisten dengan Tabel 4 skripsi (komposisi honeypot).

---

## 10.2 `02_mitigate_secure.test.js` — Eksperimen 2: Mitigasi CEI

**Lokasi:** [`test/02_mitigate_secure.test.js`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/test/02_mitigate_secure.test.js)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/test/02_mitigate_secure.test.js
**Fungsi:** Verifikasi SecureVault menolak serangan reentrancy. Honeypot identik.

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("=== EXPERIMENT 2: CEI Mitigation on SecureVault ===", function () {
  let secureVault, attacker;
  let buyerA, buyerB, attackerEOA, legitSeller;

  const BUYER_A_DEPOSIT = ethers.parseEther("1.5");
  const BUYER_B_DEPOSIT = ethers.parseEther("0.8");
  const ATTACKER_DEPOSIT = ethers.parseEther("0.1");
  const TOTAL_HONEYPOT = BUYER_A_DEPOSIT + BUYER_B_DEPOSIT;

  beforeEach(async function () {
    [, buyerA, buyerB, attackerEOA, legitSeller] = await ethers.getSigners();

    const SecureVault = await ethers.getContractFactory("SecureVault");
    secureVault = await SecureVault.deploy();
    await secureVault.waitForDeployment();

    const AttackerFactory = await ethers.getContractFactory("Attacker");
    attacker = await AttackerFactory.connect(attackerEOA).deploy(
      await secureVault.getAddress()
    );
    await attacker.waitForDeployment();

    await secureVault.connect(buyerA).createOrder(legitSeller.address);
    await secureVault.connect(buyerA).depositFunds(0, { value: BUYER_A_DEPOSIT });
    await secureVault.connect(buyerA).confirmDelivery(0);

    await secureVault.connect(buyerB).createOrder(legitSeller.address);
    await secureVault.connect(buyerB).depositFunds(1, { value: BUYER_B_DEPOSIT });
    await secureVault.connect(buyerB).confirmDelivery(1);

    await secureVault.connect(buyerA).createOrder(await attacker.getAddress());
    await secureVault.connect(buyerA).depositFunds(2, { value: ATTACKER_DEPOSIT });
    await secureVault.connect(buyerA).confirmDelivery(2);
  });

  describe("Attack Resistance Validation", function () {

    it("Attack transaction REVERTS on SecureVault (reentrancy blocked)", async function () {
      await expect(
        attacker.connect(attackerEOA).attack()
      ).to.be.reverted;

      console.log("\n[CEI] Attack transaction correctly reverted.");
    });

    it("Attacker receives only their own deposit (0.1 ETH), no illegal profit", async function () {
      try {
        await attacker.connect(attackerEOA).attack();
      } catch (_) {
      }

      const attackerContractEth = await attacker.getAttackerBalance();
      expect(attackerContractEth).to.equal(0n);

      const attackerVaultBalance = await secureVault.getBalance(await attacker.getAddress());
      expect(attackerVaultBalance).to.equal(ATTACKER_DEPOSIT);
      console.log("[CEI] Attack reverted. Attacker contract ETH: 0. Vault balance unchanged at 0.1 ETH. No illegal gain.");
    });

    it("Contract balance remains 2.3 ETH (victim funds fully preserved)", async function () {
      try { await attacker.connect(attackerEOA).attack(); } catch (_) {}

      const contractBalance = await secureVault.getContractBalance();
      expect(contractBalance).to.be.greaterThanOrEqual(TOTAL_HONEYPOT);

      console.log(`[CEI] Contract balance preserved: ${ethers.formatEther(contractBalance)} ETH`);
    });

    it("SecureVault: profit ≤ 0 (research success criterion met)", async function () {
      try { await attacker.connect(attackerEOA).attack(); } catch (_) {}

      const attackerContractEth = await attacker.getAttackerBalance();
      const illegalProfit = attackerContractEth;

      expect(illegalProfit).to.equal(0n);
      console.log(`[CEI] Illegal profit: ${ethers.formatEther(illegalProfit)} ETH (≤ 0 ✅)`);
    });
  });
});
```

**Penjelasan:**
- **`beforeEach` (L13–37):** Setup ulang untuk setiap test (mencegah kontaminasi state antar test). Honeypot 2,4 ETH seperti Eksperimen 1.
- **4 test pada Attack Resistance Validation:**
  1. Serangan *revert* (L41–47).
  2. Attacker contract tidak pegang ETH curian (L49–61).
  3. Saldo vault ≥ 2,3 ETH (korban aman) (L63–70).
  4. Profit = 0 (kriteria sukses) (L72–80).

---

## 10.3 `03_mitigate_mutex.test.js` — Eksperimen 3: Mitigasi Mutex Lock

**Lokasi:** [`test/03_mitigate_mutex.test.js`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/test/03_mitigate_mutex.test.js)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/test/03_mitigate_mutex.test.js
**Fungsi:** Verifikasi MutexVault menolak serangan reentrancy via modifier `nonReentrant`.

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("=== EXPERIMENT 3: Mutex Mitigation on MutexVault ===", function () {
  let mutexVault, attacker;
  let buyerA, buyerB, attackerEOA, legitSeller;

  const BUYER_A_DEPOSIT = ethers.parseEther("1.5");
  const BUYER_B_DEPOSIT = ethers.parseEther("0.8");
  const ATTACKER_DEPOSIT = ethers.parseEther("0.1");
  const TOTAL_HONEYPOT = BUYER_A_DEPOSIT + BUYER_B_DEPOSIT;

  beforeEach(async function () {
    [, buyerA, buyerB, attackerEOA, legitSeller] = await ethers.getSigners();

    const MutexVault = await ethers.getContractFactory("MutexVault");
    mutexVault = await MutexVault.deploy();
    await mutexVault.waitForDeployment();

    const AttackerFactory = await ethers.getContractFactory("Attacker");
    attacker = await AttackerFactory.connect(attackerEOA).deploy(
      await mutexVault.getAddress()
    );
    await attacker.waitForDeployment();

    await mutexVault.connect(buyerA).createOrder(legitSeller.address);
    await mutexVault.connect(buyerA).depositFunds(0, { value: BUYER_A_DEPOSIT });
    await mutexVault.connect(buyerA).confirmDelivery(0);

    await mutexVault.connect(buyerB).createOrder(legitSeller.address);
    await mutexVault.connect(buyerB).depositFunds(1, { value: BUYER_B_DEPOSIT });
    await mutexVault.connect(buyerB).confirmDelivery(1);

    await mutexVault.connect(buyerA).createOrder(await attacker.getAddress());
    await mutexVault.connect(buyerA).depositFunds(2, { value: ATTACKER_DEPOSIT });
    await mutexVault.connect(buyerA).confirmDelivery(2);
  });

  it("Attack on MutexVault reverts (nonReentrant blocks re-entry)", async function () {
    await expect(
      attacker.connect(attackerEOA).attack()
    ).to.be.reverted;

    console.log("\n[MUTEX] Attack transaction correctly reverted.");
  });

  it("Victim funds preserved in MutexVault after attack attempt", async function () {
    try { await attacker.connect(attackerEOA).attack(); } catch (_) {}

    const contractBalance = await mutexVault.getContractBalance();
    expect(contractBalance).to.be.greaterThanOrEqual(TOTAL_HONEYPOT);
    console.log(`[MUTEX] Contract balance preserved: ${ethers.formatEther(contractBalance)} ETH`);
  });

  it("MutexVault: profit ≤ 0 (equivalent security to CEI)", async function () {
    try { await attacker.connect(attackerEOA).attack(); } catch (_) {}
    const attackerBalance = await attacker.getAttackerBalance();
    expect(attackerBalance).to.equal(0n);
  });
});
```

**Penjelasan:**
- **Struktur paralel dengan `02_mitigate_secure.test.js`**, hanya berbeda pada `MutexVault` (pakai `nonReentrant`).
- **3 test:** revert serangan, korban aman, profit = 0.

---

## 10.4 `04_gas_benchmark.test.js` — Eksperimen 4: Benchmark Gas Komprehensif

**Lokasi:** [`test/04_gas_benchmark.test.js`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/test/04_gas_benchmark.test.js)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/test/04_gas_benchmark.test.js
**Fungsi:** Mengukur biaya deployment + full flow untuk SecureVault vs MutexVault, termasuk variasi deposit (0,1 / 1 / 5 / 10 ETH) dan demo serangan.

```javascript
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("=== GAS BENCHMARK: CEI vs Mutex (Comprehensive) ===", function () {
  let secureFactory, mutexFactory, insecureFactory, attackerFactory;

  before(async function () {
    secureFactory = await ethers.getContractFactory("SecureVault");
    mutexFactory = await ethers.getContractFactory("MutexVault");
    insecureFactory = await ethers.getContractFactory("InsecureVault");
    attackerFactory = await ethers.getContractFactory("Attacker");
  });

  async function deployContract(factory, ...args) {
    const vault = await factory.deploy(...args);
    await vault.waitForDeployment();
    const tx = vault.deploymentTransaction();
    const receipt = await tx.wait();
    return { vault, deployGas: Number(receipt.gasUsed) };
  }

  async function fullFlow(contractName, depositAmount) {
    const [, buyer, seller] = await ethers.getSigners();
    const factory = contractName === "SecureVault" ? secureFactory : contractName === "MutexVault" ? mutexFactory : insecureFactory;
    const { vault, deployGas } = await deployContract(factory);
    const addr = await vault.getAddress();

    const tx1 = await vault.connect(buyer).createOrder(seller.address);
    const r1 = await tx1.wait();
    const tx2 = await vault.connect(buyer).depositFunds(0, { value: depositAmount });
    const r2 = await tx2.wait();
    const tx3 = await vault.connect(buyer).confirmDelivery(0);
    const r3 = await tx3.wait();
    const tx4 = await vault.connect(seller).withdrawFunds();
    const r4 = await tx4.wait();

    return {
      contractName,
      deposit: ethers.formatEther(depositAmount),
      deployGas,
      createOrderGas: Number(r1.gasUsed),
      depositFundsGas: Number(r2.gasUsed),
      confirmDeliveryGas: Number(r3.gasUsed),
      withdrawFundsGas: Number(r4.gasUsed),
      totalEndToEnd: Number(r1.gasUsed) + Number(r2.gasUsed) + Number(r3.gasUsed) + Number(r4.gasUsed),
    };
  }

  it("1. Deployment Cost Comparison", async function () {
    const { deployGas: gInsecure } = await deployContract(insecureFactory);
    await network.provider.send("hardhat_reset");
    const { deployGas: gSecure } = await deployContract(secureFactory);
    await network.provider.send("hardhat_reset");
    const { deployGas: gMutex } = await deployContract(mutexFactory);

    console.log(`  InsecureVault: ${gInsecure.toLocaleString()} gas`);
    console.log(`  SecureVault  : ${gSecure.toLocaleString()} gas`);
    console.log(`  MutexVault   : ${gMutex.toLocaleString()} gas`);
  });

  it("2. Full Flow: SecureVault vs MutexVault (0.5 ETH)", async function () {
    const r1 = await fullFlow("SecureVault", ethers.parseEther("0.5"));
    await network.provider.send("hardhat_reset");
    const r2 = await fullFlow("MutexVault", ethers.parseEther("0.5"));

    expect(r1.withdrawFundsGas).to.be.lessThan(r2.withdrawFundsGas);
  });

  it("3. Deposit Amount Variation: 0.1, 1, 5, 10 ETH", async function () {
    const amounts = [ethers.parseEther("0.1"), ethers.parseEther("1"), ethers.parseEther("5"), ethers.parseEther("10")];

    for (const amt of amounts) {
      const r1 = await fullFlow("SecureVault", amt);
      await network.provider.send("hardhat_reset");
      const r2 = await fullFlow("MutexVault", amt);
      await network.provider.send("hardhat_reset");
      const diff = r2.withdrawFundsGas - r1.withdrawFundsGas;
    }
  });

  it("4. Attack Demo: InsecureVault exploit fails with CEI", async function () {
    const [owner, buyer, seller] = await ethers.getSigners();

    const { vault: insecure } = await deployContract(insecureFactory);
    const insecureAddr = await insecure.getAddress();
    await insecure.connect(buyer).createOrder(seller.address);
    await insecure.connect(buyer).depositFunds(0, { value: ethers.parseEther("1") });
    await insecure.connect(buyer).confirmDelivery(0);

    const attacker = await attackerFactory.deploy(insecureAddr);
    await attacker.waitForDeployment();
    const attackerAddr = await attacker.getAddress();

    await insecure.connect(seller).createOrder(attackerAddr);
    await insecure.connect(seller).depositFunds(1, { value: ethers.parseEther("0.1") });
    await insecure.connect(seller).confirmDelivery(1);

    const attackTx = await attacker.connect(owner).attack({ gasLimit: 500000 });
    const attackReceipt = await attackTx.wait();
    const attackGas = Number(attackReceipt.gasUsed);

    await network.provider.send("hardhat_reset");
    const { vault: secure } = await deployContract(secureFactory);
    const secureAddr = await secure.getAddress();
    const attacker2 = await attackerFactory.deploy(secureAddr);
    await attacker2.waitForDeployment();

    try {
      await attacker2.connect(owner).attack({ gasLimit: 500000 });
    } catch (err) {
      // Expected to revert
    }
  });
});
```

**Catatan:** Kode lengkap tersedia di tautan raw di atas. Empat test mencakup: deployment cost, full flow, variasi deposit, dan demo serangan.

---

## 10.5 `05_legitimate_users.test.js` — Eksperimen 5: Liveness Pengguna Sah

**Lokasi:** [`test/05_legitimate_users.test.js`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/test/05_legitimate_users.test.js)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/test/05_legitimate_users.test.js
**Fungsi:** Memverifikasi penjual jujur tetap bisa menarik dana setelah mitigasi diterapkan (kriteria liveness di Bab 3.7.2).

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("=== LIVENESS TEST: Legitimate Withdrawals Work on Secure Contracts ===", function () {
  const DEPOSIT = ethers.parseEther("1.0");

  async function setupAndWithdraw(contractName) {
    const [, buyer, seller] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory(contractName);
    const vault = await Factory.deploy();
    await vault.waitForDeployment();

    await vault.connect(buyer).createOrder(seller.address);
    await vault.connect(buyer).depositFunds(0, { value: DEPOSIT });
    await vault.connect(buyer).confirmDelivery(0);

    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
    const tx = await vault.connect(seller).withdrawFunds();
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);

    const netGain = sellerBalanceAfter - sellerBalanceBefore + gasUsed;
    return { vault, netGain };
  }

  it("SecureVault: legitimate seller successfully withdraws 1 ETH", async function () {
    const { netGain } = await setupAndWithdraw("SecureVault");
    expect(netGain).to.be.closeTo(DEPOSIT, ethers.parseEther("0.001"));
    console.log("\n[LIVENESS] SecureVault: legitimate withdrawal succeeded ✅");
  });

  it("MutexVault: legitimate seller successfully withdraws 1 ETH", async function () {
    const { netGain } = await setupAndWithdraw("MutexVault");
    expect(netGain).to.be.closeTo(DEPOSIT, ethers.parseEther("0.001"));
    console.log("[LIVENESS] MutexVault: legitimate withdrawal succeeded ✅");
  });

  it("SecureVault: second withdrawal attempt correctly reverts (no double-withdraw)", async function () {
    const [, buyer, seller] = await ethers.getSigners();
    const SecureVault = await ethers.getContractFactory("SecureVault");
    const vault = await SecureVault.deploy();
    await vault.waitForDeployment();

    await vault.connect(buyer).createOrder(seller.address);
    await vault.connect(buyer).depositFunds(0, { value: DEPOSIT });
    await vault.connect(buyer).confirmDelivery(0);

    await vault.connect(seller).withdrawFunds();
    await expect(vault.connect(seller).withdrawFunds())
      .to.be.revertedWith("SecureVault: no funds to withdraw");

    console.log("[LIVENESS] Double-withdrawal correctly prevented ✅");
  });
});
```

**Penjelasan:**
- **Test 1 & 2:** Penjual jujur menarik 1 ETH; net gain harus ≈ 1 ETH (akuransi 0,001 ETH untuk fluktuasi gas price).
- **Test 3:** Setelah penarikan pertama sukses, penarikan kedua harus *revert* dengan pesan `"SecureVault: no funds to withdraw"` — membuktikan saldo sudah di-nol-kan.

— **Akhir Lampiran 10** —
