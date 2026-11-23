
import {
  auth,
  db,
  ADMIN_UIDS,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET
} from "../js/firebase.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

// ======================================
// HELPERS
// ======================================

const $ = selector => document.querySelector(selector);

const money = value =>
  `Rs. ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

const say = (selector, message) => {
  const element = $(selector);
  if (element) element.textContent = message;
};

let customers = [];
let orders = [];
let payments = [];
let products = [];
let currentUser = null;

const customerCol = collection(db, "customers");
const orderCol = collection(db, "orders");
const paymentCol = collection(db, "payments");
const productCol = collection(db, "products");

// ======================================
// LOGIN
// ======================================

$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);

  say("#loginMessage", "Signing in...");

  try {
    await signInWithEmailAndPassword(
      auth,
      data.get("email"),
      data.get("password")
    );
  } catch (error) {
    say("#loginMessage", error.message);
  }
});

$("#logoutBtn").addEventListener("click", () => signOut(auth));

// ======================================
// AUTH CHECK
// ======================================

onAuthStateChanged(auth, async user => {
  if (!user) {
    currentUser = null;
    $("#loginView").hidden = false;
    $("#appView").hidden = true;
    return;
  }

  if (!ADMIN_UIDS.includes(user.uid)) {
    say("#loginMessage", "This account is not authorized.");
    await signOut(auth);
    return;
  }

  currentUser = user;

  $("#loginView").hidden = true;
  $("#appView").hidden = false;
  $("#staffEmail").textContent = user.email || "Administrator";

  await refresh();
});

// ======================================
// LOAD ALL DATA
// ======================================

async function refresh() {
  try {
    const [cs, os, ps] = await Promise.all([
      getDocs(query(customerCol, orderBy("createdAt", "desc"))),
      getDocs(query(orderCol, orderBy("createdAt", "desc"))),
      getDocs(query(paymentCol, orderBy("createdAt", "desc")))
    ]);

    customers = cs.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    orders = os.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    payments = ps.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    renderAll();

  } catch (error) {
    say("#globalMessage", `Could not load management data: ${error.message}`);
  }

  await loadProducts();
}

// ======================================
// DASHBOARD
// ======================================

// ======================================
// DASHBOARD
// ======================================

// Check whether a Firestore date belongs to today
function isToday(timestamp) {
  if (!timestamp) return false;

  const date = timestamp?.toDate
    ? timestamp.toDate()
    : new Date(timestamp);

  if (isNaN(date.getTime())) return false;

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function renderAll() {
  // Total Customers - All customers
  $("#statCustomers").textContent = customers.length;

  // Today's orders only
  const todayOrders = orders.filter(order =>
    isToday(order.createdAt)
  );

  // Total Orders - Today's count
  $("#statOrders").textContent = todayOrders.length;

  // Pending Orders - Keep existing all-time calculation
  $("#statPending").textContent =
    orders.filter(order => order.status === "Pending").length;

  // Outstanding Balance - Today's orders only
  const todayOutstanding = todayOrders.reduce(
    (sum, order) =>
      sum + Math.max(
        0,
        Number(order.total || 0) - Number(order.paid || 0)
      ),
    0
  );

  $("#statBalance").textContent = money(todayOutstanding);

  // Recent Orders - Keep existing behavior
  $("#recentOrders").innerHTML = tableOrders(orders.slice(0, 6));

  // Other sections - Keep existing behavior
  renderCustomers();
  renderOrders();
  renderPayments();
  fillCustomerOptions();
}

// ======================================
// ORDERS TABLE
// ======================================

function tableOrders(rows, showActions = false) {
  if (!rows.length) return "<p>No orders yet.</p>";

  return `
    <table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Description</th>
          <th>Total</th>
          <th>Balance</th>
          <th>Status</th>
          ${showActions ? "<th>Actions</th>" : ""}
        </tr>
      </thead>

      <tbody>
        ${rows.map(order => `
          <tr>
            <td>
              <strong>${esc(order.orderCode || order.id.slice(0, 7))}</strong>
            </td>

            <td>${esc(order.customerName)}</td>
            <td>${esc(order.description)}</td>
            <td>${money(order.total)}</td>

            <td>
              ${money(
    Number(order.total || 0) - Number(order.paid || 0)
  )}
            </td>

            <td>
              <span class="pill ${order.status === "Completed" ? "good" : "info"
    }">
                ${esc(order.status)}
              </span>
            </td>

            ${showActions
      ? `
                  <td>
                    <button
                      type="button"
                      data-order-edit="${esc(order.id)}">
                      Edit
                    </button>

                    <div class="whatsapp-action">
                  <button
                    type="button"
                    class="whatsapp-trigger"
                    data-order-message="${esc(order.id)}">
                    Send Message ▾
                  </button>

                  <div class="whatsapp-message-menu" hidden>
                    <button type="button" data-message-type="recorded">
                      📋 Order Recorded
                    </button>

                    <button type="button" data-message-type="ready">
                      ✅ Order Ready
                    </button>
                  </div>
                </div>

                    <button
                      type="button"
                      class="delete-product"
                      data-order-delete="${esc(order.id)}">
                      Delete
                    </button>
                  </td>
                `
      : ""
    }
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ======================================
// CUSTOMERS
// ======================================

function renderCustomers() {
  const term = ($("#customerSearch").value || "").toLowerCase();

  const rows = customers.filter(customer =>
    [
      customer.name,
      customer.customerId,
      customer.phone,
      customer.birthday
    ].join(" ").toLowerCase().includes(term)
  );

  $("#customersTable").innerHTML = rows.length ? `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Customer ID</th>
          <th>Phone</th>
          <th>Birthday</th>
          <th>Added</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>
        ${rows.map(customer => `
          <tr>
            <td><strong>${esc(customer.name)}</strong></td>
            <td>${esc(customer.customerId)}</td>
            <td>${esc(customer.phone)}</td>
            <td>${esc(customer.birthday || "—")}</td>
            <td>
              ${customer.createdAt?.toDate?.()?.toLocaleDateString?.() || "—"}
            </td>

            <td>
              <button
                type="button"
                data-customer-edit="${esc(customer.id)}">
                Edit
              </button>

              <button
                type="button"
                class="delete-product"
                data-customer-delete="${esc(customer.id)}">
                Delete
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : "<p>No customers found.</p>";

  $("#customersTable").querySelectorAll("[data-customer-edit]")
    .forEach(button => {
      button.onclick = () => editCustomer(button.dataset.customerEdit);
    });

  $("#customersTable").querySelectorAll("[data-customer-delete]")
    .forEach(button => {
      button.onclick = () => deleteCustomer(button.dataset.customerDelete);
    });
}

// ======================================
// ADD / EDIT CUSTOMER
// ======================================

$("#showCustomerForm").onclick = () => {
  const form = $("#customerForm");

  form.reset();
  form.dataset.editId = "";
  form.hidden = false;

  say("#customerMessage", "");

  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.textContent = "Save Customer";
};

function editCustomer(id) {
  const customer = customers.find(item => item.id === id);
  if (!customer) return;

  const form = $("#customerForm");

  form.reset();
  form.dataset.editId = customer.id;

  const savedName = String(customer.name || "").trim();
  const titleMatch = savedName.match(/^(Mr\.|Ms\.)\s*/i);

  form.elements.title.value = titleMatch
    ? titleMatch[1].toLowerCase() === "mr." ? "Mr." : "Ms."
    : "Mr.";

  form.elements.customerId.value = customer.customerId || "";
  form.elements.name.value = savedName.replace(/^(Mr\.|Ms\.)\s*/i, "");
  form.elements.phone.value = customer.phone || "";
  form.elements.birthday.value = customer.birthday || "";

  form.hidden = false;

  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.textContent = "Update Customer";

  say("#customerMessage", "Editing customer details.");

  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

$("#customerForm").addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);

  const editId = form.dataset.editId || "";

  const customerId = String(data.get("customerId") || "").trim();
  const title = String(data.get("title") || "Mr.").trim();
  const customerName = String(data.get("name") || "").trim();
  const name = `${title} ${customerName}`;
  const phone = String(data.get("phone") || "").replace(/[^\d+]/g, "");
  const birthday = String(data.get("birthday") || "");

  if (!name || !customerId || !phone) {
    say("#customerMessage", "Please complete all required fields.");
    return;
  }

  try {
    const duplicate = await getDocs(
      query(customerCol, where("customerId", "==", customerId))
    );

    const alreadyExists = duplicate.docs.some(
      item => item.id !== editId
    );

    if (alreadyExists) {
      say("#customerMessage", "That Customer ID already exists.");
      return;
    }

    if (editId) {
      await updateDoc(doc(db, "customers", editId), {
        name,
        customerId,
        phone,
        birthday,
        updatedAt: serverTimestamp()
      });

      say("#globalMessage", "Customer updated successfully.");

    } else {
      await addDoc(customerCol, {
        name,
        customerId,
        phone,
        birthday,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      });

      say("#globalMessage", "Customer saved successfully.");
    }

    form.reset();
    form.dataset.editId = "";
    form.hidden = true;

    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.textContent = "Save Customer";

    await refresh();

  } catch (error) {
    say("#customerMessage", error.message);
  }
});

// DELETE CUSTOMER

async function deleteCustomer(id) {
  if (!currentUser || !ADMIN_UIDS.includes(currentUser.uid)) return;

  const customer = customers.find(item => item.id === id);
  if (!customer) return;

  const confirmed = window.confirm(
    `Are you sure you want to permanently delete ${customer.name}?`
  );

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "customers", id));

    say("#globalMessage", "Customer deleted successfully.");

    await refresh();

  } catch (error) {
    say("#globalMessage", `Delete failed: ${error.message}`);
  }
}

// ======================================
// ORDERS
// ======================================

function renderOrders() {
  const term = ($("#orderSearch").value || "").toLowerCase();

  const rows = orders.filter(order =>
    [
      order.orderCode,
      order.customerName,
      order.description,
      order.customerId
    ].join(" ").toLowerCase().includes(term)
  );

  $("#ordersTable").innerHTML = tableOrders(rows, true);

  $("#ordersTable").querySelectorAll("[data-order-edit]")
    .forEach(button => {
      button.onclick = () => editOrder(button.dataset.orderEdit);
    });

  $("#ordersTable").querySelectorAll("[data-order-message]")
    .forEach(button => {
      button.onclick = () => sendOrderMessage(button.dataset.orderMessage);
    });

  $("#ordersTable").querySelectorAll("[data-order-delete]")
    .forEach(button => {
      button.onclick = () => deleteOrder(button.dataset.orderDelete);
    });
}

// ======================================
// SEND WHATSAPP MESSAGE
// ======================================

function formatWhatsAppPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");

  if (digits.startsWith("0")) {
    digits = "94" + digits.slice(1);
  } else if (!digits.startsWith("94") && digits.length === 9) {
    digits = "94" + digits;
  }

  return digits;
}

function createOrderMessage(order, customer, messageType = "recorded") {
  const isReady = messageType === "ready";

  return `
${customer.name} 👋

${isReady
      ? "Great news! Your order at Vision Center is now ready! 🎉"
      : "Your order at Vision Center has been successfully recorded. ✅"
    }

Order: ${order.orderCode}
Item: ${order.description}
Order Price: ${money(order.subtotal ?? order.total)}
Discount: ${money(order.discount || 0)}
Final Total: ${money(order.total)}
Paid: ${money(order.paid)}
Balance: ${money(order.balance)}

${isReady
      ? "You can visit Vision Center to collect your order. We look forward to seeing you! 😊"
      : "We will keep you updated about your order. Thank you for choosing Vision Center!"
    }

Thank you for choosing Vision Center Family Eye Care Services! 💙

📱 Stay Connected With Us!

🔵 Website: https://www.visioncenter.lk
🔵 Facebook: https://www.facebook.com/profile.php?id=61571592376431
🎵 TikTok: https://www.tiktok.com/@vision_center
▶️ YouTube: https://www.youtube.com/@VisionCenterGampaha

Your support means a lot to us! ❤️

Vision Center
See Better. Live Better. 👁️
  `.trim();
}



function sendOrderMessage(id) {
  const order = orders.find(item => item.id === id);

  if (!order) {
    say("#globalMessage", "Order not found.");
    return;
  }

  const phone = formatWhatsAppPhone(order.phone);

  if (!phone || phone.length < 11) {
    say("#globalMessage", "Customer phone number is invalid.");
    return;
  }

  // Remove any previously opened dropdown
  document.querySelectorAll(".whatsapp-message-menu").forEach(menu => {
    menu.remove();
  });

  const button = document.querySelector(
    `[data-order-message="${CSS.escape(id)}"]`
  );

  if (!button) return;

  const menu = document.createElement("div");
  menu.className = "whatsapp-message-menu";

  menu.innerHTML = `
    <button type="button" data-message-type="recorded">
      📋 Order Recorded
    </button>

    <button type="button" data-message-type="ready">
      ✅ Order Ready
    </button>
  `;

  button.insertAdjacentElement("afterend", menu);

  menu.querySelectorAll("[data-message-type]").forEach(option => {
    option.onclick = () => {
      const messageType = option.dataset.messageType;

      const message = createOrderMessage(
        {
          orderCode: order.orderCode || order.id,
          description: order.description,
          subtotal: order.subtotal ?? (
            Number(order.total || 0) + Number(order.discount || 0)
          ),
          discount: order.discount || 0,
          total: order.total,
          paid: order.paid,
          balance: Math.max(
            0,
            Number(order.total || 0) - Number(order.paid || 0)
          )
        },
        {
          name: order.customerName || "Customer"
        },
        messageType
      );

      const whatsappUrl =
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

      window.open(whatsappUrl, "_blank", "noopener");

      menu.remove();
    };
  });
}


// ======================================
// EDIT ORDER
// ======================================

function editOrder(id) {
  const order = orders.find(item => item.id === id);
  if (!order) return;

  const form = $("#orderForm");

  form.reset();
  form.dataset.editId = order.id;

  fillCustomerOptions();

  form.elements.customerId.value = order.customerRef || "";

  $("#orderCustomerSearch").value = order.customerId || "";

  $("#orderCustomerInfo").textContent =
    `Selected: ${order.customerName || ""} · ${order.phone || ""}`;

  // Order Number
  form.elements.orderCode.value = order.orderCode || "";

  form.elements.description.value = order.description || "";
  form.elements.total.value =
    order.subtotal ?? (
      Number(order.total || 0) + Number(order.discount || 0)
    );

  form.elements.discount.value = order.discount ?? 0;
  form.elements.paid.value = order.paid ?? 0;
  form.elements.status.value = order.status || "Pending";

  form.hidden = false;

  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.textContent = "Update Order";

  say("#orderMessage", "Editing existing order.");

  updateBalance();

  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// ======================================
// DELETE ORDER + RELATED PAYMENTS
// ======================================

async function deleteOrder(id) {
  if (!currentUser || !ADMIN_UIDS.includes(currentUser.uid)) return;

  const order = orders.find(item => item.id === id);
  if (!order) return;

  const confirmed = window.confirm(
    `Delete order ${order.orderCode || id} and its related payment records permanently?`
  );

  if (!confirmed) return;

  try {
    const relatedPayments = await getDocs(
      query(paymentCol, where("orderRef", "==", id))
    );

    const batch = writeBatch(db);

    batch.delete(doc(db, "orders", id));

    relatedPayments.forEach(payment => {
      batch.delete(doc(db, "payments", payment.id));
    });

    await batch.commit();

    say("#globalMessage", "Order and related payments deleted successfully.");

    await refresh();

  } catch (error) {
    say("#globalMessage", `Order delete failed: ${error.message}`);
  }
}

// ======================================
// PAYMENTS
// ======================================

function renderPayments() {
  $("#paymentsTable").innerHTML = payments.length ? `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Customer</th>
          <th>Order</th>
          <th>Amount</th>
          <th>Method</th>
        </tr>
      </thead>

      <tbody>
        ${payments.map(payment => `
          <tr>
            <td>
              ${payment.createdAt?.toDate?.()?.toLocaleString?.() || "—"}
            </td>
            <td>${esc(payment.customerName)}</td>
            <td>${esc(payment.orderCode || "—")}</td>
            <td>${money(payment.amount)}</td>
            <td>${esc(payment.method || "Cash")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : "<p>No payments recorded yet.</p>";
}

// ======================================
// CUSTOMER OPTIONS
// ======================================
function fillCustomerOptions() {
  const form = $("#orderForm");
  const select = form.elements.customerId;
  const search = $("#orderCustomerSearch");
  const suggestions = $("#orderCustomerSuggestions");

  const selectedValue = select.value;

  select.innerHTML =
    '<option value="">Choose customer</option>' +
    customers.map(customer => `
      <option value="${esc(customer.id)}">
        ${esc(customer.name)} · ${esc(customer.customerId)}
      </option>
    `).join("");

  suggestions.innerHTML = customers.map(customer => `
    <option value="${esc(customer.customerId)}">
      ${esc(customer.name)}
    </option>
  `).join("");

  if (selectedValue) {
    select.value = selectedValue;
  }
}

const orderCustomerSearch = $("#orderCustomerSearch");
const orderCustomerSelect = $("#orderCustomerSelect");
const orderCustomerInfo = $("#orderCustomerInfo");

orderCustomerSearch.addEventListener("input", () => {
  const searchValue = orderCustomerSearch.value.trim().toLowerCase();

  const customer = customers.find(item =>
    String(item.customerId || "").trim().toLowerCase() === searchValue
  );

  if (customer) {
    orderCustomerSelect.value = customer.id;

    orderCustomerInfo.textContent =
      `Selected: ${customer.name} · ${customer.phone || ""}`;

    orderCustomerInfo.style.color = "#16803c";
  } else {
    orderCustomerSelect.value = "";

    orderCustomerInfo.textContent =
      searchValue
        ? "Customer ID not found. Please check the ID."
        : "Enter a Customer ID to find a customer.";

    orderCustomerInfo.style.color = searchValue ? "#dc2626" : "";
  }
});

// ======================================
// NAVIGATION
// ======================================

function showView(name) {
  document.querySelectorAll(".view").forEach(view => {
    view.hidden = true;
  });

  const selectedView = $(`#${name}View`);
  if (selectedView) selectedView.hidden = false;

  document.querySelectorAll(".nav[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === name);
  });

  $("#pageTitle").textContent =
    name.charAt(0).toUpperCase() + name.slice(1);

  if (name === "products") {
    loadProducts();
  }
}

document.querySelectorAll(".nav[data-view]").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.go));
});

