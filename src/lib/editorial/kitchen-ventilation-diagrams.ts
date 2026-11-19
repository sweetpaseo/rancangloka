/**
 * RancangLoka — Architectural Technical Visual Engine
 * Kitchen Ventilation Diagrams (Canary #10011 — Refined Engineering Edition)
 *
 * Implements refined architectural schematic diagrams:
 * 1. Inline 1: Cooker Hood Resirkulasi vs Exhaust Fan Dinding Airflow Comparison.
 *    - Nuanced source capture (near cooktop) vs general room dilution/exhaust.
 *    - Balanced distinction: recirculation filtration vs outdoor ducted discharge.
 *    - Zero absolute claims ("100% terbuang" replaced with accurate physics).
 * 2. Inline 2: Ventilation Effectiveness, Airflow Obstacles & Make-up Air Balance.
 *    - Nuanced: "aliran udara pengganti menuju jalur pembuangan" (no unverified laminar claims).
 *    - Contextual condensation & trapped moisture (no unverified absolute RH claims).
 *
 * Invariants:
 * - Strictly 16:9 aspect ratio (viewBox="0 0 1200 675").
 * - Zero text clipping (safe margin >= 45px, generous inner padding).
 * - Zero pricing or currency numbers (absolute Monetary Silence).
 * - Zero internal test or placeholder text.
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
  <g transform="translate(50, 28)">
    <rect width="1100" height="50" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1.5"/>
    <rect x="14" y="10" width="8" height="30" rx="3" fill="#38BDF8"/>
    <text x="34" y="25" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" letter-spacing="1.5">RANCANGLOKA FISIKA BANGUNAN • DIAGRAM ALIRAN UDARA DAPUR</text>
    <text x="34" y="41" fill="#F8FAFC" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">Komparasi Prinsip Kerja: Resirkulasi Tertutup vs Pembuangan ke Luar</text>
  </g>

  <!-- ========================================================================= -->
  <!-- PANEL KIRI: COOKER HOOD RESIRKULASI (PENANGKAPAN LOKAL & FILTRASI)        -->
  <!-- ========================================================================= -->
  <g transform="translate(50, 92)">
    <rect width="535" height="520" rx="12" fill="url(#panelGrad)" stroke="#334155" stroke-width="1.5"/>

    <!-- Header Badge -->
    <rect x="16" y="16" width="503" height="34" rx="6" fill="#0F172A" stroke="#F59E0B" stroke-width="1"/>
    <circle cx="32" cy="33" r="5" fill="#F59E0B"/>
    <text x="46" y="37" fill="#F59E0B" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" letter-spacing="0.5">COOKER HOOD RESIRKULASI (PENANGKAPAN LOKAL &amp; FILTRASI)</text>

    <!-- Ruang Dapur & Plafon -->
    <path d="M 30 70 L 505 70 L 505 345 L 30 345 Z" fill="#090D16" stroke="#1E293B" stroke-width="1"/>
    <line x1="30" y1="120" x2="505" y2="120" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 4"/>
    <text x="40" y="112" fill="#64748B" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="600">PLAFON RUANG DAPUR</text>

    <!-- Meja Dapur / Countertop & Kompor -->
    <rect x="60" y="265" width="300" height="80" rx="4" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <rect x="80" y="255" width="140" height="10" rx="2" fill="#334155"/>
    <text x="150" y="300" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" text-anchor="middle">Area Kompor Memasak</text>

    <!-- Panci & Titik Panas -->
    <rect x="120" y="235" width="60" height="20" rx="3" fill="#475569" stroke="#64748B" stroke-width="1"/>
    <path d="M 115 240 L 120 240 M 180 240 L 185 240" stroke="#94A3B8" stroke-width="2"/>
    <ellipse cx="150" cy="254" rx="14" ry="3" fill="#EF4444" opacity="0.8"/>

    <!-- Unit Cooker Hood (Posisi Sumber Dekat Kompor 65-75 cm) -->
    <path d="M 90 185 L 210 185 L 180 145 L 120 145 Z" fill="#334155" stroke="#64748B" stroke-width="1.5"/>
    <rect x="120" y="120" width="60" height="25" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>

    <!-- Filter Lemak & Filter Karbon Aktif -->
    <line x1="96" y1="183" x2="204" y2="183" stroke="#CBD5E1" stroke-width="3"/>
    <text x="218" y="185" fill="#CBD5E1" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="9" font-weight="600">Filter Lemak Logam (Tangkap Minyak)</text>
    <line x1="102" y1="174" x2="198" y2="174" stroke="#10B981" stroke-width="3"/>
    <text x="218" y="173" fill="#34D399" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="9" font-weight="600">Filter Karbon Aktif (Serap Bau)</text>

    <!-- Kisi Louvre Hembusan Atas -->
    <line x1="125" y1="126" x2="175" y2="126" stroke="#94A3B8" stroke-width="1.5"/>
    <line x1="125" y1="132" x2="175" y2="132" stroke="#94A3B8" stroke-width="1.5"/>

    <!-- Aliran Udara Naik dari Kompor -->
    <path d="M 140 230 C 135 210, 138 200, 142 188" stroke="#FB923C" stroke-width="2.5" fill="none" marker-end="url(#arrowOrange)"/>
    <path d="M 150 230 C 150 210, 150 200, 150 188" stroke="#FB923C" stroke-width="2.5" fill="none" marker-end="url(#arrowOrange)"/>
    <path d="M 160 230 C 165 210, 162 200, 158 188" stroke="#FB923C" stroke-width="2.5" fill="none" marker-end="url(#arrowOrange)"/>
    <text x="65" y="215" fill="#FB923C" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="700">Uap, Panas &amp; Bau</text>

    <!-- Aliran Udara Keluar KEMBALI KE RUANG DAPUR -->
    <path d="M 130 120 C 110 95, 70 120, 65 170 C 60 210, 65 240, 75 255" stroke="#94A3B8" stroke-width="2.5" stroke-dasharray="4 3" fill="none" marker-end="url(#arrowGray)"/>
    <path d="M 170 120 C 190 95, 270 110, 275 160 C 280 200, 270 230, 260 255" stroke="#94A3B8" stroke-width="2.5" stroke-dasharray="4 3" fill="none" marker-end="url(#arrowGray)"/>
    <text x="285" y="145" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="700">Udara Bersih Minyak/Bau</text>
    <text x="285" y="158" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="9" font-weight="600">Diresirkulasi Kembali ke Dapur</text>

    <!-- Kabinet Dapur & Uap Bertahan -->
    <rect x="290" y="170" width="180" height="95" rx="4" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <text x="380" y="215" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" text-anchor="middle">Kabinet Atas Dapur</text>
    <circle cx="310" cy="252" r="2.5" fill="#38BDF8"/>
    <circle cx="325" cy="256" r="2" fill="#38BDF8"/>
    <circle cx="340" cy="253" r="3" fill="#38BDF8"/>
    <circle cx="360" cy="257" r="2.5" fill="#38BDF8"/>
    <text x="380" y="278" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Uap Air Berisiko Mengembun</text>

    <!-- Box Penjelasan Teknis & Batasan Fisika -->
    <g transform="translate(16, 360)">
      <rect width="503" height="142" rx="8" fill="#0B132B" stroke="#334155" stroke-width="1.5"/>
      <text x="16" y="22" fill="#F8FAFC" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="12" font-weight="700">Karakteristik &amp; Peran Sistem:</text>

      <circle cx="24" cy="45" r="3" fill="#10B981"/>
      <text x="35" y="49" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="600">Penangkapan Lokal:</text>
      <text x="150" y="49" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11">Menangkap minyak dan menyerap bau langsung di atas kompor.</text>

      <circle cx="24" cy="72" r="3" fill="#F59E0B"/>
      <text x="35" y="76" fill="#FDE68A" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="700">Uap Air &amp; Panas:</text>
      <text x="140" y="76" fill="#CBD5E1" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11">Sebagian besar uap air &amp; panas tetap bertahan di dalam ruangan.</text>

      <circle cx="24" cy="99" r="3" fill="#38BDF8"/>
      <text x="35" y="103" fill="#BAE6FD" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="600">Kebutuhan Ruang:</text>
      <text x="145" y="103" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11">Praktis tanpa bukaan luar; perhatikan kelembapan saat masak lama.</text>

      <rect x="16" y="115" width="471" height="20" rx="4" fill="#1E293B"/>
      <text x="251" y="129" fill="#CBD5E1" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" text-anchor="middle">Sangat tepat bila dinding luar jauh &amp; prioritas adalah mengurangi bau di sumbernya</text>
    </g>
  </g>

  <!-- ========================================================================= -->
  <!-- PANEL KANAN: EXHAUST FAN DINDING (VENTILASI UMUM DENGAN PEMBUANGAN KELUAR) -->
  <!-- ========================================================================= -->
  <g transform="translate(615, 92)">
    <rect width="535" height="520" rx="12" fill="url(#panelGrad)" stroke="#334155" stroke-width="1.5"/>

    <!-- Header Badge -->
    <rect x="16" y="16" width="503" height="34" rx="6" fill="#0F172A" stroke="#0284C7" stroke-width="1"/>
    <circle cx="32" cy="33" r="5" fill="#38BDF8"/>
    <text x="46" y="37" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" letter-spacing="0.5">EXHAUST FAN DINDING (VENTILASI UMUM DENGAN PEMBUANGAN KE LUAR)</text>

    <!-- Ruang Dapur & Dinding Luar Potongan Arsitektur -->
    <path d="M 30 70 L 400 70 L 400 345 L 30 345 Z" fill="#090D16" stroke="#1E293B" stroke-width="1"/>
    <line x1="30" y1="120" x2="400" y2="120" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 4"/>
    <text x="40" y="112" fill="#64748B" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="600">PLAFON RUANG DAPUR</text>

    <!-- Dinding Luar Bata Tebal Berpotongan Arsitektur -->
    <rect x="400" y="70" width="105" height="275" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <text x="452" y="105" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" text-anchor="middle">DINDING LUAR</text>
    <text x="452" y="118" fill="#64748B" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="9" text-anchor="middle">Udara Bebas</text>

    <!-- Meja Kompor -->
    <rect x="60" y="265" width="220" height="80" rx="4" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <rect x="80" y="255" width="140" height="10" rx="2" fill="#334155"/>
    <text x="150" y="300" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" text-anchor="middle">Meja Kompor</text>

    <!-- Panci Memasak -->
    <rect x="120" y="235" width="60" height="20" rx="3" fill="#475569" stroke="#64748B" stroke-width="1"/>
    <ellipse cx="150" cy="254" rx="14" ry="3" fill="#EF4444" opacity="0.8"/>

    <!-- Exhaust Fan Menembus Dinding Luar -->
    <rect x="385" y="150" width="40" height="65" rx="3" fill="#334155" stroke="#38BDF8" stroke-width="2"/>
    <line x1="428" y1="160" x2="438" y2="170" stroke="#38BDF8" stroke-width="2"/>
    <line x1="428" y1="175" x2="438" y2="185" stroke="#38BDF8" stroke-width="2"/>
    <line x1="428" y1="190" x2="438" y2="200" stroke="#38BDF8" stroke-width="2"/>
    <circle cx="405" cy="182" r="14" fill="#0F172A" stroke="#38BDF8" stroke-width="1.5"/>
    <path d="M 405 172 L 405 192 M 395 182 L 415 182" stroke="#38BDF8" stroke-width="2"/>

    <!-- Celah Pintu Masuk (Make-up Air) -->
    <rect x="30" y="275" width="8" height="70" fill="#0284C7"/>
    <path d="M 15 325 L 45 325" stroke="#38BDF8" stroke-width="2.5" marker-end="url(#arrowCyan)"/>
    <text x="40" y="340" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="9" font-weight="700">Udara Pengganti Masuk</text>

    <!-- Aliran Udara Menuju Exhaust -->
    <path d="M 150 230 C 180 195, 250 185, 380 182" stroke="#FB923C" stroke-width="3" fill="none" marker-end="url(#arrowOrange)"/>
    <text x="210" y="172" fill="#FB923C" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="700">Udara Ruangan Ditarik</text>

    <!-- Hembusan Pembuangan ke Luar Bangunan -->
    <path d="M 425 182 L 490 182" stroke="#34D399" stroke-width="3.5" marker-end="url(#arrowGreen)"/>
    <path d="M 435 170 L 485 160" stroke="#34D399" stroke-width="2.5" marker-end="url(#arrowGreen)"/>
    <path d="M 435 194 L 485 204" stroke="#34D399" stroke-width="2.5" marker-end="url(#arrowGreen)"/>
    <text x="455" y="228" fill="#34D399" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" text-anchor="middle">DIALIRKAN KE LUAR</text>

    <!-- Kabinet Dapur Kering -->
    <rect x="230" y="140" width="130" height="75" rx="4" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <text x="295" y="180" fill="#94A3B8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" text-anchor="middle">Kabinet Lebih Terjaga</text>
    <text x="295" y="195" fill="#34D399" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Pengurangan Lembap Ruang</text>

    <!-- Box Penjelasan Teknis & Fakta Fisika -->
    <g transform="translate(16, 360)">
      <rect width="503" height="142" rx="8" fill="#0B132B" stroke="#334155" stroke-width="1.5"/>
      <text x="16" y="22" fill="#F8FAFC" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="12" font-weight="700">Karakteristik &amp; Peran Sistem:</text>

      <circle cx="24" cy="45" r="3" fill="#10B981"/>
      <text x="35" y="49" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="700">Pembuangan ke Luar:</text>
      <text x="165" y="49" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11">Udara yang terhisap dialirkan ke luar; efektifitas bergantung posisi.</text>

      <circle cx="24" cy="72" r="3" fill="#38BDF8"/>
      <text x="35" y="76" fill="#BAE6FD" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="700">Ventilasi Umum:</text>
      <text x="135" y="76" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11">Menguras udara ruangan; asap sempat menyebar sebelum mencapai fan.</text>

      <circle cx="24" cy="99" r="3" fill="#F59E0B"/>
      <text x="35" y="103" fill="#FDE68A" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="700">Catatan Saluran:</text>
      <text x="135" y="103" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11">Hood berducting menangkap di kompor lalu membuang ke luar.</text>

      <rect x="16" y="115" width="471" height="20" rx="4" fill="#1E293B"/>
      <text x="251" y="129" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" text-anchor="middle">Solusi ventilasi umum ruangan yang baik bila jalur dinding luar tersedia</text>
    </g>
  </g>

  <!-- Bottom Global Invariant Footer Note -->
  <text x="600" y="647" fill="#64748B" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="500" text-anchor="middle">Prinsip Rekayasa RancangLoka: Bedakan filtrasi lokal di kompor, ventilasi umum ruangan, dan pembuangan saluran ke luar</text>
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
  <g transform="translate(50, 28)">
    <rect width="1100" height="50" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1.5"/>
    <rect x="14" y="10" width="8" height="30" rx="3" fill="#F59E0B"/>
    <text x="34" y="25" fill="#F59E0B" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" letter-spacing="1.5">RANCANGLOKA FISIKA BANGUNAN • ANALISIS KINERJA SISTEM</text>
    <text x="34" y="41" fill="#F8FAFC" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">Kapan Ventilasi Dapur Kurang Efektif? Keseimbangan Pasokan &amp; Pembuangan</text>
  </g>

  <!-- ========================================================================= -->
  <!-- PANEL KIRI: VENTILASI KURANG EFEKTIF (TANPA UDARA PENGGANTI)              -->
  <!-- ========================================================================= -->
  <g transform="translate(50, 92)">
    <rect width="535" height="520" rx="12" fill="url(#effPanelGrad)" stroke="#EF4444" stroke-width="1.5" stroke-opacity="0.6"/>

    <!-- Header Badge -->
    <rect x="16" y="16" width="503" height="34" rx="6" fill="#450A0A" stroke="#EF4444" stroke-width="1"/>
    <circle cx="32" cy="33" r="5" fill="#EF4444"/>
    <text x="46" y="37" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" letter-spacing="0.5">KONDISI KURANG EFEKTIF: TANPA UDARA PENGGANTI (VAKUM SEBAGIAN)</text>

    <!-- Ruang Dapur Tertutup Rapat -->
    <rect x="30" y="70" width="475" height="275" fill="#090D16" stroke="#450A0A" stroke-width="1.5"/>
    <text x="45" y="92" fill="#F87171" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="700">DAPUR TERISOLASI RAPAT</text>

    <!-- Pintu Tertutup Rapat (Tanpa Celah) -->
    <rect x="30" y="180" width="10" height="165" fill="#7F1D1D" stroke="#EF4444" stroke-width="1"/>
    <text x="48" y="240" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="9" font-weight="600">Pintu Rapat</text>
    <text x="48" y="252" fill="#EF4444" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="8" font-weight="700">❌ Tanpa Celah Udara Masuk</text>

    <!-- Kompor Memasak -->
    <rect x="120" y="275" width="160" height="70" rx="3" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <ellipse cx="170" cy="270" rx="12" ry="3" fill="#EF4444"/>
    <rect x="155" y="253" width="30" height="16" rx="2" fill="#475569"/>

    <!-- Kipas Bekerja Melawan Tekanan -->
    <rect x="465" y="130" width="40" height="60" rx="3" fill="#1E293B" stroke="#EF4444" stroke-width="2"/>
    <circle cx="485" cy="160" r="12" fill="#450A0A" stroke="#EF4444" stroke-width="1"/>
    <text x="485" y="205" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="8" font-weight="700" text-anchor="middle">Hisapan Terhambat</text>

    <!-- Aliran Udara Turbulen -->
    <path d="M 170 248 C 180 200, 260 210, 240 260 C 220 290, 180 280, 175 255" stroke="#EF4444" stroke-width="2" stroke-dasharray="3 3" fill="none" marker-end="url(#arrowRedEff)"/>
    <path d="M 280 180 C 340 150, 420 180, 455 160" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="2 2" fill="none"/>
    <text x="250" y="165" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="700">Pusaran Udara Lemah (Hambatan Aliran Balik)</text>

    <!-- Kabinet Berembun -->
    <rect x="230" y="110" width="140" height="60" rx="3" fill="#1E293B" stroke="#7F1D1D" stroke-width="1.5"/>
    <text x="300" y="135" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="9" font-weight="600" text-anchor="middle">Kabinet Atas Dapur</text>
    <circle cx="260" cy="175" r="2.5" fill="#38BDF8"/>
    <circle cx="280" cy="178" r="3" fill="#38BDF8"/>
    <circle cx="305" cy="174" r="2" fill="#38BDF8"/>
    <circle cx="330" cy="177" r="3.5" fill="#38BDF8"/>
    <text x="300" y="195" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Kondensasi &amp; Uap Mengendap</text>

    <!-- Box Penjelasan Teknis -->
    <g transform="translate(16, 360)">
      <rect width="503" height="142" rx="8" fill="#0B132B" stroke="#7F1D1D" stroke-width="1.5"/>
      <text x="16" y="22" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="12" font-weight="700">Mekanisme Hambatan Sirkulasi:</text>

      <circle cx="24" cy="45" r="3" fill="#EF4444"/>
      <text x="35" y="49" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="700">Tekanan Negatif:</text>
      <text x="145" y="49" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11">Kipas membuang udara tanpa ada udara pengganti; ruang jadi vakum.</text>

      <circle cx="24" cy="72" r="3" fill="#EF4444"/>
      <text x="35" y="76" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="700">Penurunan Debit:</text>
      <text x="145" y="76" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11">Daya hisap berkurang drastis karena kipas bekerja melawan hambatan ruang.</text>

      <circle cx="24" cy="99" r="3" fill="#F59E0B"/>
      <text x="35" y="103" fill="#FDE68A" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="700">Dampak Nyata:</text>
      <text x="130" y="103" fill="#CBD5E1" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11">Uap air menumpuk, bau bertahan lama, dan motor kipas cepat panas.</text>

      <rect x="16" y="115" width="471" height="20" rx="4" fill="#450A0A"/>
      <text x="251" y="129" fill="#FCA5A5" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" text-anchor="middle">Kapasitas alat yang besar tetap kurang efektif jika jalur udara masuk tidak ada</text>
    </g>
  </g>

  <!-- ========================================================================= -->
  <!-- PANEL KANAN: KONDISI BERIMBANG (PASOKAN & PEMBUANGAN TERENCANA)           -->
  <!-- ========================================================================= -->
  <g transform="translate(615, 92)">
    <rect width="535" height="520" rx="12" fill="url(#effPanelGrad)" stroke="#10B981" stroke-width="1.5" stroke-opacity="0.6"/>

    <!-- Header Badge -->
    <rect x="16" y="16" width="503" height="34" rx="6" fill="#064E3B" stroke="#10B981" stroke-width="1"/>
    <circle cx="32" cy="33" r="5" fill="#34D399"/>
    <text x="46" y="37" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" letter-spacing="0.5">KONDISI BERIMBANG: PASOKAN UDARA PENGGANTI TERENCANA</text>

    <!-- Ruang Dapur Terbuka Seimbang -->
    <rect x="30" y="70" width="475" height="275" fill="#090D16" stroke="#065F46" stroke-width="1.5"/>
    <text x="45" y="92" fill="#34D399" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="700">SIRKULASI TERKONTROL</text>

    <!-- Pintu dengan Celah Udara Pengganti -->
    <rect x="30" y="180" width="10" height="140" fill="#047857" stroke="#10B981" stroke-width="1"/>
    <rect x="30" y="320" width="10" height="25" fill="#0284C7"/>
    <path d="M 15 332 L 65 332" stroke="#38BDF8" stroke-width="3" marker-end="url(#arrowCyanEff)"/>
    <text x="48" y="240" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="9" font-weight="600">Pintu Berisi Celah</text>
    <text x="48" y="252" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="8" font-weight="700">✓ Celah Udara Masuk</text>

    <!-- Kompor Memasak -->
    <rect x="150" y="275" width="160" height="70" rx="3" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <ellipse cx="200" cy="270" rx="12" ry="3" fill="#EF4444"/>
    <rect x="185" y="253" width="30" height="16" rx="2" fill="#475569"/>

    <!-- Exhaust Fan Menghisap Lancar -->
    <rect x="465" y="130" width="40" height="60" rx="3" fill="#1E293B" stroke="#10B981" stroke-width="2"/>
    <circle cx="485" cy="160" r="12" fill="#064E3B" stroke="#10B981" stroke-width="1.5"/>
    <text x="485" y="205" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="8" font-weight="700" text-anchor="middle">Hisapan Lancar</text>

    <!-- Aliran Udara Pengganti Menuju Jalur Pembuangan -->
    <path d="M 75 332 C 120 332, 140 305, 190 270" stroke="#38BDF8" stroke-width="2.5" fill="none" marker-end="url(#arrowCyanEff)"/>
    <path d="M 205 250 C 230 195, 350 170, 460 160" stroke="#F59E0B" stroke-width="3" fill="none" marker-end="url(#arrowOrangeEff)"/>
    <path d="M 495 160 L 530 160" stroke="#10B981" stroke-width="3.5" marker-end="url(#arrowGreenEff)"/>
    <text x="310" y="175" fill="#FDE68A" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="700">Aliran Udara Pengganti Menuju Jalur Pembuangan</text>

    <!-- Kabinet Lebih Terjaga -->
    <rect x="250" y="110" width="140" height="50" rx="3" fill="#1E293B" stroke="#059669" stroke-width="1.5"/>
    <text x="320" y="135" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="9" font-weight="700" text-anchor="middle">Permukaan Kabinet Terjaga</text>
    <text x="320" y="148" fill="#38BDF8" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="9" font-weight="600" text-anchor="middle">Uap Air Mengalir Bertahap ke Luar</text>

    <!-- Box Penjelasan Teknis -->
    <g transform="translate(16, 360)">
      <rect width="503" height="142" rx="8" fill="#0B132B" stroke="#065F46" stroke-width="1.5"/>
      <text x="16" y="22" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="12" font-weight="700">Kunci Sistem Berjalan Optimal:</text>

      <circle cx="24" cy="45" r="3" fill="#10B981"/>
      <text x="35" y="49" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="700">Pasokan Udara Masuk:</text>
      <text x="175" y="49" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11">Celah pintu/ventilasi menyediakan udara masuk pengganti yang dibuang.</text>

      <circle cx="24" cy="72" r="3" fill="#34D399"/>
      <text x="35" y="76" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="700">Pola Aliran Terarah:</text>
      <text x="160" y="76" fill="#E2E8F0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11">Udara mengalir terarah menuju titik hisap tanpa pusaran vakum.</text>

      <circle cx="24" cy="99" r="3" fill="#38BDF8"/>
      <text x="35" y="103" fill="#BAE6FD" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="700">Pengurangan Lembap:</text>
      <text x="175" y="103" fill="#CBD5E1" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11">Uap air terbuang bertahap, sirkulasi lancar, dan risiko pengap berkurang.</text>

      <rect x="16" y="115" width="471" height="20" rx="4" fill="#064E3B"/>
      <text x="251" y="129" fill="#A7F3D0" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" text-anchor="middle">Keseimbangan buangan dan pasokan udara pengganti adalah kunci sirkulasi sehat</text>
    </g>
  </g>

  <!-- Bottom Global Invariant Footer Note -->
  <text x="600" y="647" fill="#64748B" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="11" font-weight="500" text-anchor="middle">Prinsip Rekayasa RancangLoka: Efektivitas hisapan bergantung pada ketersediaan jalur udara pengganti dan tata letak ruang</text>
</svg>`;
}
