
import {
  auth,
  db,
  ADMIN_UIDS,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET
} from "./firebase.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const $ = s => document.querySelector(s);

const loginPanel = $("#loginPanel");
const managePanel = $("#managePanel");
const loginForm = $("#loginForm");
const productForm = $("#productForm");
const list = $("#adminProductList");
const genderField = $("#genderField");

let inventory = [];
let currentUser = null;

const say = (el, msg) => {
  if (el) el.textContent = msg;
};

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

const money = value =>
  value == null || value === ""
    ? "Price on request"
    : `Rs. ${Number(value).toLocaleString("en-LK")}`;

const getGender = product =>
  product.gender || "both";

const getPriceLevel = product =>
  product.priceLevel || "expensive";

const genderLabel = value => ({
  male: "Male",
  female: "Female",
  both: "Both"
}[value] || "Both");

const priceLevelLabel = value => ({
  expensive: "Expensive",
  affordable: "Affordable"
}[value] || "Expensive");

// SHOW GENDER FIELD ONLY FOR FRAMES AND SUNGLASSES
function updateGenderVisibility() {
  const category = productForm.elements.category.value;
  const showGender = ["Frames", "Sunglasses"].includes(category);

  genderField.hidden = !showGender;

  if (!showGender) {
    productForm.elements.gender.value = "both";
  }
}

productForm.elements.category.addEventListener(
  "change",
  updateGenderVisibility
);

updateGenderVisibility();

// LOGIN
loginForm.addEventListener("submit", async e => {
  e.preventDefault();

  say($("#loginMessage"), "Signing in…");

  const data = new FormData(loginForm);

  try {
    await signInWithEmailAndPassword(
      auth,
      data.get("email"),
      data.get("password")
    );
  } catch (err) {
    console.error("Login error:", err);

    if (err.code === "auth/invalid-credential") {
      say($("#loginMessage"), "Incorrect email or password.");
    } else if (err.code === "auth/user-not-found") {
      say($("#loginMessage"), "User account not found.");
    } else if (err.code === "auth/wrong-password") {
      say($("#loginMessage"), "Incorrect password.");
    } else if (err.code === "auth/too-many-requests") {
      say($("#loginMessage"), "Too many attempts. Try again later.");
    } else if (err.code === "auth/network-request-failed") {
      say($("#loginMessage"), "Network connection failed.");
    } else {
      say($("#loginMessage"), err.message || "Login failed.");
    }
  }
});

// LOGOUT
$("#logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
});

// AUTH STATE
onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (!user) {
    loginPanel.hidden = false;
    managePanel.hidden = true;
    return;
  }

  if (!ADMIN_UIDS.includes(user.uid)) {
    loginPanel.hidden = false;
    managePanel.hidden = true;

    say($("#loginMessage"), "This account is not authorized.");

    await signOut(auth);
    return;
  }

  loginPanel.hidden = true;
  managePanel.hidden = false;

  $("#adminWelcome").textContent =
    `Signed in as ${user.email || "administrator"}`;

  await loadInventory();
});

// LOAD PRODUCTS
async function loadInventory() {
  list.innerHTML = "<p>Loading inventory…</p>";

  try {
    const snap = await getDocs(
      query(
        collection(db, "products"),
        orderBy("createdAt", "desc")
      )
    );

    inventory = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    renderInventory();
  } catch (err) {
    console.error(err);

    list.innerHTML =
      "<p>Could not load products. Check Firestore rules.</p>";
  }
}

