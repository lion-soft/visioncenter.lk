
(() => {
    "use strict";

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        [...root.querySelectorAll(selector)];

    const root = document.documentElement;
    const body = document.body;

    const reducedMotion = matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    const hasFinePointer = matchMedia(
        "(hover: hover) and (pointer: fine)"
    ).matches;


    /* =====================================
       1. PAGE LOADER
    ===================================== */

    (function initLoader() {
        const loader = $("#loader");
        const startTime = Date.now();

        let completed = false;

        function finishLoading() {
            if (completed) return;

            completed = true;

            if (loader) {
                loader.classList.add("hide");

                setTimeout(() => loader.remove(), 700);
            }

            body.classList.remove("loading");
            body.classList.add("ready");

            initEffects();
        }

        function waitForMinimumTime() {
            const elapsed = Date.now() - startTime;

            setTimeout(
                finishLoading,
                Math.max(0, 900 - elapsed)
            );
        }

        if (document.readyState === "complete") {
            waitForMinimumTime();
        } else {
            window.addEventListener(
                "load",
                waitForMinimumTime,
                { once: true }
            );
        }

        setTimeout(finishLoading, 6000);
    })();


    /* =====================================
       2. SCROLL REVEAL
    ===================================== */

    let revealObserver = null;

    function reveal(element, delay = 0) {
        if (!element || element.dataset.revealReady) return;

        element.dataset.revealReady = "true";
        element.classList.add("reveal");

        element.style.setProperty("--d", `${delay}s`);

        if (revealObserver) {
            revealObserver.observe(element);
        } else {
            element.classList.add("show");
        }
    }


    /* =====================================
       3. 3D CARD TILT
    ===================================== */

    function addTilt(element) {
        if (
            !element ||
            element.dataset.tiltReady ||
            !hasFinePointer ||
            reducedMotion
        ) {
            return;
        }

        element.dataset.tiltReady = "true";

        element.addEventListener("mousemove", event => {
            const rect = element.getBoundingClientRect();

            const x = (event.clientX - rect.left) / rect.width;
            const y = (event.clientY - rect.top) / rect.height;

            const rotateX = (0.5 - y) * 8;
            const rotateY = (x - 0.5) * 8;

            element.style.setProperty("--mx", `${x * 100}%`);
            element.style.setProperty("--my", `${y * 100}%`);

            element.style.transform =
                `perspective(800px) ` +
                `rotateX(${rotateX}deg) ` +
                `rotateY(${rotateY}deg) ` +
                `translateY(-5px)`;
        });

        element.addEventListener("mouseleave", () => {
            element.style.transform = "";
        });
    }


    /* =====================================
       4. NAVIGATION SLIDING INDICATOR
    ===================================== */

    function initNavigation() {
    const navMenu = $("#navMenu");
    if (!navMenu) return;

    const links = $$("a", navMenu);
    if (!links.length) return;

    let pill = $(".nav-indicator", navMenu);

    if (!pill) {
        pill = document.createElement("span");
        pill.className = "nav-indicator";
        pill.setAttribute("aria-hidden", "true");
        navMenu.prepend(pill);
    }

    const activeLink = () => $("a.active", navMenu);

    function moveIndicator(link) {
        if (!link || innerWidth <= 760 || reducedMotion) {
            pill.style.opacity = "0";
            return;
        }

        const navRect = navMenu.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();

        const left =
            linkRect.left - navRect.left -
            navMenu.clientLeft + navMenu.scrollLeft;

        const top =
            linkRect.top - navRect.top -
            navMenu.clientTop + linkRect.height / 2;

        pill.style.left = `${left}px`;
        pill.style.top = `${top}px`;
        pill.style.width = `${linkRect.width}px`;
        pill.style.height = `${linkRect.height}px`;
        pill.style.marginTop = "0";
        pill.style.transform = "translateY(-50%)";
        pill.style.opacity = "1";
    }

    links.forEach(link => {
        link.addEventListener("mouseenter", () => {
            moveIndicator(link);
        });

        link.addEventListener("focus", () => {
            moveIndicator(link);
        });
    });

    navMenu.addEventListener("mouseleave", () => {
        moveIndicator(activeLink());
    });

    navMenu.addEventListener("focusout", () => {
        setTimeout(() => {
            if (!navMenu.contains(document.activeElement)) {
                moveIndicator(activeLink());
            }
        }, 0);
    });

    window.addEventListener("resize", () => {
        moveIndicator(activeLink());
    });

    window.addEventListener("load", () => {
        moveIndicator(activeLink());
    });

    requestAnimationFrame(() => {
        moveIndicator(activeLink());
    });
}
    /* =====================================
       5. CURSOR ANIMATION
    ===================================== */

    function initCursor() {
        if (!hasFinePointer || reducedMotion) return;

        if ($(".cursor-dot") || $(".cursor-ring")) return;

        const dot = document.createElement("div");
        const ring = document.createElement("div");

        dot.className = "cursor-dot";
        ring.className = "cursor-ring";

        body.append(ring, dot);

        let x = innerWidth / 2;
        let y = innerHeight / 2;

        let rx = x;
        let ry = y;

        document.addEventListener("mousemove", event => {
            x = event.clientX;
            y = event.clientY;

            root.classList.add("has-cursor", "cursor-on");

            dot.style.transform =
                `translate3d(${x}px, ${y}px, 0)`;

            const target = event.target;

            if (!(target instanceof Element)) return;

            root.classList.toggle(
                "cursor-hover",
                !!target.closest(
                    "a, button, input, select, textarea, " +
                    ".btn, .product-card, .admin-product, label"
                )
            );

            root.classList.toggle(
                "cursor-text",
                !!target.closest("input, textarea")
            );
        }, { passive: true });

        document.addEventListener("mouseleave", () => {
            root.classList.remove("cursor-on");
        });

        document.addEventListener("mouseenter", () => {
            root.classList.add("cursor-on");
        });

        document.addEventListener("mousedown", event => {
            root.classList.add("cursor-down");

            const ripple = document.createElement("span");

            ripple.className = "cursor-click";
            ripple.style.left = `${event.clientX}px`;
            ripple.style.top = `${event.clientY}px`;

            body.appendChild(ripple);

            ripple.addEventListener(
                "animationend",
                () => ripple.remove(),
                { once: true }
            );
        });

        document.addEventListener("mouseup", () => {
            root.classList.remove("cursor-down");
        });

        function animateCursor() {
            rx += (x - rx) * 0.18;
            ry += (y - ry) * 0.18;

            ring.style.transform =
                `translate3d(${rx}px, ${ry}px, 0)`;

            requestAnimationFrame(animateCursor);
        }

        animateCursor();
    }


    /* =====================================
       6. DYNAMIC PAGE EFFECTS
    ===================================== */

    function scanPage() {
        const selectors = [
            ".product-card",
            ".admin-card",
            ".product-form",
            ".inventory",
            ".admin-product",
            ".catalog-hero .container",
            ".catalog-cta .container"
        ];

        const elements = $$(selectors.join(","));

        elements.forEach((element, index) => {
            reveal(element, (index % 4) * 0.08);

            if (
                element.matches(
                    ".product-card, .admin-product"
                )
            ) {
                addTilt(element);
            }
        });
    }


    /* =====================================
       7. INITIALIZE ALL EFFECTS
    ===================================== */

    function initEffects() {
        if (reducedMotion) {
            body.classList.add("motion-reduced");
        }

        if ("IntersectionObserver" in window) {
            revealObserver = new IntersectionObserver(
                entries => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add("show");

                            revealObserver.unobserve(entry.target);
                        }
                    });
                },
                { threshold: 0.12 }
            );
        }

        scanPage();

        // Watch Firebase-loaded product cards
        const mutationObserver = new MutationObserver(() => {
            scanPage();
        });

        mutationObserver.observe(body, {
            childList: true,
            subtree: true
        });

        initNavigation();
        initCursor();
    }

})();
