/**
 * Cloudflare D1 Database Client with Seamless Fallback for Local Dev
 */

export interface Article {
  id: number;
  slug: string;
  title: string;
  description: string;
  content_md: string;
  content_html: string;
  featured_image: string;
  image_alt: string;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  category_color?: string;
  author_id: number;
  author_name?: string;
  author_avatar?: string;
  author_role?: string;
  status: 'published' | 'draft' | 'scheduled';
  views: number;
  reading_time_minutes: number;
  key_takeaways?: string;
  focus_keyword?: string;
  content_hash?: string;
  is_featured: number;
  is_trending: number;
  is_sponsored?: number;
  disable_internal_links?: number;
  published_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  color_badge: string;
  description: string;
  show_on_home?: number; // 1 = tampil di beranda, 0 = tidak
  display_order?: number; // urutan kolom/section di beranda (1, 2, 3, ...)
  layout_style?: 'bento' | 'grid3' | 'list'; // gaya tata letak section
}

export interface Author {
  id: number;
  name: string;
  slug: string;
  bio: string;
  avatar: string;
  role: string;
  social_links?: string;
}

export interface Page {
  id: number;
  slug: string;
  title: string;
  description: string;
  content_md: string;
  content_html: string;
  featured_image?: string;
  template: 'default' | 'contact' | 'fullwidth';
  status: 'published' | 'draft';
  views: number;
  created_at: string;
  updated_at: string;
}

/// In-Memory Fallback Demo Data for Local Testing & Initial State (Erihome Living Ecosystem)
const MOCK_CATEGORIES: Category[] = [
  { id: 1, name: 'Desain Interior & Estetika', slug: 'interior-design', color_badge: '#059669', description: 'Inspirasi tata ruang, gaya Japandi, palet warna, dan dekorasi estetik untuk hunian nyaman', show_on_home: 1, display_order: 1, layout_style: 'bento' },
  { id: 2, name: 'Smart Home & Otomasi', slug: 'smart-home', color_badge: '#2563eb', description: 'Teknologi IoT rumah tangga, efisiensi energi listrik, dan sistem keamanan pintar', show_on_home: 1, display_order: 2, layout_style: 'grid3' },
  { id: 3, name: 'Arsitektur & Renovasi', slug: 'arsitektur-renovasi', color_badge: '#d97706', description: 'Panduan renovasi hemat bujet, denah rumah open-space, dan material bangunan ramah lingkungan', show_on_home: 1, display_order: 3, layout_style: 'bento' },
  { id: 4, name: 'Gaya Hidup & Hunian', slug: 'lifestyle-hunian', color_badge: '#7c3aed', description: 'Home office ergonomis, tanaman indoor, dan tips menciptakan suasana rumah bebas stres', show_on_home: 1, display_order: 4, layout_style: 'grid3' }
];

const MOCK_AUTHORS: Author[] = [
  {
    id: 1,
    name: 'Dimas Prasetyo, IAI',
    slug: 'dimas-prasetyo',
    bio: 'Principal Architect & Konsultan Tata Ruang Berkelanjutan dengan fokus pada efisiensi energi hunian tropis modern.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'Chief Architectural Editor',
    social_links: JSON.stringify({ twitter: 'https://x.com', linkedin: 'https://linkedin.com', github: 'https://github.com' })
  },
  {
    id: 2,
    name: 'Clarissa Amanda',
    slug: 'clarissa-amanda',
    bio: 'Desainer Interior & Penulis Niche Home Decor dengan keahlian konsep Japandi, Scandinavian, dan Minimalis Fungsional.',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    role: 'Interior Stylist & Columnist',
    social_links: JSON.stringify({ twitter: 'https://x.com', linkedin: 'https://linkedin.com' })
  }
];

const MOCK_SETTINGS: Record<string, string> = {
  site_title: 'RancangLoka',
  site_tagline: 'Inspirasi Desain Interior, Arsitektur & Smart Living',
  site_description: 'Platform editorial terdepan untuk inspirasi arsitektur modern, desain interior estetik, smart home, dan solusi hunian impian di rancangloka.com.',
  site_url: 'https://rancangloka.com',
  site_logo: '',
  site_favicon: '🏡',
  theme_preset: 'elegant-white',
  theme_primary_color: '#1e3a8a', // Deep Luxury Navy
  theme_accent_color: '#d97706',  // Warm Amber
  theme_dark_mode_default: 'light',
  seo_default_og_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80',
  google_analytics_id: '',
  google_search_console_code: '',
  allow_indexing: 'true',
  articles_per_sitemap: '1000',
  share_bar_enabled: 'true',
  share_enable_wa: 'true',
  share_enable_x: 'true',
  share_enable_facebook: 'true',
  share_enable_linkedin: 'true',
  share_enable_telegram: 'true',
  share_enable_copy: 'true',
  share_twitter_handle: '@RancangLoka',
  footer_description: 'Platform media digital independen untuk inspirasi desain interior, inovasi smart home, dan arsitektur hunian modern.',
  social_instagram: 'https://instagram.com/rancangloka',
  social_tiktok: 'https://tiktok.com/@rancangloka',
  social_x: 'https://x.com/rancangloka',
  social_youtube: '',
  social_pinterest: '',
  social_linkedin: '',
  footer_copyright: '© 2026 RancangLoka. All rights reserved. Kurasi editorial independen seputar dunia desain dan hunian modern.'
};

