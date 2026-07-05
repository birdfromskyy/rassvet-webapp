import { useEffect, useState } from "react";
import "./AccessibilityPanel.scss";

function AccessibilityPanel() {
  const [enabled, setEnabled] = useState(
    localStorage.getItem("accessibility") === "on",
  );
  
  const [isHidden, setIsHidden] = useState(false);

  const [theme, setTheme] = useState(
    localStorage.getItem("accessibilityTheme") || "light",
  );

  const [fontSize, setFontSize] = useState(
    localStorage.getItem("accessibilityFont") || "medium",
  );

  const [spacing, setSpacing] = useState(
    localStorage.getItem("accessibilitySpacing") || "normal",
  );

  const [images, setImages] = useState(
    localStorage.getItem("accessibilityImages") !== "off",
  );

  const [sound, setSound] = useState(
    localStorage.getItem("accessibilitySound") === "on",
  );

  useEffect(() => {
    document.body.classList.toggle("accessibility-mode", enabled);

    document.body.dataset.accessibilityTheme = theme;
    document.body.dataset.accessibilityFont = fontSize;
    document.body.dataset.accessibilitySpacing = spacing;
    document.body.dataset.accessibilityImages = images ? "on" : "off";
    document.body.dataset.accessibilitySound = sound ? "on" : "off";

    localStorage.setItem("accessibility", enabled ? "on" : "off");
    localStorage.setItem("accessibilityTheme", theme);
    localStorage.setItem("accessibilityFont", fontSize);
    localStorage.setItem("accessibilitySpacing", spacing);
    localStorage.setItem("accessibilityImages", images ? "on" : "off");
    localStorage.setItem("accessibilitySound", sound ? "on" : "off");

    if (!enabled || !sound) {
      // speechSynthesis is absent on some Android browsers / WebViews —
      // guard so this doesn't throw on every page load (see /main crash).
      window.speechSynthesis?.cancel();
    }
  }, [enabled, theme, fontSize, spacing, images, sound]);

  useEffect(() => {
    if (!enabled || !sound) return;
    // No Web Speech API on this browser → skip TTS entirely.
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      return;
    }

    let lastText = "";

    const speakElement = (event) => {
      const target = event.target;

      if (
        target.closest(".accessibility-panel") ||
        target.closest("svg") ||
        target.closest("img")
      ) {
        return;
      }
      const readableElement = target.closest(
        "h1, h2, h3, h4, h5, h6, p, a, button, label, li, span, strong, input, textarea, select",
      );

      if (!readableElement) return;

      let text = "";

      if (
        readableElement.tagName === "INPUT" ||
        readableElement.tagName === "TEXTAREA"
      ) {
        text =
          readableElement.getAttribute("aria-label") ||
          readableElement.getAttribute("placeholder") ||
          readableElement.previousElementSibling?.innerText ||
          "";
      } else if (readableElement.tagName === "SELECT") {
        text =
          readableElement.previousElementSibling?.innerText ||
          "Выпадающий список";
      } else {
        text = readableElement.innerText || readableElement.textContent || "";
      }

      text = text.trim().replace(/\s+/g, " ");

      if (!text || text.length < 2 || text === lastText) return;

      lastText = text;

      window.speechSynthesis?.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ru-RU";
      utterance.rate = 0.9;

      window.speechSynthesis.speak(utterance);
    };

    document.addEventListener("mouseover", speakElement);

    return () => {
      document.removeEventListener("mouseover", speakElement);
      window.speechSynthesis?.cancel();
    };
  }, [enabled, sound]);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 10) {
        setIsHidden(false);
      } else if (currentScrollY > lastScrollY) {
        setIsHidden(true);
      } else {
        setIsHidden(false);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  if (!enabled) return null;

  return (
<div className={`accessibility-panel ${isHidden ? "accessibility-panel--hidden" : ""}`}>      <div className="accessibility-panel__inner">
        <strong>Версия для слабовидящих</strong>

        <div className="accessibility-panel__group">
          <span>Шрифт:</span>
          <button onClick={() => setFontSize("small")}>A</button>
          <button onClick={() => setFontSize("medium")}>A+</button>
          <button onClick={() => setFontSize("large")}>A++</button>
        </div>

        <div className="accessibility-panel__group">
          <span>Цвет:</span>
          <button onClick={() => setTheme("light")}>Белый</button>
          <button onClick={() => setTheme("dark")}>Чёрный</button>
          <button onClick={() => setTheme("blue")}>Синий</button>
        </div>

        <div className="accessibility-panel__group">
          <span>Интервал:</span>
          <button onClick={() => setSpacing("normal")}>Обычный</button>
          <button onClick={() => setSpacing("large")}>Большой</button>
        </div>

        <div className="accessibility-panel__group">
          <span>Изображения:</span>
          <button onClick={() => setImages(true)}>Вкл</button>
          <button onClick={() => setImages(false)}>Выкл</button>
        </div>

        <div className="accessibility-panel__group">
          <span>Звук:</span>
          <button onClick={() => setSound(true)}>Вкл</button>
          <button onClick={() => setSound(false)}>Выкл</button>
        </div>

        <button
          className="accessibility-panel__close"
          onClick={() => setEnabled(false)}
        >
          Обычная версия
        </button>
      </div>
    </div>
  );
}

export default AccessibilityPanel;
