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
import "./styles/site.css";
import "./styles/responsive.css";
import "./styles/lab.css";
import { configureMetricFormat } from "./content/registries";
import { setEngineLocale } from "./engine/locale";
import { getLocale, isRtl, setLocale, t } from "./i18n";
import { App } from "./app/App";

setLocale("en");
configureMetricFormat({ locale: getLocale(), t });
setEngineLocale({ lang: getLocale, rtl: isRtl, t: (s) => t(s) });

createRoot(document.getElementById("app")!).render(<App />);