let inMemoryArticles: Article[] = [
  {
    id: 1,
    slug: 'tren-desain-interior-japandi-2026-hunian-minimalis',
    title: 'Tren Desain Interior Japandi 2026: Harmoni Minimalisme Jepang dan Kenyamanan Skandinavia',
    description: 'Menyingkap rahasia perpaduan estetika wabi-sabi dan fungsionalitas Skandinavia untuk menciptakan suasana rumah yang hangat, lapang, dan menenangkan jiwa.',
    content_md: `Gaya hidup perkotaan yang serba cepat mendorong para pemilik rumah mendambakan tempat tinggal yang mampu memberikan ketenangan batin seketika. Konsep **Japandi** (Japanese - Scandinavian) di tahun 2026 berevolusi menjadi pilihan utama keluarga modern yang mengutamakan filosofi kesederhanaan, keterhubungan dengan alam, dan efisiensi ruang.\n\n## Esensi Filosofi Japandi Modern\n\nJapandi bukan sekadar gaya dekorasi, melainkan pertemuan dua filosofi besar:\n- **Wabi-Sabi dari Jepang**: Menghargai keindahan alami, ketidaksempurnaan tekstur kayu, dan kehangatan material bumi.\n- **Hygge dari Denmark**: Mengedepankan kenyamanan ekstra, suasana intim, dan pencahayaan lembut yang menenangkan.\n\n## 4 Elemen Kunci Menerapkan Gaya Japandi di Rumah\n\n### 1. Palet Warna Netral & Nada Bumi (Earth Tones)\nGunakan kombinasi warna putih gading, krem hangat, abu-abu lembut (*greige*), dan aksen terakota atau hijau zaitun. Hindari warna-warna neon yang mencolok agar mata senantiasa rileks.\n\n### 2. Furnitur Berprofil Rendah & Fungsional\nCiri khas utama furnitur Japandi adalah siluet ramping (*clean lines*) dengan ketinggian yang lebih dekat ke lantai. Memilih furnitur berkualitas dari kurasi terpercaya seperti solusi hunian modern di **Erihome** membantu menghadirkan furnitur kayu kokoh yang hemat tempat dan multifungsi.\n\n### 3. Pencahayaan Alami & Indirect Lighting\nMaksimalkan masuknya cahaya matahari di siang hari dengan tirai tipis (*sheer curtains*). Pada malam hari, gunakan lampu hangat (*warm white 2700K - 3000K*) dengan pencahayaan tersembunyi (*cove lighting*) atau standing lamp berpenutup kertas washi.\n\n### 4. Sentuhan Tanaman Indoor & Keramik Bertekstur\nTambahkan aksen alami dengan tanaman berdaun ramping seperti Bonsai Ficus, Sansevieria, atau Monstera dalam pot gerabah alami.\n\n## Kesimpulan\n\nMenata rumah dengan gaya Japandi adalah investasi jangka panjang untuk kualitas istirahat dan kebahagiaan keluarga. Rumah yang bersih dari kekacauan barang (*clutter-free*) secara ilmiah terbukti menurunkan tingkat stres harian.`,
    content_html: `<p>Gaya hidup perkotaan yang serba cepat mendorong para pemilik rumah mendambakan tempat tinggal yang mampu memberikan ketenangan batin seketika. Konsep <strong>Japandi</strong> (Japanese - Scandinavian) di tahun 2026 berevolusi menjadi pilihan utama keluarga modern yang mengutamakan filosofi kesederhanaan, keterhubungan dengan alam, dan efisiensi ruang.</p><h2 id="esensi-filosofi-japandi-modern">Esensi Filosofi Japandi Modern</h2><p>Japandi bukan sekadar gaya dekorasi, melainkan pertemuan dua filosofi besar:</p><ul><li><strong>Wabi-Sabi dari Jepang</strong>: Menghargai keindahan alami, ketidaksempurnaan tekstur kayu, dan kehangatan material bumi.</li><li><strong>Hygge dari Denmark</strong>: Mengedepankan kenyamanan ekstra, suasana intim, dan pencahayaan lembut yang menenangkan.</li></ul><h2 id="4-elemen-kunci-menerapkan-gaya-japandi-di-rumah">4 Elemen Kunci Menerapkan Gaya Japandi di Rumah</h2><h3 id="1-palet-warna-netral-nada-bumi-earth-tones">1. Palet Warna Netral &amp; Nada Bumi (Earth Tones)</h3><p>Gunakan kombinasi warna putih gading, krem hangat, abu-abu lembut (<em>greige</em>), dan aksen terakota atau hijau zaitun. Hindari warna-warna neon yang mencolok agar mata senantiasa rileks.</p><h3 id="2-furnitur-berprofil-rendah-fungsional">2. Furnitur Berprofil Rendah &amp; Fungsional</h3><p>Ciri khas utama furnitur Japandi adalah siluet ramping (<em>clean lines</em>) dengan ketinggian yang lebih dekat ke lantai. Memilih furnitur berkualitas dari kurasi terpercaya seperti solusi hunian modern di <strong>Erihome</strong> membantu menghadirkan furnitur kayu kokoh yang hemat tempat dan multifungsi.</p><h3 id="3-pencahayaan-alami-indirect-lighting">3. Pencahayaan Alami &amp; Indirect Lighting</h3><p>Maksimalkan masuknya cahaya matahari di siang hari dengan tirai tipis (<em>sheer curtains</em>). Pada malam hari, gunakan lampu hangat (<em>warm white 2700K - 3000K</em>) dengan pencahayaan tersembunyi (<em>cove lighting</em>) atau standing lamp berpenutup kertas washi.</p><h3 id="4-sentuhan-tanaman-indoor-keramik-bertekstur">4. Sentuhan Tanaman Indoor &amp; Keramik Bertekstur</h3><p>Tambahkan aksen alami dengan tanaman berdaun ramping seperti Bonsai Ficus, Sansevieria, atau Monstera dalam pot gerabah alami.</p><h2 id="kesimpulan">Kesimpulan</h2><p>Menata rumah dengan gaya Japandi adalah investasi jangka panjang untuk kualitas istirahat dan kebahagiaan keluarga. Rumah yang bersih dari kekacauan barang (<em>clutter-free</em>) secara ilmiah terbukti menurunkan tingkat stres harian.</p>`,
    featured_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=720&auto=format&fit=crop&q=75',
    image_alt: 'Ruang tamu modern bergaya Japandi dengan pencahayaan alami dan furnitur kayu elegan',
    category_id: 1,
    category_name: 'Desain Interior & Estetika',
    category_slug: 'interior-design',
    category_color: '#059669',
    author_id: 2,
    author_name: 'Clarissa Amanda',
    author_avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    author_role: 'Interior Stylist & Columnist',
    status: 'published',
    views: 2450,
    reading_time_minutes: 5,
    key_takeaways: JSON.stringify([
      'Gaya Japandi menggabungkan kehangatan wabi-sabi Jepang dan fungsionalitas Skandinavia.',
      'Penggunaan furnitur berprofil rendah dan palet earth tones membuat ruangan sempit terasa lebih lapang.',
      'Pencahayaan berlapis (layered lighting) kunci utama menciptakan suasana rileks di malam hari.'
    ]),
    focus_keyword: 'desain interior japandi 2026',
    content_hash: 'erihomehash1',
    is_featured: 1,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 2,
    slug: 'panduan-smart-home-otomasi-energi-2026',
    title: 'Panduan Membangun Smart Home 2026: Otomasi Pencahayaan & Efisiensi Energi Listrik',
    description: 'Cara mudah mengintegrasikan perangkat pintar IoT untuk memangkas tagihan listrik hingga 35% sekaligus meningkatkan kenyamanan dan keamanan hunian.',
    content_md: `Rumah pintar (*smart home*) bukan lagi kemewahan futuristik yang rumit. Di tahun 2026, adopsi protokol standar universal seperti Matter memudahkan perangkat pintar saling terhubung secara mulus.\n\n## Langkah Awal Otomasi Rumah Ramah Energi\n\n1. **Smart Switch & Dimmer**: Mengatur jadwal mati-nyala lampu secara otomatis saat penghuni meninggalkan ruangan.\n2. **Sensor Gerak & Suhu Terintegrasi**: Mengatur temperatur AC secara presisi sesuai keberadaan orang di dalam kamar.\n3. **Smart Power Monitoring**: Mengetahui beban konsumsi watt peralatan elektronik secara real-time dari smartphone.\n\nDengan perancangan ekosistem rumah pintar yang tepat melalui panduan rekomendasi **Erihome**, kenyamanan hidup meningkat pesat tanpa khawatir tagihan listrik membengkak.`,
    content_html: `<p>Rumah pintar (<em>smart home</em>) bukan lagi kemewahan futuristik yang rumit. Di tahun 2026, adopsi protokol standar universal seperti Matter memudahkan perangkat pintar saling terhubung secara mulus.</p><h2 id="langkah-awal-otomasi-rumah-ramah-energi">Langkah Awal Otomasi Rumah Ramah Energi</h2><ol><li><strong>Smart Switch &amp; Dimmer</strong>: Mengatur jadwal mati-nyala lampu secara otomatis saat penghuni meninggalkan ruangan.</li><li><strong>Sensor Gerak &amp; Suhu Terintegrasi</strong>: Mengatur temperatur AC secara presisi sesuai keberadaan orang di dalam kamar.</li><li><strong>Smart Power Monitoring</strong>: Mengetahui beban konsumsi watt peralatan elektronik secara real-time dari smartphone.</li></ol><p>Dengan perancangan ekosistem rumah pintar yang tepat melalui panduan rekomendasi <strong>Erihome</strong>, kenyamanan hidup meningkat pesat tanpa khawatir tagihan listrik membengkak.</p>`,
    featured_image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600&auto=format&fit=crop&q=75',
    image_alt: 'Perangkat kontrol smart home dengan antarmuka digital modern',
    category_id: 2,
    category_name: 'Smart Home & Otomasi',
    category_slug: 'smart-home',
    category_color: '#2563eb',
    author_id: 1,
    author_name: 'Dimas Prasetyo, IAI',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Chief Architectural Editor',
    status: 'published',
    views: 1890,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Otomasi smart thermostat dan sensor suhu memangkas konsumsi listrik hingga 35%.',
      'Standar protokol Matter memastikan kompatibilitas antar berbagai merk perangkat IoT.',
      'Sistem smart security dapat dimonitor secara aman dan langsung dari smartphone.'
    ]),
    focus_keyword: 'panduan smart home 2026 hemat energi',
    content_hash: 'erihomehash2',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 6).toISOString()
  },
  {
    id: 3,
    slug: 'tips-renovasi-rumah-tipe-36-open-space',
    title: 'Tips Renovasi Rumah Tipe 36 Menjadi Terasa Luas: Konsep Open Space & Void Atap',
    description: 'Solusi arsitektural cerdas mengubah rumah mungil tipe 36/60 menjadi hunian modern yang lega, terang, dan memiliki sirkulasi udara alami optimal.',
    content_md: `Memiliki rumah tipe 36 sering kali memicu tantangan keterbatasan ruang. Namun dengan pendekatan arsitektur yang tepat, luas terbatas dapat dioptimalkan secara maksimal.\n\n## Solusi Tata Ruang Bebas Sekat (*Open Space*)\n\nMenghilangkan dinding masif pemisah antara ruang tamu, ruang keluarga, dan dapur menciptakan ilusi ruang yang jauh lebih luas. Manfaatkan partisi transparan atau rak buku dua sisi sebagai pembatas semi-privat.\n\n## Penambahan Void & Skylight Alami\n\nMembuat bukaan void setinggi 4-5 meter di area tengah rumah tidak hanya memberikan pencahayaan alami gratis sepanjang hari, tetapi juga mengalirkan udara panas keluar melalui efek cerobong (*stack effect*).`,
    content_html: `<p>Memiliki rumah tipe 36 sering kali memicu tantangan keterbatasan ruang. Namun dengan pendekatan arsitektur yang tepat, luas terbatas dapat dioptimalkan secara maksimal.</p><h2 id="solusi-tata-ruang-bebas-sekat-open-space">Solusi Tata Ruang Bebas Sekat (<em>Open Space</em>)</h2><p>Menghilangkan dinding masif pemisah antara ruang tamu, ruang keluarga, dan dapur menciptakan ilusi ruang yang jauh lebih luas. Manfaatkan partisi transparan atau rak buku dua sisi sebagai pembatas semi-privat.</p><h2 id="penambahan-void-skylight-alami">Penambahan Void &amp; Skylight Alami</h2><p>Membuat bukaan void setinggi 4-5 meter di area tengah rumah tidak hanya memberikan pencahayaan alami gratis sepanjang hari, tetapi juga mengalirkan udara panas keluar melalui efek cerobong (<em>stack effect</em>).</p>`,
    featured_image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&auto=format&fit=crop&q=75',
    image_alt: 'Desain ruang keluarga minimalis open space yang terang dan lapang',
    category_id: 3,
    category_name: 'Arsitektur & Renovasi',
    category_slug: 'arsitektur-renovasi',
    category_color: '#d97706',
    author_id: 1,
    author_name: 'Dimas Prasetyo, IAI',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Chief Architectural Editor',
    status: 'published',
    views: 3120,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Konsep open space tanpa sekat masif membuat rumah tipe 36 terasa 2x lebih lega.',
      'Void atap dan skylight menghemat lampu siang hari dan memperlancar sirkulasi udara.',
      'Gunakan furnitur berpenyimpanan tersembunyi untuk menjaga kerapian ruangan.'
    ]),
    focus_keyword: 'renovasi rumah tipe 36 open space',
    content_hash: 'erihomehash3',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 4,
    slug: 'trik-menata-kamar-tidur-minimalis-hotel-bintang-lima',
    title: '7 Trik Menata Kamar Tidur Minimalis Agar Senyaman Hotel Berbintang Lima',
    description: 'Panduan praktis memilih bedding berkualitas, tata pencahayaan hangat, dan tips bebas debu untuk kualitas tidur yang maksimal setiap malam.',
    content_md: `Kamar tidur adalah tempat pemulihan energi setelah seharian beraktivitas. Menata kamar tidur dengan standar kenyamanan hotel berbintang tidak harus menguras kantong jika Anda mengetahui rahasia intinya.\n\n## Kunci Utama Kenyamanan Kamar Tidur\n\n1. **Bedding Katun Alami Berkualitas**: Pilih sprei katun 100% dengan kerapatan benang (*thread count*) minimal 300 TC yang lembut dan sejuk di kulit.\n2. **Pencahayaan Ambience Berlapis**: Gunakan lampu dinding (*wall sconce*) di samping tempat tidur untuk membaca tanpa menyilaukan mata.\n3. **Bebas dari Kekacauan Barang (*Hidden Storage*)**: Gunakan dipan berlaci atau lemari pakaian berpintu geser rata dinding.`,
    content_html: `<p>Kamar tidur adalah tempat pemulihan energi setelah seharian beraktivitas. Menata kamar tidur dengan standar kenyamanan hotel berbintang tidak harus menguras kantong jika Anda mengetahui rahasia intinya.</p><h2 id="kunci-utama-kenyamanan-kamar-tidur">Kunci Utama Kenyamanan Kamar Tidur</h2><ol><li><strong>Bedding Katun Alami Berkualitas</strong>: Pilih sprei katun 100% dengan kerapatan benang (<em>thread count</em>) minimal 300 TC yang lembut dan sejuk di kulit.</li><li><strong>Pencahayaan Ambience Berlapis</strong>: Gunakan lampu dinding (<em>wall sconce</em>) di samping tempat tidur untuk membaca tanpa menyilaukan mata.</li><li><strong>Bebas dari Kekacauan Barang (<em>Hidden Storage</em>)</strong>: Gunakan dipan berlaci atau lemari pakaian berpintu geser rata dinding.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600&auto=format&fit=crop&q=75',
    image_alt: 'Kamar tidur minimalis estetik dengan pencahayaan hangat dan sprei rapi',
    category_id: 1,
    category_name: 'Desain Interior & Estetika',
    category_slug: 'interior-design',
    category_color: '#059669',
    author_id: 2,
    author_name: 'Clarissa Amanda',
    author_avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    author_role: 'Interior Stylist & Columnist',
    status: 'published',
    views: 1650,
    reading_time_minutes: 3,
    key_takeaways: JSON.stringify([
      'Sprei katun 100% dengan serat alami kunci kenyamanan tidur sepanjang malam.',
      'Suhu warna lampu 2700K merangsang hormon melatonin untuk tidur lebih cepat dan nyenyak.'
    ]),
    focus_keyword: 'kamar tidur minimalis hotel',
    content_hash: 'erihomehash4',
    is_featured: 0,
    is_trending: 0,
    published_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 18).toISOString()
  },
  {
    id: 5,
    slug: 'desain-home-office-ergonomis-wfh-produktif',
    title: 'Menciptakan Ruang Kerja (Home Office) Ergonomis di Rumah: Tingkatkan Fokus & Produktivitas',
    description: 'Panduan lengkap memilih kursi ergonomis, ketinggian meja ideal, pencahayaan bebas silau, dan tanaman penyaring udara untuk WFH tanpa sakit punggung.',
    content_md: `Bekerja dari rumah (*Work From Home*) menuntut area kerja yang mendukung postur tubuh sehat dan konsentrasi tinggi dalam durasi panjang.\n\n## Aspek Penting Ruang Kerja Ergonomis\n\n- **Ketinggian Monitor Sejajar Mata**: Mengurangi ketegangan leher dan pundak.\n- **Kursi dengan Penopang Lumbar**: Menjaga lekukan alami tulang belakang.\n- **Pencahayaan Alami dari Samping**: Mencegah silau pada layar laptop dan kelelahan mata.`,
    content_html: `<p>Bekerja dari rumah (<em>Work From Home</em>) menuntut area kerja yang mendukung postur tubuh sehat dan konsentrasi tinggi dalam durasi panjang.</p><h2 id="aspek-penting-ruang-kerja-ergonomis">Aspek Penting Ruang Kerja Ergonomis</h2><ul><li><strong>Ketinggian Monitor Sejajar Mata</strong>: Mengurangi ketegangan leher dan pundak.</li><li><strong>Kursi dengan Penopang Lumbar</strong>: Menjaga lekukan alami tulang belakang.</li><li><strong>Pencahayaan Alami dari Samping</strong>: Mencegah silau pada layar laptop dan kelelahan mata.</li></ul>`,
    featured_image: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&auto=format&fit=crop&q=75',
    image_alt: 'Ruang kerja rumah home office minimalis dengan tanaman hias dan meja kayu',
    category_id: 4,
    category_name: 'Gaya Hidup & Hunian',
    category_slug: 'lifestyle-hunian',
    category_color: '#7c3aed',
    author_id: 2,
    author_name: 'Clarissa Amanda',
    author_avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    author_role: 'Interior Stylist & Columnist',
    status: 'published',
    views: 1420,
    reading_time_minutes: 3,
    key_takeaways: JSON.stringify([
      'Posisi monitor sejajar pandangan mata mencegah sakit leher saat bekerja seharian.',
      'Tanaman indoor seperti Sansevieria membantu menyegarkan udara di ruang kerja.'
    ]),
    focus_keyword: 'desain home office ergonomis',
    content_hash: 'erihomehash5',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24).toISOString()
  }
];

