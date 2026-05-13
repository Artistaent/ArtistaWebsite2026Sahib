/* ============================================================
   ARTISTA ENT. — Site script
   Animation system ported from MONO template:
     - Hand-rolled scroll-progress (no GSAP/Lenis)
     - rAF-throttled scroll listener
     - position:sticky pin + per-section enter-progress (0..1)
     - Word-by-word blur reveal driven by scroll
     - Letter staggers with cubic-bezier(0.86, 0, 0.07, 1)
     - IntersectionObserver fade-on-enter for images
     - Image parallax tied to viewport position
     - Page preloader → release on load
   ============================================================ */

(function () {
  const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Lenis smooth scroll (premium eased wheel feel) ----------
     Lenis works alongside position:sticky — it just interpolates window.scrollY.
     If the CDN script failed to load, we silently fall back to native scroll. */
  let lenis = null;
  if (typeof window.Lenis === "function" && !prefersReduce) {
    try {
      lenis = new window.Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 1,
        touchMultiplier: 1.6,
      });
      const lenisRaf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(lenisRaf);
      };
      requestAnimationFrame(lenisRaf);
    } catch (e) {
      lenis = null;
    }
  }

  /* ---------- Text splitting (chars / words) ---------- */
  function splitChars(el) {
    if (el.dataset.split === "done") return;
    const text = el.textContent.trim();
    el.textContent = "";
    let charIndex = 0;
    const _lines = [text];
    _lines.forEach((line, lineIdx) => {
      const wrap = document.createElement("span");
      wrap.className = "char-wrap";
      const words = line.split(" ");
      words.forEach((word, wIdx) => {
        const wordSpan = document.createElement("span");
        wordSpan.className = "split-chars__word";
        wordSpan.style.display = "inline-block";
        Array.from(word).forEach((ch) => {
          const c = document.createElement("span");
          c.className = "char";
          c.textContent = ch;
          c.style.setProperty("--char-i", charIndex++);
          wordSpan.appendChild(c);
        });
        wrap.appendChild(wordSpan);
        if (wIdx < words.length - 1) {
          const sp = document.createElement("span");
          sp.innerHTML = "&nbsp;";
          sp.style.setProperty("--char-i", charIndex++);
          sp.className = "char char--space";
          wrap.appendChild(sp);
        }
      });
      el.appendChild(wrap);
      if (lineIdx < _lines.length - 1) el.appendChild(document.createElement("br"));
    });
    el.dataset.split = "done";
    el.classList.add("is-split");
  }

  function splitWords(el) {
    if (el.dataset.split === "done") return;
    const text = el.textContent.trim();
    const words = text.split(/\s+/);
    el.textContent = "";
    words.forEach((w, i) => {
      const span = document.createElement("span");
      span.className = "word";
      span.style.setProperty("--word-i", i);
      span.textContent = w;
      el.appendChild(span);
      el.appendChild(document.createTextNode(" "));
    });
    el.dataset.split = "done";
    el.classList.add("is-split");
  }

  document.querySelectorAll("[data-split-chars]").forEach(splitChars);
  document.querySelectorAll("[data-split-words]").forEach(splitWords);

  /* ---------- Cinematic stacked sections — enter/cover progress ---------- */
  /*
     Each .cinema-section is sticky; the next section rises and covers it.
     For a section S with the next sibling N:
       coverProgress = how much N has covered S    (0 fresh → 1 fully covered)
       enterProgress = how much THIS section has risen over the previous (0 → 1)
     We expose both as CSS vars so child elements can scrub against them.
  */
  const sections = Array.from(document.querySelectorAll(".cinema-section"));

  function updateCinematicProgress() {
    if (!sections.length) return;
    const vh = window.innerHeight;

    // First compute each section's "self-rise" based on its own getBoundingClientRect
    sections.forEach((section, i) => {
      const rect = section.getBoundingClientRect();
      // For non-first sections: enter from below (rect.top: vh → 0)
      // First section: full enter on load
      let enter = 1;
      if (i > 0) {
        enter = 1 - Math.min(Math.max(rect.top / vh, 0), 1);
      }

      // Cover by next: 1 - (next.top / vh), clamped
      let cover = 0;
      const next = sections[i + 1];
      if (next) {
        const nr = next.getBoundingClientRect();
        cover = 1 - Math.min(Math.max(nr.top / vh, 0), 1);
      }

      section.style.setProperty("--enter-progress", enter.toFixed(4));
      section.style.setProperty("--cover-progress", cover.toFixed(4));
      section.dataset.progress = cover.toFixed(2);

      // Apply scroll-tied word reveal inside this section
      applyWordBlur(section, enter);
    });
  }

  /* ---------- Word-by-word blur reveal driven by section progress ----------
     Element opts in with [data-blur-on-scroll] inside a .cinema-section.
     Optional: data-progress-start / data-progress-end (fractions of section progress).
  */
  function applyWordBlur(section, enter) {
    const targets = section.querySelectorAll("[data-blur-on-scroll]");
    targets.forEach((t) => {
      const start = parseFloat(t.dataset.progressStart || "0.05");
      const end = parseFloat(t.dataset.progressEnd || "0.85");
      const local = clamp((enter - start) / (end - start), 0, 1);
      const words = t.querySelectorAll(".word");
      const span = words.length || 1;
      const reach = local * (span + 1);
      words.forEach((w, i) => {
        const wp = clamp(reach - i, 0, 1);
        w.style.setProperty("--w-op", wp.toFixed(3));
        w.style.setProperty("--w-blur", ((1 - wp) * 32).toFixed(2));
      });
    });
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- Subtle parallax on opt-in elements [data-parallax="0.06"] ---------- */
  const parallaxEls = Array.from(document.querySelectorAll("[data-parallax]"));
  function updateParallax() {
    if (prefersReduce || !parallaxEls.length) return;
    const vh = window.innerHeight;
    parallaxEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const offset = center - vh / 2;
      const k = parseFloat(el.dataset.parallax) || 0.05;
      el.style.transform = `translate3d(0, ${(-offset * k).toFixed(2)}px, 0)`;
    });
  }

  /* ---------- Background image parallax ([data-bg-parallax]) — scale + Y drift ---------- */
  const bgParallaxEls = Array.from(document.querySelectorAll("[data-bg-parallax]"));
  function updateBgParallax() {
    if (prefersReduce || !bgParallaxEls.length) return;
    const vh = window.innerHeight;
    bgParallaxEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const t = clamp((center / vh - 0.5) * -1 + 0.5, 0, 1); // 0..1 across viewport
      const yShift = (t - 0.5) * 30; // -15..+15 px, like template's editorial parallax
      el.style.transform = `scale(1.12) translate3d(0, ${yShift.toFixed(2)}px, 0)`;
    });
  }

  /* ---------- rAF scroll loop ---------- */
  let rafId = null;
  function tick() {
    updateCinematicProgress();
    updateParallax();
    updateBgParallax();
    updateNavState();
    rafId = null;
  }
  function onScroll() {
    if (rafId == null) rafId = requestAnimationFrame(tick);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  /* ---------- IntersectionObserver: trigger letter/line/word staggers + image fades ---------- */
  const triggerEls = Array.from(document.querySelectorAll(
    ".reveal, .split-chars, .split-words.trigger-blur, .line-mask, .fade-img, [data-line-stack]"
  )).filter((el) => !el.closest(".sec-hero")); // hero is kicked manually after preloader

  // Index reveals inside each grid for stagger
  document.querySelectorAll(".work-grid").forEach((grid) => {
    Array.from(grid.querySelectorAll(".reveal")).forEach((el, i) => {
      el.style.setProperty("--i", i);
    });
  });
  // Index .line-mask siblings for line-by-line stagger
  document.querySelectorAll("[data-line-stack]").forEach((stack) => {
    Array.from(stack.querySelectorAll(".line-mask")).forEach((el, i) => {
      el.style.setProperty("--line-i", i);
    });
  });

  if (!prefersReduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
    );
    triggerEls.forEach((el) => io.observe(el));
  } else {
    triggerEls.forEach((el) => el.classList.add("is-in"));
  }

  /* ---------- Nav scroll state ---------- */
  const nav = document.getElementById("siteNav");
  function updateNavState() {
    if (!nav) return;
    nav.classList.toggle("is-scrolled", window.scrollY > 60);
  }

  /* ---------- Menu toggle (placeholder for full-screen menu later) ---------- */
  const menuBtn = document.querySelector(".nav-menu");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      menuBtn.classList.toggle("is-open");
    });
  }

  /* ---------- Preloader: counts up, then releases ---------- */
  const pre = document.getElementById("preloader");
  if (pre && !prefersReduce) {
    const counter = pre.querySelector(".preloader__count");
    let n = 0;
    const t0 = performance.now();
    const dur = 1100;
    function step(now) {
      const t = clamp((now - t0) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      n = Math.round(eased * 100);
      if (counter) counter.textContent = String(n).padStart(3, "0");
      if (t < 1) requestAnimationFrame(step);
      else releasePreloader();
    }
    function releasePreloader() {
      pre.classList.add("is-done");
      // Trigger hero entrance
      document.body.classList.add("is-ready");
      setTimeout(() => pre.parentNode && pre.parentNode.removeChild(pre), 1000);
    }
    // Start once fonts are roughly ready (don't block forever)
    if (document.fonts && document.fonts.ready) {
      Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 1400)),
      ]).then(() => requestAnimationFrame(step));
    } else {
      requestAnimationFrame(step);
    }
  } else if (pre) {
    pre.classList.add("is-done");
    document.body.classList.add("is-ready");
  } else {
    document.body.classList.add("is-ready");
  }

  /* ---------- On-load hero kick: trigger split-chars/words inside hero ---------- */
  function kickHero() {
    document.querySelectorAll(".sec-hero .split-chars, .sec-hero .split-words.trigger-blur, .sec-hero .reveal, .sec-hero .line-mask, .sec-hero .fade-img")
      .forEach((el) => el.classList.add("is-in"));
  }

  if (document.body.classList.contains("is-ready")) {
    requestAnimationFrame(kickHero);
  } else {
    const obs = new MutationObserver(() => {
      if (document.body.classList.contains("is-ready")) {
        kickHero();
        obs.disconnect();
      }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  /* ---------- Initial paint ---------- */
  updateCinematicProgress();
  updateParallax();
  updateBgParallax();
  updateNavState();
})();

/* ============================================================
   MOBILE MENU DRAWER — auto-injected into every page
   - Tapping the .nav-menu button opens a full-screen blurred overlay
   - Big tap-friendly nav links staggered in
   - Closes on link tap, close button, ESC, or backdrop tap
   ============================================================ */
(function () {
  if (document.getElementById("mobileMenu")) return;

  const links = [
    { href: "index.html",   label: "Home" },
    { href: "about.html",   label: "About Us" },
    { href: "gallery.html", label: "Services" },
    { href: "work.html",    label: "Gallery" },
    { href: "contact.html", label: "Contact Us" },
  ];

  const menu = document.createElement("div");
  menu.id = "mobileMenu";
  menu.className = "mobile-menu";
  menu.setAttribute("aria-hidden", "true");

  const close = document.createElement("button");
  close.className = "mobile-menu__close";
  close.type = "button";
  close.setAttribute("aria-label", "Close menu");
  close.textContent = "CLOSE";
  menu.appendChild(close);

  const nav = document.createElement("nav");
  nav.className = "mobile-menu__nav";
  nav.setAttribute("aria-label", "Mobile primary");
  links.forEach((l, i) => {
    const a = document.createElement("a");
    a.href = l.href;
    a.textContent = l.label;
    a.style.setProperty("--i", i);
    nav.appendChild(a);
  });
  menu.appendChild(nav);

  document.body.appendChild(menu);

  const menuBtn = document.querySelector(".nav-menu");

  function openMenu() {
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeMenu() {
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", function (e) {
      e.preventDefault();
      if (menu.classList.contains("is-open")) closeMenu();
      else openMenu();
    });
  }
  close.addEventListener("click", closeMenu);

  // Close when tapping a nav link (lets the navigation proceed)
  nav.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      // Defer close so the link click registers first
      setTimeout(closeMenu, 0);
    });
  });

  // Close on Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menu.classList.contains("is-open")) closeMenu();
  });

  // Close on backdrop tap (clicking the menu container outside of nav/close)
  menu.addEventListener("click", function (e) {
    if (e.target === menu) closeMenu();
  });
})();