// ======================================
// OPEN / CLOSE FORMS
// ======================================

$("#showOrderForm").onclick = () => {
  const form = $("#orderForm");

  form.reset();
  form.dataset.editId = "";
  form.hidden = false;

  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.textContent = "Save Order";

  say("#orderMessage", "");

  updateBalance();
};

document.querySelectorAll("[data-cancel]").forEach(button => {
  button.onclick = () => {
    const form = $(`#${button.dataset.cancel}`);

    if (form) {
      form.hidden = true;

      if (form.id === "orderForm") {
        form.dataset.editId = "";

        const submitButton = form.querySelector('[type="submit"]');
        if (submitButton) submitButton.textContent = "Save Order";
      }
    }
  };
});

$("#customerSearch").oninput = renderCustomers;
$("#orderSearch").oninput = renderOrders;

// ======================================
// ORDER FORM
// ======================================

const orderForm = $("#orderForm");

function updateBalance() {
  const subtotal = Number(orderForm.elements.total.value || 0);
  const discount = Number(orderForm.elements.discount.value || 0);
  const paid = Number(orderForm.elements.paid.value || 0);

  const finalTotal = Math.max(0, subtotal - discount);
  const balance = Math.max(0, finalTotal - paid);

  $("#finalTotalPreview").textContent =
    `Final Total: ${money(finalTotal)}`;

  $("#balancePreview").textContent =
    `Balance: ${money(balance)}`;
}