let inMemoryPages: Page[] = [
  {
    id: 1,
    slug: 'tentang-kami',
    title: 'Tentang RancangLoka',
    description: 'Mengenal visi RancangLoka sebagai platform media kurasi arsitektur, desain interior estetik, dan solusi hunian modern Indonesia.',
    content_md: `## Visi Kami\n\n**RancangLoka** adalah media editorial independen yang didedikasikan untuk menginspirasi masyarakat Indonesia dalam mewujudkan hunian impian yang fungsional, bernilai estetika tinggi, dan selaras dengan alam.\n\n## Pendekatan Editorial\n\nKami mengkurasi tren arsitektur tropis, filosofi desain Japandi, inovasi rumah pintar (*smart home*), dan panduan renovasi terukur melalui kolaborasi dengan arsitek berlisensi serta desainer interior profesional.\n\n## Komitmen Kualitas (E-E-A-T)\n\nSetiap artikel yang kami terbitkan melalui riset mendalam, verifikasi data teknis material, dan penulisan berbasis pengalaman (*hands-on expertise*) untuk memberikan nilai guna nyata bagi para pemilik rumah.`,
    content_html: `<h2>Visi Kami</h2><p><strong>RancangLoka</strong> adalah media editorial independen yang didedikasikan untuk menginspirasi masyarakat Indonesia dalam mewujudkan hunian impian yang fungsional, bernilai estetika tinggi, dan selaras dengan alam.</p><h2>Pendekatan Editorial</h2><p>Kami mengkurasi tren arsitektur tropis, filosofi desain Japandi, inovasi rumah pintar (<em>smart home</em>), dan panduan renovasi terukur melalui kolaborasi dengan arsitek berlisensi serta desainer interior profesional.</p><h2>Komitmen Kualitas (E-E-A-T)</h2><p>Setiap artikel yang kami terbitkan melalui riset mendalam, verifikasi data teknis material, dan penulisan berbasis pengalaman (<em>hands-on expertise</em>) untuk memberikan nilai guna nyata bagi para pemilik rumah.</p>`,
    featured_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=720&auto=format&fit=crop&q=75',
    template: 'default',
    status: 'published',
    views: 850,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 48).toISOString()
  },
  {
    id: 2,
    slug: 'kontak',
    title: 'Hubungi Redaksi RancangLoka',
    description: 'Saluran komunikasi resmi redaksi RancangLoka untuk pertanyaan editorial, kolaborasi, pengiriman karya arsitektur, dan kemitraan media.',
    content_md: `## Hubungi Tim Redaksi\n\nKami selalu terbuka untuk kolaborasi editorial, liputan karya arsitektur/interior, rilis pers, dan kerja sama kemitraan.\n\n### Alamat Kantor Editorial\n**RancangLoka Media Network**  \nCyber 2 Tower, Kuningan, Jakarta Selatan, Indonesia  \nEmail: **redaksi@rancangloka.com**  \nKerja Sama & Iklan: **partner@rancangloka.com**\n\n---\n\nSilakan kirimkan pesan Anda melalui formulir di bawah ini:`,
    content_html: `<h2>Hubungi Tim Redaksi</h2><p>Kami selalu terbuka untuk kolaborasi editorial, liputan karya arsitektur/interior, rilis pers, dan kerja sama kemitraan.</p><h3>Alamat Kantor Editorial</h3><p><strong>RancangLoka Media Network</strong><br>Cyber 2 Tower, Kuningan, Jakarta Selatan, Indonesia<br>Email: <strong>redaksi@rancangloka.com</strong><br>Kerja Sama &amp; Iklan: <strong>partner@rancangloka.com</strong></p><hr><p>Silakan kirimkan pesan Anda melalui formulir di bawah ini:</p>`,
    featured_image: '',
    template: 'contact',
    status: 'published',
    views: 420,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 48).toISOString()
  },
  {
    id: 3,
    slug: 'pedoman-media-siber',
    title: 'Pedoman Pemberitaan Media Siber',
    description: 'Komitmen kepatuhan standar kode etik jurnalistik dan pedoman pemberitaan media siber RancangLoka.',
    content_md: `Kemerdekaan berpendapat, kemerdekaan berekspresi, dan kemerdekaan pers adalah hak asasi manusia yang dilindungi Pancasila, Undang-Undang Dasar 1945, dan Deklarasi Universal Hak Asasi Manusia PBB.\n\n**RancangLoka** menjunjung tinggi Kode Etik Jurnalistik dan Pedoman Pemberitaan Media Siber dalam menyajikan seluruh informasi arsitektur, properti, dan hunian secara akurat, berimbang, dan bertanggung jawab.`,
    content_html: `<p>Kemerdekaan berpendapat, kemerdekaan berekspresi, dan kemerdekaan pers adalah hak asasi manusia yang dilindungi Pancasila, Undang-Undang Dasar 1945, dan Deklarasi Universal Hak Asasi Manusia PBB.</p><p><strong>RancangLoka</strong> menjunjung tinggi Kode Etik Jurnalistik dan Pedoman Pemberitaan Media Siber dalam menyajikan seluruh informasi arsitektur, properti, dan hunian secara akurat, berimbang, dan bertanggung jawab.</p>`,
    featured_image: '',
    template: 'default',
    status: 'published',
    views: 290,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 48).toISOString()
  },
  {
    id: 4,
    slug: 'kebijakan-privasi',
    title: 'Kebijakan Privasi (Privacy Policy)',
    description: 'Kebijakan perlindungan data dan privasi pengguna di platform RancangLoka.',
    content_md: `Di **RancangLoka**, privasi pengunjung kami adalah hal yang sangat penting. Dokumen Kebijakan Privasi ini menguraikan jenis informasi pribadi yang diterima dan dikumpulkan oleh RancangLoka serta bagaimana informasi tersebut digunakan secara aman.`,
    content_html: `<p>Di <strong>RancangLoka</strong>, privasi pengunjung kami adalah hal yang sangat penting. Dokumen Kebijakan Privasi ini menguraikan jenis informasi pribadi yang diterima dan dikumpulkan oleh RancangLoka serta bagaimana informasi tersebut digunakan secara aman.</p>`,
    featured_image: '',
    template: 'default',
    status: 'published',
    views: 310,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 48).toISOString()
  }
];

