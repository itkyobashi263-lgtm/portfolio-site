"use strict";

(() => {
  // ナビゲーション、スムーススクロール、ネイティブ<dialog>モーダル、アクセシブルタブ制御
  // ※ defer属性により、DOM構築完了後に自動実行されるためDOMContentLoadedは不要

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // ==========================================
  // Responsive Popover Navigation
  // ==========================================
  const header = document.querySelector("header");
  const headerInner = header ? header.querySelector(".header-inner") : null;
  const hamburger = document.getElementById("hamburger");
  const navMenu = document.getElementById("nav-menu");

  const isPopoverOpen = (el) => {
    if (!el) return false;
    try {
      return el.matches(":popover-open") || el.classList.contains(":popover-open");
    } catch {
      return el.classList.contains(":popover-open");
    }
  };

  const hideNavPopover = () => {
    if (!header || !navMenu) return;
    if (!header.classList.contains("is-wide") && isPopoverOpen(navMenu)) {
      if (typeof navMenu.hidePopover === "function") {
        navMenu.hidePopover();
      }
    }
  };

  if (header && headerInner && hamburger && navMenu) {
    let lastHeaderWidth = 0;

    const syncNavLayout = () => {
      const wasOpen = !header.classList.contains("is-wide") && isPopoverOpen(navMenu);

      header.classList.add("is-measuring", "is-wide");
      navMenu.removeAttribute("popover");

      const fits = headerInner.scrollWidth <= headerInner.clientWidth;

      if (fits) {
        hamburger.classList.remove("active");
        hamburger.setAttribute("aria-expanded", "false");
      } else {
        header.classList.remove("is-wide");
        navMenu.setAttribute("popover", "auto");
        if (wasOpen && typeof navMenu.showPopover === "function") {
          navMenu.showPopover();
        }
      }

      window.requestAnimationFrame(() => {
        header.classList.remove("is-measuring");
      });
    };

    navMenu.addEventListener("toggle", (e) => {
      const isOpen = e.newState === "open";
      hamburger.classList.toggle("active", isOpen);
      hamburger.setAttribute("aria-expanded", String(isOpen));
    });

    const navResizeObserver = new ResizeObserver((entries) => {
      const headerEntry = entries.find((entry) => entry.target === headerInner);
      const currentWidth = headerEntry ? headerEntry.contentRect.width : headerInner.clientWidth;
      const isWide = header.classList.contains("is-wide");

      // 折りたたみ時は横幅が広がった時だけ再計測し、レイアウトスラッシングを防ぐ
      if (isWide || currentWidth > lastHeaderWidth) {
        syncNavLayout();
      }
      lastHeaderWidth = currentWidth;
    });

    syncNavLayout();
    lastHeaderWidth = headerInner.clientWidth;
    navResizeObserver.observe(headerInner);
    navResizeObserver.observe(navMenu);
  }

  // ==========================================
  // Smooth Scroll
  // ==========================================
  let scrollAnimationId = null;

  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

  const smoothScrollTo = (targetY, duration) => {
    if (scrollAnimationId !== null) {
      window.cancelAnimationFrame(scrollAnimationId);
      scrollAnimationId = null;
    }

    if (prefersReducedMotion.matches) {
      window.scrollTo(0, targetY);
      return;
    }

    const startY = window.scrollY;
    const difference = targetY - startY;
    let startTime = null;

    const step = (currentTime) => {
      if (startTime === null) startTime = currentTime;
      const progress = currentTime - startTime;
      const percent = Math.min(progress / duration, 1);

      window.scrollTo(0, startY + difference * easeInOutCubic(percent));

      if (progress < duration) {
        scrollAnimationId = window.requestAnimationFrame(step);
      } else {
        scrollAnimationId = null;
      }
    };

    scrollAnimationId = window.requestAnimationFrame(step);
  };

  // ==========================================
  // Accessible Tabs + hidden="until-found"
  // ==========================================
  const tabList = document.querySelector('.tab-links[role="tablist"]');
  const tabButtons = Array.from(document.querySelectorAll('.tab-btn[role="tab"]'));
  const tabPanels = Array.from(document.querySelectorAll('.tab-content[role="tabpanel"]'));
  const tabWrapper = document.querySelector(".tab-content-wrapper");

  const activateTab = (panelId, { scrollTabIntoView = true, animate = true } = {}) => {
    const targetPanel = document.getElementById(panelId);
    const targetTab = tabButtons.find((btn) => btn.dataset.target === panelId);
    if (!targetPanel || !targetTab) return;

    tabButtons.forEach((btn) => {
      const isSelected = btn === targetTab;
      btn.setAttribute("aria-selected", String(isSelected));
      btn.tabIndex = isSelected ? 0 : -1;
    });

    tabPanels.forEach((panel) => {
      if (panel === targetPanel) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "until-found");
      }
    });

    if (scrollTabIntoView) {
      targetTab.scrollIntoView({ block: "nearest", inline: "nearest", container: "nearest" });
    }

    if (animate && !prefersReducedMotion.matches) {
      targetPanel.getAnimations().forEach((anim) => anim.cancel());
      targetPanel.animate(
        [
          { opacity: 0, translate: "0 15px", scale: 0.98 },
          { opacity: 1, translate: "0 0", scale: 1 },
        ],
        {
          duration: 500,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        }
      );
    }
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.target) {
        activateTab(btn.dataset.target);
      }
    });
  });

  if (tabList && tabButtons.length > 0) {
    tabList.addEventListener("keydown", (e) => {
      const currentIndex = tabButtons.indexOf(document.activeElement);
      if (currentIndex === -1) return;

      let nextIndex = null;
      if (e.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % tabButtons.length;
      } else if (e.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
      } else if (e.key === "Home") {
        nextIndex = 0;
      } else if (e.key === "End") {
        nextIndex = tabButtons.length - 1;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        const nextTab = tabButtons[nextIndex];
        nextTab.focus();
        if (nextTab.dataset.target) {
          activateTab(nextTab.dataset.target);
        }
      }
    });
  }

  // ブラウザのページ内検索(Ctrl+F)等で隠しパネルが自動展開された際、タブ選択状態を同期する
  if (tabWrapper) {
    tabWrapper.addEventListener("beforematch", (e) => {
      const matchedPanel = e.target.closest('.tab-content[role="tabpanel"]');
      if (matchedPanel && matchedPanel.id) {
        activateTab(matchedPanel.id, { scrollTabIntoView: true, animate: false });
      }
    });
  }

  // URLハッシュがタブパネルを指している場合に同期する
  const syncTabWithHash = () => {
    if (!window.location.hash) return;
    const hashId = window.location.hash.slice(1);
    if (tabPanels.some((panel) => panel.id === hashId)) {
      activateTab(hashId, { scrollTabIntoView: false, animate: false });
    }
  };
  syncTabWithHash();
  window.addEventListener("hashchange", syncTabWithHash);

  // ページ内リンク（#から始まるhref）のスムーススクロール処理
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      hideNavPopover();

      const targetId = this.getAttribute("href");
      if (targetId === "#") {
        smoothScrollTo(0, 650);
        return;
      }

      const targetElement = document.querySelector(targetId);
      if (!targetElement) return;

      if (targetElement.getAttribute("role") === "tabpanel") {
        activateTab(targetElement.id);
      }

      const headerHeight = header ? header.offsetHeight : 0;
      const getAbsoluteY = (el) => el.getBoundingClientRect().top + window.scrollY;
      let targetY = getAbsoluteY(targetElement) - headerHeight;

      // タブコンテンツの場合は、親要素である「Projects」セクションの位置にスクロールする（見切れ防止）
      if (targetElement.getAttribute("role") === "tabpanel") {
        const projectsSection = document.getElementById("Projects");
        if (projectsSection) {
          targetY = getAbsoluteY(projectsSection) - headerHeight;
        }
      }

      smoothScrollTo(targetY, 650);
    });
  });

  // ==========================================
  // Native <dialog> Image Lightbox Modal
  // ==========================================
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImg");
  const modalCaption = document.getElementById("modalCaption");
  const modalClose = document.getElementById("modalClose");

  let supportsDisplayTransition;
  const canTransitionDisplay = () => {
    if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
    if (!window.CSS?.supports?.("transition-behavior", "allow-discrete") || !document.body) {
      return false;
    }
    const probe = document.createElement("div");
    probe.style.cssText = "transition: display 1s allow-discrete !important; display: block;";
    document.body.appendChild(probe);
    getComputedStyle(probe).display;
    probe.style.display = "none";
    supportsDisplayTransition = getComputedStyle(probe).display === "block";
    probe.remove();
    return supportsDisplayTransition;
  };

  const supportsTopLayerExit = () =>
    Boolean(window.CSS?.supports?.("overlay", "auto") && canTransitionDisplay());

  const closeTopLayer = async (dialog) => {
    if (!dialog || !dialog.open) return;

    if (!supportsTopLayerExit()) {
      dialog.setAttribute("data-closing", "");
      const animations = dialog.getAnimations({ subtree: true });
      if (animations.length > 0) {
        await Promise.race([
          Promise.allSettled(animations.map((a) => a.finished)),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
      }
      if (!dialog.hasAttribute("data-closing")) return;
      dialog.removeAttribute("data-closing");
    }

    dialog.close();
  };

  if (modal && modalImg && modalCaption && modalClose) {
    document.querySelectorAll(".popup-trigger").forEach((trigger) => {
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        modalImg.src = this.getAttribute("href");
        modalCaption.textContent = this.getAttribute("data-caption") || "";
        modal.removeAttribute("data-closing");
        if (!modal.open) {
          modal.showModal();
        }
      });
    });

    modalClose.addEventListener("click", () => {
      closeTopLayer(modal);
    });

    // Escキーやclosedbyによるネイティブ閉じ要求時も終了アニメーションを適用
    modal.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeTopLayer(modal);
    });

    // Safari等 closedby 未対応ブラウザ向けのライトディスミス・フォールバック
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      modal.addEventListener("pointerdown", (e) => {
        pressedOutside = outside(e, modal);
      });
      modal.addEventListener("pointerup", (e) => {
        if (pressedOutside && outside(e, modal)) {
          closeTopLayer(modal);
        }
        pressedOutside = false;
      });
    }
  }

  // ==========================================
  // Back to Top Button (IntersectionObserver)
  // ==========================================
  const pageTopBtn = document.getElementById("page-top");
  if (pageTopBtn) {
    const scrollSentinel = document.createElement("div");
    scrollSentinel.setAttribute("aria-hidden", "true");
    scrollSentinel.style.cssText =
      "position: absolute; inset-block-start: 0; inset-inline-start: 0; inline-size: 1px; block-size: 300px; pointer-events: none; visibility: hidden;";
    document.body.prepend(scrollSentinel);

    const pageTopObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      const shouldShow = !entry.isIntersecting && entry.boundingClientRect.bottom <= 0;
      const wasVisible = pageTopBtn.classList.contains("show");

      if (wasVisible && !shouldShow && document.activeElement === pageTopBtn) {
        const mainRegion = document.querySelector("main");
        if (mainRegion) {
          if (!mainRegion.hasAttribute("tabindex")) {
            mainRegion.setAttribute("tabindex", "-1");
          }
          mainRegion.focus({ preventScroll: true });
        }
      }

      pageTopBtn.classList.toggle("show", shouldShow);
    });

    pageTopObserver.observe(scrollSentinel);
  }

  // ==========================================
  // Intersection Observer for Fade-in
  // ==========================================
  const fadeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    {
      root: null,
      rootMargin: "0px",
      threshold: 0.15,
    }
  );

  document.querySelectorAll(".fade-in").forEach((element) => {
    fadeObserver.observe(element);
  });
})();