// RENDER PRODUCTS
function renderInventory() {
  const term = $("#adminSearch").value.toLowerCase();

  const items = inventory.filter(p =>
    `${p.name || ""} ${p.category || ""} ${p.gender || "both"} ${p.priceLevel || "expensive"}`
      .toLowerCase()
      .includes(term)
  );

  if (!items.length) {
    list.innerHTML =
      "<p>No products yet. Add the first product using the form.</p>";
    return;
  }

  list.innerHTML = items.map(p => `
    <article class="admin-product ${p.active ? "" : "inactive"}">
      <img src="${esc(p.imageUrl || "")}" alt="">

      <div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.category)} · ${money(p.price)}</p>
        <p>Gender: ${genderLabel(getGender(p))}</p>
        <p>Price Level: ${priceLevelLabel(getPriceLevel(p))}</p>
        <p>${p.active ? "Visible" : "Hidden"} · ${esc(p.id)}</p>
      </div>

      <div class="admin-actions">
        <button data-edit="${esc(p.id)}">Edit</button>

        <button data-toggle="${esc(p.id)}">
          ${p.active ? "Hide" : "Show"}
        </button>

        <button class="delete" data-delete="${esc(p.id)}">
          Delete
        </button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-edit]").forEach(button => {
    button.onclick = () => editProduct(button.dataset.edit);
  });

  list.querySelectorAll("[data-toggle]").forEach(button => {
    button.onclick = () => toggleProduct(button.dataset.toggle);
  });

  list.querySelectorAll("[data-delete]").forEach(button => {
    button.onclick = () => removeProduct(button.dataset.delete);
  });
}

$("#adminSearch").addEventListener("input", renderInventory);

// EDIT PRODUCT
function editProduct(id) {
  const p = inventory.find(item => item.id === id);

  if (!p) return;

  for (const key of ["id", "name", "category", "price", "description"]) {
    productForm.elements[key].value = p[key] ?? "";
  }

  // Old products default to Both and Expensive
  productForm.elements.gender.value = getGender(p);
  productForm.elements.priceLevel.value = getPriceLevel(p);

  productForm.elements.active.checked = !!p.active;

  productForm.dataset.imageUrl = p.imageUrl || "";
  productForm.dataset.publicId = p.publicId || "";

  updateGenderVisibility();

  $("#formTitle").textContent = "Edit product";
  $("#saveProduct").textContent = "Update product";
  $("#cancelEdit").hidden = false;

  say($("#productMessage"), "");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// RESET FORM
function resetForm() {
  productForm.reset();

  productForm.elements.id.value = "";
  productForm.elements.gender.value = "both";
  productForm.elements.priceLevel.value = "expensive";

  delete productForm.dataset.imageUrl;
  delete productForm.dataset.publicId;

  updateGenderVisibility();

  $("#formTitle").textContent = "Add a product";
  $("#saveProduct").textContent = "Save product";
  $("#cancelEdit").hidden = true;

  say($("#uploadStatus"), "");
  say($("#productMessage"), "");
}

$("#cancelEdit").onclick = resetForm;

// CLOUDINARY IMAGE UPLOAD
async function uploadImage(file) {
  if (!file) {
    return {
      imageUrl: productForm.dataset.imageUrl || "",
      publicId: productForm.dataset.publicId || ""
    };
  }

  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    throw new Error("Choose JPG, PNG or WEBP under 5 MB.");
  }

  say($("#uploadStatus"), "Uploading image…");

  const fd = new FormData();

  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  fd.append("folder", "visioncenter/products");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: fd
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || "Image upload failed.");
  }

  say($("#uploadStatus"), "Image uploaded ✓");

  return {
    imageUrl: data.secure_url,
    publicId: data.public_id
  };
}

// SAVE PRODUCT
productForm.addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser || !ADMIN_UIDS.includes(currentUser.uid)) {
    return;
  }

  const button = $("#saveProduct");

  button.disabled = true;
  say($("#productMessage"), "Saving…");

  try {
    const data = new FormData(productForm);

    const selectedCategory = data.get("category");
    const supportsGender = ["Frames", "Sunglasses"].includes(selectedCategory);

    const image = await uploadImage(
      $("#imageFile").files[0]
    );

    if (!image.imageUrl) {
      throw new Error("Please upload a product photo.");
    }

    const payload = {
      name: String(data.get("name") || "").trim(),
      category: selectedCategory,

      // Gender applies to Frames and Sunglasses.
      // Other categories use Both as the default value.
      gender: supportsGender
        ? (data.get("gender") || "both")
        : "both",

      // All products must have a price level.
      priceLevel: data.get("priceLevel") || "expensive",

      price: data.get("price") === ""
        ? null
        : Number(data.get("price")),

      description: String(data.get("description") || "").trim(),
      imageUrl: image.imageUrl,
      publicId: image.publicId,
      active: productForm.elements.active.checked,
      updatedAt: serverTimestamp()
    };

    const id = data.get("id");

    if (id) {
      await updateDoc(doc(db, "products", id), payload);
    } else {
      await addDoc(collection(db, "products"), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    say($("#productMessage"), "Product saved successfully ✓");

    resetForm();
    await loadInventory();

  } catch (err) {
    console.error(err);

    say(
      $("#productMessage"),
      err.message || "Could not save product."
    );
  } finally {
    button.disabled = false;
  }
});

// SHOW / HIDE PRODUCT
async function toggleProduct(id) {
  const p = inventory.find(item => item.id === id);

  if (!p) return;

  try {
    await updateDoc(doc(db, "products", id), {
      active: !p.active,
      updatedAt: serverTimestamp()
    });

    await loadInventory();
  } catch (err) {
    console.error(err);
    alert("Could not update product. Check permissions.");
  }
}

// DELETE PRODUCT
async function removeProduct(id) {
  const p = inventory.find(item => item.id === id);

  if (
    !p ||
    !confirm(
      `Delete "${p.name}" from Firestore? (The Cloudinary image remains stored.)`
    )
  ) return;

  try {
    await deleteDoc(doc(db, "products", id));
    await loadInventory();
  } catch (err) {
    console.error(err);
    alert("Could not delete product. Check permissions.");
  }
}