export async function getDb(locals?: any) {
  return locals?.runtime?.env?.DB || null;
}

export async function getAllArticles(db: any, limit = 50, offset = 0, status = 'published'): Promise<Article[]> {
  if (db) {
    try {
      const { results } = await db
        .prepare(`
          SELECT a.*, c.name as category_name, c.slug as category_slug, c.color_badge as category_color,
                 au.name as author_name, au.avatar as author_avatar, au.role as author_role
          FROM articles a
          LEFT JOIN categories c ON a.category_id = c.id
          LEFT JOIN authors au ON a.author_id = au.id
          WHERE (? IS NULL OR a.status = ?)
          ORDER BY a.published_at DESC
          LIMIT ? OFFSET ?
        `)
        .bind(status === 'all' ? null : status, status === 'all' ? null : status, limit, offset)
        .all();
      if (results && results.length > 0) return results as Article[];
    } catch (e) {
      console.warn('D1 Query fallback to mock:', e);
    }
  }
  return inMemoryArticles.filter(a => status === 'all' || a.status === status).slice(offset, offset + limit);
}

export async function getTotalArticlesCount(db: any, status = 'published'): Promise<number> {
  if (db) {
    try {
      const result = await db
        .prepare('SELECT COUNT(*) as count FROM articles WHERE (? IS NULL OR status = ?)')
        .bind(status === 'all' ? null : status, status === 'all' ? null : status)
        .first();
      if (result && typeof result.count === 'number') return result.count;
    } catch (e) {
      console.warn('D1 count fallback:', e);
    }
  }
  return inMemoryArticles.filter(a => status === 'all' || a.status === status).length;
}

