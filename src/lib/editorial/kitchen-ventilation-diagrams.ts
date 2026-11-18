/**
 * RancangLoka — Architectural Technical Visual Engine
 * Kitchen Ventilation Diagrams (Canary #10011 & Generic Architecture)
 *
 * Provides responsive, highly readable 16:9 SVG diagrams for kitchen ventilation:
 * 1. Inline 1: Cooker Hood Resirkulasi vs Exhaust Fan Dinding Airflow Comparison.
 * 2. Inline 2: Ventilation Effectiveness, Airflow Obstacles & Make-up Air Balance.
 *
 * Invariants:
 * - Aspect Ratio: Strictly 16:9 (viewBox="0 0 1200 675").
 * - Zero Text Clipping: All coordinates, text labels, and boxes respect safe margins (min 45px padding).
 * - Architectural Fidelity: Renders physical objects (walls, cooktops, hoods, fans, ducts, airflow vectors).
 * - Zero Generic Tables: Rejects tabular bullet lists disguised as diagrams.
 * - Evidence Pack Compliance: Zero fabricated technical standards or unverified figures.
 */

export function generateKitchenAirflowComparisonSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675" role="img" aria-label="Diagram Potongan Dapur: Perbedaan Aliran Udara Cooker Hood Resirkulasi vs Exhaust Fan Dinding">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B132B"/>
      <stop offset="100%" stop-color="#1C2541"/>
    </linearGradient>
    <linearGradient id="panelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#0F172A" stop-opacity="0.98"/>
    </linearGradient>
    <linearGradient id="steamGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#F97316" stop-opacity="0.8"/>
      <stop offset="50%" stop-color="#FB923C" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#FDBA74" stop-opacity="0.1"/>
    </linearGradient>
    <linearGradient id="exhaustGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284C7" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="recircGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#94A3B8" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#64748B" stop-opacity="0.3"/>
    </linearGradient>
    <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <marker id="arrowOrange" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#FB923C"/>
    </marker>
    <marker id="arrowCyan" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8"/>
    </marker>
    <marker id="arrowGray" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#94A3B8"/>
    </marker>
    <marker id="arrowGreen" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#34D399"/>
    </marker>
  </defs>

  <!-- Background Base -->
  <rect width="1200" height="675" fill="url(#bgGrad)"/>
  <rect x="2" y="2" width="1196" height="671" rx="14" fill="none" stroke="#334155" stroke-width="2"/>

  <!-- Top Header Banner -->
  <g transform="translate(50, 30)">
    <rect width="1100" height="48" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1.5"/>
    <rect x="12" y="10" width="8" height="28" rx="3" fill="#38BDF8"/>
    <text x="32" y="24" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="700" letter-spacing="1.5">RANCANGLOKA FISIKA BANGUNAN • DIAGRAM ALIRAN UDARA DAPUR</text>
    <text x="32" y="40" fill="#F8FAFC" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" font-weight="700">Komparasi Prinsip Kerja: Cooker Hood Resirkulasi vs Exhaust Fan Dinding</text>
  </g>

  <!-- ========================================================================= -->
  <!-- PANEL KIRI: COOKER HOOD RESIRKULASI (SISTEM TERTUTUP)                     -->
  <!-- ========================================================================= -->
  <g transform="translate(50, 95)">
    <!-- Panel Backdrop -->
    <rect width="535" height="515" rx="12" fill="url(#panelGrad)" stroke="#334155" stroke-width="1.5"/>

    <!-- Header Badge -->
    <rect x="16" y="16" width="503" height="34" rx="6" fill="#0F172A" stroke="#475569" stroke-width="1"/>
    <circle cx="32" cy="33" r="5" fill="#F59E0B"/>
    <text x="46" y="37" fill="#F59E0B" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="12" font-weight="700" letter-spacing="0.5">SISTEM RESIRKULASI (SISTEM TERTUTUP TANPA JALUR LUAR)</text>

    <!-- Ruang Dapur & Dinding Potongan -->
    <!-- Dinding Belakang & Plafon -->
    <path d="M 30 70 L 505 70 L 505 340 L 30 340 Z" fill="#090D16" stroke="#1E293B" stroke-width="1"/>
    <line x1="30" y1="120" x2="505" y2="120" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 4"/>
    <text x="40" y="112" fill="#64748B" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="600">PLAFON RUANG DAPUR</text>

    <!-- Meja Dapur / Countertop -->
    <rect x="60" y="260" width="300" height="80" rx="4" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <rect x="80" y="250" width="140" height="10" rx="2" fill="#334155"/>
    <text x="150" y="295" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="600" text-anchor="middle">Meja Dapur / Kompor</text>

    <!-- Panci Memasak & Titik Panas -->
    <rect x="120" y="232" width="60" height="18" rx="3" fill="#475569" stroke="#64748B" stroke-width="1"/>
    <path d="M 115 236 L 120 236 M 180 236 L 185 236" stroke="#94A3B8" stroke-width="2"/>
    <ellipse cx="150" cy="249" rx="14" ry="3" fill="#EF4444" opacity="0.8"/>

    <!-- Cooker Hood Unit -->
    <path d="M 90 185 L 210 185 L 180 145 L 120 145 Z" fill="#334155" stroke="#64748B" stroke-width="1.5"/>
    <rect x="120" y="120" width="60" height="25" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>

    <!-- Filter Lapisan (Grease + Carbon) -->
    <line x1="96" y1="183" x2="204" y2="183" stroke="#CBD5E1" stroke-width="3"/>
    <text x="218" y="185" fill="#CBD5E1" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="9" font-weight="600">Filter Lemak Logam</text>
    <line x1="102" y1="175" x2="198" y2="175" stroke="#10B981" stroke-width="3"/>
    <text x="218" y="174" fill="#34D399" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="9" font-weight="600">Filter Karbon Aktif (Serap Bau)</text>

    <!-- Kisi Louvre Hembusan Atas (Resirkulasi) -->
    <line x1="125" y1="126" x2="175" y2="126" stroke="#94A3B8" stroke-width="1.5"/>
    <line x1="125" y1="132" x2="175" y2="132" stroke="#94A3B8" stroke-width="1.5"/>

    <!-- Aliran Udara Naik (Uap Panas, Bau & Lemak) -->
    <path d="M 140 228 C 135 210, 138 200, 142 188" stroke="#FB923C" stroke-width="2.5" fill="none" marker-end="url(#arrowOrange)"/>
    <path d="M 150 228 C 150 210, 150 200, 150 188" stroke="#FB923C" stroke-width="2.5" fill="none" marker-end="url(#arrowOrange)"/>
    <path d="M 160 228 C 165 210, 162 200, 158 188" stroke="#FB923C" stroke-width="2.5" fill="none" marker-end="url(#arrowOrange)"/>
    <text x="65" y="215" fill="#FB923C" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="700">Uap, Panas &amp; Bau</text>

    <!-- Aliran Udara Keluar KEMBALI KE RUANG DAPUR (Resirkulasi Tertutup) -->
    <path d="M 130 120 C 110 95, 70 120, 65 170 C 60 210, 65 240, 75 250" stroke="#94A3B8" stroke-width="2.5" stroke-dasharray="4 3" fill="none" marker-end="url(#arrowGray)"/>
    <path d="M 170 120 C 190 95, 270 110, 275 160 C 280 200, 270 230, 260 250" stroke="#94A3B8" stroke-width="2.5" stroke-dasharray="4 3" fill="none" marker-end="url(#arrowGray)"/>
    <text x="285" y="145" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="700">Udara Dihembuskan</text>
    <text x="285" y="158" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="9" font-weight="600">Kembali ke Dapur</text>

    <!-- Kabinet Atas Mengalami Kondensasi -->
    <rect x="290" y="170" width="180" height="90" rx="4" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <text x="380" y="215" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="600" text-anchor="middle">Kabinet Dapur</text>
    <!-- Titik Kondensasi Embun -->
    <circle cx="310" cy="250" r="2.5" fill="#38BDF8"/>
    <circle cx="325" cy="254" r="2" fill="#38BDF8"/>
    <circle cx="340" cy="252" r="3" fill="#38BDF8"/>
    <circle cx="360" cy="255" r="2.5" fill="#38BDF8"/>
    <text x="380" y="275" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Kondensasi Embun Air</text>

    <!-- Box Penjelasan Teknis & Fakta Fisika -->
    <g transform="translate(16, 355)">
      <rect width="503" height="142" rx="8" fill="#0B132B" stroke="#334155" stroke-width="1.5"/>
      <text x="16" y="22" fill="#F8FAFC" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="12" font-weight="700">Karakteristik &amp; Batasan Fisika:</text>

      <circle cx="24" cy="45" r="3" fill="#10B981"/>
      <text x="35" y="49" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="600">Penyaringan:</text>
      <text x="110" y="49" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11">Filter menyerap partikel minyak dan sebagian bau masakan.</text>

      <circle cx="24" cy="72" r="3" fill="#EF4444"/>
      <text x="35" y="76" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="700">Uap Air &amp; Panas:</text>
      <text x="135" y="76" fill="#EF4444" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="600">100% uap air &amp; panas tetap berada di dalam ruangan dapur.</text>

      <circle cx="24" cy="99" r="3" fill="#F59E0B"/>
      <text x="35" y="103" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="600">Dampak Ruang:</text>
      <text x="122" y="103" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11">Kelembapan tetap tinggi; risiko jamur kabinet bila tanpa bukaan.</text>

      <rect x="16" y="115" width="471" height="20" rx="4" fill="#1E293B"/>
      <text x="251" y="129" fill="#CBD5E1" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="600" text-anchor="middle">Cocok bila dinding luar tidak terjangkau &amp; prioritas utama adalah bau ringan</text>
    </g>
  </g>

  <!-- ========================================================================= -->
  <!-- PANEL KANAN: EXHAUST FAN DINDING (PEMBUANGAN KELUAR)                      -->
  <!-- ========================================================================= -->
  <g transform="translate(615, 95)">
    <!-- Panel Backdrop -->
    <rect width="535" height="515" rx="12" fill="url(#panelGrad)" stroke="#334155" stroke-width="1.5"/>

    <!-- Header Badge -->
    <rect x="16" y="16" width="503" height="34" rx="6" fill="#0F172A" stroke="#0284C7" stroke-width="1"/>
    <circle cx="32" cy="33" r="5" fill="#38BDF8"/>
    <text x="46" y="37" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="12" font-weight="700" letter-spacing="0.5">EXHAUST FAN DINDING (PEMBUANGAN TOTAL KE LUAR RUANG)</text>

    <!-- Ruang Dapur & Dinding Luar Potongan Arsitektur -->
    <path d="M 30 70 L 400 70 L 400 340 L 30 340 Z" fill="#090D16" stroke="#1E293B" stroke-width="1"/>
    <line x1="30" y1="120" x2="400" y2="120" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 4"/>
    <text x="40" y="112" fill="#64748B" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="600">PLAFON RUANG DAPUR</text>

    <!-- Dinding Luar Bata Tebal (Potongan Arsitektur) -->
    <rect x="400" y="70" width="105" height="270" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <text x="452" y="105" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="700" text-anchor="middle">DINDING LUAR</text>
    <text x="452" y="118" fill="#64748B" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="9" text-anchor="middle">Udara Bebas</text>

    <!-- Meja Dapur / Countertop -->
    <rect x="60" y="260" width="220" height="80" rx="4" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <rect x="80" y="250" width="140" height="10" rx="2" fill="#334155"/>
    <text x="150" y="295" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="600" text-anchor="middle">Meja Kompor</text>

    <!-- Panci Memasak & Titik Panas -->
    <rect x="120" y="232" width="60" height="18" rx="3" fill="#475569" stroke="#64748B" stroke-width="1"/>
    <ellipse cx="150" cy="249" rx="14" ry="3" fill="#EF4444" opacity="0.8"/>

    <!-- Exhaust Fan Unit Terpasang Menembus Dinding Luar -->
    <rect x="385" y="150" width="40" height="65" rx="3" fill="#334155" stroke="#38BDF8" stroke-width="2"/>
    <!-- Louvers Luar (Gravity Shutter) -->
    <line x1="428" y1="160" x2="438" y2="170" stroke="#38BDF8" stroke-width="2"/>
    <line x1="428" y1="175" x2="438" y2="185" stroke="#38BDF8" stroke-width="2"/>
    <line x1="428" y1="190" x2="438" y2="200" stroke="#38BDF8" stroke-width="2"/>
    <!-- Baling-Baling Kipas -->
    <circle cx="405" cy="182" r="14" fill="#0F172A" stroke="#38BDF8" stroke-width="1.5"/>
    <path d="M 405 172 L 405 192 M 395 182 L 415 182" stroke="#38BDF8" stroke-width="2"/>

    <!-- Celah Pintu Masuk / Make-up Air -->
    <rect x="30" y="270" width="8" height="70" fill="#0284C7"/>
    <path d="M 15 320 L 45 320" stroke="#38BDF8" stroke-width="2.5" marker-end="url(#arrowCyan)"/>
    <text x="40" y="335" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="9" font-weight="700">Udara Pengganti Masuk</text>

    <!-- Aliran Udara: Uap Panas Mengalir Langsung ke Exhaust -->
    <path d="M 150 228 C 170 190, 240 185, 380 182" stroke="#FB923C" stroke-width="3" fill="none" marker-end="url(#arrowOrange)"/>
    <text x="210" y="172" fill="#FB923C" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="700">Uap &amp; Panas Ditarik</text>

    <!-- Hembusan Exhaust Membuang Udara ke Luar Bangunan -->
    <path d="M 425 182 L 490 182" stroke="#34D399" stroke-width="3.5" marker-end="url(#arrowGreen)"/>
    <path d="M 435 170 L 485 160" stroke="#34D399" stroke-width="2.5" marker-end="url(#arrowGreen)"/>
    <path d="M 435 194 L 485 204" stroke="#34D399" stroke-width="2.5" marker-end="url(#arrowGreen)"/>
    <text x="455" y="228" fill="#34D399" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="800" text-anchor="middle">DIBUANG KELUAR</text>

    <!-- Kabinet Bersih & Bebas Kondensasi -->
    <rect x="230" y="140" width="130" height="75" rx="4" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <text x="295" y="180" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="600" text-anchor="middle">Kabinet Tetap Kering</text>
    <text x="295" y="195" fill="#34D399" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="9" font-weight="700" text-anchor="middle">✓ Tanpa Kondensasi</text>

    <!-- Box Penjelasan Teknis & Fakta Fisika -->
    <g transform="translate(16, 355)">
      <rect width="503" height="142" rx="8" fill="#0B132B" stroke="#334155" stroke-width="1.5"/>
      <text x="16" y="22" fill="#F8FAFC" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="12" font-weight="700">Karakteristik &amp; Keunggulan Fisika:</text>

      <circle cx="24" cy="45" r="3" fill="#10B981"/>
      <text x="35" y="49" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="700">Pembuangan Total:</text>
      <text x="145" y="49" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11">Uap air, minyak, panas, dan bau dibuang langsung ke area luar.</text>

      <circle cx="24" cy="72" r="3" fill="#38BDF8"/>
      <text x="35" y="76" fill="#BAE6FD" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="700">Kontrol Lembap:</text>
      <text x="135" y="76" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11">Mencegah kelembapan berlebih &gt;65% RH dan melindungi kabinet.</text>

      <circle cx="24" cy="99" r="3" fill="#F59E0B"/>
      <text x="35" y="103" fill="#FDE68A" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="700">Syarat Mutlak:</text>
      <text x="125" y="103" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11">Wajib ada dinding luar serta pasokan udara pengganti (make-up air).</text>

      <rect x="16" y="115" width="471" height="20" rx="4" fill="#1E293B"/>
      <text x="251" y="129" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="600" text-anchor="middle">Solusi ideal untuk dapur tanpa jendela dengan intensitas memasak rutin</text>
    </g>
  </g>

  <!-- Bottom Global Invariant Footer Note -->
  <text x="600" y="645" fill="#64748B" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="500" text-anchor="middle">Prinsip Rekayasa RancangLoka: Menyaring bau tidak sama dengan membuang kelembapan • Rujukan Standar Fisika Bangunan Tropis</text>