/* ============================================================
   CURSOR BLOB — single soft orange follower (additive, self-contained)
   - Injects a <div id="cursor-blob"> into <body>
   - Updates its transform on every mousemove; CSS transition
     (110ms ease-out) smooths the lag, no JS lerp loop needed
   - mix-blend-mode: screen (set in CSS) makes the orange blob
     brighten dark backgrounds & text it passes near, giving the
     "letters lighting up" effect from the reference template
   - Honors prefers-reduced-motion (effect skipped)
   ============================================================ */
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const blob = document.createElement("div");
  blob.id = "cursor-blob";
  blob.setAttribute("aria-hidden", "true");
  document.body.appendChild(blob);

  const HALF = 240; // half of the 480px blob, to center it on the cursor

  document.addEventListener("mousemove", (e) => {
    blob.style.transform =
      "translate3d(" + (e.clientX - HALF) + "px, " + (e.clientY - HALF) + "px, 0)";
  }, { passive: true });

  // Hide the blob whenever the cursor is over a <video> element.
  function bindVideoHide(v) {
    if (!v || v.__blobBound) return;
    v.__blobBound = true;
    v.addEventListener("mouseenter", () => document.body.classList.add("over-video"));
    v.addEventListener("mouseleave", () => document.body.classList.remove("over-video"));
  }
  document.querySelectorAll("video").forEach(bindVideoHide);
  // Catch any videos added later
  new MutationObserver((muts) => {
    muts.forEach((m) => {
      m.addedNodes && m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.tagName === "VIDEO") bindVideoHide(n);
        else if (n.querySelectorAll) n.querySelectorAll("video").forEach(bindVideoHide);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
})();