export async function getArticleBySlug(db: any, slug: string): Promise<Article | null> {
  if (db) {
    try {
      const result = await db
        .prepare(`
          SELECT a.*, c.name as category_name, c.slug as category_slug, c.color_badge as category_color,
                 au.name as author_name, au.avatar as author_avatar, au.role as author_role
          FROM articles a
          LEFT JOIN categories c ON a.category_id = c.id
          LEFT JOIN authors au ON a.author_id = au.id
          WHERE a.slug = ?
          LIMIT 1
        `)
        .bind(slug)
        .first();
      if (result) return result as Article;
    } catch (e) {
      console.warn('D1 Query fallback to mock:', e);
    }
  }
  return inMemoryArticles.find(a => a.slug === slug) || null;
}

export async function getRelatedArticles(db: any, currentId: number, categoryId: number, limit = 4): Promise<Article[]> {
  if (db) {
    try {
      const { results } = await db
        .prepare(`
          SELECT a.*, c.name as category_name, c.slug as category_slug, c.color_badge as category_color,
                 au.name as author_name, au.avatar as author_avatar, au.role as author_role
          FROM articles a
          LEFT JOIN categories c ON a.category_id = c.id
          LEFT JOIN authors au ON a.author_id = au.id
          WHERE a.id != ? AND a.category_id = ? AND a.status = 'published'
          ORDER BY a.published_at DESC
          LIMIT ?
        `)
        .bind(currentId, categoryId, limit)
        .all();
      if (results && results.length > 0) return results as Article[];
    } catch (e) {
      console.warn('D1 Query fallback:', e);
    }
  }
  const related = inMemoryArticles.filter(a => a.id !== currentId && a.category_id === categoryId && a.status === 'published');
  if (related.length < limit) {
    const others = inMemoryArticles.filter(a => a.id !== currentId && a.category_id !== categoryId && a.status === 'published');
    return [...related, ...others].slice(0, limit);
  }
  return related.slice(0, limit);
}

