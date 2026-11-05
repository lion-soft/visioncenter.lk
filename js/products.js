import { db } from "./firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const menuToggle = $("#menuToggle"), navMenu = $("#navMenu"), root = document.documentElement;

// Mobile menu
function setMenu(open) {
  navMenu.classList.toggle("open", open);
  menuToggle.textContent = open ? "✕" : "☰";
  menuToggle.setAttribute("aria-expanded", String(open));
}
menuToggle.addEventListener("click", () => setMenu(!navMenu.classList.contains("open")));
$$("a", navMenu).forEach(a => a.addEventListener("click", () => setMenu(false)));
$("#year").textContent = new Date().getFullYear();

const grid = document.querySelector("#productGrid");
const count = document.querySelector("#productCount");
const search = document.querySelector("#productSearch");
const category = document.querySelector("#categoryFilter");
const errorBox = document.querySelector("#catalogError");
document.querySelector("#year").textContent = new Date().getFullYear();
const wa = "94717550750";
let products = [];

const money = value => value === "" || value == null ? "Price on request" : `Rs. ${Number(value).toLocaleString("en-LK")}`;
const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function render(){
  const term = search.value.trim().toLowerCase(), cat = category.value;
  const shown = products.filter(p => (cat==="all" || p.category===cat) && `${p.name} ${p.category} ${p.description||""}`.toLowerCase().includes(term));
  count.textContent = `${shown.length} product${shown.length===1?"":"s"}`;
  if(!shown.length){grid.innerHTML='<div class="catalog-message">No products found. Please try another search.</div>';return;}
  grid.innerHTML = shown.map(p=>`<article class="product-card">
    <div class="product-image-wrap"><img class="product-image" src="${safe(p.imageUrl)}" alt="${safe(p.name)}" loading="lazy"></div>
    <div class="product-info"><span class="product-category">${safe(p.category)}</span><h3>${safe(p.name)}</h3>
    <p class="product-description">${safe(p.description||"Ask us for more details.")}</p><div class="product-price">${money(p.price)}</div>
    <a class="product-contact" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(`Hello Vision Center, I'm interested in ${p.name}.`)}">Ask about this product →</a></div></article>`).join("");
}
search.addEventListener("input",render);category.addEventListener("change",render);
try{
  const snap=await getDocs(query(collection(db,"products"),where("active","==",true)));
  products=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  render();
}catch(err){
  console.error(err);grid.innerHTML="";errorBox.hidden=false;errorBox.textContent="Could not load products right now. Please try again later.";
  count.textContent=""; 
}
