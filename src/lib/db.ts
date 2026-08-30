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
    name: 'Dewan Redaksi Spasial RancangLoka',
    slug: 'dewan-redaksi-spasial',
    bio: 'Tim kurasi independen RancangLoka yang fokus pada analisis sirkulasi udara, pencahayaan alami, dan efisiensi spasial hunian tropis kontemporer.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'Kurator Utama Tata Ruang Tropis',
    social_links: JSON.stringify({ email: 'redaksi@rancangloka.com' })
  },
  {
    id: 2,
    name: 'Tim Riset Materialitas RancangLoka',
    slug: 'tim-riset-materialitas',
    bio: 'Kolektif riset spesifikasi material bangunan ramah lingkungan, isolasi termal pasif, dan pengujian durabilitas iklim tropis lembap.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'Editor Spesifikasi & Material',
    social_links: JSON.stringify({ email: 'redaksi@rancangloka.com' })
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

const inMemoryArticles: Article[] = [
  // 1. ARSITEKTUR & FASAD (5 Articles)
  {
    id: 1,
    slug: 'rumah-tropis-yang-tidak-takut-matahari',
    title: 'Rumah Tropis yang Tidak Takut Matahari: Rekayasa Secondary Skin & Cross-Ventilation',
    description: 'Bagaimana kisi-kisi kayu ulin dan kanopi gantung membiaskan radiasi panas siang hari tanpa mengorbankan pasokan cahaya alami.',
    content_md: `Tinggal di iklim tropis lembap menuntut kejelian merespons orientasi lintasan matahari. Menutup rapat fasad dengan tirai tebal bukanlah solusi yang sehat bagi ruang dalam.\n\n## Prinsip Menjinakkan Radiasi Tropis\n\n1. **Kisi-Kisi Kayu & Aluminium Vertikal**: Mengurangi radiasi panas matahari sore hingga 60% tanpa menghalangi aliran udara alami.\n2. **Sumbu Ventilasi Silang (*Cross Ventilation*)**: Bukaan berhadapan yang mengalirkan udara sejuk melintasi ruang keluarga.\n3. **Overhang Atap yang Dalam**: Mencegah tampias air hujan sekaligus menaungi bidang kaca dari paparan langsung.\n\n## Matriks Evaluasi & Trade-off\n\n- **Kelebihan**: Suhu dinding lebih stabil, cahaya alami melimpah, sirkulasi udara kontinu.\n- **Konsekuensi Desain**: Memerlukan struktur angkur baja tahan karat dan perawatan berkala pada lapisan coating kayu ulin.`,
    content_html: `<p>Tinggal di iklim tropis lembap menuntut kejelian merespons orientasi lintasan matahari. Menutup rapat fasad dengan tirai tebal bukanlah solusi yang sehat bagi ruang dalam.</p><h2 id="prinsip-menjinakkan-radiasi-tropis">Prinsip Menjinakkan Radiasi Tropis</h2><ol><li><strong>Kisi-Kisi Kayu &amp; Aluminium Vertikal</strong>: Mengurangi radiasi panas matahari sore hingga 60% tanpa menghalangi aliran udara alami.</li><li><strong>Sumbu Ventilasi Silang (<em>Cross Ventilation</em>)</strong>: Bukaan berhadapan yang mengalirkan udara sejuk melintasi ruang keluarga.</li><li><strong>Overhang Atap yang Dalam</strong>: Mencegah tampias air hujan sekaligus menaungi bidang kaca.</li></ol><h2 id="matriks-evaluasi-trade-off">Matriks Evaluasi &amp; Trade-off</h2><ul><li><strong>Kelebihan</strong>: Suhu dinding lebih stabil, cahaya alami melimpah, sirkulasi udara kontinu.</li><li><strong>Konsekuensi Desain</strong>: Memerlukan struktur angkur baja tahan karat dan perawatan berkala pada lapisan coating kayu ulin.</li></ul>`,
    featured_image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Fasad rumah tropis dengan kisi-kisi kayu sekunder dan taman hijau',
    category_id: 3,
    category_name: 'Arsitektur & Renovasi',
    category_slug: 'arsitektur-renovasi',
    category_color: '#d97706',
    author_id: 1,
    author_name: 'Dewan Redaksi Spasial RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Kurator Utama Tata Ruang Tropis',
    status: 'published',
    views: 3890,
    reading_time_minutes: 5,
    key_takeaways: JSON.stringify([
      'Secondary skin membiaskan radiasi panas sore namun tetap meloloskan aliran angin alami.',
      'Sumbu ventilasi silang menjaga suhu ruang tetap stabil secara pasif.',
      'Overhang atap melindungi bukaan kaca dari terpaan cuaca ekstrem tropis.'
    ]),
    focus_keyword: 'arsitektur rumah tropis modern',
    content_hash: 'rancanglokahash1',
    is_featured: 1,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 2,
    slug: 'mengapa-rumah-menghadap-barat-selalu-panas',
    title: 'Mengapa Rumah Menghadap Barat Selalu Panas? Analisis Sudut Radiasi & Shading Pasif',
    description: 'Menelusuri sains penyerapan panas dinding barat dan 3 strategi arsitektural untuk menetralkan suhu ruangan tanpa ketergantungan AC penuh.',
    content_md: `Matahari sore memiliki sudut jatuh yang rendah (*low solar altitude angle*), sehingga sinarnya menembus lebih dalam ke dalam ruang interior dibanding matahari tengah hari.\n\n## Solusi Desain untuk Fasad Barat\n\n1. **Insulasi Dinding Berlapis**: Menggunakan dinding ganda (*cavity wall*) dengan celah udara 5 cm.\n2. **Louver Horisontal vs Vertikal**: Louver vertikal lebih efektif memotong sinar matahari sore dengan sudut miring.\n3. **Penanaman Pohon Peneduh Berdaun Lebar**: Ketapang kencana atau kamboja fosil sebagai kanopi alami peredam silau.`,
    content_html: `<p>Matahari sore memiliki sudut jatuh yang rendah (<em>low solar altitude angle</em>), sehingga sinarnya menembus lebih dalam ke dalam ruang interior dibanding matahari tengah hari.</p><h2 id="solusi-desain-untuk-fasad-barat">Solusi Desain untuk Fasad Barat</h2><ol><li><strong>Insulasi Dinding Berlapis</strong>: Menggunakan dinding ganda (<em>cavity wall</em>) dengan celah udara 5 cm.</li><li><strong>Louver Horisontal vs Vertikal</strong>: Louver vertikal lebih efektif memotong sinar matahari sore dengan sudut miring.</li><li><strong>Penanaman Pohon Peneduh Berdaun Lebar</strong>: Ketapang kencana atau kamboja fosil sebagai kanopi alami peredam silau.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Fasad bangunan modern dengan naungan peneduh matahari sore',
    category_id: 3,
    category_name: 'Arsitektur & Renovasi',
    category_slug: 'arsitektur-renovasi',
    category_color: '#d97706',
    author_id: 1,
    author_name: 'Dewan Redaksi Spasial RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Kurator Utama Tata Ruang Tropis',
    status: 'published',
    views: 2940,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Sudut jatuh matahari sore yang rendah membuat penetrasi panas menembus kaca lebih dalam.',
      'Kisi vertikal jauh lebih efektif memblokir matahari barat dibanding kisi horisontal.',
      'Dinding ganda berongga memutus transmisi panas konduksi ke ruang dalam.'
    ]),
    focus_keyword: 'solusi rumah menghadap barat panas',
    content_hash: 'rancanglokahash2',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 8).toISOString()
  },
  {
    id: 3,
    slug: 'efek-cerobong-void-rumah-sempit-36',
    title: 'Efek Cerobong Void Vertikal: Kapan Void Menguntungkan dan Kapan Membuang Luas Lantai?',
    description: 'Analisis rekayasa ketinggian plafon 5 meter untuk mengalirkan udara panas keluar pada hunian tipe 36/60.',
    content_md: `Void atap sering kali dianggap sebagai pemborosan ruang lantai dua pada lahan mungil 60 meter persegi. Namun, ditinjau dari sains termal, void adalah mesin ventilasi pasif terbaik.\n\n## Cara Kerja Efek Cerobong (*Stack Effect*)\n\nUdara panas memiliki massa jenis lebih ringan sehingga selalu bergerak naik ke titik tertinggi. Dengan menempatkan bukaan kisi ventilasi di puncak void, udara hangat terdorong keluar sementara udara sejuk dari lantai dasar terhisap masuk.`,
    content_html: `<p>Void atap sering kali dianggap sebagai pemborosan ruang lantai dua pada lahan mungil 60 meter persegi. Namun, ditinjau dari sains termal, void adalah mesin ventilasi pasif terbaik.</p><h2 id="cara-kerja-efek-cerobong-stack-effect">Cara Kerja Efek Cerobong (<em>Stack Effect</em>)</h2><p>Udara panas memiliki massa jenis lebih ringan sehingga selalu bergerak naik ke titik tertinggi. Dengan menempatkan bukaan kisi ventilasi di puncak void, udara hangat terdorong keluar secara alami.</p>`,
    featured_image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Void atap tinggi pada ruang keluarga rumah mungil minimalis',
    category_id: 3,
    category_name: 'Arsitektur & Renovasi',
    category_slug: 'arsitektur-renovasi',
    category_color: '#d97706',
    author_id: 1,
    author_name: 'Dewan Redaksi Spasial RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Kurator Utama Tata Ruang Tropis',
    status: 'published',
    views: 3120,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Efek cerobong memanfaatkan naiknya udara panas untuk menjaga sirkulasi tanpa kipas mekanik.',
      'Void vertikal melipatgandakan persepsi luas hunian tipe 36.',
      'Wajib menyematkan kisi ventilasi atas berpelindung tampias hujan.'
    ]),
    focus_keyword: 'void rumah tipe 36 efek cerobong',
    content_hash: 'rancanglokahash3',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 14).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 14).toISOString()
  },
  {
    id: 4,
    slug: 'panduan-material-fasad-kisi-ulin-vs-louver',
    title: 'Kisi Kayu Ulin vs Louver Aluminium: Komparasi Termal, Durabilitas Lembap, & Biaya',
    description: 'Perbandingan spesifikasi materialitas selubung fasad antara kayu besi kalimantan dengan aluminium ekstrusi powder coating.',
    content_md: `Memilih material selubung luar bangunan adalah keputusan jangka panjang. Di iklim tropis dengan curah hujan tinggi dan terik matahari ekstrem, ketahanan material diuji secara intensif.\n\n## Perbandingan Karakteristik Material\n\n- **Kayu Ulin Grade 1**: Insulasi termal superior (tidak menghantarkan panas ke dinding), estetika natural wabi-sabi, namun membutuhkan biaya material awal lebih tinggi.\n- **Aluminium Louver Hollow**: Nol perawatan rayap, ringan secara struktur, presisi tinggi, namun dapat memancarkan panas radiasi jika terpapar matahari langsung tanpa thermal break.`,
    content_html: `<p>Memilih material selubung luar bangunan adalah keputusan jangka panjang. Di iklim tropis dengan curah hujan tinggi, ketahanan material diuji secara intensif.</p><h2 id="perbandingan-karakteristik-material">Perbandingan Karakteristik Material</h2><ul><li><strong>Kayu Ulin Grade 1</strong>: Insulasi termal superior, estetika natural wabi-sabi.</li><li><strong>Aluminium Louver Hollow</strong>: Bebas rayap, ringan, presisi modular.</li></ul>`,
    featured_image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Detail kisi kayu ulin pada fasad arsitektur modern',
    category_id: 3,
    category_name: 'Arsitektur & Renovasi',
    category_slug: 'arsitektur-renovasi',
    category_color: '#d97706',
    author_id: 2,
    author_name: 'Tim Riset Materialitas RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    author_role: 'Editor Spesifikasi & Material',
    status: 'published',
    views: 2180,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Kayu ulin memiliki koefisien konduktivitas termal lebih rendah dibanding logam.',
      'Aluminium louver unggul pada kemudahan perakitan dan bobot struktur yang ringan.',
      'Gunakan sistem penguncian stainless steel 304 untuk mencegah korosi sambungan.'
    ]),
    focus_keyword: 'kisi kayu ulin vs louver aluminium fasad',
    content_hash: 'rancanglokahash4',
    is_featured: 0,
    is_trending: 0,
    published_at: new Date(Date.now() - 3600000 * 20).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 20).toISOString()
  },

  // 2. DESAIN INTERIOR & ESTETIKA (4 Articles)
  {
    id: 5,
    slug: 'tren-desain-interior-japandi-2026-hunian-minimalis',
    title: 'Kenapa Rumah Japandi Terasa Begitu Menenangkan?',
    description: 'Bukan sekadar dominasi warna krem atau furnitur kayu rendah. Ada serangkaian keputusan proporsi, sirkulasi cahaya, dan material alami yang membuat ruang Japandi terasa lapang tanpa kehilangan kehangatan.',
    content_md: `Gaya Japandi (*Japan + Scandi*) terus memikat siapa saja yang mendambakan ketenangan di tengah hiruk-pikuk perkotaan. Mengapa pendekatan estetika ini begitu awet dan tidak lekang oleh zaman?\n\n## Esensi Filosofi Japandi Modern\n\nFilosofi Japandi lahir dari perpaduan dua nilai fundamental:\n\n- **Wabi-Sabi (Jepang)**: Menghargai ketidaksempurnaan alami serat kayu dan tekstur bebatuan lokal.\n- **Fungsionalitas Skandinavia**: Menciptakan kenyamanan praktis secukupnya tanpa ornamen visual yang berlebihan.\n\n## 4 Kunci Menerapkan Gaya Japandi di Rumah\n\n1. **Palet Warna Netral & Nada Bumi (*Earth Tones*)**: Paduan broken white, oat, warm grey, dan aksen kayu jati mentah.\n2. **Furnitur Berprofil Rendah & Fungsional**: Memberikan ilusi plafon yang lebih tinggi dan lapang.\n3. **Pencahayaan Alami & Layered Lighting**: Memaksimalkan jendela bukaan besar dan lampu bercahaya hangat (*warm white 2700K*).\n4. **Sentuhan Tanaman Indoor & Keramik Bertekstur**: Menghidupkan sudut ruangan secara organik.`,
    content_html: `<p>Gaya Japandi (<em>Japan + Scandi</em>) terus memikat siapa saja yang mendambakan ketenangan di tengah hiruk-pikuk perkotaan. Mengapa pendekatan estetika ini begitu awet dan tidak lekang oleh zaman?</p><h2 id="esensi-filosofi-japandi-modern">Esensi Filosofi Japandi Modern</h2><p>Filosofi Japandi lahir dari perpaduan dua nilai fundamental:</p><ul><li><strong>Wabi-Sabi (Jepang)</strong>: Menghargai ketidaksempurnaan alami serat kayu dan bebatuan lokal.</li><li><strong>Fungsionalitas Skandinavia</strong>: Kenyamanan praktis tanpa ornamen visual berlebih.</li></ul><h2 id="4-kunci-menerapkan-gaya-japandi-di-rumah">4 Kunci Menerapkan Gaya Japandi di Rumah</h2><ol><li><strong>Palet Warna Netral</strong>: Broken white, oat, warm grey, dan kayu jati.</li><li><strong>Furnitur Rendah</strong>: Memberi ilusi plafon lebih tinggi.</li><li><strong>Pencahayaan Alami Berlapis</strong>: Bukaan kaca dan lampu 2700K warm white.</li><li><strong>Materialitas Bertekstur</strong>: Katun organik dan keramik matte.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Desain ruang tamu Japandi dengan bukaan kaca besar dan aksen kayu hangat',
    category_id: 1,
    category_name: 'Desain Interior & Estetika',
    category_slug: 'interior-design',
    category_color: '#059669',
    author_id: 1,
    author_name: 'Dewan Redaksi Spasial RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Kurator Utama Tata Ruang Tropis',
    status: 'published',
    views: 4450,
    reading_time_minutes: 5,
    key_takeaways: JSON.stringify([
      'Gaya Japandi menggabungkan kehangatan wabi-sabi Jepang dan fungsionalitas Skandinavia.',
      'Furnitur berprofil rendah dan palet earth tones membuat ruangan terasa lebih lega.',
      'Pencahayaan berlapis menciptakan suasana rileks alami di malam hari.'
    ]),
    focus_keyword: 'desain interior japandi modern',
    content_hash: 'rancanglokahash5',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 6,
    slug: 'proporsi-spasial-rumah-mungil-skala-furnitur',
    title: 'Prinsip Proporsi Spasial: Mengapa Skala Furnitur Jauh Lebih Menentukan Dibanding Warna Dinding',
    description: 'Bagaimana rasio ukuran sofa, ketinggian meja, dan jarak sirkulasi jalan menentukan kenyamanan fisik penghuni di ruang terbatas.',
    content_md: `Kesalahan paling umum dalam menata rumah berukuran kecil adalah memasukkan furnitur berukuran besar (*oversized*) yang menyumbat jalur sirkulasi.\n\n## Kaidah Rasio Furnitur Terhadap Luas Ruang\n\n1. **Aturan 60/40 Luas Lantai**: Maksimal 60% luas lantai ditempati furnitur, sisakan 40% untuk area lalu lintas terbuka.\n2. **Kaki Furnitur Terbuka (*Elevated Legs*)**: Memilih sofa dan credenza dengan kaki ramping meloloskan pandangan mata hingga ke sudut dinding terjauh.`,
    content_html: `<p>Kesalahan paling umum dalam menata rumah berukuran kecil adalah memasukkan furnitur berukuran besar (<em>oversized</em>) yang menyumbat jalur sirkulasi.</p><h2 id="kaidah-rasio-furnitur-terhadap-luas-ruang">Kaidah Rasio Furnitur Terhadap Luas Ruang</h2><ol><li><strong>Aturan 60/40 Luas Lantai</strong>: Maksimal 60% lantai terisi furnitur, sisakan 40% untuk sirkulasi bebas.</li><li><strong>Kaki Furnitur Terbuka</strong>: Mengarahkan pandangan mata menembus ke sudut terjauh.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Ruang tamu mungil dengan penataan furnitur proporsional dan kaki ramping',
    category_id: 1,
    category_name: 'Desain Interior & Estetika',
    category_slug: 'interior-design',
    category_color: '#059669',
    author_id: 1,
    author_name: 'Dewan Redaksi Spasial RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Kurator Utama Tata Ruang Tropis',
    status: 'published',
    views: 1980,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Pertahankan minimal 40% area lantai terbuka untuk kelancaran sirkulasi fisik dan visual.',
      'Furnitur berkaki terbuka memberikan ilusi optik ruang yang lebih luas.',
      'Hindari sofa sectional masif pada ruang keluarga di bawah 15 meter persegi.'
    ]),
    focus_keyword: 'proporsi furnitur rumah kecil',
    content_hash: 'rancanglokahash6',
    is_featured: 0,
    is_trending: 0,
    published_at: new Date(Date.now() - 3600000 * 30).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 30).toISOString()
  },
  {
    id: 7,
    slug: 'layering-pencahayaan-alami-dan-cove-lighting',
    title: 'Layering Pencahayaan Alami & Cove Light: Panduan Temperatur 2700K–3000K untuk Istirahat Berkualitas',
    description: 'Menata pencahayaan arsitektural tanpa silau langsung untuk mendukung ritme sirkadian tubuh yang sehat.',
    content_md: `Pencahayaan buatan di dalam rumah tidak boleh hanya bertumpu pada satu lampu downlight terang benderang di tengah plafon.\n\n## Tiga Lapisan Pencahayaan (*Lighting Layering*)\n\n1. **General Ambient**: Cahaya pantul tidak langsung (*cove lighting*) tersembunyi di balik drop ceiling.\n2. **Task Lighting**: Lampu sorot fokus pada meja kerja, kitchen island, atau area membaca.\n3. **Accent Lighting**: Menyorot tekstur dinding batu alam atau karya seni visual.`,
    content_html: `<p>Pencahayaan buatan di dalam rumah tidak boleh hanya bertumpu pada satu lampu downlight terang benderang di tengah plafon.</p><h2 id="tiga-lapisan-pencahayaan">Tiga Lapisan Pencahayaan</h2><ol><li><strong>General Ambient</strong>: Cove light 2700K tersembunyi di drop ceiling.</li><li><strong>Task Lighting</strong>: Lampu fokus 4000K pada area kerja atau memasak.</li><li><strong>Accent Lighting</strong>: Sorot aksen untuk menonjolkan tekstur material.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Pencahayaan cove lighting tersembunyi pada plafon kayu ruang keluarga',
    category_id: 1,
    category_name: 'Desain Interior & Estetika',
    category_slug: 'interior-design',
    category_color: '#059669',
    author_id: 1,
    author_name: 'Dewan Redaksi Spasial RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Kurator Utama Tata Ruang Tropis',
    status: 'published',
    views: 2240,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Gunakan temperatur 2700K–3000K untuk area santai dan 4000K untuk area kerja.',
      'Cove lighting tersembunyi membasmi silau langsung pada mata saat malam hari.',
      'Kombinasikan dimmer sakelar untuk fleksibilitas pengaturan intensitas cahaya.'
    ]),
    focus_keyword: 'layering pencahayaan cove lighting rumah',
    content_hash: 'rancanglokahash7',
    is_featured: 0,
    is_trending: 0,
    published_at: new Date(Date.now() - 3600000 * 36).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 36).toISOString()
  },
  {
    id: 8,
    slug: 'kamar-tidur-yang-benar-benar-mengistirahatkan',
    title: 'Kamar Tidur yang Benar-Benar Mengistirahatkan: Keseimbangan Cahaya & Katun Alami',
    description: 'Menghilangkan stimulasi visual berlebih di ruang privat untuk kualitas pemulihan energi yang optimal setiap malam.',
    content_md: `Kamar tidur adalah suaka pemulihan energi setelah seharian beraktivitas di luar rumah. Menatanya dengan standar ketenangan prima berakar pada pengendalian stimulasi sensorik.\n\n## Kunci Ruang Tidur yang Menenangkan\n\n1. **Serat Katun Alami**: Sprei katun organik dengan tenunan sejuk yang ramah terhadap suhu tubuh sepanjang malam.\n2. **Pencahayaan Ambience Berlapis**: Menghindari lampu sorot langsung ke arah tempat tidur, utamakan lampu meja bertutup kain lembut.\n3. **Kerapian Visual**: Memastikan permukaan meja samping tempat tidur bebas dari tumpukan kabel dan gawai elektronik.`,
    content_html: `<p>Kamar tidur adalah suaka pemulihan energi setelah seharian beraktivitas di luar rumah. Menatanya dengan standar ketenangan prima berakar pada pengendalian stimulasi sensorik.</p><h2 id="kunci-ruang-tidur-yang-menenangkan">Kunci Ruang Tidur yang Menenangkan</h2><ol><li><strong>Serat Katun Alami</strong>: Sprei katun organik yang menyerap keringat.</li><li><strong>Pencahayaan Ambience Berlapis</strong>: Hindari lampu sorot langsung ke kasur.</li><li><strong>Kerapian Visual</strong>: Permukaan meja samping bebas dari kabel.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Kamar tidur minimalis estetik dengan pencahayaan hangat dan sprei rapi',
    category_id: 1,
    category_name: 'Desain Interior & Estetika',
    category_slug: 'interior-design',
    category_color: '#059669',
    author_id: 1,
    author_name: 'Dewan Redaksi Spasial RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Kurator Utama Tata Ruang Tropis',
    status: 'published',
    views: 1650,
    reading_time_minutes: 3,
    key_takeaways: JSON.stringify([
      'Pilihlah serat katun alami organik yang menyerap keringat dan ramah suhu tubuh.',
      'Pencahayaan tidak langsung (indirect lighting) membantu pelepasan hormon melatonin alami.',
      'Jauhkan gawai dan polusi cahaya dari area sekitar kasur untuk kualitas tidur dalam.'
    ]),
    focus_keyword: 'menata kamar tidur menenangkan',
    content_hash: 'rancanglokahash8',
    is_featured: 0,
    is_trending: 0,
    published_at: new Date(Date.now() - 3600000 * 42).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 42).toISOString()
  },

  // 3. SMART HOME & OTOMASI ENERGI (4 Articles)
  {
    id: 9,
    slug: 'panduan-smart-home-otomasi-energi-2026',
    title: 'Otomasi Energi Cerdas: Mengoptimalkan Konsumsi Daya HVAC dan Pencahayaan Rumah Tropis',
    description: 'Panduan teknis penerapan sensor suhu, smart switch, dan jadwal pendingin udara untuk efisiensi energi hunian yang lebih terkontrol.',
    content_md: `Penggunaan AC di negara beriklim tropis sering kali menyumbang porsi terbesar dalam tagihan listrik bulanan. Melalui integrasi sensor cerdas dan mikrokontroler lokal, konsumsi daya dapat dipantau dan dikontrol secara presisi.\n\n## Tiga Langkah Efisiensi HVAC Otomatis\n\n1. **Sensor Kontak Pintu & Jendela**: Mematikan AC secara otomatis saat jendela dibuka untuk ventilasi alami.\n2. **Smart Thermostat Berbasis Waktu**: Menaikkan suhu AC 1°C secara bertahap saat dini hari ketika suhu lingkungan luar menurun.\n3. **Monitoring Konsumsi Real-Time**: Mengidentifikasi perangkat beban tinggi melalui smart plug berfitur power meter.`,
    content_html: `<p>Penggunaan AC di negara beriklim tropis menyumbang porsi terbesar dalam konsumsi daya bulanan. Melalui integrasi sensor cerdas, efisiensi energi dapat dicapai secara terukur.</p><h2 id="tiga-langkah-efisiensi-hvac-otomatis">Tiga Langkah Efisiensi HVAC Otomatis</h2><ol><li><strong>Sensor Kontak Pintu &amp; Jendela</strong>: Mematikan AC saat jendela dibuka.</li><li><strong>Smart Thermostat Waktu</strong>: Menyesuaikan suhu AC bertahap saat dini hari.</li><li><strong>Monitoring Daya Real-Time</strong>: Memantau beban daya perangkat secara presisi.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Panel kontrol smart home modern di dinding rumah minimalis',
    category_id: 2,
    category_name: 'Smart Home & Otomasi',
    category_slug: 'smart-home',
    category_color: '#2563eb',
    author_id: 2,
    author_name: 'Tim Riset Materialitas RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    author_role: 'Editor Spesifikasi & Material',
    status: 'published',
    views: 3120,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Sensor kontak mencegah AC bekerja keras saat pintu atau jendela terbuka.',
      'Penaikan suhu AC 1°C di dini hari menghemat daya tanpa mengganggu kenyamanan tidur.',
      'Otomasi lokal menjaga sistem tetap beroperasi tanpa tergantung koneksi internet luar.'
    ]),
    focus_keyword: 'smart home efisiensi energi ac tropis',
    content_hash: 'rancanglokahash9',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 48).toISOString()
  },
  {
    id: 10,
    slug: 'protokol-matter-dan-thread-smart-home',
    title: 'Standar Protokol Matter & Thread: Meningkatkan Interoperabilitas IoT Rumah Tangga Tanpa Vendor Lock-in',
    description: 'Memahami bagaimana standar nirkabel mesh Thread dan protokol terpadu Matter memudahkan komunikasi perangkat lintas merk.',
    content_md: `Tantangan terbesar ekosistem smart home selama satu dekade terakhir adalah fragmentasi aplikasi dan ketergantungan pada server cloud masing-masing pabrikan.\n\n## Keunggulan Matter & Thread untuk Hunian\n\n- **Kontrol Lokal Tanpa Internet**: Perintah sakelar ke lampu dieksekusi secara instan dalam jaringan LAN lokal tanpa latensi cloud.\n- **Topologi Mesh Thread**: Setiap perangkat bertenaga listrik berfungsi sebagai penguat sinyal (*router*), mengeliminasi zona mati sinyal di rumah bertingkat.\n- **Kompatibilitas Terpadu**: Dapat dikendalikan secara simultan melalui Apple Home, Google Home, dan Home Assistant.`,
    content_html: `<p>Tantangan terbesar ekosistem smart home selama satu dekade terakhir adalah fragmentasi aplikasi dan ketergantungan server cloud.</p><h2 id="keunggulan-matter-thread">Keunggulan Matter &amp; Thread</h2><ul><li><strong>Kontrol Lokal Bebas Latensi</strong>: Perintah dieksekusi instan di jaringan lokal.</li><li><strong>Topologi Mesh Thread</strong>: Jangkauan sinyal saling memperkuat antar perangkat.</li><li><strong>Bebas Vendor Lock-in</strong>: Kompatibel lintas ekosistem aplikasi.</li></ul>`,
    featured_image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Perangkat hub smart home gateway modern dengan lampu indikator status',
    category_id: 2,
    category_name: 'Smart Home & Otomasi',
    category_slug: 'smart-home',
    category_color: '#2563eb',
    author_id: 2,
    author_name: 'Tim Riset Materialitas RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    author_role: 'Editor Spesifikasi & Material',
    status: 'published',
    views: 1850,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Matter dirancang untuk meningkatkan interoperabilitas lintas merk perangkat IoT.',
      'Jaringan Thread mesh meniadakan masalah sinyal lemah di lantai dua.',
      'Eksekusi lokal menjamin otomasi tetap aktif saat koneksi internet provider terputus.'
    ]),
    focus_keyword: 'protokol matter thread smart home indonesia',
    content_hash: 'rancanglokahash10',
    is_featured: 0,
    is_trending: 0,
    published_at: new Date(Date.now() - 3600000 * 54).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 54).toISOString()
  },
  {
    id: 11,
    slug: 'smart-lighting-sensor-keberadaan-lokal',
    title: 'Smart Lighting Berbasis Sensor Keberadaan (mmWave): Otomasi Presisi Tanpa Salah Deteksi',
    description: 'Mengapa sensor radar gelombang milimeter (mmWave) jauh lebih superior dibanding sensor inframerah PIR pasif di kamar mandi dan ruang kerja.',
    content_md: `Sensor PIR konvensional sering mematikan lampu saat penghuni sedang duduk diam membaca buku atau bekerja. Sensor radar mmWave mendeteksi gerakan mikro pernapasan manusia secara presisi.\n\n## Integrasi Praktis di Rumah\n\n1. **Kamar Mandi & Area Servis**: Lampu menyala otomatis saat dimasuki dan padam 60 detik setelah area benar-benar kosong.\n2. **Pencahayaan Malam Hari (*Nightlight*)**: Menghidupkan LED strip bawah ranjang dengan intensitas 10% jika penghuni bangun di tengah malam.`,
    content_html: `<p>Sensor PIR konvensional sering mematikan lampu saat penghuni duduk diam. Sensor radar mmWave mendeteksi gerakan mikro pernapasan manusia secara presisi.</p><h2 id="integrasi-praktis-di-rumah">Integrasi Praktis di Rumah</h2><ol><li><strong>Kamar Mandi</strong>: Lampu otomatis tanpa perlu meraba sakelar basah.</li><li><strong>Pencahayaan Malam</strong>: LED strip 10% lembut untuk navigasi toilet dini hari.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Sensor pintar tersembunyi di sudut plafon kamar mandi modern',
    category_id: 2,
    category_name: 'Smart Home & Otomasi',
    category_slug: 'smart-home',
    category_color: '#2563eb',
    author_id: 2,
    author_name: 'Tim Riset Materialitas RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    author_role: 'Editor Spesifikasi & Material',
    status: 'published',
    views: 2410,
    reading_time_minutes: 3,
    key_takeaways: JSON.stringify([
      'Sensor radar mmWave mendeteksi keberadaan statis penghuni tanpa perlu gerakan tangan besar.',
      'Sangat ideal untuk area kamar mandi, dapur basah, dan walk-in closet.',
      'Mencegah pemborosan listrik akibat lampu yang lupa dimatikan.'
    ]),
    focus_keyword: 'sensor keberadaan mmwave smart lighting',
    content_hash: 'rancanglokahash11',
    is_featured: 0,
    is_trending: 0,
    published_at: new Date(Date.now() - 3600000 * 60).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 60).toISOString()
  },
  {
    id: 12,
    slug: 'sistem-keamanan-rumah-privasi-lokal',
    title: 'Keamanan Rumah Terintegrasi: Sensor Kontak Pintu, Sirene Lokal, dan Perlindungan Privasi Penghuni',
    description: 'Membangun sistem peringatan dini perimeter rumah tanpa mengekspos rekaman kamera keluarga ke server pihak ketiga.',
    content_md: `Keamanan hunian tidak harus mengorbankan privasi data domestik. Memilih arsitektur NVR lokal dan sensor nirkabel terenkripsi menjaga rekaman tetap berada di dalam hunian.\n\n## Komponen Utama Keamanan Perimeter\n\n1. **Sensor Kontak Magnetik**: Pada pintu utama, jendela samping, dan pintu geser halaman belakang.\n2. **Kamera CCTV dengan Penyimpanan SSD Lokal**: Mengisolasi jalur kamera dari akses cloud luar.\n3. **Sirene & Notifikasi Instan**: Membunyikan sirine internal jika pintu dipaksa terbuka saat mode 'Away' aktif.`,
    content_html: `<p>Keamanan hunian tidak harus mengorbankan privasi data domestik. Memilih arsitektur NVR lokal menjaga rekaman tetap berada di dalam hunian.</p><h2 id="komponen-utama-keamanan-perimeter">Komponen Utama Keamanan Perimeter</h2><ol><li><strong>Sensor Kontak Magnetik</strong>: Pada seluruh titik bukaan perimeter luar.</li><li><strong>Penyimpanan Lokal Terenkripsi</strong>: Isolasi rekaman kamera dari server pihak ketiga.</li><li><strong>Otomasi Sirine Terintegrasi</strong>: Peringatan suara instan saat anomali terdeteksi.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Kamera pengawas keamanan modern dan sensor pintu terpasang rapi',
    category_id: 2,
    category_name: 'Smart Home & Otomasi',
    category_slug: 'smart-home',
    category_color: '#2563eb',
    author_id: 2,
    author_name: 'Tim Riset Materialitas RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    author_role: 'Editor Spesifikasi & Material',
    status: 'published',
    views: 1720,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Sensor kontak perimeter mendeteksi intrusi sebelum penyusup sempat masuk ke ruang dalam.',
      'Penyimpanan lokal menjamin privasi visual keluarga tetap terjaga aman.',
      'Sistem mandiri baterai tetap aktif meski aliran listrik utama PLN padam.'
    ]),
    focus_keyword: 'keamanan smart home privasi lokal',
    content_hash: 'rancanglokahash12',
    is_featured: 0,
    is_trending: 0,
    published_at: new Date(Date.now() - 3600000 * 66).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 66).toISOString()
  },

  // 4. GAYA HIDUP, MATERIALITAS & SPASIAL (4 Articles)
  {
    id: 13,
    slug: 'desain-home-office-ergonomis-wfh-produktif',
    title: 'Menciptakan Ruang Kerja (Home Office) Ergonomis di Rumah: Tingkatkan Fokus & Produktivitas',
    description: 'Panduan lengkap memilih kursi ergonomis, ketinggian meja ideal, pencahayaan bebas silau, dan tanaman penyaring udara untuk WFH tanpa sakit punggung.',
    content_md: `Bekerja dari rumah (*Work From Home*) menuntut area kerja yang mendukung postur tubuh sehat dan konsentrasi tinggi dalam durasi panjang.\n\n## Aspek Penting Ruang Kerja Ergonomis\n\n- **Ketinggian Monitor Sejajar Mata**: Mengurangi ketegangan leher dan pundak.\n- **Kursi dengan Penopang Lumbar**: Menjaga lekukan alami tulang belakang.\n- **Pencahayaan Alami dari Samping**: Mencegah silau pada layar laptop dan kelelahan mata.`,
    content_html: `<p>Bekerja dari rumah (<em>Work From Home</em>) menuntut area kerja yang mendukung postur tubuh sehat dan konsentrasi tinggi dalam durasi panjang.</p><h2 id="aspek-penting-ruang-kerja-ergonomis">Aspek Penting Ruang Kerja Ergonomis</h2><ul><li><strong>Ketinggian Monitor Sejajar Mata</strong>: Mengurangi ketegangan leher dan pundak.</li><li><strong>Kursi dengan Penopang Lumbar</strong>: Menjaga lekukan alami tulang belakang.</li><li><strong>Pencahayaan Alami dari Samping</strong>: Mencegah silau pada layar laptop.</li></ul>`,
    featured_image: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Ruang kerja rumah home office minimalis dengan tanaman hias dan meja kayu',
    category_id: 4,
    category_name: 'Gaya Hidup & Hunian',
    category_slug: 'lifestyle-hunian',
    category_color: '#7c3aed',
    author_id: 1,
    author_name: 'Dewan Redaksi Spasial RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Kurator Utama Tata Ruang Tropis',
    status: 'published',
    views: 1820,
    reading_time_minutes: 3,
    key_takeaways: JSON.stringify([
      'Posisi monitor sejajar pandangan mata mencegah sakit leher saat bekerja seharian.',
      'Pencahayaan samping membasmi silau reflektif pada layar komputer.',
      'Tanaman indoor seperti Sansevieria membantu menyegarkan udara di ruang kerja.'
    ]),
    focus_keyword: 'desain home office ergonomis',
    content_hash: 'rancanglokahash13',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 72).toISOString()
  },
  {
    id: 14,
    slug: 'materialitas-batu-alam-andesit-dan-terakota',
    title: 'Batu Alam Andesit & Roster Terakota: Memilih Selubung Dinding yang Tahan Lumut dan Bernapas',
    description: 'Karakteristik teknis porositas batu alam lokal dan teknik aplikasi coating matte untuk dinding eksterior tropis.',
    content_md: `Memilih material dinding eksterior di Indonesia harus mempertimbangkan kelembapan udara rata-rata 75–85%. Batu andesit dan terakota bakar memberikan ketahanan cuaca tinggi.\n\n## Perawatan & Aplikasi Dinding Bernapas\n\n1. **Batu Andesit Alur Cacing / Bakar**: Memiliki kepadatan pori tinggi sehingga minim menyerap air hujan.\n2. **Bata Roster Terakota**: Menjadi jalur ventilasi udara pasif sekaligus dinding partisi berbayang estetis.\n3. **Coating Water-Repellent Siloxane**: Melindungi permukaan dari lumut tanpa menutup pori alami bebatuan.`,
    content_html: `<p>Memilih material dinding eksterior di Indonesia harus mempertimbangkan kelembapan udara rata-rata tinggi. Batu andesit dan terakota bakar memberikan ketahanan cuaca optimal.</p><h2 id="perawatan-aplikasi-dinding-bernapas">Perawatan &amp; Aplikasi Dinding Bernapas</h2><ol><li><strong>Batu Andesit Bakar</strong>: Kepadatan tinggi, minim rembesan air hujan.</li><li><strong>Roster Terakota</strong>: Partisi bernapas penyaring angin kencang.</li><li><strong>Coating Siloxane</strong>: Antilumut tanpa mengubah warna alami batu.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Dinding terakota roster dan batu alam andesit pada fasad rumah',
    category_id: 4,
    category_name: 'Gaya Hidup & Hunian',
    category_slug: 'lifestyle-hunian',
    category_color: '#7c3aed',
    author_id: 2,
    author_name: 'Tim Riset Materialitas RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    author_role: 'Editor Spesifikasi & Material',
    status: 'published',
    views: 2050,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Batu andesit bakar minim porositas sehingga sangat tahan terhadap lumut.',
      'Roster terakota memecah terpaan angin dan menjaga sirkulasi udara fasad.',
      'Gunakan pelapis water-repellent berbasis siloxane berpenetrasi dalam.'
    ]),
    focus_keyword: 'batu alam andesit roster terakota dinding tropis',
    content_hash: 'rancanglokahash14',
    is_featured: 0,
    is_trending: 0,
    published_at: new Date(Date.now() - 3600000 * 78).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 78).toISOString()
  },
  {
    id: 15,
    slug: 'inner-courtyard-taman-kering-tengah-rumah',
    title: 'Inner Courtyard (Taman Kering): Menghadirkan Mikroklimat Sejuk di Tengah Pemukiman Padat',
    description: 'Strategi memasukkan unsur alam ke tengah denah rumah untuk menurunkan suhu ruangan secara pasif.',
    content_md: `Pada rumah deret di perkotaan dengan dinding samping berdempetan dengan tetangga, menempatkan taman terbuka di tengah denah (*inner courtyard*) adalah solusi cerdas.\n\n## Dampak Termal Taman Tengah\n\n- **Pusat Pencahayaan Siang**: Menyediakan cahaya alami ke seluruh kamar tanpa membuka jendela ke arah luar yang bising.\n- **Pencipta Mikroklimat**: Kelembapan evaporasi dari tanaman peneduh dan bebatuan koral mendinginkan udara yang masuk ke ruang keluarga.`,
    content_html: `<p>Pada rumah deret perkotaan dengan dinding samping berdempetan, menempatkan taman terbuka di tengah denah (<em>inner courtyard</em>) adalah solusi termal yang efektif.</p><h2 id="dampak-termal-taman-tengah">Dampak Termal Taman Tengah</h2><ul><li><strong>Pusat Pencahayaan</strong>: Menyinari seluruh ruang tengah secara alami.</li><li><strong>Pencipta Mikroklimat Sejuk</strong>: Evaporasi tanaman menurunkan temperatur udara ruang.</li></ul>`,
    featured_image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Taman kering inner courtyard dengan pohon peneduh di tengah rumah minimalis',
    category_id: 4,
    category_name: 'Gaya Hidup & Hunian',
    category_slug: 'lifestyle-hunian',
    category_color: '#7c3aed',
    author_id: 1,
    author_name: 'Dewan Redaksi Spasial RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Kurator Utama Tata Ruang Tropis',
    status: 'published',
    views: 2680,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Inner courtyard memasok cahaya alami bagi ruangan yang terhimpit dinding tetangga.',
      'Menciptakan zona mikroklimat yang menyegarkan udara ruang keluarga.',
      'Gunakan tanaman berakar serabut seperti Lee Kuan Yew atau pakis untuk kemudahan perawatan.'
    ]),
    focus_keyword: 'inner courtyard taman kering rumah tropis',
    content_hash: 'rancanglokahash15',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 84).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 84).toISOString()
  },
  {
    id: 16,
    slug: 'open-plan-vs-ruang-tersekat-trade-off',
    title: 'Open Plan vs Ruang Tersekat: Trade-off Akustik, Privasi, dan Beban Pendinginan AC',
    description: 'Kajian objektif kelebihan dan kekurangan denah terbuka untuk membantu pemilik rumah mengambil keputusan spasial yang tepat.',
    content_md: `Konsep open-plan memang membuat rumah terasa lapang dan instagrammable. Namun, tata letak ini memiliki konsekuensi praktis yang jarang dibahas secara terbuka.\n\n## Evaluasi Sisi Positif dan Konsekuensi\n\n- **Kelebihan**: Aliran udara bebas, interaksi antar anggota keluarga lebih akrab, fleksibilitas penataan furnitur.\n- **Trade-off Akustik & Termal**: Suara blender di dapur terdengar jelas di ruang keluarga, aroma masakan menyebar, dan AC membutuhkan kapasitas BTU lebih tinggi untuk mendinginkan satu volume ruang besar.`,
    content_html: `<p>Konsep open-plan membuat rumah terasa lapang, namun memiliki konsekuensi praktis yang perlu dievaluasi.</p><h2 id="evaluasi-trade-off">Evaluasi Trade-off</h2><ul><li><strong>Kelebihan</strong>: Aliran udara bebas, fleksibilitas tata letak, interaksi keluarga lebih hangat.</li><li><strong>Trade-off</strong>: Privasi akustik berkurang dan kapasitas pendinginan AC harus dihitung cermat.</li></ul>`,
    featured_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Ruang keluarga open-plan terhubung langsung dengan dapur bersih minimalis',
    category_id: 1,
    category_name: 'Desain Interior & Estetika',
    category_slug: 'interior-design',
    category_color: '#059669',
    author_id: 1,
    author_name: 'Dewan Redaksi Spasial RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Kurator Utama Tata Ruang Tropis',
    status: 'published',
    views: 3410,
    reading_time_minutes: 5,
    key_takeaways: JSON.stringify([
      'Open plan mengoptimalkan persepsi kelapangan pada lahan mungil.',
      'Perhitungkan penempatan cooker hood berkekuatan hisap tinggi di area dapur.',
      'Gunakan partisi geser semi-transparan untuk fleksibilitas privasi instan.'
    ]),
    focus_keyword: 'open plan vs ruang tersekat kelebihan kekurangan',
    content_hash: 'rancanglokahash16',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 90).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 90).toISOString()
  },
  // 5. FLAGSHIP FORMAT-DRIVEN ARTICLES (4 New Editorial Formats)
  {
    id: 17,
    slug: 'arsitek-menjawab-efektivitas-void-tanpa-exhaust-fan',
    title: 'Arsitek Menjawab: Seberapa Efektif Void Atap Mengalirkan Udara Tanpa Bantuan Exhaust Fan?',
    description: 'Tanya jawab teknis seputar batas performa ventilasi pasif stack effect dan kapan rumah membutuhkan dorongan sirkulasi mekanis.',
    content_md: `Void sering digadang-gadang sebagai penyelamat sirkulasi udara rumah mungil. Namun, apakah efek cerobong vertikal ini bekerja efektif pada hari-hari tanpa angin kencang?\n\n## Kunci Efektivitas Ventilasi Vertikal\n\n- **Rasio Luas Bukaan Masuk vs Keluar**: Bukaan atas di puncak void harus minimal 1,5 kali lebih besar dibanding inlet udara di lantai dasar.\n- **Peredam Radiasi Atap**: Menggunakan atap insulasi peredam panas agar puncak void tidak berubah menjadi kantong udara panas yang justru menekan udara ke bawah.\n- **Kapan Butuh Bantuan Mekanis**: Pada denah terhimpit tanpa ventilasi silang horisontal, turbin ventilator atau exhaust fan berdaya rendah 25W sangat disarankan untuk menjaga laju aliran konstan.`,
    content_html: `<p>Void sering digadang-gadang sebagai penyelamat sirkulasi udara rumah mungil. Namun, bagaimana performa pasifnya saat tidak ada hembusan angin?</p><h2 id="kunci-efektivitas-ventilasi-vertikal">Kunci Efektivitas Ventilasi Vertikal</h2><ul><li><strong>Rasio Bukaan Atas</strong>: Outlet atas minimal 1.5x lebih besar dari inlet bawah.</li><li><strong>Insulasi Atap Puncak</strong>: Mencegah terbentuknya kantong panas di loteng.</li><li><strong>Bantuan Mekanis 25W</strong>: Turbin angin atau exhaust membantu kontinuitas aliran saat cuaca terik tanpa angin.</li></ul>`,
    featured_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Bukaan void atap tinggi dengan aliran cahaya alami dan ventilasi silang',
    category_id: 3,
    category_name: 'Arsitektur & Renovasi',
    category_slug: 'arsitektur-renovasi',
    category_color: '#d97706',
    author_id: 1,
    author_name: 'Dewan Redaksi Spasial RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Kurator Utama Tata Ruang Tropis',
    status: 'published',
    views: 1980,
    reading_time_minutes: 5,
    key_takeaways: JSON.stringify([
      'Void memerlukan perbedaan suhu dan rasio bukaan outlet yang cukup untuk memicu aliran alami.',
      'Puncak void wajib diberi lapisan insulasi reflektif agar tidak menjadi perangkap panas.',
      'Turbin ventilator pasif di atap memaksimalkan hisapan udara saat kondisi hening tanpa angin.'
    ]),
    focus_keyword: 'efektivitas void atap ventilasi pasif arsitektur',
    content_hash: 'rancanglokahash17',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 96).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 96).toISOString()
  },
  {
    id: 18,
    slug: 'studi-kasus-fasad-kisi-ulin-rumah-120m2',
    title: 'Studi Kasus Fasad Fungsional: Bedah Desain Rumah 120m² dengan Bukaan Kisi Kayu Ulin',
    description: 'Analisis detail orientasi denah, detail pemasangan bracket stainless steel, dan hasil penurunan temperatur dinding luar.',
    content_md: `Membedah penerapan secondary skin pada lahan urban berorientasi barat laut. Bagaimana kisi kayu ulin setebal 4cm memangkas temperatur permukaan dinding hingga 4°C.\n\n## Rekayasa Sambungan & Detail Arsitektur\n\n1. **Celah Jarak 15cm dari Dinding Utama**: Menciptakan lorong udara dingin (*thermal buffer zone*) di balik kisi.\n2. **Orientasi Bilah 45 Derajat**: Memblokir pandangan langsung dari jalan raya tanpa mengorbankan privasi penghuni di lantai atas.\n3. **Finishing Bio-Oil Alami**: Mempertahankan napas kayu ulin tanpa risiko lapisan coating mengelupas akibat sengatan UV.`,
    content_html: `<p>Membedah penerapan secondary skin pada lahan urban berorientasi barat laut dengan kisi kayu ulin berjarak 15cm dari dinding utama.</p><h2 id="rekayasa-sambungan-detail-arsitektur">Rekayasa Sambungan &amp; Detail Arsitektur</h2><ol><li><strong>Thermal Buffer Zone</strong>: Celah 15cm mendinginkan dinding utama secara konveksi.</li><li><strong>Bilah Kisi 45 Derajat</strong>: Perlindungan privasi visual dari jalan raya.</li><li><strong>Finishing Bio-Oil</strong>: Ketahanan UV tinggi tanpa lapisan film terkelupas.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Fasad rumah modern dengan kisi-kisi kayu ulin berjarak estetis',
    category_id: 3,
    category_name: 'Arsitektur & Renovasi',
    category_slug: 'arsitektur-renovasi',
    category_color: '#d97706',
    author_id: 2,
    author_name: 'Tim Riset Materialitas RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    author_role: 'Editor Spesifikasi & Material',
    status: 'published',
    views: 2840,
    reading_time_minutes: 5,
    key_takeaways: JSON.stringify([
      'Jarak rongga 15cm antara kisi dan dinding esensial untuk membuang panas konvektif.',
      'Kemiringan bilah 45° menghalau terik matahari sore dan pandangan luar.',
      'Perawatan dengan bio-oil cukup diulang setiap 24–36 bulan sekali.'
    ]),
    focus_keyword: 'studi kasus fasad kisi kayu ulin rumah tropis',
    content_hash: 'rancanglokahash18',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 102).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 102).toISOString()
  },
  {
    id: 19,
    slug: 'panduan-kusen-aluminium-ekstrusi-daerah-lembap',
    title: 'Panduan Memilih Kusen Aluminium Ekstrusi untuk Daerah Lembap: Spesifikasi Anodized vs Powder Coating',
    description: 'Standar ketebalan profil 1.4mm, sistem isolasi karet EPDM ganda, dan proteksi anti-bocor di musim hujan lebat.',
    content_md: `Kusen jendela di Indonesia menghadapi terpaan ganda: kelembapan tinggi dan paparan asam air hujan perkotaan. Memilih profil aluminium yang tepat menentukan kedap suara dan pencegahan kebocoran.\n\n## Perbandingan Lapisan Proteksi Profil\n\n- **Anodized Finishes (18–25 Mikron)**: Lapisan oksida yang menyatu secara molekuler dengan logam, sangat tahan gores dan tidak akan pernah terkelupas.\n- **Powder Coating Arsitektural (60–80 Mikron)**: Pilihan palet warna tak terbatas (matte black, warm grey, sand tone), namun wajib memastikan proses pre-treatment chromate bebas cacat pori.\n- **Karet Seal EPDM**: Menggantikan karet PVC murah agar tidak mengeras dan getas setelah 2 tahun terpapar matahari.`,
    content_html: `<p>Kusen jendela di Indonesia menghadapi kelembapan tinggi dan paparan air hujan lebat. Pemilihan spesifikasi ekstrusi dan karet seal menentukan performa kedap air.</p><h2 id="perbandingan-lapisan-proteksi-profil">Perbandingan Lapisan Proteksi Profil</h2><ul><li><strong>Anodized (18-25 Mikron)</strong>: Sangat tahan gores, tahan korosi asam air hujan.</li><li><strong>Powder Coating (60-80 Mikron)</strong>: Estetika warna matte dan sand tone modern.</li><li><strong>Gasket Karet EPDM</strong>: Mencegah kebocoran dan tidak getas termakan cuaca.</li></ul>`,
    featured_image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Detail profil kusen aluminium minimalis warna matte black terpasang presisi',
    category_id: 4,
    category_name: 'Material & Rekayasa Spasial',
    category_slug: 'lifestyle-hunian',
    category_color: '#7c3aed',
    author_id: 2,
    author_name: 'Tim Riset Materialitas RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    author_role: 'Editor Spesifikasi & Material',
    status: 'published',
    views: 2210,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Pilihlah profil aluminium dengan ketebalan dinding minimal 1.35mm–1.4mm untuk bukaan besar.',
      'Karet EPDM sintetis menjamin kedap suara dan bebas bocor hingga lebih dari 10 tahun.',
      'Pastikan lubang drainase (weep holes) terpasang di rangka bawah jendela.'
    ]),
    focus_keyword: 'panduan memilih kusen aluminium ekstrusi rumah',
    content_hash: 'rancanglokahash19',
    is_featured: 0,
    is_trending: 0,
    published_at: new Date(Date.now() - 3600000 * 108).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 108).toISOString()
  },
  {
    id: 20,
    slug: 'solusi-rumah-panas-5-intervensi-spasial-berbiaya-rendah',
    title: 'Rumah Panas & Pengap: 5 Intervensi Spasial dari Biaya Nol Hingga Renovasi Selubung',
    description: 'Matriks tindakan bertahap mengatasi hawa gerah hunian tropis mulai dari manajemen ventilasi malam hingga pemasangan insulasi atap.',
    content_md: `Mengatasi rumah yang panas tidak harus selalu diawali dengan membongkar tembok atau menambah AC berdaya besar. Terapkan intervensi bertingkat berdasarkan efektivitas biaya.\n\n## Matriks 5 Tingkatan Solusi Termal\n\n1. **Tingkat 1 (Biaya Rp 0 - Night Flushing)**: Buka ventilasi silang pada pukul 20.00–06.00 untuk membuang panas yang tersimpan di struktur beton ke luar.\n2. **Tingkat 2 (Biaya Rendah - Film Penolak Panas)**: Pasang solar window film dengan Total Solar Energy Rejection (TSER) >65% pada jendela barat.\n3. **Tingkat 3 (Biaya Sedang - Shading Vegetasi)**: Menanam tanaman rambat thunbergia atau sirih gading di kawat sling depan jendela.\n4. **Tingkat 4 (Biaya Menengah - Insulasi Aluminium Foil Bubble)**: Memasang peredam panas berongga di bawah rangka genteng atap.\n5. **Tingkat 5 (Renovasi - Secondary Skin & Louver)**: Memasang kisi proteksi eksterior permanen pada dinding barat.`,
    content_html: `<p>Mengatasi rumah yang panas tidak selalu harus membongkar tembok. Terapkan 5 tingkat intervensi termal dari biaya terendah.</p><h2 id="matriks-5-tingkatan-solusi-termal">Matriks 5 Tingkatan Solusi Termal</h2><ol><li><strong>Tingkat 1 (Biaya Rp 0)</strong>: Night flushing membuang panas beton di malam hari.</li><li><strong>Tingkat 2 (Biaya Rendah)</strong>: Solar window film TSER &gt;65% di jendela barat.</li><li><strong>Tingkat 3 (Biaya Sedang)</strong>: Shading tanaman rambat vertikal.</li><li><strong>Tingkat 4 (Biaya Menengah)</strong>: Insulasi foil bubble di bawah genteng.</li><li><strong>Tingkat 5 (Renovasi)</strong>: Secondary skin kisi louver eksterior permanen.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Teras rumah sejuk berkanopi tanaman hijau dengan sirkulasi angin alami',
    category_id: 3,
    category_name: 'Arsitektur & Renovasi',
    category_slug: 'arsitektur-renovasi',
    category_color: '#d97706',
    author_id: 1,
    author_name: 'Dewan Redaksi Spasial RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Kurator Utama Tata Ruang Tropis',
    status: 'published',
    views: 3150,
    reading_time_minutes: 5,
    key_takeaways: JSON.stringify([
      'Night flushing adalah strategi pendinginan pasif termudah tanpa biaya listrik tambahan.',
      'Insulasi atap memotong hingga 70% perpindahan panas radiasi matahari siang ke plafon kamar.',
      'Kombinasi naungan luar dan kaca ber-TSER tinggi memberikan reduksi suhu ruangan paling stabil.'
    ]),
    focus_keyword: 'solusi rumah panas gerah tanpa ac renovasi',
    content_hash: 'rancanglokahash20',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 114).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 114).toISOString()
  }
];

let inMemoryPages: Page[] = [
  {
    id: 1,
    slug: 'tentang-kami',
    title: 'Tentang RancangLoka',
    description: 'Mengenal visi RancangLoka sebagai jurnal kurasi independen arsitektur, desain interior estetik, dan solusi hunian modern Indonesia.',
    content_md: `## Mengapa RancangLoka Ada?\n\nTerlalu banyak konten desain di internet hanya menunjukkan apa yang terlihat indah di layar, tanpa menjelaskan **MENGAPA** dan **BAGAIMANA** keputusan ruang tersebut bekerja.\n\n**RancangLoka** hadir sebagai jurnal kurasi independen yang menjembatani bahasa arsitektural profesional dengan kebutuhan nyata para pemilik rumah di Indonesia.\n\n## Pendekatan Editorial Kami\n\n1. **Bukti & Presisi di Atas Hype**: Kami menguji setiap gagasan desain berdasarkan orientasi matahari tropis, ventilasi alami, dan durabilitas material.\n2. **Pemisahan Tegas Karya Nyata & Konseptual**: Setiap foto proyek nyata dan visualisasi studi 3D selalu diberi label transparan.\n3. **Independensi Tanpa Bias Sponsor**: Rekomendasi materialitas murni dinilai berdasarkan performa fungsional dan estetika spasial.`,
    content_html: `<h2>Mengapa RancangLoka Ada?</h2><p>Terlalu banyak konten desain di internet hanya menunjukkan apa yang terlihat indah di layar, tanpa menjelaskan <strong>MENGAPA</strong> dan <strong>BAGAIMANA</strong> keputusan ruang tersebut bekerja.</p><p><strong>RancangLoka</strong> hadir sebagai jurnal kurasi independen yang menjembatani bahasa arsitektural profesional dengan kebutuhan nyata para pemilik rumah di Indonesia.</p><h2>Pendekatan Editorial Kami</h2><ol><li><strong>Bukti &amp; Presisi di Atas Hype</strong>: Kami menguji setiap gagasan desain berdasarkan orientasi matahari tropis, ventilasi alami, dan durabilitas material.</li><li><strong>Pemisahan Tegas Karya Nyata &amp; Konseptual</strong>: Setiap foto proyek nyata dan visualisasi studi 3D selalu diberi label transparan.</li><li><strong>Independensi Tanpa Bias Sponsor</strong>: Rekomendasi materialitas murni dinilai berdasarkan performa fungsional dan estetika spasial.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80',
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
    description: 'Saluran komunikasi resmi redaksi RancangLoka untuk pertanyaan editorial, liputan karya arsitektur, dan kemitraan independen.',
    content_md: `## Hubungi Tim Redaksi\n\nKami selalu terbuka untuk saran editorial, liputan proyek arsitektur/interior nyata, dan dialog independen seputar ruang hunian.\n\n### Operasional Redaksi\n**RancangLoka Editorial Collective**  \nBeroperasi secara independen dan terdistribusi dari Indonesia.  \nEmail Redaksi: **redaksi@rancangloka.com**  \nKemitraan & Liputan: **partner@rancangloka.com**\n\n---\n\nSilakan kirimkan pesan Anda melalui formulir di bawah ini:`,
    content_html: `<h2>Hubungi Tim Redaksi</h2><p>Kami selalu terbuka untuk saran editorial, liputan proyek arsitektur/interior nyata, dan dialog independen seputar ruang hunian.</p><h3>Operasional Redaksi</h3><p><strong>RancangLoka Editorial Collective</strong><br>Beroperasi secara independen dan terdistribusi dari Indonesia.<br>Email Redaksi: <strong>redaksi@rancangloka.com</strong><br>Kemitraan &amp; Liputan: <strong>partner@rancangloka.com</strong></p><hr><p>Silakan kirimkan pesan Anda melalui formulir di bawah ini:</p>`,
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
    title: 'Pedoman Pemberitaan Media Siber & Kode Integritas',
    description: 'Komitmen kepatuhan standar kode etik jurnalistik, kebijakan koreksi terbuka, dan transparansi editorial RancangLoka.',
    content_md: `Kemerdekaan berpendapat dan integritas jurnalisme adalah komitmen utama kami.\n\n**RancangLoka** menjunjung tinggi Kode Etik Jurnalistik dan Pedoman Pemberitaan Media Siber dalam menyajikan seluruh dokumentasi arsitektur, analisis spasial, dan spesifikasi materialitas secara akurat, berimbang, dan bertanggung jawab.\n\n### Kebijakan Koreksi & Hak Jawab\nJika terdapat kekeliruan data teknis, atribusi nama arsitek/fotografer, atau kutipan yang memerlukan revisi, pembaca dan pihak terkait berhak mengajukan koreksi terbuka melalui **redaksi@rancangloka.com**. Tim redaksi akan memverifikasi dan mencatat pembaruan secara transparan pada artikel terkait.`,
    content_html: `<p>Kemerdekaan berpendapat dan integritas jurnalisme adalah komitmen utama kami.</p><p><strong>RancangLoka</strong> menjunjung tinggi Kode Etik Jurnalistik dan Pedoman Pemberitaan Media Siber dalam menyajikan seluruh dokumentasi arsitektur, analisis spasial, dan spesifikasi materialitas secara akurat, berimbang, dan bertanggung jawab.</p><h3>Kebijakan Koreksi &amp; Hak Jawab</h3><p>Jika terdapat kekeliruan data teknis, atribusi nama arsitek/fotografer, atau kutipan yang memerlukan revisi, pembaca dan pihak terkait berhak mengajukan koreksi terbuka melalui <strong>redaksi@rancangloka.com</strong>. Tim redaksi akan memverifikasi dan mencatat pembaruan secara transparan pada artikel terkait.</p>`,
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

export function sanitizeArticle(a: Article): Article {
  if (!a) return a;
  let content = a.content_html || '';
  // Clean unverified brand insertions
  content = content.replace(/Erihome/gi, 'RancangLoka');
  content = content.replace(/solusi hunian modern di Erihome/gi, 'solusi hunian modern yang proporsional');
  content = content.replace(/panduan rekomendasi Erihome/gi, 'panduan kurasi editorial');
  // Clean unverified 35% claims
  content = content.replace(/hingga 35%/gi, 'secara terukur');
  content = content.replace(/memangkas tagihan listrik hingga 35%/gi, 'mengoptimalkan efisiensi energi hunian');
  content = content.replace(/memastikan kompatibilitas/gi, 'dirancang untuk meningkatkan interoperabilitas');
  
  let title = (a.title || '').replace(/hingga 35%/gi, 'Secara Efisien');
  let desc = (a.description || '').replace(/hingga 35%/gi, 'secara terukur');

  // Enforce authentic author
  let author_name = a.author_name;
  let author_role = a.author_role;
  if (!author_name || author_name.includes('Dimas') || author_name.includes('Clarissa') || author_name.includes('Dewan')) {
    author_name = 'RancangLoka Editorial Desk';
    author_role = 'Kurasi & Riset Spasial Tropis';
  }

  return {
    ...a,
    title,
    description: desc,
    content_html: content,
    author_name,
    author_role
  };
}

export function sanitizePage(p: Page): Page {
  if (!p) return p;
  let content = p.content_html || '';
  content = content.replace(/Cyber 2 Tower, Kuningan, Jakarta Selatan/gi, 'Beroperasi secara independen & terdistribusi dari Indonesia');
  content = content.replace(/RancangLoka Media Network/gi, 'RancangLoka Editorial Collective');
  content = content.replace(/dalam 1x24 jam kerja/gi, 'secepatnya');
  return {
    ...p,
    content_html: content
  };
}

export async function getAllArticles(db: any, limit = 50, offset = 0, status = 'published'): Promise<Article[]> {
  const inMemFiltered = inMemoryArticles
    .filter(a => status === 'all' || a.status === status)
    .map(sanitizeArticle);

  let dbArticles: Article[] = [];
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
        `)
        .bind(status === 'all' ? null : status, status === 'all' ? null : status)
        .all();
      if (results && results.length > 0) {
        dbArticles = (results as Article[]).map(sanitizeArticle);
      }
    } catch (e) {
      console.warn('D1 Query fallback to mock:', e);
    }
  }

  // Combine: inMemoryArticles are authoritative, plus any new dynamic DB articles
  const inMemSlugs = new Set(inMemFiltered.map(a => a.slug));
  const newFromDb = dbArticles.filter(a => !inMemSlugs.has(a.slug));
  const combined = [...inMemFiltered, ...newFromDb];

  return combined.slice(offset, offset + limit);
}

export async function getTotalArticlesCount(db: any, status = 'published'): Promise<number> {
  const all = await getAllArticles(db, 1000, 0, status);
  return all.length;
}

export async function getArticleBySlug(db: any, slug: string): Promise<Article | null> {
  const inMem = inMemoryArticles.find(a => a.slug === slug);
  if (inMem) {
    return sanitizeArticle(inMem);
  }

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
      if (result) return sanitizeArticle(result as Article);
    } catch (e) {
      console.warn('D1 Query fallback to mock:', e);
    }
  }
  return null;
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
      if (results && results.length > 0) return (results as Article[]).map(sanitizeArticle);
    } catch (e) {
      console.warn('D1 Query fallback:', e);
    }
  }
  const related = inMemoryArticles.filter(a => a.id !== currentId && a.category_id === categoryId && a.status === 'published');
  if (related.length < limit) {
    const others = inMemoryArticles.filter(a => a.id !== currentId && a.category_id !== categoryId && a.status === 'published');
    return [...related, ...others].slice(0, limit).map(sanitizeArticle);
  }
  return related.slice(0, limit).map(sanitizeArticle);
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
        return sanitizePage(page as Page);
      }
    } catch (e) {
      console.warn('D1 getPageBySlug fallback to in-memory:', e);
    }
  }

  const found = inMemoryPages.find(p => p.slug === slug);
  if (found) {
    found.views += 1;
    return sanitizePage(found);
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