orderForm.elements.total.oninput = updateBalance;
orderForm.elements.discount.oninput = updateBalance;
orderForm.elements.paid.oninput = updateBalance;

// ======================================
// CREATE / UPDATE ORDER
// ======================================

orderForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser || !ADMIN_UIDS.includes(currentUser.uid)) {
    say("#orderMessage", "You are not authorized.");
    return;
  }

  const form = event.currentTarget;
  const data = new FormData(form);

  const editId = form.dataset.editId || "";

  const customer = customers.find(
    item => item.id === data.get("customerId")
  );

  if (!customer) {
    say("#orderMessage", "Please select a customer.");
    return;
  }

  const subtotal = Number(data.get("total"));
  const discount = Number(data.get("discount") || 0);
  const total = subtotal - discount;
  const paid = Number(data.get("paid"));

  if (
    !Number.isFinite(total) ||
    !Number.isFinite(paid) ||
    subtotal <= 0 ||
    discount < 0 ||
    discount > subtotal ||
    total <= 0 ||
    paid < 0 ||
    paid > total
  ) {
    say("#orderMessage", "Please check order price, discount and payment amount.");
    return;
  }

  const description = String(data.get("description") || "").trim();
  const orderCode = String(data.get("orderCode") || "").trim();

  if (!orderCode) {
    say("#orderMessage", "Please enter an Order Number.");
    return;
  }

  // Check duplicate Order Numbers
  const duplicateOrder = orders.some(item =>
    String(item.orderCode || "").trim().toLowerCase() === orderCode.toLowerCase() &&
    item.id !== editId
  );

  if (duplicateOrder) {
    say("#orderMessage", "This Order Number already exists. Please enter another number.");
    return;
  }

  if (!description) {
    say("#orderMessage", "Please enter order description.");
    return;
  }

  const status = String(data.get("status") || "Pending");
  const balance = total - paid;

  const paymentStatus =
    paid === 0 ? "Unpaid" : paid >= total ? "Paid" : "Partial";

  const submitButton = form.querySelector('[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = editId ? "Updating..." : "Saving...";
  }

  let whatsappWindow = null;

  if (!editId) {
    whatsappWindow = window.open("about:blank", "_blank");
  }

  try {
    if (editId) {
      // UPDATE EXISTING ORDER

      const order = orders.find(item => item.id === editId);

      if (!order) {
        throw new Error("Order could not be found.");
      }

      const orderData = {
        orderCode,
        customerRef: customer.id,
        customerId: customer.customerId,
        customerName: customer.name,
        phone: customer.phone,
        description,
        subtotal,
        discount,
        total,
        paid,
        balance,
        status,
        paymentStatus,
        updatedAt: serverTimestamp()
      };

      const relatedPayments = await getDocs(
        query(paymentCol, where("orderRef", "==", editId))
      );

      const batch = writeBatch(db);

      batch.update(doc(db, "orders", editId), orderData);

      const paymentDocs = relatedPayments.docs;

      if (paid > 0) {
        if (paymentDocs.length > 0) {
          const firstPayment = paymentDocs[0];

          batch.update(doc(db, "payments", firstPayment.id), {
            customerRef: customer.id,
            customerId: customer.customerId,
            customerName: customer.name,
            orderCode,
            amount: paid,
            updatedAt: serverTimestamp()
          });

          paymentDocs.slice(1).forEach(payment => {
            batch.delete(doc(db, "payments", payment.id));
          });

        } else {
          const newPaymentRef = doc(paymentCol);

          batch.set(newPaymentRef, {
            orderRef: editId,
            orderCode: order.orderCode,
            customerRef: customer.id,
            customerId: customer.customerId,
            customerName: customer.name,
            amount: paid,
            method: "Cash",
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid
          });
        }

      } else {
        paymentDocs.forEach(payment => {
          batch.delete(doc(db, "payments", payment.id));
        });
      }

      await batch.commit();

      say("#globalMessage", "Order and payment updated successfully.");

    } else {
      // CREATE NEW ORDER


      const orderRef = await addDoc(orderCol, {
        orderCode,
        customerRef: customer.id,
        customerId: customer.customerId,
        customerName: customer.name,
        phone: customer.phone,
        description,
        subtotal,
        discount,
        total,
        paid,
        balance,
        status,
        paymentStatus,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid
      });

      if (paid > 0) {
        await addDoc(paymentCol, {
          orderRef: orderRef.id,
          orderCode,
          customerRef: customer.id,
          customerId: customer.customerId,
          customerName: customer.name,
          amount: paid,
          method: "Cash",
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid
        });
      }

      const newOrder = {
        orderCode,
        description,
        subtotal,
        discount,
        total,
        paid,
        balance
      };

      const message = createOrderMessage(newOrder, customer);
      const phone = formatWhatsAppPhone(customer.phone);

      if (phone && phone.length >= 11) {
        const whatsappUrl =
          `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

        if (whatsappWindow && !whatsappWindow.closed) {
          whatsappWindow.location.href = whatsappUrl;
        } else {
          say(
            "#globalMessage",
            "Order saved. Your browser blocked the WhatsApp popup. Allow popups and try again."
          );
        }
      } else {
        if (whatsappWindow && !whatsappWindow.closed) {
          whatsappWindow.close();
        }

        say(
          "#globalMessage",
          "Order saved, but the customer's phone number is invalid."
        );
      }

      if (phone && phone.length >= 11) {
        say("#globalMessage", "Order saved successfully. WhatsApp opened.");
      }
    }

    form.reset();
    form.dataset.editId = "";
    form.hidden = true;

    if (submitButton) submitButton.textContent = "Save Order";

    updateBalance();

    await refresh();

  } catch (error) {
    if (whatsappWindow && !whatsappWindow.closed) {
      whatsappWindow.close();
    }

    say("#orderMessage", error.message);

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = form.dataset.editId
        ? "Update Order"
        : "Save Order";
    }
  }
});

// ==================================================
// PRODUCT MANAGEMENT
// ==================================================

// LOAD PRODUCTS

async function loadProducts() {
  const list = $("#managementProductList");
  if (!list) return;

  list.innerHTML = "<p>Loading products...</p>";

  try {
    const result = await getDocs(
      query(productCol, orderBy("createdAt", "desc"))
    );

    products = result.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    renderProducts();

  } catch (error) {
    list.innerHTML = `<p>Could not load products: ${esc(error.message)}</p>`;
    say("#managementProductMessage", error.message);
  }
}

// RENDER PRODUCTS

function renderProducts() {
  const list = $("#managementProductList");
  if (!list) return;

  const term = ($("#productSearch").value || "").trim().toLowerCase();

  const rows = products.filter(product =>
    [
      product.name,
      product.category,
      product.gender,
      product.priceLevel,
      product.description
    ].join(" ").toLowerCase().includes(term)
  );

  $("#productCount").textContent = `${rows.length} Products`;

  if (!rows.length) {
    list.innerHTML = "<p>No products found.</p>";
    return;
  }

  list.innerHTML = rows.map(product => `
    <article class="management-product ${product.active === false ? "inactive" : ""
    }">

      ${product.imageUrl
      ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.name)}" loading="lazy">`
      : `<div class="preview">No Image</div>`
    }

      <div class="management-product-info">
        <h3>${esc(product.name)}</h3>

        <p>
          ${esc(product.category || "Uncategorized")}
          ${["Frames", "Sunglasses"].includes(product.category)
      ? ` · ${esc(product.gender || "both")}`
      : ""
    }
        </p>

        <p class="product-price">
          ${product.price !== null &&
      product.price !== undefined &&
      product.price !== ""
      ? money(product.price)
      : esc(product.priceLevel || "Price on request")
    }
        </p>

        <p>${esc(product.description || "No description")}</p>

        <span class="product-status ${product.active === false ? "hidden-status" : ""
    }">
          ${product.active === false ? "Hidden" : "Visible"}
        </span>
      </div>

      <div class="product-actions">
        <button type="button" data-product-edit="${esc(product.id)}">
          Edit
        </button>

        <button type="button" data-product-toggle="${esc(product.id)}">
          ${product.active === false ? "Show" : "Hide"}
        </button>

        <button
          type="button"
          class="delete-product"
          data-product-delete="${esc(product.id)}">
          Delete
        </button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-product-edit]").forEach(button => {
    button.onclick = () => editProduct(button.dataset.productEdit);
  });

  list.querySelectorAll("[data-product-toggle]").forEach(button => {
    button.onclick = () => toggleProduct(button.dataset.productToggle);
  });

  list.querySelectorAll("[data-product-delete]").forEach(button => {
    button.onclick = () => deleteProduct(button.dataset.productDelete);
  });
}

