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
  {
    id: 1,
    slug: 'tren-desain-interior-japandi-2026-hunian-minimalis',
    title: 'Kenapa Rumah Japandi Terasa Begitu Menenangkan?',
    description: 'Bukan sekadar dominasi warna krem atau furnitur kayu rendah. Ada serangkaian keputusan proporsi, sirkulasi cahaya, dan material alami yang membuat ruang Japandi terasa lapang tanpa kehilangan kehangatan.',
    content_md: `Gaya Japandi (*Japan + Scandi*) terus memikat siapa saja yang mendambakan ketenangan di tengah hiruk-pikuk perkotaan. Mengapa pendekatan estetika ini begitu awet dan tidak lekang oleh zaman?\n\n## Esensi Filosofi Japandi Modern\n\nFilosofi Japandi lahir dari perpaduan dua nilai fundamental:\n\n- **Wabi-Sabi (Jepang)**: Menghargai ketidaksempurnaan alami serat kayu dan tekstur bebatuan lokal.\n- **Hygge dan Lagom (Skandinavia)**: Menciptakan kenyamanan fungsional secukupnya tanpa dekorasi yang berlebihan.\n\n## 4 Kunci Menerapkan Gaya Japandi di Rumah\n\n1. **Palet Warna Netral & Nada Bumi (*Earth Tones*)**: Paduan broken white, oat, warm grey, dan aksen kayu jati mentah.\n2. **Furnitur Berprofil Rendah & Fungsional**: Memberikan ilusi plafon yang lebih tinggi dan lapang.\n3. **Pencahayaan Alami & Layered Lighting**: Memaksimalkan jendela bukaan besar dan lampu bercahaya hangat (*warm white 2700K*).\n4. **Sentuhan Tanaman Indoor & Keramik Bertekstur**: Menghidupkan sudut ruangan secara organik.`,
    content_html: `<p>Gaya Japandi (<em>Japan + Scandi</em>) terus memikat siapa saja yang mendambakan ketenangan di tengah hiruk-pikuk perkotaan. Mengapa pendekatan estetika ini begitu awet dan tidak lekang oleh zaman?</p><h2 id="esensi-filosofi-japandi-modern">Esensi Filosofi Japandi Modern</h2><p>Filosofi Japandi lahir dari perpaduan dua nilai fundamental:</p><ul><li><strong>Wabi-Sabi (Jepang)</strong>: Menghargai ketidaksempurnaan alami serat kayu dan tekstur bebatuan lokal.</li><li><strong>Hygge dan Lagom (Skandinavia)</strong>: Menciptakan kenyamanan fungsional secukupnya tanpa dekorasi yang berlebihan.</li></ul><h2 id="4-kunci-menerapkan-gaya-japandi-di-rumah">4 Kunci Menerapkan Gaya Japandi di Rumah</h2><ol><li><strong>Palet Warna Netral &amp; Nada Bumi (<em>Earth Tones</em>)</strong>: Paduan broken white, oat, warm grey, dan aksen kayu jati mentah.</li><li><strong>Furnitur Berprofil Rendah &amp; Fungsional</strong>: Memberikan ilusi plafon yang lebih tinggi dan lapang.</li><li><strong>Pencahayaan Alami &amp; Layered Lighting</strong>: Memaksimalkan jendela bukaan besar dan lampu bercahaya hangat (<em>warm white 2700K</em>).</li><li><strong>Sentuhan Tanaman Indoor &amp; Keramik Bertekstur</strong>: Menghidupkan sudut ruangan secara organik.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Desain ruang tamu Japandi dengan bukaan kaca besar dan aksen kayu hangat',
    category_id: 1,
    category_name: 'Desain Interior & Estetika',
    category_slug: 'interior-design',
    category_color: '#059669',
    author_id: 1,
    author_name: 'Tim Kurasi RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Dewan Redaksi Spasial',
    status: 'published',
    views: 2450,
    reading_time_minutes: 5,
    key_takeaways: JSON.stringify([
      'Gaya Japandi menggabungkan kehangatan wabi-sabi Jepang dan fungsionalitas Skandinavia.',
      'Furnitur berprofil rendah dan palet earth tones membuat ruangan terasa lebih lega.',
      'Pencahayaan berlapis menciptakan suasana rileks alami di malam hari.'
    ]),
    focus_keyword: 'desain interior japandi modern',
    content_hash: 'erihomehash1',
    is_featured: 1,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 2,
    slug: 'rumah-tropis-yang-tidak-takut-matahari',
    title: 'Rumah Tropis yang Tidak Takut Matahari: Eksplorasi Secondary Skin & Cross-Ventilation',
    description: 'Bagaimana kisi-kisi kayu ulin dan kanopi gantung membiaskan radiasi panas siang hari tanpa mengorbankan pasokan cahaya alami.',
    content_md: `Tinggal di iklim tropis menuntut kejelian merespons orientasi matahari. Alih-alih menutup rapat fasad dengan tirai tebal, arsitektur tropis kontemporer memanfaatkan selubung ganda (*secondary skin*).\n\n## Prinsip Menjinakkan Radiasi Tropis\n\n1. **Kisi-Kisi Kayu & Aluminium Vertikal**: Mengurangi silau matahari barat hingga 60% tanpa menghalangi sirkulasi udara alami.\n2. **Sumbu Ventilasi Silang (*Cross Ventilation*)**: Bukaan yang berhadapan langsung mengalirkan angin sejuk terus menerus melintasi ruang tengah.\n3. **Overhang Atap yang Dalam**: Mencegah tampias air hujan sekaligus menaungi bidang kaca dari paparan langsung.`,
    content_html: `<p>Tinggal di iklim tropis menuntut kejelian merespons orientasi matahari. Alih-alih menutup rapat fasad dengan tirai tebal, arsitektur tropis kontemporer memanfaatkan selubung ganda (<em>secondary skin</em>).</p><h2 id="prinsip-menjinakkan-radiasi-tropis">Prinsip Menjinakkan Radiasi Tropis</h2><ol><li><strong>Kisi-Kisi Kayu &amp; Aluminium Vertikal</strong>: Mengurangi silau matahari barat tanpa menghalangi sirkulasi udara alami.</li><li><strong>Sumbu Ventilasi Silang (<em>Cross Ventilation</em>)</strong>: Bukaan yang berhadapan langsung mengalirkan angin sejuk melintasi ruang tengah.</li><li><strong>Overhang Atap yang Dalam</strong>: Mencegah tampias air hujan sekaligus menaungi bidang kaca.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Fasad rumah tropis dengan kisi-kisi kayu sekunder dan taman hijau',
    category_id: 3,
    category_name: 'Arsitektur & Fasad',
    category_slug: 'arsitektur-renovasi',
    category_color: '#d97706',
    author_id: 2,
    author_name: 'Dewan Redaksi Arsitektur',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    author_role: 'Editor Pelaksana',
    status: 'published',
    views: 1890,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Secondary skin membiaskan panas matahari barat namun tetap meloloskan angin alami.',
      'Sumbu ventilasi silang menjaga suhu ruang tetap stabil tanpa ketergantungan AC 24 jam.',
      'Overhang atap melindungi bukaan kaca dari terpaan cuaca ekstrem tropis.'
    ]),
    focus_keyword: 'arsitektur rumah tropis modern',
    content_hash: 'erihomehash2',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 6).toISOString()
  },
  {
    id: 3,
    slug: 'merancang-rumah-tipe-36-agar-bernapas',
    title: 'Merancang Rumah Tipe 36 Agar Bernapas: Trik Void 5 Meter & Ruang Bebas Sekat',
    description: 'Solusi spasial cerdas memaksimalkan lahan terbatas agar terasa seperti hunian dua kali lipat lebih lega dengan efek cerobong udara vertikal.',
    content_md: `Keterbatasan lahan 60 meter persegi bukan alasan sebuah hunian harus terasa sesak dan pengap. Dengan rekayasa ketinggian plafon dan penataan ruang terbuka, rumah mungil dapat bernapas dengan lega.\n\n## Solusi Tata Ruang Bebas Sekat (*Open Plan*)\n\nMenghilangkan dinding masif antara ruang keluarga dan dapur menciptakan kontinuitas visual. Gunakan rak partisi dua sisi berbahan kayu jati terbuka.\n\n## Efek Cerobong Udara via Void Tengah\n\nMembuat bukaan void setinggi 4 hingga 5 meter di area tengah rumah mengalirkan udara hangat ke atas secara alami keluar dari rumah melalui ventilasi atap (*stack effect*).`,
    content_html: `<p>Keterbatasan lahan 60 meter persegi bukan alasan sebuah hunian harus terasa sesak dan pengap. Dengan rekayasa ketinggian plafon dan penataan ruang terbuka, rumah mungil dapat bernapas dengan lega.</p><h2 id="solusi-tata-ruang-bebas-sekat-open-plan">Solusi Tata Ruang Bebas Sekat (<em>Open Plan</em>)</h2><p>Menghilangkan dinding masif antara ruang keluarga dan dapur menciptakan kontinuitas visual.</p><h2 id="efek-cerobong-udara-via-void-tengah">Efek Cerobong Udara via Void Tengah</h2><p>Membuat bukaan void setinggi 4 hingga 5 meter di area tengah rumah mengalirkan udara hangat ke atas secara alami melalui efek cerobong (<em>stack effect</em>).</p>`,
    featured_image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Desain ruang keluarga minimalis open space yang terang dan lapang',
    category_id: 3,
    category_name: 'Arsitektur & Fasad',
    category_slug: 'arsitektur-renovasi',
    category_color: '#d97706',
    author_id: 1,
    author_name: 'Tim Kurasi RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Dewan Redaksi Spasial',
    status: 'published',
    views: 3120,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Konsep open plan tanpa dinding masif melipatgandakan kontinuitas visual ruang.',
      'Void atap mengalirkan udara panas keluar melalui efek cerobong vertikal alami.',
      'Penyimpanan tersembunyi menjaga kerapian dan ketenangan visual rumah kecil.'
    ]),
    focus_keyword: 'renovasi rumah tipe 36 lapang',
    content_hash: 'erihomehash3',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 4,
    slug: 'kamar-tidur-yang-benar-benar-mengistirahatkan',
    title: 'Kamar Tidur yang Benar-Benar Mengistirahatkan: Keseimbangan Cahaya & Katun Alami',
    description: 'Menghilangkan stimulasi visual berlebih di ruang privat untuk kualitas pemulihan energi yang optimal setiap malam.',
    content_md: `Kamar tidur adalah suaka pemulihan energi setelah seharian beraktivitas di luar rumah. Menatanya dengan standar ketenangan prima berakar pada pengendalian stimulasi sensorik.\n\n## Kunci Ruang Tidur yang Menenangkan\n\n1. **Serat Katun Alami**: Sprei katun organik dengan tenunan sejuk yang ramah terhadap suhu tubuh sepanjang malam.\n2. **Pencahayaan Ambience Berlapis**: Menghindari lampu sorot langsung ke arah tempat tidur, utamakan lampu meja bertutup kain lembut.\n3. **Kerapian Visual**: Memastikan permukaan meja samping tempat tidur bebas dari tumpukan kabel dan gawai elektronik.`,
    content_html: `<p>Kamar tidur adalah suaka pemulihan energi setelah seharian beraktivitas di luar rumah. Menatanya dengan standar ketenangan prima berakar pada pengendalian stimulasi sensorik.</p><h2 id="kunci-ruang-tidur-yang-menenangkan">Kunci Ruang Tidur yang Menenangkan</h2><ol><li><strong>Serat Katun Alami</strong>: Sprei katun organik dengan tenunan sejuk yang ramah terhadap suhu tubuh.</li><li><strong>Pencahayaan Ambience Berlapis</strong>: Hindari lampu sorot langsung, utamakan lampu meja bertutup kain lembut.</li><li><strong>Kerapian Visual</strong>: Memastikan permukaan meja samping tempat tidur bebas dari kabel.</li></ol>`,
    featured_image: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Kamar tidur minimalis estetik dengan pencahayaan hangat dan sprei rapi',
    category_id: 1,
    category_name: 'Desain Interior & Estetika',
    category_slug: 'interior-design',
    category_color: '#059669',
    author_id: 1,
    author_name: 'Tim Kurasi RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Dewan Redaksi Spasial',
    status: 'published',
    views: 1650,
    reading_time_minutes: 3,
    key_takeaways: JSON.stringify([
      'Pilihlah serat katun alami organik yang menyerap keringat dan ramah suhu tubuh.',
      'Pencahayaan tidak langsung (indirect lighting) membantu pelepasan hormon melatonin alami.',
      'Jauhkan gawai dan polusi cahaya dari area sekitar kasur untuk kualitas tidur dalam.'
    ]),
    focus_keyword: 'menata kamar tidur menenangkan',
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
    author_id: 1,
    author_name: 'Dewan Redaksi Spasial RancangLoka',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Kurator Utama Tata Ruang Tropis',
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