</svg>`;
}

export function generateVentilationEffectivenessSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675" role="img" aria-label="Diagram Kondisi Efektivitas Ventilasi Dapur: Ruang Terisolasi vs Aliran Udara Berimbang">
  <defs>
    <linearGradient id="effBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B132B"/>
      <stop offset="100%" stop-color="#1C2541"/>
    </linearGradient>
    <linearGradient id="effPanelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#0F172A" stop-opacity="0.98"/>
    </linearGradient>
    <marker id="arrowRedEff" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444"/>
    </marker>
    <marker id="arrowCyanEff" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8"/>
    </marker>
    <marker id="arrowGreenEff" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981"/>
    </marker>
    <marker id="arrowOrangeEff" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#F59E0B"/>
    </marker>
  </defs>

  <!-- Background Base -->
  <rect width="1200" height="675" fill="url(#effBgGrad)"/>
  <rect x="2" y="2" width="1196" height="671" rx="14" fill="none" stroke="#334155" stroke-width="2"/>

  <!-- Top Header Banner -->
  <g transform="translate(50, 30)">
    <rect width="1100" height="48" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1.5"/>
    <rect x="12" y="10" width="8" height="28" rx="3" fill="#F59E0B"/>
    <text x="32" y="24" fill="#F59E0B" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="700" letter-spacing="1.5">RANCANGLOKA FISIKA BANGUNAN • ANALISIS KINERJA SISTEM</text>
    <text x="32" y="40" fill="#F8FAFC" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" font-weight="700">Kapan Ventilasi Dapur Kurang Efektif? Keseimbangan Pasokan &amp; Pembuangan</text>
  </g>

  <!-- ========================================================================= -->
  <!-- PANEL KIRI: VENTILASI KURANG EFEKTIF (TANPA UDARA PENGGANTI)              -->
  <!-- ========================================================================= -->
  <g transform="translate(50, 95)">
    <!-- Panel Backdrop -->
    <rect width="535" height="515" rx="12" fill="url(#effPanelGrad)" stroke="#EF4444" stroke-width="1.5" stroke-opacity="0.6"/>

    <!-- Header Badge -->
    <rect x="16" y="16" width="503" height="34" rx="6" fill="#450A0A" stroke="#EF4444" stroke-width="1"/>
    <circle cx="32" cy="33" r="5" fill="#EF4444"/>
    <text x="46" y="37" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="12" font-weight="700" letter-spacing="0.5">KONDISI KURANG EFEKTIF: TANPA UDARA PENGGANTI (VAKUM)</text>

    <!-- Ruang Dapur Tertutup Rapat -->
    <rect x="30" y="70" width="475" height="270" fill="#090D16" stroke="#450A0A" stroke-width="1.5"/>
    <text x="45" y="92" fill="#F87171" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="700">DAPUR TERISOLASI RAPAT</text>

    <!-- Pintu Tertutup Rapat (Tanpa Celah) -->
    <rect x="30" y="180" width="10" height="160" fill="#7F1D1D" stroke="#EF4444" stroke-width="1"/>
    <text x="48" y="240" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="9" font-weight="600">Pintu Rapat</text>
    <text x="48" y="252" fill="#EF4444" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="8" font-weight="700">❌ Tanpa Celah Bawah</text>

    <!-- Kompor Memasak -->
    <rect x="120" y="270" width="160" height="70" rx="3" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <ellipse cx="170" cy="265" rx="12" ry="3" fill="#EF4444"/>
    <rect x="155" y="248" width="30" height="16" rx="2" fill="#475569"/>

    <!-- Kipas Exhaust Bekerja Berat -->
    <rect x="465" y="130" width="40" height="60" rx="3" fill="#1E293B" stroke="#EF4444" stroke-width="2"/>
    <circle cx="485" cy="160" r="12" fill="#450A0A" stroke="#EF4444" stroke-width="1"/>
    <text x="485" y="205" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="8" font-weight="700" text-anchor="middle">Kipas Terhambat</text>

    <!-- Aliran Udara Turbulen / Berputar di Tempat -->
    <path d="M 170 245 C 180 200, 260 210, 240 260 C 220 290, 180 280, 175 255" stroke="#EF4444" stroke-width="2" stroke-dasharray="3 3" fill="none" marker-end="url(#arrowRedEff)"/>
    <path d="M 280 180 C 340 150, 420 180, 455 160" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="2 2" fill="none"/>
    <text x="250" y="165" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="700">Aliran Turbulen (Ruang Vakum)</text>

    <!-- Kabinet Berembun / Kondensasi Parah -->
    <rect x="230" y="110" width="140" height="60" rx="3" fill="#1E293B" stroke="#7F1D1D" stroke-width="1.5"/>
    <text x="300" y="135" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="9" font-weight="600" text-anchor="middle">Kabinet Mengembun</text>
    <!-- Droplets -->
    <circle cx="260" cy="175" r="2.5" fill="#38BDF8"/>
    <circle cx="280" cy="178" r="3" fill="#38BDF8"/>
    <circle cx="305" cy="174" r="2" fill="#38BDF8"/>
    <circle cx="330" cy="177" r="3.5" fill="#38BDF8"/>
    <text x="300" y="195" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Kelembapan &gt; 65% RH</text>

    <!-- Box Penjelasan Kerusakan & Masalah Fisika -->
    <g transform="translate(16, 355)">
      <rect width="503" height="142" rx="8" fill="#0B132B" stroke="#7F1D1D" stroke-width="1.5"/>
      <text x="16" y="22" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="12" font-weight="700">Mekanisme Kegagalan Sistem:</text>

      <circle cx="24" cy="45" r="3" fill="#EF4444"/>
      <text x="35" y="49" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="700">Tekanan Negatif:</text>
      <text x="140" y="49" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11">Kipas membuang udara tanpa ada udara masuk; ruang jadi vakum.</text>

      <circle cx="24" cy="72" r="3" fill="#EF4444"/>
      <text x="35" y="76" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="700">Debit Merosot Drastis:</text>
      <text x="165" y="76" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11">Kapasitas hisap kipas turun drastis karena hambatan aliran balik.</text>

      <circle cx="24" cy="99" r="3" fill="#F59E0B"/>
      <text x="35" y="103" fill="#FDE68A" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="700">Akibat Nyata:</text>
      <text x="115" y="103" fill="#CBD5E1" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11">Uap air mengembun di kabinet, bau terperangkap, motor kipas panas.</text>

      <rect x="16" y="115" width="471" height="20" rx="4" fill="#450A0A"/>
      <text x="251" y="129" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="600" text-anchor="middle">Membeli alat berkapasitas besar tetap sia-sia jika pasokan udara masuk diabaikan</text>
    </g>
  </g>

  <!-- ========================================================================= -->
  <!-- PANEL KANAN: KONDISI EFEKTIF (PASOKAN & PEMBUANGAN SEIMBANG)               -->
  <!-- ========================================================================= -->
  <g transform="translate(615, 95)">
    <!-- Panel Backdrop -->
    <rect width="535" height="515" rx="12" fill="url(#effPanelGrad)" stroke="#10B981" stroke-width="1.5" stroke-opacity="0.6"/>

    <!-- Header Badge -->
    <rect x="16" y="16" width="503" height="34" rx="6" fill="#064E3B" stroke="#10B981" stroke-width="1"/>
    <circle cx="32" cy="33" r="5" fill="#34D399"/>
    <text x="46" y="37" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="12" font-weight="700" letter-spacing="0.5">KONDISI EFEKTIF: PASOKAN &amp; PEMBUANGAN SEIMBANG</text>

    <!-- Ruang Dapur Terbuka Seimbang -->
    <rect x="30" y="70" width="475" height="270" fill="#090D16" stroke="#065F46" stroke-width="1.5"/>
    <text x="45" y="92" fill="#34D399" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="700">SIRKULASI TERKONTROL</text>

    <!-- Pintu dengan Celah Udara Pengganti (Make-up Air Slot) -->
    <rect x="30" y="180" width="10" height="135" fill="#047857" stroke="#10B981" stroke-width="1"/>
    <!-- Celah Bawah Pintu Terbuka 2 cm -->
    <rect x="30" y="315" width="10" height="25" fill="#0284C7"/>
    <path d="M 15 327 L 65 327" stroke="#38BDF8" stroke-width="3" marker-end="url(#arrowCyanEff)"/>
    <text x="48" y="240" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="9" font-weight="600">Pintu Berisi Celah</text>
    <text x="48" y="252" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="8" font-weight="700">✓ Celah Udara Masuk</text>

    <!-- Kompor Memasak -->
    <rect x="150" y="270" width="160" height="70" rx="3" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <ellipse cx="200" cy="265" rx="12" ry="3" fill="#EF4444"/>
    <rect x="185" y="248" width="30" height="16" rx="2" fill="#475569"/>

    <!-- Exhaust Fan Menghisap Lancar -->
    <rect x="465" y="130" width="40" height="60" rx="3" fill="#1E293B" stroke="#10B981" stroke-width="2"/>
    <circle cx="485" cy="160" r="12" fill="#064E3B" stroke="#10B981" stroke-width="1.5"/>
    <text x="485" y="205" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="8" font-weight="700" text-anchor="middle">Hisapan Lancar</text>

    <!-- Aliran Udara Terarah (Laminar Cross Flow) -->
    <path d="M 75 327 C 120 327, 140 300, 190 265" stroke="#38BDF8" stroke-width="2.5" fill="none" marker-end="url(#arrowCyanEff)"/>
    <path d="M 205 245 C 230 190, 350 170, 460 160" stroke="#F59E0B" stroke-width="3" fill="none" marker-end="url(#arrowOrangeEff)"/>
    <!-- Pembuangan Keluar Tembus Dinding -->
    <path d="M 495 160 L 530 160" stroke="#10B981" stroke-width="3.5" marker-end="url(#arrowGreenEff)"/>
    <text x="290" y="175" fill="#FDE68A" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="700">Aliran Udara Menyapu Teratur</text>

    <!-- Kabinet Kering & Nyaman -->
    <rect x="250" y="110" width="140" height="50" rx="3" fill="#1E293B" stroke="#059669" stroke-width="1.5"/>
    <text x="320" y="135" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Kabinet Bersih &amp; Kering</text>
    <text x="320" y="148" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="9" font-weight="600" text-anchor="middle">Kelembapan Aman &lt; 60% RH</text>

    <!-- Box Penjelasan Keberhasilan Fisika -->
    <g transform="translate(16, 355)">
      <rect width="503" height="142" rx="8" fill="#0B132B" stroke="#065F46" stroke-width="1.5"/>
      <text x="16" y="22" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="12" font-weight="700">Kunci Sistem Berjalan Optimal:</text>

      <circle cx="24" cy="45" r="3" fill="#10B981"/>
      <text x="35" y="49" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="700">Make-Up Air Efektif:</text>
      <text x="155" y="49" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11">Celah bawah pintu menyediakan udara masuk menggantikan yang dibuang.</text>

      <circle cx="24" cy="72" r="3" fill="#34D399"/>
      <text x="35" y="76" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="700">Aliran Cross-Flow:</text>
      <text x="150" y="76" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11">Udara bergerak menyapu sumber polutan langsung menuju titik hisap.</text>

      <circle cx="24" cy="99" r="3" fill="#38BDF8"/>
      <text x="35" y="103" fill="#BAE6FD" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="700">Hasil Nyata:</text>
      <text x="110" y="103" fill="#CBD5E1" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11">Dapur tidak pengap, uap air keluar sempurna, dan kabinet bebas jamur.</text>

      <rect x="16" y="115" width="471" height="20" rx="4" fill="#064E3B"/>
      <text x="251" y="129" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10" font-weight="600" text-anchor="middle">Keseimbangan buangan dan pasokan udara adalah prinsip dasar ventilasi sehat</text>
    </g>
  </g>

  <!-- Bottom Global Invariant Footer Note -->
  <text x="600" y="645" fill="#64748B" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="500" text-anchor="middle">Prinsip Rekayasa RancangLoka: Udara tidak bisa dibuang jika tidak ada udara baru yang masuk • Standar Fisika Bangunan Tropis</text>
</svg>`;
}