// PRODUCT SEARCH

$("#productSearch").oninput = renderProducts;

// OPEN PRODUCT FORM

$("#showProductForm").addEventListener("click", () => {
  resetProductForm();

  const form = $("#managementProductForm");
  form.hidden = false;

  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

// CANCEL PRODUCT FORM

$("#cancelProductEdit").onclick = () => {
  resetProductForm();
  $("#managementProductForm").hidden = true;
};

// CATEGORY / GENDER

function updateProductGenderField() {
  const category = $("#managementProductForm").elements.category.value;

  $("#productGenderField").hidden =
    !["Frames", "Sunglasses"].includes(category);
}

$("#managementProductForm").elements.category.addEventListener(
  "change",
  updateProductGenderField
);

// RESET FORM

function resetProductForm() {
  const form = $("#managementProductForm");

  form.reset();

  form.elements.id.value = "";
  form.elements.active.checked = true;

  form.dataset.imageUrl = "";
  form.dataset.publicId = "";

  $("#managementImageFile").value = "";
  $("#managementUploadStatus").textContent = "";
  $("#managementProductMessage").textContent = "";

  $("#formTitle").textContent = "Add New Product";
  $("#saveManagementProduct").textContent = "Save Product";
  $("#saveManagementProduct").disabled = false;

  $("#cancelProductEdit").hidden = true;

  updateProductGenderField();
}

// EDIT PRODUCT

function editProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;

  const form = $("#managementProductForm");

  resetProductForm();

  form.hidden = false;

  form.elements.id.value = product.id;
  form.elements.name.value = product.name || "";
  form.elements.category.value = product.category || "Frames";
  form.elements.gender.value = product.gender || "both";
  form.elements.priceLevel.value = product.priceLevel || "affordable";
  form.elements.price.value = product.price ?? "";
  form.elements.description.value = product.description || "";
  form.elements.active.checked = product.active !== false;

  form.dataset.imageUrl = product.imageUrl || "";
  form.dataset.publicId = product.publicId || "";

  $("#formTitle").textContent = "Edit Product";
  $("#saveManagementProduct").textContent = "Update Product";
  $("#cancelProductEdit").hidden = false;

  $("#managementUploadStatus").textContent = product.imageUrl
    ? "Existing image will be kept unless you choose a new image."
    : "No existing image.";

  updateProductGenderField();

  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// CLOUDINARY IMAGE UPLOAD

async function uploadProductImage(file) {
  if (!file) return null;

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Only JPG, PNG and WEBP images are allowed.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image size must be less than 5MB.");
  }

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error("Cloudinary configuration is missing in firebase.js.");
  }

  $("#managementUploadStatus").textContent = "Uploading image...";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "visioncenter/products");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error?.message || "Image upload failed.");
  }

  $("#managementUploadStatus").textContent = "Image uploaded successfully.";

  return {
    imageUrl: result.secure_url,
    publicId: result.public_id
  };
}

