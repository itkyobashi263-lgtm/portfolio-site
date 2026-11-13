"use strict";

(() => {
  // ハンバーガーメニューとスムーススクロールの機能
  // ※ defer属性により、DOM構築完了後に自動実行されるためDOMContentLoadedは不要

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const hamburger = document.getElementById("hamburger");
  const navMenu = document.getElementById("nav-menu");

  const setMenuOpen = (isOpen) => {
    if (!hamburger || !navMenu) return;
    hamburger.classList.toggle("active", isOpen);
    navMenu.classList.toggle("active", isOpen);
    hamburger.setAttribute("aria-expanded", String(isOpen));
  };

  // ハンバーガーボタンをクリックした時の処理
  if (hamburger && navMenu) {
    hamburger.addEventListener("click", () => {
      const isOpen = !hamburger.classList.contains("active");
      setMenuOpen(isOpen);
    });
  }

  // イージング関数付きのカスタムスムーススクロール処理（速度調整可能）
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

      // 時間がdurationに達するまでrequestAnimationFrameでアニメーションを繰り返す
      if (progress < duration) {
        scrollAnimationId = window.requestAnimationFrame(step);
      } else {
        scrollAnimationId = null;
      }
    };

    scrollAnimationId = window.requestAnimationFrame(step);
  };

  // タブ切り替え共通ヘルパー
  const tabContents = document.querySelectorAll(".tab-content");

  const activateTab = (targetId) => {
    const targetContent = document.querySelector(targetId);
    if (!targetContent) return;

    document.querySelectorAll(".tab-links li").forEach((li) => li.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));

    targetContent.classList.add("active");

    const matchingTabBtn = document.querySelector(`.tab-links a[href="${targetId}"]`);
    if (matchingTabBtn) {
      matchingTabBtn.parentElement.classList.add("active");
    }

    if (!prefersReducedMotion.matches) {
      targetContent.getAnimations().forEach((anim) => anim.cancel());
      targetContent.animate(
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

  // ページ内のリンク（#から始まるhref、タブ切り替えリンク除く）をクリックした時のスムーススクロール処理
  document.querySelectorAll('a[href^="#"]:not(.tab-links a)').forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();

      // モバイル用メニューが開いていたら閉じる
      setMenuOpen(false);

      const targetId = this.getAttribute("href");

      // href="#" の場合はページ最上部へスクロール
      if (targetId === "#") {
        smoothScrollTo(0, 650);
        return;
      }

      const targetElement = document.querySelector(targetId);
      if (!targetElement) return;

      // ターゲットがタブコンテンツだった場合は、対象タブをアクティブにする
      if (targetElement.classList.contains("tab-content")) {
        activateTab(targetId);
      }

      // ヘッダーの高さを動的に取得してスクロール位置を調整
      const header = document.querySelector("header");
      const headerHeight = header ? header.offsetHeight : 0;

      const getAbsoluteY = (el) => el.getBoundingClientRect().top + window.scrollY;
      let targetY = getAbsoluteY(targetElement) - headerHeight;

      // タブコンテンツの場合は、親要素である「Projects」セクションの位置にスクロールする（見切れ防止）
      if (targetElement.classList.contains("tab-content")) {
        const projectsSection = document.getElementById("Projects");
        if (projectsSection) {
          targetY = getAbsoluteY(projectsSection) - headerHeight;
        }
      }

      smoothScrollTo(targetY, 650);
    });
  });

  // Image Popup Modal Lightbox Functionality
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImg");
  const modalCaption = document.getElementById("modalCaption");
  const modalClose = document.getElementById("modalClose");

  const openModal = (src, caption) => {
    if (!modal || !modalImg || !modalCaption) return;
    modalImg.src = src;
    modalCaption.textContent = caption;
    modal.classList.remove("is-closing");
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden"; // Prevent background scrolling
  };

  const closeModal = async () => {
    if (!modal || !modal.classList.contains("show")) return;
    modal.classList.remove("show");
    modal.classList.add("is-closing");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = ""; // Restore background scrolling

    const animations = modal.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
    }

    if (!modal.classList.contains("show")) {
      modal.classList.remove("is-closing");
    }
  };

  if (modal && modalClose) {
    document.querySelectorAll(".popup-trigger").forEach((trigger) => {
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        const imgSrc = this.getAttribute("href");
        const captionText = this.getAttribute("data-caption") || "";
        openModal(imgSrc, captionText);
      });
    });

    modalClose.addEventListener("click", closeModal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  // Escapeキーでモーダルまたはモバイルメニューを閉じる
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    if (modal && modal.classList.contains("show")) {
      closeModal();
      return;
    }

    if (hamburger && navMenu && hamburger.classList.contains("active")) {
      const wasFocusedInsideMenu = navMenu.contains(document.activeElement);
      setMenuOpen(false);
      if (wasFocusedInsideMenu) {
        hamburger.focus();
      }
    }
  });

  // 「Topに戻る」ボタンのスクロール位置に応じた表示・非表示制御（IntersectionObserver）
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
  // Modern Enhancements: Tabs & Scroll Animation
  // ==========================================

  // --- Intersection Observer for Fade-in ---
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

  // --- Tab Switching Logic ---
  document.querySelectorAll(".tab-links a").forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href");
      if (targetId) {
        activateTab(targetId);
      }
    });
  });
})();
