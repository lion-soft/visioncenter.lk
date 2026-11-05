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

// WhatsApp (replace with your real number: 94 + number, no leading 0)
const WHATSAPP_NUMBER = "94717550750";
const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hello Vision Center, I would like to make an appointment.")}`;
$("#floatWhatsapp").href = whatsappUrl;

$("#appointmentForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const d = new FormData(this);
  const message = [
    "Hello Vision Center! Appointment request:",
    `Name: ${d.get("name")}`, `Phone: ${d.get("phone")}`, `Service: ${d.get("service")}`,
    `Preferred date: ${d.get("date") || "Flexible"}`, `Message: ${d.get("message") || "—"}`
  ].join("\n");
  $("#formMessage").textContent = "Opening WhatsApp to send your appointment request…";
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
});

// Navbar: shrink + progress bar + active link + sliding pill
(function () {
  const header = $(".header"), bar = $("#scrollProgress"), links = $$("a", navMenu);
  const pill = document.createElement("span");
  pill.className = "nav-indicator";
  navMenu.prepend(pill);
  const active = () => $("a.active", navMenu);
  const move = (l) => {
    if (!l || window.innerWidth <= 760) { pill.style.opacity = 0; return; }
    pill.style.opacity = 1; pill.style.width = l.offsetWidth + "px"; pill.style.transform = `translateX(${l.offsetLeft}px)`;
  };
  let tick = false;
  const update = () => {
    const y = window.scrollY, max = root.scrollHeight - innerHeight;
    header.classList.toggle("scrolled", y > 20);
    bar.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
    tick = false;
  };
  addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener("resize", () => { update(); move(active()); });
  addEventListener("load", () => move(active()));
  update();

  const byId = new Map(links.map(a => [a.getAttribute("href").slice(1), a]));
  const spy = new IntersectionObserver((es) => es.forEach(en => {
    if (!en.isIntersecting) return;
    links.forEach(l => l.classList.remove("active"));
    byId.get(en.target.id)?.classList.add("active");
    if (!navMenu.matches(":hover")) move(active());
  }), { rootMargin: "-45% 0px -50% 0px" });
  byId.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
  links.forEach(l => l.addEventListener("mouseenter", () => move(l)));
  navMenu.addEventListener("mouseleave", () => move(active()));
})();

// Scroll reveal + glass card tilt
let io;
function reveal(el, cls, delay = 0) {
  io = io || new IntersectionObserver((es) => es.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add("show"); io.unobserve(en.target); }
  }), { threshold: 0.15 });
  el.classList.add("reveal"); if (cls) el.classList.add(cls);
  el.style.setProperty("--d", delay + "s"); io.observe(el);
}
function initPage() {
  const hover = matchMedia("(hover: hover)").matches;
  $$(".service-card, .doctor-card").forEach((c, i) => {
    reveal(c, "", (i % 4) * 0.1);
    if (!hover) return;
    c.addEventListener("mousemove", (e) => {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty("--mx", x * 100 + "%"); c.style.setProperty("--my", y * 100 + "%");
      c.style.transform = `perspective(800px) rotateX(${(0.5 - y) * 10}deg) rotateY(${(x - 0.5) * 10}deg) translateY(-6px)`;
    });
    c.addEventListener("mouseleave", () => c.style.transform = "");
  });
  [[".section-heading", ""], [".about-image", "from-left"], [".about-copy", "from-right"], [".products-panel", ""],
   [".appointment-box > div", "from-left"], [".appointment-box > form", "from-right"],
   [".contact-grid > div:first-child", "from-left"], [".map-card", "from-right"]]
    .forEach(([s, c]) => $$(s).forEach(el => reveal(el, c)));
}

// Loader
(function () {
  const loader = $("#loader"), t0 = Date.now();
  let done = false;
  function go() {
    if (done) return; done = true;
    loader?.classList.add("hide"); setTimeout(() => loader?.remove(), 700);
    document.body.classList.remove("loading"); document.body.classList.add("ready");
    initPage();
  }
  const wait = () => setTimeout(go, Math.max(0, 900 - (Date.now() - t0)));
  document.readyState === "complete" ? wait() : addEventListener("load", wait);
  setTimeout(go, 6000);
})();

// Custom cursor + hero parallax (mouse devices only)
(function () {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const dot = document.createElement("div"), ring = document.createElement("div");
  dot.className = "cursor-dot"; ring.className = "cursor-ring";
  document.body.append(ring, dot);
  const eye = $(".eye-orbit");
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
  document.addEventListener("mousemove", (e) => {
    x = e.clientX; y = e.clientY;
    root.classList.add("has-cursor", "cursor-on");
    dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    const t = e.target; if (!(t instanceof Element)) return;
    root.classList.toggle("cursor-hover", !!t.closest("a, button, .btn, .service-card, .doctor-card, label"));
    root.classList.toggle("cursor-text", !!t.closest("input, textarea"));
    root.classList.toggle("cursor-light", !!t.closest(".appointment, footer"));
    if (eye && document.body.classList.contains("ready")) {
      eye.style.transform = `translate(${(x / innerWidth - 0.5) * 24}px,${(y / innerHeight - 0.5) * 24}px)`;
    }
  }, { passive: true });
  root.addEventListener("mouseleave", () => root.classList.remove("cursor-on"));
  root.addEventListener("mouseenter", () => root.classList.add("cursor-on"));
  document.addEventListener("mousedown", (e) => {
    root.classList.add("cursor-down");
    const r = document.createElement("span");
    r.className = "cursor-click"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
    document.body.appendChild(r); r.addEventListener("animationend", () => r.remove());
  });
  document.addEventListener("mouseup", () => root.classList.remove("cursor-down"));
  (function loop() {
    rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    requestAnimationFrame(loop);
  })();
})();