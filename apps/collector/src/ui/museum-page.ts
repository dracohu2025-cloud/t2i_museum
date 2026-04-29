export function renderMuseumPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>t2i_museum</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        --bg: #07111b;
        --bg-soft: #102233;
        --panel: rgba(8, 20, 33, 0.78);
        --panel-strong: rgba(10, 25, 41, 0.92);
        --line: rgba(235, 200, 139, 0.22);
        --line-strong: rgba(235, 200, 139, 0.42);
        --text: #edf2f7;
        --muted: #9fb0c3;
        --accent: #ebc88b;
        --accent-soft: rgba(235, 200, 139, 0.14);
        --shadow: 0 18px 50px rgba(0, 0, 0, 0.38);
        --radius-xl: 28px;
        --radius-lg: 22px;
        --radius-md: 16px;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "IBM Plex Sans", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(34, 111, 194, 0.18), transparent 32%),
          radial-gradient(circle at top right, rgba(235, 200, 139, 0.12), transparent 28%),
          linear-gradient(180deg, #08111b 0%, #050a11 100%);
        min-height: 100vh;
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        background-image:
          linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
        background-size: 48px 48px;
        mask-image: radial-gradient(circle at center, black, transparent 82%);
        pointer-events: none;
        opacity: 0.32;
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      .shell {
        width: min(1320px, calc(100vw - 40px));
        margin: 24px auto 64px;
      }

      .masthead {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(420px, 0.95fr);
        gap: 20px;
        align-items: center;
        border: 1px solid var(--line);
        border-radius: 28px;
        padding: 22px 28px;
        background:
          linear-gradient(135deg, rgba(11, 25, 42, 0.94), rgba(8, 17, 28, 0.9)),
          radial-gradient(circle at top right, rgba(235, 200, 139, 0.18), transparent 32%);
        box-shadow: var(--shadow);
      }

      .masthead::after {
        content: "";
        position: absolute;
        inset: auto -10% -34% 58%;
        height: 150px;
        background: radial-gradient(circle, rgba(63, 133, 212, 0.22), transparent 70%);
        transform: rotate(-8deg);
        pointer-events: none;
      }

      .masthead-copy {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 12px;
        min-width: 0;
      }

      .masthead-copy-main {
        display: grid;
        gap: 10px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 7px 14px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .title {
        margin: 0;
        font-family: "Cormorant Garamond", serif;
        font-size: clamp(40px, 4.6vw, 72px);
        line-height: 0.9;
        letter-spacing: -0.03em;
        font-weight: 600;
      }

      .title-link {
        display: inline-block;
        color: inherit;
        text-decoration: none;
        transition: opacity 180ms ease, transform 180ms ease;
      }

      .title-link:hover {
        opacity: 0.92;
        transform: translateY(-1px);
      }

      .title-link[data-active="true"] {
        cursor: default;
        pointer-events: none;
      }

      .lede {
        width: min(680px, 100%);
        margin: 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.65;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 0;
        position: relative;
        z-index: 1;
      }

      .stat {
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        backdrop-filter: blur(12px);
        min-height: 94px;
        display: grid;
        align-content: center;
      }

      .stat-label {
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .stat-value {
        margin-top: 8px;
        font-size: 24px;
        font-weight: 600;
      }

      .layout {
        display: grid;
        grid-template-columns: 300px minmax(0, 1fr);
        gap: 20px;
        margin-top: 22px;
      }

      .sidebar,
      .content-panel,
      .style-hero,
      .empty {
        border-radius: var(--radius-xl);
        border: 1px solid var(--line);
        background: var(--panel);
        backdrop-filter: blur(14px);
        box-shadow: var(--shadow);
      }

      .sidebar {
        padding: 22px;
        align-self: start;
        position: sticky;
        top: 20px;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 16px;
        max-height: calc(100vh - 40px);
        overflow: hidden;
      }

      .sidebar h2,
      .content-head h2 {
        margin: 0;
        font-family: "Cormorant Garamond", serif;
        font-size: 34px;
        font-weight: 600;
      }

      .sidebar p,
      .content-head p,
      .style-meta p,
      .work-meta {
        color: var(--muted);
        line-height: 1.7;
        font-size: 14px;
      }

      .sidebar-head {
        display: grid;
        gap: 14px;
      }

      .style-shelf-tools {
        display: grid;
        gap: 10px;
      }

      .style-filter {
        display: grid;
        gap: 8px;
      }

      .style-filter span {
        color: var(--muted);
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .style-filter select {
        width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.04);
        color: var(--text);
        padding: 12px 14px;
        font: inherit;
      }

      .style-search {
        display: grid;
        gap: 8px;
      }

      .style-search span {
        color: var(--muted);
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .style-search input {
        width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.04);
        color: var(--text);
        padding: 12px 14px;
        font: inherit;
      }

      .style-search input::placeholder {
        color: rgba(159, 176, 195, 0.72);
      }

      .style-shelf-count {
        color: var(--muted);
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .style-list {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 0;
        min-height: 0;
        overflow: auto;
        padding-right: 6px;
        align-content: start;
        align-items: flex-start;
        overscroll-behavior: contain;
      }

      .style-list::-webkit-scrollbar {
        width: 8px;
      }

      .style-list::-webkit-scrollbar-track {
        background: transparent;
      }

      .style-list::-webkit-scrollbar-thumb {
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
      }

      .style-pill {
        display: inline-flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid transparent;
        background: rgba(255, 255, 255, 0.03);
        transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
        max-width: 100%;
      }

      .style-pill:hover,
      .style-pill[data-active="true"] {
        transform: translateY(-1px);
        border-color: var(--line-strong);
        background: var(--accent-soft);
      }

      .style-pill strong {
        font-size: 14px;
        line-height: 1.25;
      }

      .style-pill small {
        color: var(--muted);
        font-size: 11px;
      }

      .style-list-empty {
        padding: 14px 4px 4px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.7;
      }

      .content-panel {
        padding: 22px;
      }

      .content-head {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 16px;
        margin-bottom: 18px;
      }

      .gallery {
        column-count: 3;
        column-gap: 18px;
      }

      .work-card {
        break-inside: avoid;
        margin: 0 0 18px;
        border-radius: 24px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: var(--panel-strong);
      }

      .work-card img {
        width: 100%;
        display: block;
        background: #0d1722;
      }

      .work-body {
        padding: 16px;
      }

      .style-hero-title {
        margin: 0;
        font-family: "Cormorant Garamond", serif;
        font-weight: 600;
      }

      .tag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }

      .tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 12px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        font-size: 12px;
      }

      .tag[data-primary="true"] {
        border-color: var(--line-strong);
        background: var(--accent-soft);
      }

      .style-hero {
        position: relative;
        min-height: 420px;
        overflow: hidden;
        display: grid;
        align-items: end;
      }

      .style-hero img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        filter: saturate(1.08) contrast(1.02);
      }

      .style-hero::after {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(180deg, rgba(4, 10, 18, 0.18), rgba(4, 10, 18, 0.92)),
          linear-gradient(90deg, rgba(4, 10, 18, 0.72), rgba(4, 10, 18, 0.22));
      }

      .style-meta {
        position: relative;
        z-index: 1;
        padding: 28px;
      }

      .style-hero-title {
        font-size: clamp(42px, 6vw, 76px);
        line-height: 0.94;
        margin-bottom: 14px;
      }

      .floating-style-title {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 50;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 30px;
        max-width: min(240px, calc(100vw - 40px));
        padding: 0 14px;
        border: 1px solid rgba(235, 200, 139, 0.2);
        border-radius: 999px;
        background: rgba(7, 17, 27, 0.98);
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
        color: var(--text);
        font-family: "IBM Plex Sans", sans-serif;
        font-size: 14px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        pointer-events: none;
        opacity: 0;
        transform: translateY(-8px);
        transition: opacity 160ms ease, transform 160ms ease;
      }

      .floating-style-title[data-visible="true"] {
        opacity: 1;
        transform: translateY(0);
      }

      .style-copy {
        width: min(760px, 100%);
      }

      .style-lineage-card {
        margin-top: 18px;
        padding: 18px 20px;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(6, 14, 24, 0.38);
        backdrop-filter: blur(10px);
      }

      .style-lineage-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .style-lineage-section {
        display: grid;
        align-content: start;
        gap: 10px;
        min-width: 0;
      }

      .style-lineage-label {
        color: rgba(255, 255, 255, 0.72);
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .style-lineage-card p {
        margin: 0;
        color: rgba(237, 242, 247, 0.9);
        font-size: 13px;
        line-height: 1.7;
      }

      .style-lineage-card p + p {
        margin-top: 10px;
      }

      .style-work-grid {
        margin-top: 20px;
      }

      .hero-admin-trigger {
        position: absolute;
        right: 22px;
        bottom: 22px;
        z-index: 2;
        width: 54px;
        height: 54px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(8, 20, 33, 0.56);
        color: rgba(255, 255, 255, 0.88);
        backdrop-filter: blur(14px);
        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.28);
        cursor: pointer;
        transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
      }

      .hero-admin-trigger:hover {
        transform: translateY(-2px);
        border-color: var(--line-strong);
        background: rgba(16, 34, 51, 0.82);
      }

      .hero-admin-trigger svg {
        width: 22px;
        height: 22px;
      }

      .work-link {
        display: block;
        color: inherit;
      }

      .detail-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
        gap: 20px;
      }

      .detail-card {
        padding: 22px;
      }

      .detail-info-card {
        position: relative;
      }

      .detail-card h2,
      .detail-card h3 {
        margin: 0 0 10px;
        font-family: "Cormorant Garamond", serif;
        font-size: 34px;
        font-weight: 600;
      }

      .detail-image-frame {
        overflow: hidden;
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: #0d1722;
      }

      .detail-image-frame img {
        width: 100%;
        display: block;
      }

      .meta-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 18px;
      }

      .meta-item {
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .meta-item strong {
        display: block;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
        margin-bottom: 8px;
      }

      .prompt-block {
        margin-top: 18px;
        padding: 16px 18px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
        color: #d7e2ed;
        line-height: 1.8;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .related-head {
        margin-top: 20px;
      }

      .detail-utility-row {
        margin-top: 14px;
        display: flex;
        justify-content: flex-end;
      }

      .work-delete-trigger {
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        border: 1px solid rgba(255, 133, 133, 0.18);
        background: rgba(255, 255, 255, 0.03);
        color: rgba(255, 160, 160, 0.42);
        cursor: pointer;
        opacity: 0.34;
        transition: opacity 180ms ease, transform 180ms ease, border-color 180ms ease, background 180ms ease;
      }

      .work-delete-trigger:hover,
      .work-delete-trigger:focus-visible {
        opacity: 1;
        transform: translateY(-1px);
        border-color: rgba(255, 133, 133, 0.52);
        background: rgba(255, 106, 106, 0.12);
        color: rgba(255, 218, 218, 0.94);
      }

      .work-delete-trigger svg {
        width: 16px;
        height: 16px;
      }

      .style-edit-overlay {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(3, 8, 14, 0.66);
        backdrop-filter: blur(10px);
      }

      .style-edit-panel {
        width: min(1180px, 94vw);
        max-height: 86vh;
        overflow: auto;
        border-radius: 24px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        background:
          radial-gradient(circle at top right, rgba(34, 211, 238, 0.12), transparent 28%),
          linear-gradient(180deg, rgba(7, 18, 30, 0.98), rgba(5, 14, 24, 0.97));
        box-shadow: 0 26px 80px rgba(0, 0, 0, 0.48);
        padding: 24px;
      }

      .style-edit-head h3 {
        margin: 0 0 10px;
        font-family: "Cormorant Garamond", serif;
        font-size: 36px;
        font-weight: 700;
      }

      .style-edit-head p {
        margin: 0 0 18px;
        color: var(--muted);
        line-height: 1.7;
      }

      .style-edit-grid {
        display: grid;
        grid-template-columns: minmax(300px, 0.82fr) minmax(420px, 1.18fr);
        gap: 16px;
        align-items: start;
      }

      .style-edit-prompt,
      .style-edit-row {
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 16px;
        background: rgba(2, 6, 23, 0.58);
      }

      .style-edit-prompt {
        max-height: 54vh;
        overflow: auto;
        padding: 14px;
      }

      .style-edit-label {
        margin-bottom: 10px;
        color: var(--accent);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .style-edit-prompt-text {
        white-space: pre-wrap;
        word-break: break-word;
        color: #d7e2ed;
        font-size: 14px;
        line-height: 1.75;
      }

      .narrative-loading {
        position: relative;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.04);
        border-radius: 8px;
        color: transparent !important;
        user-select: none;
        pointer-events: none;
      }

      .narrative-loading::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.06) 40%,
          rgba(255, 255, 255, 0.1) 50%,
          rgba(255, 255, 255, 0.06) 60%,
          transparent 100%
        );
        transform: translateX(-100%);
        animation: narrative-shimmer 2s ease-in-out infinite;
      }

      @keyframes narrative-shimmer {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }

      .narrative-loading-label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .narrative-loading-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--accent);
        animation: narrative-dot-pulse 1.2s ease-in-out infinite;
      }

      .narrative-loading-dot:nth-child(2) {
        animation-delay: 0.2s;
      }

      .narrative-loading-dot:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes narrative-dot-pulse {
        0%, 60%, 100% {
          opacity: 0.3;
          transform: scale(0.75);
        }
        30% {
          opacity: 1;
          transform: scale(1.15);
        }
      }

      .style-edit-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .style-edit-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 150px auto;
        gap: 10px;
        align-items: center;
        padding: 12px;
      }

      .style-edit-field label {
        display: block;
        margin-bottom: 6px;
        color: var(--accent);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
      }

      .style-edit-field input,
      .style-edit-row select {
        width: 100%;
        height: 38px;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: rgba(2, 6, 23, 0.72);
        color: var(--text);
        font: inherit;
      }

      .style-edit-field input {
        padding: 0 12px;
      }

      .style-edit-row select {
        padding: 0 10px;
      }

      .style-edit-meta {
        margin-top: 6px;
        color: var(--muted);
        font-size: 12px;
      }

      .style-edit-actions {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-top: 18px;
      }

      .style-edit-actions-right {
        display: flex;
        gap: 10px;
      }

      .admin-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
        gap: 20px;
      }

      .admin-drawer {
        position: fixed;
        inset: 0;
        z-index: 30;
        display: none;
        align-items: stretch;
        justify-content: flex-end;
      }

      .admin-drawer[data-open="true"] {
        display: flex;
      }

      .admin-backdrop {
        position: absolute;
        inset: 0;
        border: 0;
        padding: 0;
        margin: 0;
        background: rgba(3, 8, 14, 0.58);
        backdrop-filter: blur(6px);
        cursor: pointer;
      }

      .admin-sheet {
        position: relative;
        z-index: 1;
        width: min(980px, calc(100vw - 32px));
        max-height: calc(100vh - 32px);
        margin: 16px;
        padding: 24px;
        overflow: auto;
        border-radius: 28px;
        background:
          linear-gradient(180deg, rgba(7, 18, 30, 0.98), rgba(5, 14, 24, 0.96)),
          radial-gradient(circle at top right, rgba(235, 200, 139, 0.08), transparent 24%);
      }

      .admin-sheet-head {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: start;
        margin-bottom: 20px;
      }

      .admin-sheet-head h3 {
        margin: 10px 0 8px;
        font-family: "Cormorant Garamond", serif;
        font-size: 38px;
        font-weight: 600;
      }

      .admin-sheet-head p {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.7;
      }

      .admin-close {
        width: 42px;
        height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.04);
        color: var(--text);
        font: inherit;
        cursor: pointer;
      }

      .admin-panel {
        padding: 22px;
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
      }

      .admin-panel h3 {
        margin: 0 0 8px;
        font-family: "Cormorant Garamond", serif;
        font-size: 32px;
        font-weight: 600;
      }

      .admin-panel p {
        margin: 0 0 16px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.7;
      }

      .admin-form,
      .admin-stack {
        display: grid;
        gap: 14px;
      }

      .field {
        display: grid;
        gap: 8px;
      }

      .field label {
        font-size: 12px;
        letter-spacing: 0.08em;
        color: var(--muted);
        text-transform: uppercase;
      }

      .field input,
      .field textarea,
      .field select {
        width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.04);
        color: var(--text);
        padding: 13px 14px;
        font: inherit;
      }

      .field textarea {
        min-height: 118px;
        resize: vertical;
      }

      .button-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }

      .action-button {
        appearance: none;
        border: 1px solid var(--line-strong);
        border-radius: 999px;
        padding: 11px 16px;
        background: var(--accent-soft);
        color: var(--text);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      .action-button[data-variant="ghost"] {
        border-color: rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
      }

      .action-button[data-variant="danger"] {
        border-color: rgba(255, 133, 133, 0.5);
        background: rgba(255, 106, 106, 0.14);
      }

      .masthead-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        margin-top: 4px;
      }

      .anki-entry-button {
        position: relative;
        isolation: isolate;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-height: 46px;
        padding: 0 18px;
        border: 1px solid rgba(235, 200, 139, 0.48);
        border-radius: 999px;
        background:
          linear-gradient(135deg, rgba(235, 200, 139, 0.22), rgba(56, 189, 248, 0.12)),
          rgba(255, 255, 255, 0.04);
        color: var(--text);
        font: inherit;
        font-weight: 800;
        letter-spacing: 0.04em;
        cursor: pointer;
        box-shadow: 0 16px 38px rgba(0, 0, 0, 0.28);
        overflow: hidden;
        transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
      }

      .anki-entry-button::before {
        content: "";
        width: 18px;
        height: 18px;
        border-radius: 6px;
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(235, 200, 139, 0.45)),
          linear-gradient(180deg, transparent 44%, rgba(7, 17, 27, 0.5) 46%, transparent 52%);
        box-shadow: 0 6px 16px rgba(235, 200, 139, 0.22);
        transform: rotate(-8deg);
      }

      .anki-entry-button:hover,
      .anki-entry-button:focus-visible {
        transform: translateY(-2px);
        border-color: rgba(235, 200, 139, 0.8);
        box-shadow: 0 22px 48px rgba(0, 0, 0, 0.34), 0 0 34px rgba(235, 200, 139, 0.16);
        outline: none;
      }

      .anki-practice-overlay {
        position: fixed;
        inset: 0;
        z-index: 120;
        display: grid;
        place-items: center;
        padding: 28px;
        background:
          radial-gradient(circle at 28% 16%, rgba(56, 189, 248, 0.16), transparent 34%),
          radial-gradient(circle at 82% 78%, rgba(235, 200, 139, 0.16), transparent 34%),
          rgba(3, 7, 12, 0.82);
        backdrop-filter: blur(18px);
        perspective: 1600px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 220ms ease;
      }

      .anki-practice-overlay[data-open="true"] {
        opacity: 1;
        pointer-events: auto;
      }

      .anki-stage {
        width: min(1120px, 100%);
        max-height: min(860px, calc(100vh - 48px));
        display: grid;
        grid-template-columns: minmax(320px, 0.95fr) minmax(340px, 0.8fr);
        gap: 22px;
        align-items: stretch;
        animation: ankiStageIn 360ms cubic-bezier(.2,.8,.2,1) both;
      }

      .anki-card-shell {
        min-height: 560px;
        transform-style: preserve-3d;
        transform: rotateX(4deg) rotateY(-7deg) translateZ(0);
        transition: transform 260ms ease;
      }

      .anki-card-shell:hover {
        transform: rotateX(2deg) rotateY(-3deg) translateY(-2px);
      }

      .anki-card-inner {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 560px;
        transform-style: preserve-3d;
        transition: transform 560ms cubic-bezier(.2,.8,.2,1);
      }

      .anki-card-shell[data-answered="true"] .anki-card-inner {
        transform: rotateY(180deg);
      }

      .anki-card-face {
        position: absolute;
        inset: 0;
        overflow: hidden;
        border: 1px solid rgba(235, 200, 139, 0.28);
        border-radius: 34px;
        background: rgba(7, 17, 27, 0.96);
        box-shadow: 0 34px 88px rgba(0, 0, 0, 0.56);
        backface-visibility: hidden;
      }

      .anki-card-face img {
        width: 100%;
        height: 100%;
        min-height: 560px;
        object-fit: cover;
        display: block;
        filter: saturate(1.08) contrast(1.04);
      }

      .anki-card-face::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(4, 10, 18, 0.02), rgba(4, 10, 18, 0.78));
      }

      .anki-card-caption {
        position: absolute;
        left: 22px;
        right: 22px;
        bottom: 20px;
        z-index: 1;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: end;
      }

      .anki-card-caption strong {
        font-family: "Cormorant Garamond", serif;
        font-size: clamp(34px, 4vw, 56px);
        line-height: 0.9;
      }

      .anki-card-back {
        display: grid;
        place-items: center;
        padding: 34px;
        transform: rotateY(180deg);
        text-align: center;
      }

      .anki-card-back h3 {
        margin: 0;
        font-family: "Cormorant Garamond", serif;
        font-size: clamp(42px, 5vw, 72px);
        line-height: 0.9;
      }

      .anki-card-back p {
        margin: 16px auto 0;
        max-width: 520px;
        color: var(--muted);
        line-height: 1.7;
      }

      .anki-panel {
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 30px;
        background:
          linear-gradient(180deg, rgba(10, 25, 41, 0.94), rgba(6, 14, 24, 0.96)),
          rgba(255, 255, 255, 0.04);
        box-shadow: var(--shadow);
        padding: 24px;
        display: grid;
        align-content: start;
        gap: 18px;
      }

      .anki-panel-head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: start;
      }

      .anki-panel h2 {
        margin: 6px 0 0;
        font-family: "Cormorant Garamond", serif;
        font-size: clamp(38px, 4vw, 58px);
        line-height: 0.92;
      }

      .anki-close-button {
        width: 38px;
        height: 38px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.04);
        color: var(--text);
        cursor: pointer;
      }

      .anki-score-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .anki-score-row article {
        padding: 12px;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
      }

      .anki-score-row span {
        display: block;
        color: var(--muted);
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .anki-score-row strong {
        display: block;
        margin-top: 6px;
        font-size: 22px;
      }

      .anki-option-list {
        display: grid;
        gap: 10px;
      }

      .anki-option {
        width: 100%;
        min-height: 52px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.045);
        color: var(--text);
        font: inherit;
        font-weight: 700;
        text-align: left;
        padding: 14px 16px;
        cursor: pointer;
        transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
      }

      .anki-option:hover:not(:disabled),
      .anki-option:focus-visible {
        transform: translateY(-1px);
        border-color: rgba(235, 200, 139, 0.56);
        background: rgba(235, 200, 139, 0.12);
        outline: none;
      }

      .anki-option[data-result="correct"] {
        border-color: rgba(74, 222, 128, 0.7);
        background: rgba(34, 197, 94, 0.16);
      }

      .anki-option[data-result="wrong"] {
        border-color: rgba(248, 113, 113, 0.7);
        background: rgba(239, 68, 68, 0.15);
      }

      .anki-feedback {
        min-height: 58px;
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
        color: var(--muted);
        line-height: 1.6;
      }

      .anki-feedback[data-kind="correct"] {
        color: #bbf7d0;
        border-color: rgba(74, 222, 128, 0.42);
      }

      .anki-feedback[data-kind="wrong"] {
        color: #fecaca;
        border-color: rgba(248, 113, 113, 0.42);
      }

      .anki-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .anki-empty {
        width: min(620px, 100%);
        padding: 34px;
        border-radius: 30px;
        border: 1px solid var(--line);
        background: var(--panel-strong);
        box-shadow: var(--shadow);
        text-align: center;
      }

      @keyframes ankiStageIn {
        from {
          opacity: 0;
          transform: translateY(26px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .anki-stage,
        .anki-card-inner,
        .anki-entry-button,
        .anki-option {
          animation: none;
          transition: none;
        }

        .anki-card-shell,
        .anki-card-shell:hover,
        .anki-card-shell[data-answered="true"] .anki-card-inner {
          transform: none;
        }
      }

      .alias-cloud {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .alias-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 12px;
      }

      .alias-chip small,
      .flash small {
        color: var(--muted);
      }

      .flash {
        margin-bottom: 14px;
        padding: 12px 14px;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        color: var(--text);
      }

      .flash[data-kind="success"] {
        border-color: rgba(126, 211, 146, 0.34);
        background: rgba(126, 211, 146, 0.12);
      }

      .flash[data-kind="error"] {
        border-color: rgba(255, 133, 133, 0.36);
        background: rgba(255, 106, 106, 0.12);
      }

      .empty {
        padding: 42px;
        text-align: center;
      }

      .loading {
        color: var(--muted);
        padding: 30px 0;
      }

      @media (max-width: 1080px) {
        .masthead {
          grid-template-columns: 1fr;
        }

        .layout {
          grid-template-columns: 1fr;
        }

        .admin-grid {
          grid-template-columns: 1fr;
        }

        .sidebar {
          position: static;
          max-height: none;
        }

        .gallery {
          column-count: 2;
        }

        .detail-grid {
          grid-template-columns: 1fr;
        }

        .style-edit-grid {
          grid-template-columns: 1fr;
        }

        .style-list {
          max-height: min(52vh, 520px);
        }

        .anki-stage {
          grid-template-columns: 1fr;
          max-height: calc(100vh - 32px);
          overflow: auto;
        }

        .anki-card-shell,
        .anki-card-inner,
        .anki-card-face img {
          min-height: 420px;
        }
      }

      @media (max-width: 720px) {
        .shell {
          width: min(100vw - 20px, 100%);
          margin-top: 10px;
        }

        .masthead,
        .sidebar,
        .content-panel,
        .style-hero,
        .empty {
          border-radius: 24px;
        }

        .masthead,
        .content-panel,
        .sidebar,
        .style-meta {
          padding: 18px;
        }

        .floating-style-title {
          left: auto !important;
          right: 10px;
          top: 10px;
        }

        .masthead-copy {
          gap: 10px;
        }

        .masthead-copy-main {
          gap: 8px;
        }

        .stats {
          grid-template-columns: 1fr;
        }

        .style-lineage-grid {
          grid-template-columns: 1fr;
        }

        .gallery {
          column-count: 1;
        }

        .hero-admin-trigger {
          right: 16px;
          bottom: 16px;
        }

        .admin-sheet {
          width: calc(100vw - 16px);
          max-height: calc(100vh - 16px);
          margin: 8px;
          padding: 18px;
          border-radius: 24px;
        }

        .admin-sheet-head {
          flex-direction: column;
          align-items: stretch;
        }

        .meta-grid {
          grid-template-columns: 1fr;
        }

        .style-edit-panel {
          padding: 18px;
        }

        .style-edit-row {
          grid-template-columns: 1fr;
        }

        .style-list {
          max-height: 44vh;
        }

        .anki-practice-overlay {
          padding: 12px;
        }

        .anki-stage {
          gap: 12px;
        }

        .anki-panel {
          padding: 18px;
          border-radius: 24px;
        }

        .anki-score-row {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="masthead">
        <div class="masthead-copy">
          <div class="eyebrow">Local-first Style Atlas</div>
          <div class="masthead-copy-main">
            <h1 class="title">
              <a class="title-link" id="museum-home-link" href="/museum" data-active="true" aria-current="page">Graphics Academy</a>
            </h1>
            <p class="lede">
              收集即梦图片样例，自动抽取绘画风格词，并把图片、风格、含义串成一个可学习和浏览的本地视觉库。
            </p>
            <div class="masthead-actions">
              <button class="anki-entry-button" id="anki-start-button" type="button">Anki 风格测试</button>
            </div>
          </div>
        </div>
        <div class="stats" id="stats"></div>
      </section>

      <section class="layout">
        <aside class="sidebar">
          <div class="sidebar-head">
            <h2>Style Shelf</h2>
            <div class="style-shelf-tools">
              <label class="style-search" for="style-shelf-query">
                <span>Search Styles</span>
                <input id="style-shelf-query" type="search" placeholder="搜索风格名" autocomplete="off" />
              </label>
              <label class="style-filter" for="style-shelf-filter">
                <span>Filter By Type</span>
                <select id="style-shelf-filter"></select>
              </label>
              <div class="style-shelf-count" id="style-shelf-count"></div>
            </div>
          </div>
          <div class="style-list" id="style-list"></div>
        </aside>

        <section id="content"></section>
      </section>
    </main>
    <section class="anki-practice-overlay" id="anki-practice-overlay" data-open="false" aria-hidden="true"></section>

    <script>
      const statsNode = document.getElementById('stats');
      const styleListNode = document.getElementById('style-list');
      const styleShelfCountNode = document.getElementById('style-shelf-count');
      const styleShelfFilterNode = document.getElementById('style-shelf-filter');
      const styleShelfQueryNode = document.getElementById('style-shelf-query');
      const contentNode = document.getElementById('content');
      const homeLinkNode = document.getElementById('museum-home-link');
      const ankiStartButtonNode = document.getElementById('anki-start-button');
      const ankiOverlayNode = document.getElementById('anki-practice-overlay');
      let stickyStyleTitleCleanup = null;
      const state = {
        works: [],
        styles: [],
        activeSlug: '',
        activeWorkId: '',
        styleQuery: '',
        styleTermFilter: 'all',
        adminPanelOpen: false,
        anki: {
          deck: [],
          current: null,
          answered: false,
          selectedOption: '',
          totalCount: 0,
          correctCount: 0,
          streak: 0
        },
        flash: null
      };

      function cleanupStickyStyleTitle() {
        if (typeof stickyStyleTitleCleanup === 'function') {
          stickyStyleTitleCleanup();
          stickyStyleTitleCleanup = null;
        }
      }

      function bindStickyStyleTitle() {
        cleanupStickyStyleTitle();

        const heroNode = contentNode.querySelector('.style-hero');
        const titleNode = contentNode.querySelector('[data-style-hero-title]');
        const floatingTitleNode = contentNode.querySelector('[data-floating-style-title]');
        if (!(heroNode instanceof HTMLElement) || !(titleNode instanceof HTMLElement) || !(floatingTitleNode instanceof HTMLElement)) {
          return;
        }

        let ticking = false;
        const update = () => {
          ticking = false;
          const titleRect = titleNode.getBoundingClientRect();
          const contentRect = contentNode.getBoundingClientRect();
          const stickyTop = window.innerWidth <= 760 ? 10 : 20;
          const shouldShow = titleRect.top <= stickyTop && contentRect.bottom > 96;

          floatingTitleNode.dataset.visible = shouldShow ? 'true' : 'false';
          if (!shouldShow) {
            return;
          }

          const isNarrowViewport = window.innerWidth <= 760;
          if (isNarrowViewport) {
            floatingTitleNode.style.left = 'auto';
            floatingTitleNode.style.right = '10px';
            return;
          }

          floatingTitleNode.style.left = 'auto';
          floatingTitleNode.style.right = '20px';
        };

        const schedule = () => {
          if (ticking) {
            return;
          }

          ticking = true;
          window.requestAnimationFrame(update);
        };

        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        schedule();

        stickyStyleTitleCleanup = () => {
          window.removeEventListener('scroll', schedule);
          window.removeEventListener('resize', schedule);
          floatingTitleNode.remove();
        };
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      }

      function renderStats(works, styles) {
        const primaryStyleCount = works.filter((work) =>
          work.styles.some((style) => style.isPrimary && style.status !== 'ignored')
        ).length;
        statsNode.innerHTML = [
          ['Works', works.length],
          ['Styles', styles.filter((style) => style.status !== 'ignored').length],
          ['Tagged Pieces', primaryStyleCount]
        ]
          .map(
            ([label, value]) => \`
              <article class="stat">
                <div class="stat-label">\${label}</div>
                <div class="stat-value">\${value}</div>
              </article>
            \`
          )
          .join('');
      }

      function getVisibleStyleShelf(styles, activeSlug) {
        return styles.filter((style) => style.status !== 'ignored' || style.slug === activeSlug);
      }

      function normalizeSearchValue(value) {
        return String(value || '').trim().toLowerCase();
      }

      function getTermTypeLabel(termType) {
        return {
          artist_style: '艺术家风格',
          movement_style: '流派 / 主义',
          aesthetic_style: '审美风格',
          medium_rendering: '媒介 / 渲染',
          quality_modifier: '质量修饰',
          subject_content: '题材内容',
          mood_atmosphere: '情绪氛围'
        }[termType] || termType;
      }

      function sortStyleShelf(styles, activeSlug) {
        return [...styles].sort((left, right) => {
          const leftActive = left.slug === activeSlug ? 1 : 0;
          const rightActive = right.slug === activeSlug ? 1 : 0;

          if (leftActive !== rightActive) {
            return rightActive - leftActive;
          }

          if (left.workCount !== right.workCount) {
            return right.workCount - left.workCount;
          }

          return left.name.localeCompare(right.name, 'zh-CN');
        });
      }

      function renderStyleFilterOptions(styles) {
        const orderedTypes = [
          'artist_style',
          'movement_style',
          'aesthetic_style',
          'medium_rendering',
          'quality_modifier',
          'subject_content',
          'mood_atmosphere'
        ];
        const availableTypes = orderedTypes.filter((termType) =>
          styles.some((style) => style.termType === termType)
        );
        const options = [
          { value: 'all', label: '全部类型' },
          ...availableTypes.map((termType) => ({
            value: termType,
            label: getTermTypeLabel(termType)
          }))
        ];

        return options
          .map(
            (option) =>
              \`<option value="\${option.value}" \${option.value === state.styleTermFilter ? 'selected' : ''}>\${escapeHtml(option.label)}</option>\`
          )
          .join('');
      }

      function renderStyleList(styles, activeSlug) {
        const visibleStyles = getVisibleStyleShelf(styles, activeSlug);
        const query = normalizeSearchValue(state.styleQuery);
        const filteredByType =
          state.styleTermFilter === 'all'
            ? visibleStyles
            : visibleStyles.filter((style) => style.termType === state.styleTermFilter);
        const filteredStyles = sortStyleShelf(
          filteredByType.filter((style) => {
            if (!query) {
              return true;
            }

            return [style.name, style.termType, style.slug]
              .some((value) => normalizeSearchValue(value).includes(query));
          }),
          activeSlug
        );

        if (styleShelfQueryNode instanceof HTMLInputElement && styleShelfQueryNode.value !== state.styleQuery) {
          styleShelfQueryNode.value = state.styleQuery;
        }

        if (styleShelfFilterNode instanceof HTMLSelectElement) {
          styleShelfFilterNode.innerHTML = renderStyleFilterOptions(visibleStyles);
          styleShelfFilterNode.value = state.styleTermFilter;
        }

        if (styleShelfCountNode) {
          styleShelfCountNode.textContent =
            query || state.styleTermFilter !== 'all'
              ? \`\${filteredStyles.length} / \${visibleStyles.length} styles\`
              : \`\${visibleStyles.length} styles\`;
        }

        if (!filteredStyles.length) {
          styleListNode.innerHTML = '<div class="style-list-empty">没有匹配的 styles。</div>';
          return;
        }

        styleListNode.innerHTML = filteredStyles
          .map((style) => {
            const meta = style.status === 'active'
              ? \`\${getTermTypeLabel(style.termType)} · \${style.workCount}\`
              : \`\${style.status} · \${style.workCount}\`;

            return \`
              <a class="style-pill" href="/museum/styles/\${style.slug}" data-active="\${String(style.slug === activeSlug)}">
                <strong>\${escapeHtml(style.name)}</strong>
                <small>\${escapeHtml(meta)}</small>
              </a>
            \`;
          })
          .join('');
      }

      function syncHomeLink() {
        const atHome = !state.activeSlug && !state.activeWorkId;
        if (!homeLinkNode) {
          return;
        }

        homeLinkNode.dataset.active = String(atHome);
        if (atHome) {
          homeLinkNode.setAttribute('aria-current', 'page');
        } else {
          homeLinkNode.removeAttribute('aria-current');
        }
      }

      function getVisibleStyleTags(styles) {
        return styles.filter((style) => style.status !== 'ignored');
      }

      function renderTagRow(styles) {
        const visibleStyles = getVisibleStyleTags(styles);
        if (!visibleStyles.length) {
          return '<span class="tag">No visible style tags</span>';
        }

        return visibleStyles
          .map(
            (style) => \`
              <a class="tag" data-primary="\${String(style.isPrimary)}" href="/museum/styles/\${style.slug}">
                \${escapeHtml(style.name)}
              </a>
            \`
          )
          .join('');
      }

      function renderWorkCard(work) {
        const modelMeta = [work.modelLabel || '模型未知', work.aspectRatio || '比例未知'].join(' · ');
        return \`
          <article class="work-card">
            <a class="work-link" href="/museum/works/\${encodeURIComponent(work.sourceWorkId)}">
              <img src="\${escapeHtml(work.imageUrl)}" alt="\${escapeHtml(work.sourceWorkId)}" loading="lazy" />
            </a>
            <div class="work-body">
              <p class="work-meta">\${escapeHtml(modelMeta)}</p>
              <p class="work-meta">\${escapeHtml(work.promptRaw.slice(0, 160))}\${work.promptRaw.length > 160 ? '…' : ''}</p>
              <div class="tag-row">\${renderTagRow(work.styles)}</div>
            </div>
          </article>
        \`;
      }

      function renderWorkDetail(detail) {
        state.adminPanelOpen = false;
        document.body.style.overflow = '';
        const visibleStyles = getVisibleStyleTags(detail.styles);

        contentNode.innerHTML = \`
          \${renderFlash()}
          <section class="detail-grid">
            <article class="content-panel detail-card">
              <div class="detail-image-frame">
                <img src="\${escapeHtml(detail.imageUrl)}" alt="\${escapeHtml(detail.sourceWorkId)}" />
              </div>
            </article>

            <article class="content-panel detail-card detail-info-card">
              <div class="eyebrow">Collected Work</div>
              <h2>\${escapeHtml(detail.sourceWorkId)}</h2>
              <div class="tag-row">\${renderTagRow(detail.styles)}</div>

              <div class="meta-grid">
                <div class="meta-item">
                  <strong>Model</strong>
                  <div>\${escapeHtml(detail.modelLabel || '模型未知')}</div>
                </div>
                <div class="meta-item">
                  <strong>Aspect Ratio</strong>
                  <div>\${escapeHtml(detail.aspectRatio || '比例未知')}</div>
                </div>
                <div class="meta-item">
                  <strong>Published At</strong>
                  <div>\${escapeHtml(detail.publishedAt || 'unknown')}</div>
                </div>
                <div class="meta-item">
                  <strong>Ingest Status</strong>
                  <div>\${escapeHtml(detail.ingestStatus)}</div>
                </div>
              </div>

              <div class="prompt-block">\${escapeHtml(detail.promptRaw)}</div>

              <div class="button-row related-head">
                <a class="action-button" href="\${escapeHtml(detail.sourceUrl)}" target="_blank" rel="noreferrer">打开来源页</a>
                \${visibleStyles[0] ? \`<a class="action-button" data-variant="ghost" href="/museum/styles/\${encodeURIComponent(visibleStyles[0].slug)}">查看主风格</a>\` : ''}
                <button class="action-button" data-variant="ghost" id="work-style-edit-trigger" type="button">编辑关键词</button>
              </div>

              <div class="detail-utility-row">
                <button
                  class="work-delete-trigger"
                  id="work-delete-trigger"
                  type="button"
                  aria-label="删除当前作品"
                  title="删除当前作品"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9ZM7 9h2v8H7V9Zm-1 11h12a2 2 0 0 0 2-2V8H4v10a2 2 0 0 0 2 2Z"/>
                  </svg>
                </button>
              </div>
            </article>
          </section>

          <section class="content-panel style-work-grid">
            <div class="content-head">
              <div>
                <h2>Related Works</h2>
                <p>基于当前作品共享的非 ignored 风格标签，聚合出其它相关作品。</p>
              </div>
            </div>
            <div class="gallery">\${detail.relatedWorks.length ? detail.relatedWorks.map(renderWorkCard).join('') : '<p class="work-meta">当前还没有共享风格的其它作品。</p>'}</div>
          </section>
        \`;
      }

      function renderAliasCloud(aliases) {
        if (!aliases.length) {
          return '<p class="work-meta">还没有 alias。你可以在这里补入中英文近义词和站内变体。</p>';
        }

        return \`
          <div class="alias-cloud">
            \${aliases
              .map(
                (alias) => \`
                  <span class="alias-chip">
                    <span>\${escapeHtml(alias.name)}</span>
                    <small>\${escapeHtml(alias.source)}</small>
                  </span>
                \`
              )
              .join('')}
          </div>
        \`;
      }

      function renderFlash() {
        if (!state.flash) {
          return '';
        }

        return \`
          <div class="flash" data-kind="\${escapeHtml(state.flash.kind)}">
            \${escapeHtml(state.flash.message)}
          </div>
        \`;
      }

      function renderHeroOptions(detail) {
        return [
          '<option value="">自动选择首张作品</option>',
          ...detail.works.map(
            (work) =>
              \`<option value="\${work.workId}" \${work.workId === detail.heroWorkId ? 'selected' : ''}>\${escapeHtml(work.sourceWorkId)} · \${escapeHtml(work.modelLabel || '模型未知')}</option>\`
          )
        ].join('');
      }

      function renderStatusOptions(currentStatus) {
        return ['active', 'candidate', 'ignored']
          .map(
            (status) =>
              \`<option value="\${status}" \${status === currentStatus ? 'selected' : ''}>\${status}</option>\`
          )
          .join('');
      }

      function renderHome(works) {
        state.adminPanelOpen = false;
        document.body.style.overflow = '';
        contentNode.innerHTML = \`
          \${renderFlash()}
          <section class="content-panel">
            <div class="content-head">
              <div>
                <h2>Collected Works</h2>
                <p>从即梦 detail 页自动入馆的样例会先出现在这里。点击 style tag 可进入对应风格页。</p>
              </div>
            </div>
            <div class="gallery">\${works.map(renderWorkCard).join('')}</div>
          </section>
        \`;
      }

      function uniqueByName(items) {
        const seen = new Set();
        return items.filter((item) => {
          const name = String(item?.name || '').trim();
          if (!name || seen.has(name)) {
            return false;
          }
          seen.add(name);
          return true;
        });
      }

      function getAnkiStyleTags(work) {
        return uniqueByName(
          (work.styles || []).filter((style) => style.status !== 'ignored' && style.name)
        );
      }

      function shuffle(items) {
        const next = [...items];
        for (let index = next.length - 1; index > 0; index -= 1) {
          const swapIndex = Math.floor(Math.random() * (index + 1));
          [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
        }
        return next;
      }

      function buildAnkiDeck(cards, styles) {
        const styleNames = uniqueByName(
          styles
            .filter((style) => style.status !== 'ignored' && style.name)
            .map((style) => ({ name: style.name }))
        ).map((style) => style.name);

        return cards
          .filter((card) => card.imageUrl && card.answer?.name)
          .map((card) => {
            const answer = card.answer.name;
            const work = {
              workId: card.workId,
              sourceWorkId: card.sourceWorkId,
              promptRaw: card.promptRaw,
              imageUrl: card.imageUrl,
              modelLabel: card.modelLabel,
              aspectRatio: card.aspectRatio,
              styles: [
                {
                  name: answer,
                  slug: card.answer.slug,
                  status: 'active',
                  isPrimary: true
                }
              ]
            };
            const workFromMuseum = state.works.find((item) => item.workId === card.workId);
            return {
              apiCard: card,
              work: workFromMuseum ?? work,
              answer,
              answerSlug: card.answer.slug,
              review: card.review,
              styleNames
            };
          }));
      }

      function drawAnkiCard() {
        if (!state.anki.deck.length) {
          state.anki.current = null;
          state.anki.answered = false;
          state.anki.selectedOption = '';
          return;
        }

        const dueCards = state.anki.deck.filter((item) => item.review?.isDue);
        const lapsedDueCards = dueCards.filter((item) => (item.review?.lapses || 0) > 0);
        const pool = lapsedDueCards.length ? lapsedDueCards : dueCards.length ? dueCards : state.anki.deck;
        const deckItem = pool[Math.floor(Math.random() * pool.length)];
        const answer = deckItem.answer;
        const workStyles = getAnkiStyleTags(deckItem.work);
        const workStyleNames = new Set(workStyles.map((style) => style.name));
        const distractors = shuffle(
          deckItem.styleNames.filter((name) => name !== answer && !workStyleNames.has(name))
        );
        const fallbackDistractors = shuffle(
          state.works
            .flatMap((work) => getAnkiStyleTags(work).map((style) => style.name))
            .filter((name) => name !== answer && !workStyleNames.has(name))
        );
        const optionNames = uniqueByName(
          [answer, ...distractors, ...fallbackDistractors].map((name) => ({ name }))
        )
          .slice(0, 4)
          .map((item) => item.name);

        state.anki.current = {
          apiCard: deckItem.apiCard,
          work: deckItem.work,
          answer,
          answerSlug: deckItem.answerSlug,
          review: deckItem.review,
          options: shuffle(optionNames.length >= 2 ? optionNames : [answer])
        };
        state.anki.answered = false;
        state.anki.selectedOption = '';
      }

      function closeAnkiPractice() {
        state.anki.current = null;
        if (ankiOverlayNode) {
          ankiOverlayNode.dataset.open = 'false';
          ankiOverlayNode.setAttribute('aria-hidden', 'true');
          ankiOverlayNode.innerHTML = '';
        }
        document.body.style.overflow = '';
      }

      async function openAnkiPractice() {
        if (ankiOverlayNode) {
          ankiOverlayNode.dataset.open = 'true';
          ankiOverlayNode.setAttribute('aria-hidden', 'false');
          ankiOverlayNode.innerHTML = '<article class="anki-empty"><div class="eyebrow">Anki Drill</div><h2 class="style-hero-title">正在整理复习队列</h2><p class="work-meta">正在读取 /api/anki/cards，并优先安排到期与答错卡片。</p></article>';
        }
        document.body.style.overflow = 'hidden';
        try {
          const cardsPayload = await loadJson('/api/anki/cards');
          state.anki.deck = buildAnkiDeck(cardsPayload.items ?? [], state.styles);
        } catch {
          state.anki.deck = [];
        }
        state.anki.totalCount = 0;
        state.anki.correctCount = 0;
        state.anki.streak = 0;
        drawAnkiCard();
        renderAnkiOverlay();
      }

      function renderAnkiEmpty() {
        return \`
          <article class="anki-empty">
            <div class="eyebrow">Anki Drill</div>
            <h2 class="style-hero-title">还没有可测试的卡片</h2>
            <p class="work-meta">需要至少一张已入馆图片，并且这张图带有非 ignored 风格关键词。先继续采集几张作品，再回来做风格记忆练习。</p>
            <div class="button-row" style="justify-content:center; margin-top: 18px;">
              <button class="action-button" data-anki-close type="button">返回 museum</button>
            </div>
          </article>
        \`;
      }

      function renderAnkiOverlay() {
        if (!ankiOverlayNode) {
          return;
        }

        ankiOverlayNode.dataset.open = 'true';
        ankiOverlayNode.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        const card = state.anki.current;
        if (!card) {
          ankiOverlayNode.innerHTML = renderAnkiEmpty();
          bindAnkiOverlay();
          return;
        }

        const correct = state.anki.answered && state.anki.selectedOption === card.answer;
        const feedbackKind = !state.anki.answered ? '' : correct ? 'correct' : 'wrong';
        const feedbackText = !state.anki.answered
          ? (card.review?.isDue
              ? '这张卡已经到期，或曾经答错过。观察图像的线条、色彩、材质和构图，再选择风格关键词。'
              : '这张卡还未到期，但可以继续自由练习。')
          : correct
            ? \`答对了。下一次复习会延后到 \${card.review?.dueAt || '未来某个时间'}。\`
            : \`这张图包含的是“\${card.answer}”。这张卡会保持到期，稍后更容易再次抽到。\`;
        const visibleStyles = getAnkiStyleTags(card.work).map((style) => style.name).join(' · ');

        ankiOverlayNode.innerHTML = \`
          <section class="anki-stage" role="dialog" aria-modal="true" aria-label="Anki 风格测试">
            <article class="anki-card-shell" data-answered="\${String(state.anki.answered)}">
              <div class="anki-card-inner">
                <div class="anki-card-face">
                  <img src="\${escapeHtml(card.work.imageUrl)}" alt="\${escapeHtml(card.work.sourceWorkId)}" />
                  <div class="anki-card-caption">
                    <strong>Recall</strong>
                    <span class="tag">\${escapeHtml(card.work.modelLabel || '模型未知')}</span>
                  </div>
                </div>
                <div class="anki-card-face anki-card-back">
                  <div>
                    <div class="eyebrow">\${correct ? 'Correct Recall' : 'Style Revealed'}</div>
                    <h3>\${escapeHtml(card.answer)}</h3>
                    <p>\${escapeHtml(card.work.promptRaw || '')}</p>
                  </div>
                </div>
              </div>
            </article>
            <aside class="anki-panel">
              <div class="anki-panel-head">
                <div>
                  <div class="eyebrow">Anki 风格测试</div>
                  <h2>这张图包含哪个风格关键词？</h2>
                </div>
                <button class="anki-close-button" data-anki-close type="button" aria-label="关闭 Anki 测试">×</button>
              </div>
              <div class="anki-score-row">
                <article><span>Cards</span><strong>\${state.anki.totalCount}</strong></article>
                <article><span>Correct</span><strong>\${state.anki.correctCount}</strong></article>
                <article><span>Streak</span><strong>\${state.anki.streak}</strong></article>
              </div>
              <div class="work-meta">
                复习状态：\${card.review?.isDue ? '已到期' : '未到期'} · 已复习 \${card.review?.reviewCount ?? 0} 次 · 错误 \${card.review?.lapses ?? 0} 次
              </div>
              <div class="anki-option-list">
                \${card.options
                  .map((option, index) => {
                    const result =
                      !state.anki.answered
                        ? ''
                        : option === card.answer
                          ? 'correct'
                          : option === state.anki.selectedOption
                            ? 'wrong'
                            : '';
                    return \`
                      <button class="anki-option" data-anki-option="\${index}" data-result="\${result}" type="button" \${state.anki.answered ? 'disabled' : ''}>
                        \${escapeHtml(option)}
                      </button>
                    \`;
                  })
                  .join('')}
              </div>
              <div class="anki-feedback" data-kind="\${feedbackKind}">
                \${escapeHtml(feedbackText)}
              </div>
              <div class="work-meta">本图所有可见风格：\${escapeHtml(visibleStyles || '暂无')}</div>
              <div class="anki-actions">
                <button class="action-button" data-anki-next type="button">\${state.anki.answered ? '下一张卡片' : '跳过此卡'}</button>
                <a class="action-button" data-variant="ghost" href="/museum/works/\${encodeURIComponent(card.work.sourceWorkId)}" data-anki-work-link>查看作品详情</a>
              </div>
            </aside>
          </section>
        \`;

        bindAnkiOverlay();
      }

      async function answerAnki(option) {
        if (!state.anki.current || state.anki.answered) {
          return;
        }

        state.anki.selectedOption = option;
        state.anki.answered = true;
        state.anki.totalCount += 1;
        const isCorrect = option === state.anki.current.answer;
        if (isCorrect) {
          state.anki.correctCount += 1;
          state.anki.streak += 1;
        } else {
          state.anki.streak = 0;
        }

        try {
          const payload = await requestJson('/api/anki/reviews', {
            method: 'POST',
            body: JSON.stringify({
              workId: state.anki.current.work.workId,
              styleSlug: state.anki.current.answerSlug,
              correct: isCorrect
            })
          });
          const updated = payload.item;
          state.anki.current.review = updated.review;
          state.anki.deck = state.anki.deck.map((item) =>
            item.apiCard.cardId === updated.cardId
              ? {
                  ...item,
                  apiCard: updated,
                  review: updated.review
                }
              : item
          );
        } catch {
          state.anki.current.review = {
            ...(state.anki.current.review ?? {}),
            isDue: !isCorrect
          };
        }
        renderAnkiOverlay();
      }

      function bindAnkiOverlay() {
        ankiOverlayNode?.querySelectorAll('[data-anki-close]').forEach((button) => {
          button.addEventListener('click', closeAnkiPractice);
        });

        ankiOverlayNode?.querySelectorAll('[data-anki-option]').forEach((button) => {
          button.addEventListener('click', () => {
            const index = Number(button.getAttribute('data-anki-option'));
            const option = state.anki.current?.options?.[index];
            if (option) {
              void answerAnki(option);
            }
          });
        });

        ankiOverlayNode?.querySelector('[data-anki-next]')?.addEventListener('click', () => {
          drawAnkiCard();
          renderAnkiOverlay();
        });

        ankiOverlayNode?.querySelector('[data-anki-work-link]')?.addEventListener('click', () => {
          closeAnkiPractice();
        });
      }

      function renderStyleTypeOptions(currentType) {
        return [
          'aesthetic_style',
          'medium_rendering',
          'artist_style',
          'movement_style',
          'quality_modifier',
          'subject_content',
          'mood_atmosphere'
        ]
          .map(
            (termType) =>
              \`<option value="\${termType}" \${termType === currentType ? 'selected' : ''}>\${escapeHtml(getTermTypeLabel(termType))}</option>\`
          )
          .join('');
      }

      function openWorkStyleEditor(detail) {
        const existing = document.getElementById('work-style-edit-overlay');
        existing?.remove();

        const rows = getVisibleStyleTags(detail.styles).map((style) => {
          const styleSummary = state.styles.find((item) => item.slug === style.slug);
          return {
            name: style.name,
            originalTerm: style.name,
            termType: styleSummary?.termType || 'aesthetic_style',
            shortExplanation: '用户在 museum 中保留的风格关键词。'
          };
        });

        const overlay = document.createElement('section');
        overlay.className = 'style-edit-overlay';
        overlay.id = 'work-style-edit-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', '编辑入馆风格关键词');
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        const closeEditor = () => {
          overlay.remove();
          document.body.style.overflow = '';
        };

        const renderRows = () => {
          overlay.innerHTML = \`
            <div class="style-edit-panel">
              <div class="style-edit-head">
                <h3>编辑入馆风格关键词</h3>
                <p>每一行都是可直接编辑的最终风格词。保存后会重写这张作品的风格标签，并刷新 museum。</p>
              </div>
              <div class="style-edit-grid">
                <aside class="style-edit-prompt">
                  <div class="style-edit-label">原始 Prompt</div>
                  <div class="style-edit-prompt-text">\${escapeHtml(detail.promptRaw || '未读取到原始 Prompt。')}</div>
                </aside>
                <div class="style-edit-list">
                  \${rows
                    .map(
                      (row, index) => \`
                        <article class="style-edit-row" data-style-edit-row="\${index}">
                          <div class="style-edit-field">
                            <label for="style-edit-name-\${index}">风格词（可直接编辑）</label>
                            <input id="style-edit-name-\${index}" data-style-edit-name="\${index}" value="\${escapeHtml(row.name)}" autocomplete="off" spellcheck="false" />
                            <div class="style-edit-meta">原词：\${escapeHtml(row.originalTerm || '手动添加')}</div>
                          </div>
                          <select data-style-edit-type="\${index}" aria-label="风格类型">
                            \${renderStyleTypeOptions(row.termType)}
                          </select>
                          <button class="action-button" data-variant="danger" data-style-edit-remove="\${index}" type="button">删除</button>
                        </article>
                      \`
                    )
                    .join('')}
                </div>
              </div>
              <div class="style-edit-actions">
                <button class="action-button" data-style-edit-add type="button">添加关键词</button>
                <div class="style-edit-actions-right">
                  <button class="action-button" data-variant="ghost" data-style-edit-cancel type="button">取消</button>
                  <button class="action-button" data-style-edit-save type="button">保存关键词</button>
                </div>
              </div>
            </div>
          \`;

          overlay.querySelectorAll('[data-style-edit-name]').forEach((input) => {
            input.addEventListener('input', () => {
              const index = Number(input.getAttribute('data-style-edit-name'));
              rows[index].name = input.value;

              const trimmed = input.value.trim();
              if (trimmed) {
                const matched = state.styles.find((s) => s.name === trimmed);
                if (matched && matched.termType && matched.termType !== rows[index].termType) {
                  rows[index].termType = matched.termType;
                  const typeSelect = overlay.querySelector(\`[data-style-edit-type="\${index}"]\`);
                  if (typeSelect instanceof HTMLSelectElement) {
                    typeSelect.value = matched.termType;
                  }
                }
              }
            });
          });

          overlay.querySelectorAll('[data-style-edit-type]').forEach((select) => {
            select.addEventListener('change', () => {
              const index = Number(select.getAttribute('data-style-edit-type'));
              rows[index].termType = select.value;
            });
          });

          overlay.querySelectorAll('[data-style-edit-remove]').forEach((button) => {
            button.addEventListener('click', () => {
              const index = Number(button.getAttribute('data-style-edit-remove'));
              rows.splice(index, 1);
              renderRows();
            });
          });

          overlay.querySelector('[data-style-edit-add]')?.addEventListener('click', () => {
            rows.push({
              name: '',
              originalTerm: '手动添加',
              termType: 'aesthetic_style',
              shortExplanation: '用户在 museum 中手动添加的风格关键词。'
            });
            renderRows();
          });

          overlay.querySelector('[data-style-edit-cancel]')?.addEventListener('click', closeEditor);

          overlay.querySelector('[data-style-edit-save]')?.addEventListener('click', async () => {
            const seen = new Set();
            const approvedStyles = rows
              .map((row) => ({
                name: String(row.name || '').trim(),
                termType: row.termType,
                shortExplanation:
                  String(row.name || '').trim() === row.originalTerm
                    ? row.shortExplanation
                    : \`用户在 museum 中将“\${row.originalTerm}”修订为“\${String(row.name || '').trim()}”。\`
              }))
              .filter((row) => {
                if (!row.name || seen.has(row.name)) {
                  return false;
                }

                seen.add(row.name);
                return true;
              });

            try {
              await requestJson('/api/works/' + encodeURIComponent(detail.sourceWorkId) + '/styles', {
                method: 'PATCH',
                body: JSON.stringify({ approvedStyles })
              });
              closeEditor();
              setFlash('success', '作品风格关键词已更新。');
              await loadMuseumState('', detail.sourceWorkId, false);
            } catch (error) {
              setFlash('error', error instanceof Error ? error.message : 'work_style_update_failed');
              closeEditor();
              await loadMuseumState('', detail.sourceWorkId, false);
            }
          });
        };

        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) {
            closeEditor();
          }
        });

        renderRows();
      }

      function bindWorkDetailActions(detail) {
        const styleEditButton = document.getElementById('work-style-edit-trigger');
        const deleteButton = document.getElementById('work-delete-trigger');

        if (styleEditButton) {
          styleEditButton.addEventListener('click', () => {
            openWorkStyleEditor(detail);
          });
        }

        deleteButton?.addEventListener('click', async () => {
          if (!window.confirm('确认删除这张作品吗？这个动作会把它从 museum 数据库与风格映射中移除。')) {
            return;
          }

          try {
            await requestJson('/api/works/' + encodeURIComponent(detail.sourceWorkId), {
              method: 'DELETE'
            });
            setFlash('success', '作品已从 museum 删除。');
            await loadMuseumState('', '', true);
          } catch (error) {
            setFlash('error', error instanceof Error ? error.message : 'work_delete_failed');
            await loadMuseumState('', detail.sourceWorkId, false);
          }
        });
      }

      function renderStyleAdmin(detail, styles) {
        const mergeOptions = styles
          .filter((style) => style.slug !== detail.slug)
          .map(
            (style) =>
              \`<option value="\${style.slug}">\${escapeHtml(style.name)} · \${escapeHtml(style.status)}</option>\`
          )
          .join('');

        return \`
          <button
            class="hero-admin-trigger"
            id="style-admin-toggle"
            type="button"
            aria-label="打开风格管理工具"
            aria-controls="style-admin-drawer"
            aria-expanded="\${String(state.adminPanelOpen)}"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M19.14 12.94a7.98 7.98 0 0 0 .05-.94 7.98 7.98 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.42 7.42 0 0 0-1.63-.94l-.36-2.54a.48.48 0 0 0-.49-.42h-3.84a.48.48 0 0 0-.49.42l-.36 2.54c-.58.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.03.31-.05.62-.05.94s.02.63.05.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54a.48.48 0 0 0 .49.42h3.84a.48.48 0 0 0 .49-.42l.36-2.54c.58-.23 1.13-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/>
            </svg>
          </button>
          <section class="admin-drawer" id="style-admin-drawer" data-open="\${String(state.adminPanelOpen)}" aria-hidden="\${String(!state.adminPanelOpen)}">
            <button class="admin-backdrop" id="style-admin-backdrop" type="button" aria-label="关闭风格管理面板"></button>
            <div class="admin-sheet content-panel">
              <div class="admin-sheet-head">
                <div>
                  <div class="eyebrow">Style Tools</div>
                  <h3>Catalog Notes & Alias Cabinet</h3>
                  <p>管理入口被收纳到 HERO 右下角，只在需要修订词库时展开。</p>
                </div>
                <button class="admin-close" id="style-admin-close" type="button" aria-label="关闭风格管理面板">✕</button>
              </div>
              \${renderFlash()}
              <section class="admin-grid">
                <article class="admin-panel">
                  <h3>Catalog Notes</h3>
                  <p>这里直接修订 canonical style 的展示名、渊源解释、视觉特征和 HERO。所有修改都会立刻写回本地 SQLite。</p>
                  <form class="admin-form" id="style-edit-form">
                    <div class="field">
                      <label for="style-name">Canonical Name</label>
                      <input id="style-name" name="name" value="\${escapeHtml(detail.name)}" />
                    </div>
                    <div class="field">
                      <label for="style-status">Status</label>
                      <select id="style-status" name="status">\${renderStatusOptions(detail.status)}</select>
                    </div>
                    <div class="field">
                      <label for="style-short-description">风格概述</label>
                      <textarea id="style-short-description" name="shortDescription">\${escapeHtml(detail.shortDescription)}</textarea>
                    </div>
                    <div class="field">
                      <label for="style-visual-traits">典型视觉特征</label>
                      <textarea id="style-visual-traits" name="visualTraits">\${escapeHtml(detail.visualTraits)}</textarea>
                    </div>
                    <div class="field">
                      <label for="style-prompt-hints">AIGC Prompt Hints</label>
                      <textarea id="style-prompt-hints" name="promptHints">\${escapeHtml(detail.promptHints)}</textarea>
                    </div>
                    <div class="field">
                      <label for="style-hero-work">Hero Work</label>
                      <select id="style-hero-work" name="heroWorkId">\${renderHeroOptions(detail)}</select>
                    </div>
                    <div class="button-row">
                      <button class="action-button" type="submit">保存修订</button>
                      <a class="action-button" data-variant="ghost" href="\${escapeHtml(detail.heroImageUrl || '#works-in-style')}">查看当前 HERO</a>
                    </div>
                  </form>
                  <div style="margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(255,133,133,0.18);">
                    <p style="margin: 0 0 12px; color: var(--muted); font-size: 13px; line-height: 1.6;">删除当前风格会同时移除所有关联的别名和作品映射。作品本身不会被删除。</p>
                    <div class="button-row">
                      <button class="action-button" data-variant="danger" id="style-delete-trigger" type="button">删除此风格</button>
                    </div>
                  </div>
                </article>

                <article class="admin-panel">
                  <h3>Alias Cabinet</h3>
                  <p>补充常见中英混写、站内 prompt 变体和人工收口后的别名。merge 会把源 style 的作品与 alias 并入目标 style。</p>
                  <div class="admin-stack">
                    <div>
                      \${renderAliasCloud(detail.aliases)}
                    </div>
                    <form class="admin-form" id="style-alias-form">
                      <div class="field">
                        <label for="style-alias-name">New Alias</label>
                        <input id="style-alias-name" name="aliasName" placeholder="例如：Moebius风格 / 墨比乌斯风格" />
                      </div>
                      <div class="button-row">
                        <button class="action-button" type="submit">添加 Alias</button>
                      </div>
                    </form>
                    <form class="admin-form" id="style-merge-form">
                      <div class="field">
                        <label for="style-merge-target">Merge Into</label>
                        <select id="style-merge-target" name="targetSlug">
                          <option value="">选择目标 style</option>
                          \${mergeOptions}
                        </select>
                      </div>
                      <div class="button-row">
                        <button class="action-button" data-variant="danger" type="submit">Merge 当前 Style</button>
                      </div>
                    </form>
                  </div>
                </article>
              </section>
            </div>
          </section>
        \`;
      }

      function renderStyleDetail(detail, styles, loadingNarrative) {
        const narrativeIsLoading = loadingNarrative === true;
        const narrativeLoadingClass = narrativeIsLoading ? ' narrative-loading' : '';
        const narrativeOverview = narrativeIsLoading
          ? '&nbsp;'
          : escapeHtml(detail.narrative?.overview || detail.shortDescription || '这个风格已经进入 catalog，但解释仍待补全。');
        const narrativeLineage = narrativeIsLoading
          ? '&nbsp;'
          : escapeHtml(detail.narrative?.lineage || detail.shortDescription || '这里应该解释这种风格的渊源、代表创作者、视觉传统与后续演化脉络。');
        const narrativeCharacteristics = narrativeIsLoading
          ? '&nbsp;'
          : escapeHtml(detail.narrative?.characteristics || detail.visualTraits || '这里应该解释这种风格在构图、线条、色彩和材质上的典型特征。');

        contentNode.innerHTML = \`
          <section class="style-hero">
            \${detail.heroImageUrl ? \`<img src="\${escapeHtml(detail.heroImageUrl)}" alt="\${escapeHtml(detail.name)}" />\` : ''}
            <div class="style-meta">
              <div class="eyebrow">\${escapeHtml(detail.termType.replaceAll('_', ' '))}</div>
              <h2 class="style-hero-title" data-style-hero-title>\${escapeHtml(detail.name)}</h2>
              <div class="style-copy">
                <p>\${narrativeOverview}</p>
                <div class="style-lineage-card">
                  <div class="style-lineage-grid" id="style-narrative-grid">
                    <section class="style-lineage-section">
                      <div class="style-lineage-label">
                        \${narrativeIsLoading ? '<span class="narrative-loading-label">正在通过大模型更新释义<span class="narrative-loading-dot"></span><span class="narrative-loading-dot"></span><span class="narrative-loading-dot"></span></span>' : '这是什么'}
                      </div>
                      <p data-narrative-field="overview"\${narrativeIsLoading ? ' class="narrative-loading"' : ''}>\${narrativeOverview}</p>
                    </section>
                    <section class="style-lineage-section">
                      <div class="style-lineage-label">渊源与传承</div>
                      <p data-narrative-field="lineage"\${narrativeIsLoading ? ' class="narrative-loading"' : ''}>\${narrativeLineage}</p>
                    </section>
                    <section class="style-lineage-section">
                      <div class="style-lineage-label">典型特征</div>
                      <p data-narrative-field="characteristics"\${narrativeIsLoading ? ' class="narrative-loading"' : ''}>\${narrativeCharacteristics}</p>
                    </section>
                  </div>
                </div>
              </div>
            </div>
            \${renderStyleAdmin(detail, styles)}
          </section>
          <div class="floating-style-title" data-floating-style-title="true" data-visible="false">\${escapeHtml(detail.name)}</div>

          <section class="content-panel style-work-grid">
            <div class="gallery">\${detail.works.map(renderWorkCard).join('')}</div>
          </section>
        \`;

        bindStyleAdmin(detail);
        bindStickyStyleTitle();
      }

      async function loadJson(url) {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('request failed');
        }

        return response.json();
      }

      async function requestJson(url, init) {
        const requestInit = init || {};
        const headers = new Headers(requestInit.headers || {});
        if (requestInit.body !== undefined && !headers.has('content-type')) {
          headers.set('content-type', 'application/json');
        }

        const response = await fetch(url, {
          ...requestInit,
          headers
        });

        if (!response.ok) {
          let payload = null;
          try {
            payload = await response.json();
          } catch {}

          throw new Error(payload?.error || 'request_failed');
        }

        return response.json();
      }

      function setFlash(kind, message) {
        state.flash = { kind, message };
      }

      function clearFlash() {
        state.flash = null;
      }

      function updateNarrativeContent(narrative) {
        const overviewEl = contentNode.querySelector('[data-narrative-field="overview"]');
        const lineageEl = contentNode.querySelector('[data-narrative-field="lineage"]');
        const characteristicsEl = contentNode.querySelector('[data-narrative-field="characteristics"]');

        if (overviewEl) {
          overviewEl.textContent = narrative.overview;
          overviewEl.classList.remove('narrative-loading');
        }
        if (lineageEl) {
          lineageEl.textContent = narrative.lineage;
          lineageEl.classList.remove('narrative-loading');
        }
        if (characteristicsEl) {
          characteristicsEl.textContent = narrative.characteristics;
          characteristicsEl.classList.remove('narrative-loading');
        }

        const label = contentNode.querySelector('.style-lineage-section:first-child .style-lineage-label');
        if (label) {
          label.textContent = '这是什么';
        }
      }

      async function loadStyleWithEnrichment(slug) {
        const [worksPayload, stylesPayload] = await Promise.all([
          loadJson('/api/works'),
          loadJson('/api/styles')
        ]);

        state.works = worksPayload.items ?? [];
        state.styles = stylesPayload.items ?? [];
        state.activeSlug = slug;
        state.activeWorkId = '';

        renderStats(state.works, state.styles);
        renderStyleList(state.styles, state.activeSlug);
        syncHomeLink();
        window.history.replaceState({}, '', '/museum/styles/' + encodeURIComponent(slug));

        const detailPayload = await loadJson('/api/styles/' + encodeURIComponent(slug) + '?skipEnrichment=true');
        const detail = detailPayload.item;

        if (detail.needsEnrichment) {
          renderStyleDetail(detail, state.styles, true);

          try {
            const enrichedPayload = await requestJson('/api/styles/' + encodeURIComponent(slug) + '/enrich', {
              method: 'POST'
            });
            updateNarrativeContent(enrichedPayload.item.narrative);
            setFlash('success', 'Style 已更新，释义已通过大模型重新生成。');
          } catch {
            updateNarrativeContent(detail.narrative);
            setFlash('error', '释义更新失败，将保留当前内容。');
          }
        } else {
          renderStyleDetail(detail, state.styles, false);
        }
      }

      function bindStyleAdmin(detail) {
        const drawer = document.getElementById('style-admin-drawer');
        const toggleButton = document.getElementById('style-admin-toggle');
        const closeButton = document.getElementById('style-admin-close');
        const backdrop = document.getElementById('style-admin-backdrop');
        const editForm = document.getElementById('style-edit-form');
        const aliasForm = document.getElementById('style-alias-form');
        const mergeForm = document.getElementById('style-merge-form');

        function syncAdminDrawer(open) {
          state.adminPanelOpen = open;
          if (drawer) {
            drawer.dataset.open = String(open);
            drawer.setAttribute('aria-hidden', String(!open));
          }
          if (toggleButton) {
            toggleButton.setAttribute('aria-expanded', String(open));
          }
          document.body.style.overflow = open ? 'hidden' : '';
        }

        if (toggleButton) {
          toggleButton.addEventListener('click', () => {
            syncAdminDrawer(true);
          });
        }

        if (closeButton) {
          closeButton.addEventListener('click', () => {
            syncAdminDrawer(false);
          });
        }

        if (backdrop) {
          backdrop.addEventListener('click', () => {
            syncAdminDrawer(false);
          });
        }

        syncAdminDrawer(state.adminPanelOpen);

        if (editForm) {
          editForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(editForm);

            try {
              const payload = await requestJson('/api/styles/' + encodeURIComponent(detail.slug), {
                method: 'PATCH',
                body: JSON.stringify({
                  name: formData.get('name'),
                  status: formData.get('status'),
                  shortDescription: formData.get('shortDescription'),
                  visualTraits: formData.get('visualTraits'),
                  promptHints: formData.get('promptHints'),
                  heroWorkId: formData.get('heroWorkId')
                    ? Number(formData.get('heroWorkId'))
                    : null
                })
              });
              const nextSlug = payload.item?.slug || detail.slug;
              state.adminPanelOpen = false;
              clearFlash();
              await loadStyleWithEnrichment(nextSlug);
            } catch (error) {
              setFlash('error', error instanceof Error ? error.message : 'style_update_failed');
              state.adminPanelOpen = false;
              await loadMuseumState(detail.slug, '', false);
            }
          });
        }

        if (aliasForm) {
          aliasForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(aliasForm);

            try {
              await requestJson('/api/styles/' + encodeURIComponent(detail.slug) + '/aliases', {
                method: 'POST',
                body: JSON.stringify({
                  aliasName: formData.get('aliasName')
                })
              });
              setFlash('success', 'Alias 已加入词库。');
              state.adminPanelOpen = true;
              await loadMuseumState(detail.slug, '', false);
            } catch (error) {
              setFlash('error', error instanceof Error ? error.message : 'style_alias_failed');
              state.adminPanelOpen = true;
              await loadMuseumState(detail.slug, '', false);
            }
          });
        }

        if (mergeForm) {
          mergeForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(mergeForm);
            const targetSlug = String(formData.get('targetSlug') || '');
            if (!targetSlug) {
              setFlash('error', '请先选择 merge 目标。');
              await loadMuseumState(detail.slug, '', false);
              return;
            }

            if (!window.confirm('确认把当前 style 合并进目标 style 吗？这个动作会修改作品映射和 alias。')) {
              return;
            }

            try {
              const payload = await requestJson('/api/styles/' + encodeURIComponent(detail.slug) + '/merge', {
                method: 'POST',
                body: JSON.stringify({
                  targetSlug
                })
              });
              const nextSlug = payload.item?.slug || targetSlug;
              setFlash('success', 'Style merge 完成。');
              state.adminPanelOpen = true;
              await loadMuseumState(nextSlug, '', true);
            } catch (error) {
              setFlash('error', error instanceof Error ? error.message : 'style_merge_failed');
              state.adminPanelOpen = true;
              await loadMuseumState(detail.slug, '', false);
            }
          });
        }

        const deleteTrigger = document.getElementById('style-delete-trigger');
        if (deleteTrigger) {
          deleteTrigger.addEventListener('click', async () => {
            if (!window.confirm('确认删除风格 "' + detail.name + '" 吗？这个操作会移除风格本身、所有别名以及作品与风格之间的映射关系。作品不会被删除，但会失去该风格标签。')) {
              return;
            }

            try {
              await requestJson('/api/styles/' + encodeURIComponent(detail.slug), {
                method: 'DELETE'
              });
              setFlash('success', '风格已删除。');
              state.adminPanelOpen = false;
              await loadMuseumState('', '', true);
            } catch (error) {
              setFlash('error', error instanceof Error ? error.message : 'style_delete_failed');
              await loadMuseumState(detail.slug, '', false);
            }
          });
        }
      }

      async function loadMuseumState(activeSlug, activeWorkId, replacePath) {
        cleanupStickyStyleTitle();
        contentNode.innerHTML = '<div class="content-panel"><div class="loading">Loading museum…</div></div>';

        const [worksPayload, stylesPayload] = await Promise.all([
          loadJson('/api/works'),
          loadJson('/api/styles')
        ]);

        state.works = worksPayload.items ?? [];
        state.styles = stylesPayload.items ?? [];
        state.activeSlug = activeSlug || '';
        state.activeWorkId = activeWorkId || '';

        renderStats(state.works, state.styles);
        renderStyleList(state.styles, state.activeSlug);
        syncHomeLink();

        if (state.activeWorkId) {
          try {
            const detailPayload = await loadJson('/api/works/' + encodeURIComponent(state.activeWorkId));
            renderWorkDetail(detailPayload.item);
            bindWorkDetailActions(detailPayload.item);
            if (replacePath) {
              window.history.replaceState({}, '', '/museum/works/' + encodeURIComponent(detailPayload.item.sourceWorkId));
            }
          } catch {
            contentNode.innerHTML = \`
              <section class="empty">
                <h2 class="style-hero-title">Work Not Found</h2>
                <p>这个 sourceWorkId 当前没有对应作品记录。</p>
              </section>
            \`;
          }

          clearFlash();
          return;
        }

        if (!state.activeSlug) {
          renderHome(state.works);
          if (replacePath) {
            window.history.replaceState({}, '', '/museum');
          }
          clearFlash();
          return;
        }

        try {
          const detailPayload = await loadJson('/api/styles/' + encodeURIComponent(state.activeSlug));
          renderStyleDetail(detailPayload.item, state.styles);
          if (replacePath) {
            window.history.replaceState({}, '', '/museum/styles/' + encodeURIComponent(detailPayload.item.slug));
          }
        } catch {
          contentNode.innerHTML = \`
            <section class="empty">
              <h2 class="style-hero-title">Style Not Found</h2>
              <p>这个 slug 当前没有对应的风格记录。</p>
            </section>
          \`;
        }

        clearFlash();
      }

      async function boot() {
        const styleMatch = window.location.pathname.match(/^\\/museum\\/styles\\/([^/]+)$/);
        const workMatch = window.location.pathname.match(/^\\/museum\\/works\\/([^/]+)$/);
        const activeSlug = styleMatch ? decodeURIComponent(styleMatch[1]) : '';
        const activeWorkId = workMatch ? decodeURIComponent(workMatch[1]) : '';
        await loadMuseumState(activeSlug, activeWorkId, false);
      }

      ankiStartButtonNode?.addEventListener('click', () => {
        void openAnkiPractice();
      });
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && ankiOverlayNode?.dataset.open === 'true') {
          closeAnkiPractice();
        }
      });

      if (styleShelfQueryNode instanceof HTMLInputElement) {
        styleShelfQueryNode.addEventListener('input', () => {
          state.styleQuery = styleShelfQueryNode.value;
          renderStyleList(state.styles, state.activeSlug);
        });
      }

      if (styleShelfFilterNode instanceof HTMLSelectElement) {
        styleShelfFilterNode.addEventListener('change', () => {
          state.styleTermFilter = styleShelfFilterNode.value;
          renderStyleList(state.styles, state.activeSlug);
        });
      }

      boot().catch(() => {
        contentNode.innerHTML = \`
          <section class="empty">
            <h2 class="style-hero-title">Museum Unavailable</h2>
            <p>当前 museum 数据尚未准备好，或者本地 collector 暂时无法读取 catalog。</p>
          </section>
        \`;
      });
    </script>
  </body>
</html>`;
}
