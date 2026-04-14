// ============================================================
// KJS Business — core.js
// Supabase client, autenticação, utilitários globais
// ============================================================

// ⚠️ Substituir com as credenciais do projeto Supabase KJS
const SUPABASE_URL  = 'https://nmdshljajpcnvnoebaqi.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZHNobGphanBjbnZub2ViYXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzA1MzYsImV4cCI6MjA5MTc0NjUzNn0.O2Ck7wif8Am1i2SY9aP5EsGNhf8iUO1h0_55L4c7Gyo';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
// CONFIG GLOBAL — carregada uma vez, reutilizada
// ============================================================
let KJS_CONFIG = null;

async function loadConfig() {
  const { data } = await supabase.from('config').select('*').eq('id', 1).single();
  KJS_CONFIG = data || { whatsapp: '', nome_exibicao: 'KJS Business', bio: '' };
  return KJS_CONFIG;
}

// ============================================================
// AUTENTICAÇÃO — Supabase Auth nativo
// ============================================================
async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function login(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = '/admin.html';
}

// Redireciona para login se não autenticado
async function exigirAuth() {
  const user = await getUser();
  if (!user) {
    window.location.href = '/admin.html';
    return false;
  }
  return true;
}

// ============================================================
// FORMATADORES
// ============================================================
function formatarMoeda(v) {
  if (!v && v !== 0) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0
  }).format(v);
}

function formatarData(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function formatarKm(km) {
  if (!km) return '—';
  return new Intl.NumberFormat('pt-BR').format(km) + ' km';
}

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

// ============================================================
// TOAST — sistema único de notificações
// ============================================================
function toast(msg, tipo = 'success') {
  const existing = document.querySelector('.kjs-toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = 'kjs-toast';
  el.setAttribute('data-tipo', tipo);
  el.textContent = msg;
  document.body.appendChild(el);

  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ============================================================
// WHATSAPP — geração de link com mensagem pré-pronta
// ============================================================
function linkWpp(anuncio) {
  if (!KJS_CONFIG?.whatsapp) return '#';
  const num = KJS_CONFIG.whatsapp.replace(/\D/g, '');
  const preco = formatarMoeda(anuncio.valor_venda);
  const texto = `Olá! Vi o anúncio *${anuncio.titulo}* por ${preco} no KJS Business e gostaria de mais informações.`;
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

function abrirWpp(anuncio) {
  window.open(linkWpp(anuncio), '_blank');
}

// ============================================================
// COMPARTILHAR — Web Share API + fallback
// ============================================================
async function compartilhar(anuncio) {
  const url = `${location.origin}/anuncio.html?id=${anuncio.id}`;
  const text = `${anuncio.titulo} por ${formatarMoeda(anuncio.valor_venda)}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: anuncio.titulo, text, url });
    } catch (e) { /* usuário cancelou */ }
  } else {
    await navigator.clipboard.writeText(url);
    toast('Link copiado!');
  }
}

// ============================================================
// SPECS — texto resumido por tipo de anúncio
// ============================================================
function specsTexto(a) {
  if (a.tipo === 'carro') {
    return [
      a.ano, a.km ? formatarKm(a.km) : null, a.cambio, a.combustivel
    ].filter(Boolean).join(' · ');
  }
  return [
    a.cidade, a.area_m2 ? `${a.area_m2}m²` : null,
    a.quartos ? `${a.quartos} quartos` : null
  ].filter(Boolean).join(' · ');
}

// ============================================================
// FOTO PRINCIPAL — primeira do array ou placeholder
// ============================================================
function fotoPrincipal(fotos) {
  return (fotos && fotos.length > 0)
    ? fotos[0]
    : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="%231E1E1E" width="400" height="300"/><text fill="%23555" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em">Sem foto</text></svg>';
}

// ============================================================
// FORMAS DE PAGAMENTO — labels e ícones
// ============================================================
const FORMAS_LABEL = {
  pix: 'PIX',
  debito: 'Débito',
  credito_maquininha: 'Crédito parcelado'
};

const FORMAS_SVG = {
  pix: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  debito: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  credito_maquininha: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="6" y1="16" x2="6" y2="16" stroke-linecap="round" stroke-width="3"/><line x1="10" y1="16" x2="14" y2="16" stroke-linecap="round"/></svg>`
};
