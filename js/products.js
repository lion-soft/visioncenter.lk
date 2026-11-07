
import { db } from "./firebase.js";

import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const menuToggle = $("#menuToggle");
const navMenu = $("#navMenu");

// MOBILE MENU
function setMenu(open) {
  if (!navMenu || !menuToggle) return;

  navMenu.classList.toggle("open", open);
  menuToggle.textContent = open ? "✕" : "☰";
  menuToggle.setAttribute("aria-expanded", String(open));
}

if (menuToggle && navMenu) {
  menuToggle.addEventListener("click", () => {
    setMenu(!navMenu.classList.contains("open"));
  });

  $$("a", navMenu).forEach(link => {
    link.addEventListener("click", () => setMenu(false));
  });
}

// FOOTER YEAR
const year = $("#year");

if (year) {
  year.textContent = new Date().getFullYear();
}

// PRODUCT ELEMENTS
const grid = $("#productGrid");
const count = $("#productCount");
const search = $("#productSearch");
const category = $("#categoryFilter");
const priceFilter = $("#priceFilter");
const genderFilter = $("#genderFilter");
const errorBox = $("#catalogError");

const wa = "94717550750";

let products = [];

// HELPERS
const money = value =>
  value === "" || value == null
    ? "Price on request"
    : `Rs. ${Number(value).toLocaleString("en-LK")}`;

const safe = value =>
  String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));

const getGender = product =>
  product.gender || "both";

const getPriceLevel = product =>
  product.priceLevel || "expensive";

const genderName = value => ({
  male: "Male",
  female: "Female",
  both: "Both"
}[value] || "Both");

const priceLevelName = value => ({
  expensive: "Expensive",
  affordable: "Affordable"
}[value] || "Expensive");

// FILTER PRODUCTS
function render() {
  if (!grid || !count || !search || !category || !priceFilter || !genderFilter) {
    return;
  }

  const term = search.value.trim().toLowerCase();
  const selectedCategory = category.value;
  const selectedPrice = priceFilter.value;
  const selectedGender = genderFilter.value;

  const shown = products.filter(product => {
    const productCategory = product.category || "";
    const productGender = getGender(product);
    const productPrice = getPriceLevel(product);

    // CATEGORY FILTER
    const matchesCategory =
      selectedCategory === "all" ||
      productCategory === selectedCategory;

    // PRICE FILTER
    const matchesPrice =
      selectedPrice === "all" ||
      productPrice === selectedPrice;

    // GENDER FILTER
    // Both products are visible to Male and Female selections.
    // Gender filtering applies only to Frames and Sunglasses.
    const isGenderProduct =
      ["Frames", "Sunglasses"].includes(productCategory);

    const matchesGender =
      !isGenderProduct ||
      selectedGender === "both" ||
      productGender === "both" ||
      productGender === selectedGender;

    // SEARCH FILTER
    const searchableText = `
      ${product.name || ""}
      ${product.category || ""}
      ${product.description || ""}
      ${genderName(productGender)}
      ${priceLevelName(productPrice)}
    `.toLowerCase();

    const matchesSearch = searchableText.includes(term);

    return (
      matchesCategory &&
      matchesPrice &&
      matchesGender &&
      matchesSearch
    );
  });

  count.textContent =
    `${shown.length} product${shown.length === 1 ? "" : "s"}`;

  if (!shown.length) {
    grid.innerHTML = `
      <div class="catalog-message">
        No products found. Please try another search.
      </div>
    `;
    return;
  }

  grid.innerHTML = shown.map(product => {
    const name = product.name || "Optical Product";
    const imageUrl = product.imageUrl || "";
    const productCategory = product.category || "Product";
    const productGender = getGender(product);
    const productPrice = getPriceLevel(product);
    const description =
      product.description || "Ask us for more details.";

    const message =
      `Hello Vision Center, I'm interested in ${name}.`;

    const whatsappUrl =
      `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;

    const genderBadge = ["Frames", "Sunglasses"].includes(productCategory)
      ? `<span class="product-category">${safe(genderName(productGender))}</span>`
      : "";

    return `
      <article class="product-card">

        <div class="product-image-wrap">
          <img
            class="product-image"
            src="${safe(imageUrl)}"
            alt="${safe(name)}"
            loading="lazy">
        </div>

        <div class="product-info">

          <span class="product-category">
            ${safe(productCategory)}
          </span>

          ${genderBadge}

          <span class="product-category">
            ${safe(priceLevelName(productPrice))}
          </span>

          <h3>${safe(name)}</h3>

          <p class="product-description">
            ${safe(description)}
          </p>

          <div class="product-price">
            ${money(product.price)}
          </div>

          <a
            class="product-contact"
            target="_blank"
            rel="noopener"
            href="${safe(whatsappUrl)}">
            Ask about this product →
          </a>

        </div>
      </article>
    `;
  }).join("");
}

// FILTER EVENTS
if (search) {
  search.addEventListener("input", render);
}

if (category) {
  category.addEventListener("change", render);
}

if (priceFilter) {
  priceFilter.addEventListener("change", render);
}

if (genderFilter) {
  genderFilter.addEventListener("change", render);
}

// LOAD PRODUCTS FROM FIRESTORE
async function loadProducts() {
  try {
    const snap = await getDocs(
      query(
        collection(db, "products"),
        where("active", "==", true)
      )
    );

    products = snap.docs
      .map(document => ({
        id: document.id,
        ...document.data(),

        // Legacy product defaults
        gender: document.data().gender || "both",
        priceLevel: document.data().priceLevel || "expensive"
      }))
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      );

    render();

  } catch (err) {
    console.error("Product loading error:", err);

    if (grid) {
      grid.innerHTML = "";
    }

    if (errorBox) {
      errorBox.hidden = false;
      errorBox.textContent =
        "Could not load products right now. Please try again later.";
    }

    if (count) {
      count.textContent = "";
    }
  }
}

loadProducts();