// SAVE / UPDATE PRODUCT

$("#managementProductForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser || !ADMIN_UIDS.includes(currentUser.uid)) {
    say("#managementProductMessage", "You are not authorized.");
    return;
  }

  const form = event.currentTarget;
  const data = new FormData(form);

  const id = String(data.get("id") || "").trim();
  const name = String(data.get("name") || "").trim();
  const category = String(data.get("category") || "").trim();
  const description = String(data.get("description") || "").trim();

  const price = data.get("price") === "" ? null : Number(data.get("price"));
  const priceLevel = String(data.get("priceLevel") || "affordable");
  const active = data.get("active") === "on";

  const gender = ["Frames", "Sunglasses"].includes(category)
    ? String(data.get("gender") || "both")
    : "both";

  if (!name || !category) {
    say("#managementProductMessage", "Please enter product name and category.");
    return;
  }

  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    say("#managementProductMessage", "Please enter a valid price.");
    return;
  }

  const file = $("#managementImageFile").files[0];
  const saveButton = $("#saveManagementProduct");

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    let imageUrl = form.dataset.imageUrl || "";
    let publicId = form.dataset.publicId || "";

    if (file) {
      const uploaded = await uploadProductImage(file);
      imageUrl = uploaded.imageUrl;
      publicId = uploaded.publicId;
    }

    if (!id && !imageUrl) {
      throw new Error("Please select a product image.");
    }

    const productData = {
      name,
      category,
      gender,
      priceLevel,
      price,
      description,
      imageUrl,
      publicId,
      active,
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(db, "products", id), productData);
      say("#globalMessage", "Product updated successfully.");

    } else {
      await addDoc(productCol, {
        ...productData,
        createdAt: serverTimestamp()
      });

      say("#globalMessage", "Product added successfully.");
    }

    resetProductForm();
    form.hidden = true;

    await loadProducts();

  } catch (error) {
    say("#managementProductMessage", error.message);

  } finally {
    saveButton.disabled = false;
    saveButton.textContent = form.elements.id.value
      ? "Update Product"
      : "Save Product";
  }
});

// SHOW / HIDE PRODUCT

async function toggleProduct(id) {
  if (!currentUser) return;

  const product = products.find(item => item.id === id);
  if (!product) return;

  try {
    await updateDoc(doc(db, "products", id), {
      active: product.active === false,
      updatedAt: serverTimestamp()
    });

    say(
      "#globalMessage",
      product.active === false
        ? "Product is now visible."
        : "Product is now hidden."
    );

    await loadProducts();

  } catch (error) {
    say("#globalMessage", error.message);
  }
}

// DELETE PRODUCT

async function deleteProduct(id) {
  if (!currentUser) return;

  const product = products.find(item => item.id === id);
  if (!product) return;

  const confirmed = window.confirm(
    `Delete "${product.name}" permanently?`
  );

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "products", id));

    say("#globalMessage", "Product deleted successfully.");

    // Firestore product document is deleted.
    // The Cloudinary image remains, matching the old system behavior.

    await loadProducts();

  } catch (error) {
    say("#globalMessage", error.message);
  }
}