export async function getAllCategories(db: any): Promise<Category[]> {
  if (db) {
    try {
      const { results } = await db.prepare('SELECT * FROM categories ORDER BY id ASC').all();
      if (results && results.length > 0) return results as Category[];
    } catch (e) {
      console.warn('D1 Query fallback:', e);
    }
  }
  return MOCK_CATEGORIES;
}

export async function insertCategory(db: any, cat: Partial<Category>): Promise<Category> {
  const newId = MOCK_CATEGORIES.length > 0 ? Math.max(...MOCK_CATEGORIES.map(c => c.id)) + 1 : 1;
  const newCat: Category = {
    id: newId,
    name: cat.name || 'Kategori Baru',
    slug: cat.slug || `kategori-${newId}`,
    color_badge: cat.color_badge || '#2563eb',
    description: cat.description || '',
    show_on_home: cat.show_on_home !== undefined ? cat.show_on_home : 1,
    display_order: cat.display_order || (MOCK_CATEGORIES.length + 1),
    layout_style: cat.layout_style || 'bento'
  };

  if (db) {
    try {
      await db
        .prepare('INSERT INTO categories (name, slug, color_badge, description, show_on_home, display_order, layout_style) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(newCat.name, newCat.slug, newCat.color_badge, newCat.description, newCat.show_on_home, newCat.display_order, newCat.layout_style)
        .run();
    } catch (e) {
      console.warn('D1 Insert Category fallback:', e);
    }
  }

  MOCK_CATEGORIES.push(newCat);
  return newCat;
}

export async function updateCategoryLayout(db: any, updates: Array<{ id: number; show_on_home: number; display_order: number; layout_style: string }>): Promise<void> {
  for (const item of updates) {
    const found = MOCK_CATEGORIES.find(c => c.id === item.id);
    if (found) {
      found.show_on_home = item.show_on_home;
      found.display_order = item.display_order;
      found.layout_style = item.layout_style as any;
    }
    if (db) {
      try {
        await db
          .prepare('UPDATE categories SET show_on_home = ?, display_order = ?, layout_style = ? WHERE id = ?')
          .bind(item.show_on_home, item.display_order, item.layout_style, item.id)
          .run();
      } catch (e) {
        console.warn('D1 Update Category Layout fallback:', e);
      }
    }
  }
}

export async function deleteCategory(db: any, id: number): Promise<void> {
  const idx = MOCK_CATEGORIES.findIndex(c => c.id === id);
  if (idx !== -1) MOCK_CATEGORIES.splice(idx, 1);

  if (db) {
    try {
      await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 Delete Category fallback:', e);
    }
  }
}

export async function getAllAuthors(db: any): Promise<Author[]> {
  if (db) {
    try {
      const { results } = await db.prepare('SELECT * FROM authors ORDER BY id ASC').all();
      if (results && results.length > 0) return results as Author[];
    } catch (e) {
      console.warn('D1 Query fallback:', e);
    }
  }
  return MOCK_AUTHORS;
}

export async function insertAuthor(db: any, author: Partial<Author>): Promise<Author> {
  const newId = MOCK_AUTHORS.length > 0 ? Math.max(...MOCK_AUTHORS.map(a => a.id)) + 1 : 1;
  const newAuthor: Author = {
    id: newId,
    name: author.name || 'Penulis Baru',
    slug: author.slug || `author-${newId}`,
    bio: author.bio || '',
    avatar: author.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: author.role || 'Contributor',
    social_links: author.social_links || '{}'
  };

  if (db) {
    try {
      await db
        .prepare('INSERT INTO authors (name, slug, bio, avatar, role, social_links) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(newAuthor.name, newAuthor.slug, newAuthor.bio, newAuthor.avatar, newAuthor.role, newAuthor.social_links)
        .run();
    } catch (e) {
      console.warn('D1 Insert Author fallback:', e);
    }
  }

  MOCK_AUTHORS.push(newAuthor);
  return newAuthor;
}

export async function deleteAuthor(db: any, id: number): Promise<void> {
  const idx = MOCK_AUTHORS.findIndex(a => a.id === id);
  if (idx !== -1) MOCK_AUTHORS.splice(idx, 1);

  if (db) {
    try {
      await db.prepare('DELETE FROM authors WHERE id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 Delete Author fallback:', e);
    }
  }
}

export async function getSiteSettings(db: any): Promise<Record<string, string>> {
  if (db) {
    try {
      const { results } = await db.prepare('SELECT key, value FROM settings').all();
      if (results && results.length > 0) {
        const settings: Record<string, string> = {};
        for (const row of results as { key: string; value: string }[]) {
          settings[row.key] = row.value;
        }
        return { ...MOCK_SETTINGS, ...settings };
      }
    } catch (e) {
      console.warn('D1 Query fallback:', e);
    }
  }
  return MOCK_SETTINGS;
}

export async function updateSiteSettings(db: any, newSettings: Record<string, string>): Promise<void> {
  Object.assign(MOCK_SETTINGS, newSettings);
  if (db) {
    try {
      for (const [key, value] of Object.entries(newSettings)) {
        await db
          .prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP')
          .bind(key, String(value))
          .run();
      }
    } catch (e) {
      console.warn('D1 Update Settings fallback:', e);
    }
  }
}

export async function checkDuplicateArticle(db: any, slug: string, contentHash?: string): Promise<{ isDuplicate: boolean; existingArticle?: Article; reason?: string }> {
  if (db) {
    try {
      // 1. Check Slug match
      const bySlug = await db.prepare('SELECT * FROM articles WHERE slug = ? LIMIT 1').bind(slug).first();
      if (bySlug) {
        return { isDuplicate: true, existingArticle: bySlug as Article, reason: 'Slug / Judul sudah ada di database' };
      }
      // 2. Check Content Hash match
      if (contentHash) {
        const byHash = await db.prepare('SELECT * FROM articles WHERE content_hash = ? LIMIT 1').bind(contentHash).first();
        if (byHash) {
          return { isDuplicate: true, existingArticle: byHash as Article, reason: 'Konten sama persis dengan artikel yang sudah ada' };
        }
      }
    } catch (e) {
      console.warn('D1 Check Duplicate fallback:', e);
    }
  }

  const foundBySlug = inMemoryArticles.find(a => a.slug === slug);
  if (foundBySlug) return { isDuplicate: true, existingArticle: foundBySlug, reason: 'Slug / Judul sudah ada di database' };

  if (contentHash) {
    const foundByHash = inMemoryArticles.find(a => a.content_hash === contentHash);
    if (foundByHash) return { isDuplicate: true, existingArticle: foundByHash, reason: 'Konten sama persis dengan artikel yang sudah ada' };
  }

  return { isDuplicate: false };
}

export async function insertArticle(db: any, article: Partial<Article>): Promise<Article> {
  const newId = inMemoryArticles.length > 0 ? Math.max(...inMemoryArticles.map(a => a.id)) + 1 : 1;
  const fullArticle: Article = {
    id: newId,
    slug: article.slug || `article-${newId}`,
    title: article.title || 'Untitled',
    description: article.description || '',
    content_md: article.content_md || '',
    content_html: article.content_html || '',
    featured_image: article.featured_image || MOCK_SETTINGS.seo_default_og_image,
    image_alt: article.image_alt || article.title || '',
    category_id: article.category_id || 1,
    author_id: article.author_id || 1,
    status: article.status || 'published',
    views: 0,
    reading_time_minutes: article.reading_time_minutes || 3,
    key_takeaways: article.key_takeaways || '[]',
    focus_keyword: article.focus_keyword || '',
    content_hash: article.content_hash || '',
    is_featured: article.is_featured || 0,
    is_trending: article.is_trending || 0,
    is_sponsored: article.is_sponsored || 0,
    disable_internal_links: article.disable_internal_links || 0,
    published_at: article.published_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (db) {
    try {
      await db
        .prepare(`
          INSERT INTO articles (slug, title, description, content_md, content_html, featured_image, image_alt, category_id, author_id, status, reading_time_minutes, key_takeaways, focus_keyword, content_hash, is_featured, is_trending, is_sponsored, disable_internal_links, published_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          fullArticle.slug,
          fullArticle.title,
          fullArticle.description,
          fullArticle.content_md,
          fullArticle.content_html,
          fullArticle.featured_image,
          fullArticle.image_alt,
          fullArticle.category_id,
          fullArticle.author_id,
          fullArticle.status,
          fullArticle.reading_time_minutes,
          fullArticle.key_takeaways,
          fullArticle.focus_keyword,
          fullArticle.content_hash,
          fullArticle.is_featured,
          fullArticle.is_trending,
          fullArticle.is_sponsored,
          fullArticle.disable_internal_links,
          fullArticle.published_at,
          fullArticle.updated_at
        )
        .run();
    } catch (e) {
      console.warn('D1 insert failed, adding to memory:', e);
    }
  }

  inMemoryArticles.unshift(fullArticle);
  return fullArticle;
}

// ==========================================
// 📄 STATIC PAGES OPERATIONS (WordPress-Style)
// ==========================================

export async function getAllPages(db: any, status?: 'published' | 'draft'): Promise<Page[]> {
  if (db) {
    try {
      let query = 'SELECT * FROM pages ORDER BY created_at DESC';
      if (status) {
        query = 'SELECT * FROM pages WHERE status = ? ORDER BY created_at DESC';
        const res = await db.prepare(query).bind(status).all();
        if (res?.results && res.results.length > 0) {
          return res.results as Page[];
        }
      } else {
        const res = await db.prepare(query).all();
        if (res?.results && res.results.length > 0) {
          return res.results as Page[];
        }
      }
    } catch (e) {
      console.warn('D1 getAllPages fallback to in-memory:', e);
    }
  }

  if (status) {
    return inMemoryPages.filter(p => p.status === status);
  }
  return inMemoryPages;
}

export async function getPageBySlug(db: any, slug: string): Promise<Page | null> {
  if (db) {
    try {
      const page = await db.prepare('SELECT * FROM pages WHERE slug = ? LIMIT 1').bind(slug).first();
      if (page) {
        // Increment views
        db.prepare('UPDATE pages SET views = views + 1 WHERE slug = ?').bind(slug).run().catch(() => {});
        return page as Page;
      }
    } catch (e) {
      console.warn('D1 getPageBySlug fallback to in-memory:', e);
    }
  }

  const found = inMemoryPages.find(p => p.slug === slug);
  if (found) {
    found.views += 1;
    return found;
  }
  return null;
}

export async function getPageById(db: any, id: number): Promise<Page | null> {
  if (db) {
    try {
      const page = await db.prepare('SELECT * FROM pages WHERE id = ? LIMIT 1').bind(id).first();
      if (page) return page as Page;
    } catch (e) {
      console.warn('D1 getPageById fallback:', e);
    }
  }
  return inMemoryPages.find(p => p.id === id) || null;
}

export async function insertPage(db: any, page: Partial<Page>): Promise<Page> {
  const newId = inMemoryPages.length > 0 ? Math.max(...inMemoryPages.map(p => p.id)) + 1 : 1;
  const fullPage: Page = {
    id: newId,
    slug: page.slug || `page-${newId}`,
    title: page.title || 'Untitled Page',
    description: page.description || '',
    content_md: page.content_md || '',
    content_html: page.content_html || '',
    featured_image: page.featured_image || '',
    template: page.template || 'default',
    status: page.status || 'published',
    views: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (db) {
    try {
      await db
        .prepare(`
          INSERT INTO pages (slug, title, description, content_md, content_html, featured_image, template, status, views, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          fullPage.slug,
          fullPage.title,
          fullPage.description,
          fullPage.content_md,
          fullPage.content_html,
          fullPage.featured_image,
          fullPage.template,
          fullPage.status,
          fullPage.views,
          fullPage.created_at,
          fullPage.updated_at
        )
        .run();
    } catch (e) {
      console.warn('D1 insertPage fallback to in-memory:', e);
    }
  }

  inMemoryPages.unshift(fullPage);
  return fullPage;
}

export async function updatePage(db: any, id: number, page: Partial<Page>): Promise<Page | null> {
  const existing = await getPageById(db, id);
  if (!existing) return null;

  const updated: Page = {
    ...existing,
    ...page,
    updated_at: new Date().toISOString()
  };

  if (db) {
    try {
      await db
        .prepare(`
          UPDATE pages SET slug = ?, title = ?, description = ?, content_md = ?, content_html = ?, featured_image = ?, template = ?, status = ?, updated_at = ?
          WHERE id = ?
        `)
        .bind(
          updated.slug,
          updated.title,
          updated.description,
          updated.content_md,
          updated.content_html,
          updated.featured_image || '',
          updated.template,
          updated.status,
          updated.updated_at,
          id
        )
        .run();
    } catch (e) {
      console.warn('D1 updatePage fallback:', e);
    }
  }

  const idx = inMemoryPages.findIndex(p => p.id === id);
  if (idx !== -1) inMemoryPages[idx] = updated;

  return updated;
}

export async function deletePage(db: any, id: number): Promise<boolean> {
  if (db) {
    try {
      await db.prepare('DELETE FROM pages WHERE id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 deletePage fallback:', e);
    }
  }

  const idx = inMemoryPages.findIndex(p => p.id === id);
  if (idx !== -1) {
    inMemoryPages.splice(idx, 1);
    return true;
  }
  return false;
}

// ----------------------------------------------------
// NEWSLETTER SUBSCRIBERS
// ----------------------------------------------------
export interface Subscriber {
  id: number;
  email: string;
  status: 'active' | 'unsubscribed';
  source?: string;
  created_at: string;
}

let inMemorySubscribers: Subscriber[] = [];

export async function addSubscriber(db: any, email: string, source: string = 'website'): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, message: 'Format email tidak valid.' };
  }

  if (db) {
    try {
      await db
        .prepare('INSERT OR IGNORE INTO subscribers (email, status, source) VALUES (?, ?, ?)')
        .bind(cleanEmail, 'active', source)
        .run();
      return { success: true, message: 'Terima kasih! Anda berhasil berlangganan buletin RancangLoka.' };
    } catch (e: any) {
      if (e.message && e.message.includes('UNIQUE')) {
        return { success: true, message: 'Email Anda sudah terdaftar di buletin kami.' };
      }
      console.warn('D1 addSubscriber fallback:', e);
    }
  }

  const exists = inMemorySubscribers.some(s => s.email === cleanEmail);
  if (!exists) {
    inMemorySubscribers.push({
      id: inMemorySubscribers.length + 1,
      email: cleanEmail,
      status: 'active',
      source,
      created_at: new Date().toISOString()
    });
  }
  return { success: true, message: 'Terima kasih! Anda berhasil berlangganan buletin RancangLoka.' };
}

export async function getSubscribers(db: any): Promise<Subscriber[]> {
  if (db) {
    try {
      const { results } = await db
        .prepare('SELECT * FROM subscribers ORDER BY created_at DESC')
        .all();
      return results as Subscriber[];
    } catch (e) {
      console.warn('D1 getSubscribers fallback:', e);
    }
  }
  return inMemorySubscribers;
}

export async function deleteSubscriber(db: any, id: number): Promise<boolean> {
  if (db) {
    try {
      await db.prepare('DELETE FROM subscribers WHERE id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 deleteSubscriber fallback:', e);
    }
  }

  const idx = inMemorySubscribers.findIndex(s => s.id === id);
  if (idx !== -1) {
    inMemorySubscribers.splice(idx, 1);
    return true;
  }
  return true;
}

