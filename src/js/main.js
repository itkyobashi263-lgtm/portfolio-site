"use strict";

(() => {
  // ハンバーガーメニューとスムーススクロールの機能
  // ※ defer属性により、DOM構築完了後に自動実行されるためDOMContentLoadedは不要

  const hamburger = document.getElementById("hamburger");
  const navMenu = document.getElementById("nav-menu");

  // ハンバーガーボタンをクリックした時の処理
  hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active"); // アイコンを×にする
    navMenu.classList.toggle("active");   // メニューを表示/非表示
  });

  // イージング関数付きのカスタムスムーススクロール処理（速度調整可能）
  const smoothScrollTo = (targetY, duration) => {
    const startY = window.pageYOffset || document.documentElement.scrollTop;
    const difference = targetY - startY;
    let startTime = null;

    const step = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = currentTime - startTime;
      const percent = Math.min(progress / duration, 1);

      // イージング関数: easeInOutCubic (滑らかに加速・減速するプレミアムなイージング)
      const easeInOutCubic = (t) => {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
      };

      window.scrollTo(0, startY + difference * easeInOutCubic(percent));

      // 時間がdurationに達するまでrequestAnimationFrameでアニメーションを繰り返す
      if (progress < duration) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  };

  // ページ内のリンク（#から始まるhref）をクリックした時のスムーススクロール処理
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", function(e) {
      // もしタブボタン自体がクリックされた場合は、スムーススクロールを無効化（タブの切り替え処理のみに任せる）
      if (this.closest('.tab-links')) {
        return;
      }

      // デフォルトの瞬間的な移動をキャンセル
      e.preventDefault();

      // モバイル用メニューが開いていたら閉じる
      hamburger.classList.remove("active");
      navMenu.classList.remove("active");

      // スクロール先のIDを取得して要素を探す
      const targetId = this.getAttribute("href");

      // href="#" の場合はページ最上部へスクロール
      if (targetId === "#") {
        // 650msかけてスムースに上部へスクロール
        smoothScrollTo(0, 650);
        return;
      }

      const targetElement = document.querySelector(targetId);

      if (targetElement) {
        // もしターゲットがタブコンテンツ（#javascriptなど）だった場合、対象タブをアクティブにする
        if (targetElement.classList.contains('tab-content')) {
          // 全てのタブとコンテンツをリセット
          document.querySelectorAll('.tab-links li').forEach(li => li.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            content.style.animation = 'none';
            content.offsetHeight; /* trigger reflow */
            content.style.animation = null; 
          });

          // 対象のタブコンテンツをアクティブ化
          targetElement.classList.add('active');

          // 対応するタブボタンもアクティブ化
          const matchingTabBtn = document.querySelector(`.tab-links a[href="${targetId}"]`);
          if (matchingTabBtn) {
            matchingTabBtn.parentElement.classList.add('active');
          }
        }

        // ヘッダーの高さを動的に取得してスクロール位置を調整
        const header = document.querySelector("header");
        const headerHeight = header ? header.offsetHeight : 0;

        // 要素の絶対Y座標（ドキュメント全体からの相対位置）を取得するヘルパー
        const getAbsoluteY = (el) => el.getBoundingClientRect().top + window.pageYOffset;

        let targetY = getAbsoluteY(targetElement) - headerHeight;

        // タブコンテンツの場合は、親要素である「Projects」セクションの位置にスクロールする（見切れ防止）
        if (targetElement.classList.contains('tab-content')) {
          const projectsSection = document.getElementById('Projects');
          if (projectsSection) {
            targetY = getAbsoluteY(projectsSection) - headerHeight;
          }
        }

        // 650msかけてスムースに指定位置へスクロール
        smoothScrollTo(targetY, 650);
      }
    });
  });

  // Image Popup Modal Lightbox Functionality
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImg");
  const modalCaption = document.getElementById("modalCaption");
  const modalClose = document.getElementById("modalClose");

  // Open modal
  const openModal = (src, caption) => {
    modalImg.src = src;
    modalCaption.textContent = caption;
    modal.style.display = "flex";
    // Force a browser reflow to trigger CSS opacity transition
    modal.offsetHeight; 
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden"; // Prevent background scrolling
  };

  // Close modal
  const closeModal = () => {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = ""; // Restore background scrolling
    // Hide modal element from layout after CSS transition finishes
    setTimeout(() => {
      if (!modal.classList.contains("show")) {
        modal.style.display = "none";
      }
    }, 300); // Matches the 0.3s transition duration
  };

  // Attach click event to triggers
  document.querySelectorAll(".popup-trigger").forEach(trigger => {
    trigger.addEventListener("click", function(e) {
      e.preventDefault(); // Prevent default link navigation
      const imgSrc = this.getAttribute("href");
      const captionText = this.getAttribute("data-caption") || "";
      openModal(imgSrc, captionText);
    });
  });

  // Close modal when close button is clicked
  modalClose.addEventListener("click", closeModal);

  // Close modal when clicking outside the image content
  modal.addEventListener("click", function(e) {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Close modal when Escape key is pressed
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("show")) {
      closeModal();
    }
  });

  // 「Topに戻る」ボタンのスクロール時表示・非表示制御
  const pageTopBtn = document.getElementById("page-top");
  if (pageTopBtn) {
    window.addEventListener("scroll", () => {
      // 300px以上スクロールされたらボタンを表示
      if (window.pageYOffset > 300) {
        pageTopBtn.classList.add("show");
      } else {
        pageTopBtn.classList.remove("show");
      }
    });
  }

  // ==========================================
  // Modern Enhancements: Tabs & Scroll Animation
  // ==========================================

  // --- Intersection Observer for Fade-in ---
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const fadeObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Uncomment the line below if you only want the animation to play once
        // observer.unobserve(entry.target); 
      }
    });
  }, observerOptions);

  document.querySelectorAll('.fade-in').forEach(element => {
    fadeObserver.observe(element);
  });

  // --- Tab Switching Logic ---
  const tabLinks = document.querySelectorAll('.tab-links a');
  const tabContents = document.querySelectorAll('.tab-content');

  tabLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopImmediatePropagation(); // Prevent smooth scroll logic from firing

      // Remove active class from all links and contents
      document.querySelectorAll('.tab-links li').forEach(li => li.classList.remove('active'));
      tabContents.forEach(content => {
        content.classList.remove('active');
        // Reset animation by removing and re-adding style if needed
        content.style.animation = 'none';
        content.offsetHeight; /* trigger reflow */
        content.style.animation = null; 
      });

      // Add active class to clicked link's parent <li>
      this.parentElement.classList.add('active');

      // Add active class to corresponding tab content
      const targetId = this.getAttribute('href');
      const targetContent = document.querySelector(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });

})();
