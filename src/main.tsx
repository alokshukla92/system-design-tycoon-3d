import { createRoot } from "react-dom/client";
import "@fontsource-variable/jetbrains-mono";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/topbar.css";
import "./styles/sidebar.css";
import "./styles/sheet.css";
import "./styles/diagram.css";
import "./styles/rail.css";
import "./styles/chrome.css";
import "./styles/credit.css";
import "./styles/site.css";
import "./styles/responsive.css";
import "./styles/lab.css";
import { configureMetricFormat } from "./content/registries";
import { setEngineLocale } from "./engine/locale";
import { getLocale, isRtl, loadLocale, localeFromPath, t } from "./i18n";
import { App } from "./app/App";

// Original fg(): the page's locale comes from its path prefix (/es/…); load that dictionary, then render.
// index.html marks localized pages `data-lang-pending` until then.
loadLocale(localeFromPath(location.pathname))
  .catch((err) => {
    console.warn("[i18n] could not load the translation", err);
    return loadLocale("en");
  })
  .then(() => {
    configureMetricFormat({ locale: getLocale(), t });
    setEngineLocale({ lang: getLocale, rtl: isRtl, t: (s) => t(s) });
    document.documentElement.removeAttribute("data-lang-pending");
    createRoot(document.getElementById("app")!).render(<App />);
  });
