"use strict";

(() => {
  // ナビゲーション、スムーススクロール、ネイティブ<dialog>モーダル、アクセシブルタブ制御
  // ※ defer属性により、DOM構築完了後に自動実行されるためDOMContentLoadedは不要

  const SCROLL_DURATION_MS = 650;
  const MODAL_CLOSE_TIMEOUT_MS = 2000;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const isPopoverOpen = (el) => {
    if (!el) return false;
    try {
      return el.matches(":popover-open") || el.classList.contains(":popover-open");
    } catch {
      return el.classList.contains(":popover-open");
    }
  };

  const setMenuExpanded = (hamburger, isOpen) => {
    hamburger.classList.toggle("active", isOpen);
    hamburger.setAttribute("aria-expanded", String(isOpen));
  };

  /**
   * ヘッダー幅に応じて通常ナビ / popover ドロワーを切り替え、閉じる関数を返す。
   */
  const initResponsiveNav = (header) => {
    const headerInner = header ? header.querySelector(".header-inner") : null;
    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("nav-menu");

    const hideNavPopover = () => {
      if (!header || !navMenu) return;
      if (!header.classList.contains("is-wide") && isPopoverOpen(navMenu)) {
        if (typeof navMenu.hidePopover === "function") {
          navMenu.hidePopover();
        }
      }
    };

    if (!header || !headerInner || !hamburger || !navMenu) {
      return hideNavPopover;
    }

    let lastHeaderWidth = 0;

    const syncNavLayout = () => {
      const wasOpen = !header.classList.contains("is-wide") && isPopoverOpen(navMenu);

      header.classList.add("is-measuring", "is-wide");
      navMenu.removeAttribute("popover");

      if (headerInner.scrollWidth <= headerInner.clientWidth) {
        setMenuExpanded(hamburger, false);
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
      setMenuExpanded(hamburger, e.newState === "open");
    });

    const navResizeObserver = new ResizeObserver((entries) => {
      const headerEntry = entries.find((entry) => entry.target === headerInner);
      const currentWidth = headerEntry ? headerEntry.contentRect.width : headerInner.clientWidth;

      // 折りたたみ時は横幅が広がった時だけ再計測し、レイアウトスラッシングを防ぐ
      if (header.classList.contains("is-wide") || currentWidth > lastHeaderWidth) {
        syncNavLayout();
      }
      lastHeaderWidth = currentWidth;
    });

    syncNavLayout();
    lastHeaderWidth = headerInner.clientWidth;
    navResizeObserver.observe(headerInner);
    navResizeObserver.observe(navMenu);

    return hideNavPopover;
  };

  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

  /**
   * `prefers-reduced-motion` に配慮したスムーススクロール関数を生成する。
   */
  const createSmoothScroller = () => {
    let scrollAnimationId = null;

    return (targetY, duration = SCROLL_DURATION_MS) => {
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
  };

  const TAB_KEY_NEXT_INDEX = {
    ArrowRight: (current, total) => (current + 1) % total,
    ArrowLeft: (current, total) => (current - 1 + total) % total,
    Home: () => 0,
    End: (_current, total) => total - 1,
  };

  /**
   * タブの選択状態、矢印キー移動、`hidden="until-found"`、URLハッシュ同期を初期化する。
   */
  const initTabs = () => {
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
        const resolveNextIndex = TAB_KEY_NEXT_INDEX[e.key];
        if (!resolveNextIndex) return;

        const currentIndex = tabButtons.indexOf(document.activeElement);
        if (currentIndex === -1) return;

        e.preventDefault();
        const nextTab = tabButtons[resolveNextIndex(currentIndex, tabButtons.length)];
        nextTab.focus();
        if (nextTab.dataset.target) {
          activateTab(nextTab.dataset.target);
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

    const syncTabWithHash = () => {
      if (!window.location.hash) return;
      const hashId = window.location.hash.slice(1);
      if (tabPanels.some((panel) => panel.id === hashId)) {
        activateTab(hashId, { scrollTabIntoView: false, animate: false });
      }
    };

    syncTabWithHash();
    window.addEventListener("hashchange", syncTabWithHash);

    return activateTab;
  };

  const getAbsoluteY = (el) => el.getBoundingClientRect().top + window.scrollY;

  /**
   * ページ内アンカーリンクのスムーススクロールと、タブパネル遷移時のスクロール位置補正を設定する。
   */
  const initAnchorScroll = ({ header, hideNavPopover, activateTab, smoothScrollTo }) => {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        hideNavPopover();

        const targetId = link.getAttribute("href");
        if (targetId === "#") {
          smoothScrollTo(0);
          return;
        }

        const targetElement = document.querySelector(targetId);
        if (!targetElement) return;

        const isTabPanel = targetElement.getAttribute("role") === "tabpanel";
        if (isTabPanel) {
          activateTab(targetElement.id);
        }

        const headerHeight = header ? header.offsetHeight : 0;
        // タブコンテンツの場合は、親要素である「Projects」セクションの位置にスクロールする（見切れ防止）
        const scrollTarget = isTabPanel
          ? document.getElementById("Projects") || targetElement
          : targetElement;

        smoothScrollTo(getAbsoluteY(scrollTarget) - headerHeight);
      });
    });
  };

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

  const waitForAnimations = async (element, timeoutMs) => {
    const animations = element.getAnimations({ subtree: true });
    if (animations.length === 0) return;
    await Promise.race([
      Promise.allSettled(animations.map((anim) => anim.finished)),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  };

  const closeTopLayer = async (dialog) => {
    if (!dialog || !dialog.open) return;

    if (!supportsTopLayerExit()) {
      dialog.setAttribute("data-closing", "");
      await waitForAnimations(dialog, MODAL_CLOSE_TIMEOUT_MS);
      if (!dialog.hasAttribute("data-closing")) return;
      dialog.removeAttribute("data-closing");
    }

    dialog.close();
  };

  const isOutsideDialog = (e, dialog) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };

  // Safari等 closedby 未対応ブラウザ向けのライトディスミス・フォールバック
  const attachLightDismissFallback = (dialog) => {
    if ("closedBy" in HTMLDialogElement.prototype) return;

    let pressedOutside = false;
    dialog.addEventListener("pointerdown", (e) => {
      pressedOutside = isOutsideDialog(e, dialog);
    });
    dialog.addEventListener("pointerup", (e) => {
      if (pressedOutside && isOutsideDialog(e, dialog)) {
        closeTopLayer(dialog);
      }
      pressedOutside = false;
    });
  };

  /**
   * ネイティブ `<dialog>` による画像拡大モーダルを初期化する。
   */
  const initImageModal = () => {
    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("modalImg");
    const modalCaption = document.getElementById("modalCaption");
    const modalClose = document.getElementById("modalClose");
    if (!modal || !modalImg || !modalCaption || !modalClose) return;

    document.querySelectorAll(".popup-trigger").forEach((trigger) => {
      trigger.addEventListener("click", (e) => {
        e.preventDefault();
        modalImg.src = trigger.getAttribute("href");
        modalCaption.textContent = trigger.getAttribute("data-caption") || "";
        modal.removeAttribute("data-closing");
        if (!modal.open) {
          modal.showModal();
        }
      });
    });

    modalClose.addEventListener("click", () => closeTopLayer(modal));

    // Escキーやclosedbyによるネイティブ閉じ要求時も終了アニメーションを適用
    modal.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeTopLayer(modal);
    });

    attachLightDismissFallback(modal);
  };

  /**
   * ページ先頭センチネルの交差監視により「TOPへ戻る」ボタンの表示を切り替える。
   */
  const initBackToTop = () => {
    const pageTopBtn = document.getElementById("page-top");
    if (!pageTopBtn) return;

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
  };

  /**
   * `.fade-in` 要素のビューポート進入時に表示クラスを付与する。
   */
  const initFadeInObserver = () => {
    const fadeTargets = document.querySelectorAll(".fade-in");
    if (fadeTargets.length === 0) return;

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

    fadeTargets.forEach((element) => fadeObserver.observe(element));
  };

  const header = document.querySelector("header");
  const hideNavPopover = initResponsiveNav(header);
  const activateTab = initTabs();
  const smoothScrollTo = createSmoothScroller();

  initAnchorScroll({ header, hideNavPopover, activateTab, smoothScrollTo });
  initImageModal();
  initBackToTop();
  initFadeInObserver();
})();
