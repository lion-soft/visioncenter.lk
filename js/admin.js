import { auth, db, ADMIN_UID, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "./firebase.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const $=s=>document.querySelector(s), loginPanel=$("#loginPanel"),managePanel=$("#managePanel");
const loginForm=$("#loginForm"),productForm=$("#productForm"),list=$("#adminProductList");
let inventory=[],currentUser=null;
const say=(el,msg)=>el.textContent=msg;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>v==null||v===""?"Price on request":`Rs. ${Number(v).toLocaleString("en-LK")}`;

loginForm.addEventListener("submit",async e=>{e.preventDefault();say($("#loginMessage"),"Signing in…");const d=new FormData(loginForm);try{await signInWithEmailAndPassword(auth,d.get("email"),d.get("password"));}catch(err){say($("#loginMessage"),"Login failed. Check your email and password.");}});
$("#logoutBtn").addEventListener("click",()=>signOut(auth));
onAuthStateChanged(auth,async user=>{
 currentUser=user;
 if(!user){loginPanel.hidden=false;managePanel.hidden=true;return;}
 if(user.uid!==ADMIN_UID){await signOut(auth);say($("#loginMessage"),"This account is not authorized.");return;}
 loginPanel.hidden=true;managePanel.hidden=false;$("#adminWelcome").textContent=`Signed in as ${user.email||"administrator"}`;
 await loadInventory();
});
async function loadInventory(){
 list.innerHTML="<p>Loading inventory…</p>";
 try{const snap=await getDocs(query(collection(db,"products"),orderBy("createdAt","desc")));inventory=snap.docs.map(d=>({id:d.id,...d.data()}));renderInventory();}
 catch(err){console.error(err);list.innerHTML="<p>Could not load products. Check Firestore rules and admin UID.</p>";}
}
function renderInventory(){
 const term=$("#adminSearch").value.toLowerCase();
 const items=inventory.filter(p=>(p.name+" "+p.category).toLowerCase().includes(term));
 if(!items.length){list.innerHTML="<p>No products yet. Add the first product using the form.</p>";return;}
 list.innerHTML=items.map(p=>`<article class="admin-product ${p.active?"":"inactive"}"><img src="${esc(p.imageUrl||"")}" alt=""><div><h3>${esc(p.name)}</h3><p>${esc(p.category)} · ${money(p.price)}</p><p>${p.active?"Visible":"Hidden"} · ${esc(p.id)}</p></div><div class="admin-actions"><button data-edit="${esc(p.id)}">Edit</button><button data-toggle="${esc(p.id)}">${p.active?"Hide":"Show"}</button><button class="delete" data-delete="${esc(p.id)}">Delete</button></div></article>`).join("");
 list.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editProduct(b.dataset.edit));
 list.querySelectorAll("[data-toggle]").forEach(b=>b.onclick=()=>toggleProduct(b.dataset.toggle));
 list.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>removeProduct(b.dataset.delete));
}
$("#adminSearch").addEventListener("input",renderInventory);
function editProduct(id){const p=inventory.find(x=>x.id===id);if(!p)return;for(const key of ["id","name","category","price","description"])productForm.elements[key].value=p[key]??"";productForm.elements.active.checked=!!p.active;productForm.dataset.imageUrl=p.imageUrl||"";productForm.dataset.publicId=p.publicId||"";$("#formTitle").textContent="Edit product";$("#saveProduct").textContent="Update product";$("#cancelEdit").hidden=false;say($("#productMessage"),"");window.scrollTo({top:0,behavior:"smooth"});}
function resetForm(){productForm.reset();productForm.elements.id.value="";delete productForm.dataset.imageUrl;delete productForm.dataset.publicId;$("#formTitle").textContent="Add a product";$("#saveProduct").textContent="Save product";$("#cancelEdit").hidden=true;say($("#uploadStatus"),"");}
$("#cancelEdit").onclick=resetForm;
async function uploadImage(file){
 if(!file)return {imageUrl:productForm.dataset.imageUrl||"",publicId:productForm.dataset.publicId||""};
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024)throw new Error("Choose JPG, PNG or WEBP under 5 MB.");
 say($("#uploadStatus"),"Uploading image…");
 const fd=new FormData();fd.append("file",file);fd.append("upload_preset",CLOUDINARY_UPLOAD_PRESET);fd.append("folder","visioncenter/products");
 const res=await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,{method:"POST",body:fd});
 const data=await res.json();if(!res.ok)throw new Error(data.error?.message||"Image upload failed.");
 say($("#uploadStatus"),"Image uploaded ✓");return {imageUrl:data.secure_url,publicId:data.public_id};
}
productForm.addEventListener("submit",async e=>{
 e.preventDefault();if(!currentUser||currentUser.uid!==ADMIN_UID)return;
 const btn=$("#saveProduct");btn.disabled=true;say($("#productMessage"),"Saving…");
 try{
  const d=new FormData(productForm),image=await uploadImage($("#imageFile").files[0]);
  if(!image.imageUrl)throw new Error("Please upload a product photo.");
  const payload={name:String(d.get("name")).trim(),category:d.get("category"),price:d.get("price")===""?null:Number(d.get("price")),description:String(d.get("description")||"").trim(),imageUrl:image.imageUrl,publicId:image.publicId,active:productForm.elements.active.checked,updatedAt:serverTimestamp()};
  const id=d.get("id");
  if(id)await updateDoc(doc(db,"products",id),payload);else await addDoc(collection(db,"products"),{...payload,createdAt:serverTimestamp()});
  say($("#productMessage"),"Product saved successfully ✓");resetForm();await loadInventory();
 }catch(err){console.error(err);say($("#productMessage"),err.message||"Could not save product.");}
 finally{btn.disabled=false;}
});
async function toggleProduct(id){const p=inventory.find(x=>x.id===id);if(!p)return;try{await updateDoc(doc(db,"products",id),{active:!p.active,updatedAt:serverTimestamp()});await loadInventory();}catch(e){alert("Could not update product. Check permissions.");}}
async function removeProduct(id){const p=inventory.find(x=>x.id===id);if(!p||!confirm(`Delete "${p.name}" from Firestore? (The Cloudinary image remains stored.)`))return;try{await deleteDoc(doc(db,"products",id));await loadInventory();}catch(e){alert("Could not delete product. Check permissions.");}}
