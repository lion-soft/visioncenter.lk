VISION CENTER - OPTICAL PRODUCTS + ADMIN

Files in this bundle:
- firebase.js, products.html/css/js, admin.html/css/js
- Keep your existing index.html, style.css, script.js and images folder.

1) Place these files beside index.html.
2) Confirm firebase.js config values and ADMIN_UID match Firebase project/admin.
3) Firestore Rules (replace UID with your actual admin UID):
rules_version = '2';
service cloud.firestore {
 match /databases/{database}/documents {
  function isAdmin(){return request.auth != null && request.auth.uid == "iCWTpZOJDHPk0exPjfy2OUuOk093";}
  match /products/{productId} {
   allow read: if resource.data.active == true || isAdmin();
   allow create: if isAdmin() && request.resource.data.keys().hasAll(['name','category','imageUrl','active']);
   allow update, delete: if isAdmin();
  }
 }
}
NOTE: For public reads of active products, Firestore query must include where("active","==",true); admin is authorized to read all.
4) Firebase Authentication -> Email/Password enabled; create the admin login user. Its UID must exactly match ADMIN_UID.
5) Cloudinary preset visioncenter_products should be Unsigned. This unsigned endpoint is public; a Firebase login UI alone cannot stop outsiders from uploading. Limit preset formats/size/folder as available, monitor usage, and never put Cloudinary API secret in browser code.
6) Test on localhost or deployed HTTPS (ES modules don't work reliably by opening file:// directly). Use VS Code Live Server.
7) Update index.html optical products links:
   - nav: href="products.html"
   - promo button: href="products.html"
Security note: Firebase rules protect Firestore writes. Admin UID is not a password.
