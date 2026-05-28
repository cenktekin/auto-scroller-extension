# PROJECT_HEALTH.md — auto-scroll-extension

## Sağlık Puanı: 90/100 🟢

### Güçlü Yanlar
- **MV3 Chrome Extension** — Modern manifest v3, doğru permission yönetimi (storage, activeTab, scripting, contextMenus)
- **React + TypeScript + Vite** — Modern toolchain ile geliştirilmiş, type-safe
- **PDF Viewer desteği** — `pdfjs-dist` ile PDF okuma modu
- **Klavye kısayolları** — Ctrl+Shift+S (scroll), Ctrl+Shift+R (reading mode)
- **Content Script mimarisi** — `content.ts` clean class yapısı, hata yönetimi, hotkey listeners
- **Tailwind CSS** — Popup UI responsive ve temiz
- **Okuma kılavuzu** — Odak çizgisi (renk/kalınlık/opaklık/pozisyon ayarları), scroll hızı/yönü
- **Chrome Storage** — Ayarların persist edilmesi, hata handling ile
- **README** ✅ Mevcut
- **TSConfig** — Ayrı node config ile temiz derleme

### Riskler

| Risk | Seviye | Detay |
|------|--------|-------|
| `content.ts` boyutu | 🟡 Orta | 634 satır — tek content script dosyası, büyümeye devam ederse bölünmeli |
| Test yok | 🟡 Orta | Browser extension için E2E/unit test eksik |
| `pdfjs-dist` build entegrasyonu | 🟢 Düşük | `vite-plugin-static-copy` ile PDF.js vendor dosyaları kopyalanıyor — build pipeline'da kırılgan olabilir |
| `archive/` dizini | 🟢 Düşük | Eski dosyalar içerebilir, kontrol edilmeli |

### Öneriler

1. **🧪 Test ekle** — En azından content script'in scroll mantığı ve setting değişiklikleri için birim test
2. **📦 PDF.js vendor yönetimini gözden geçir** — `vite-plugin-static-copy` ile vendor taşıma yerine proper import çözümü düşünülebilir
3. **🔧 `content.ts` bölünmeyi düşün** — 634 satıra ulaştı, reading mode, scroll controller, UI toast gibi sorumluluklar ayrılabilir

### Detaylar

- **Toplam TS**: 1,219 satır
- **Anahtar dosyalar**: `content.ts` (634 satır), `pdf-viewer.ts` (330 satır), `App.tsx` (251 satır), `background.ts` (77 satır)
- **Manifest**: ✅ V3, storage+activeTab+scripting+contextMenus
- **Framework**: React 18 + TypeScript 5 + Vite 5
- **Bağımlılık**: Sadece React, minimal
- **README**: ✅ Mevcut
- **Kısayollar**: Ctrl+Shift+S (toggle scroll), Ctrl+Shift+R (reading mode)
- **Popup**: 288px genişlik, Tailwind ile dark theme
