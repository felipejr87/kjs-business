// ============================================================
// KJS Business — anuncio.js
// Detalhe de anúncio individual
// ============================================================

let anuncioAtual = null;
let fotoAtiva = 0;

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { window.location.href = '/'; return; }
  await carregarAnuncio(id);
});

// ============================================================
// CARREGAMENTO
// ============================================================
async function carregarAnuncio(id) {
  const { data, error } = await supabase
    .from('anuncios_publicos')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    document.getElementById('conteudo').innerHTML = `
      <div class="not-found">
        <div style="font-size:64px">😕</div>
        <h2>Anúncio não encontrado</h2>
        <p>Este item pode ter sido vendido ou removido.</p>
        <a href="/" class="btn-primary">← Ver todos os anúncios</a>
      </div>
    `;
    return;
  }

  anuncioAtual = data;
  document.title = `${data.titulo} — KJS Business`;
  renderAnuncio(data);
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================
function renderAnuncio(a) {
  const fotos = a.fotos && a.fotos.length ? a.fotos.map(fotoUrl) : [fotoPrincipal([])];
  const specs = buildSpecs(a);
  const formas = (a.formas_pgto || ['pix','debito','credito_maquininha']);

  document.getElementById('conteudo').innerHTML = `
    <!-- Galeria -->
    <div class="galeria">
      <div class="galeria-principal" id="foto-principal">
        <img id="foto-main" src="${fotos[0]}" alt="${a.titulo}">
        ${fotos.length > 1 ? `
          <button class="galeria-nav prev" onclick="mudarFoto(-1)">‹</button>
          <button class="galeria-nav next" onclick="mudarFoto(1)">›</button>
          <div class="galeria-counter">${fotoAtiva + 1} / ${fotos.length}</div>
        ` : ''}
      </div>
      ${fotos.length > 1 ? `
        <div class="galeria-thumbs" id="thumbs">
          ${fotos.map((f, i) => `
            <div class="thumb ${i === 0 ? 'ativo' : ''}" onclick="irParaFoto(${i})">
              <img src="${f}" alt="">
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <!-- Conteúdo -->
    <div class="anuncio-body">
      <div class="anuncio-main">
        <div class="anuncio-badges">
          <span class="badge-tipo badge-${a.tipo}">${a.tipo === 'carro' ? '🚗 Carro' : '🏠 Imóvel'}</span>
        </div>
        <h1 class="anuncio-titulo">${a.titulo}</h1>
        <div class="anuncio-preco">${formatarMoeda(a.valor_venda)}</div>

        <!-- Specs -->
        <div class="specs-grid">
          ${specs.map(s => `
            <div class="spec-item">
              <div class="spec-label">${s.label}</div>
              <div class="spec-valor">${s.valor}</div>
            </div>
          `).join('')}
        </div>

        <!-- Descrição -->
        ${a.descricao ? `
          <div class="anuncio-descricao">
            <h3>Descrição</h3>
            <p>${a.descricao.replace(/\n/g, '<br>')}</p>
          </div>
        ` : ''}

        <!-- Formas de pagamento -->
        <div class="pgto-section">
          <h3>Formas de pagamento</h3>
          <div class="pgto-grid">
            ${formas.map(f => `
              <div class="pgto-item">
                <div class="pgto-icone">${FORMAS_SVG[f] || ''}</div>
                <div class="pgto-nome">${FORMAS_LABEL[f] || f}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Sidebar de ação -->
      <div class="anuncio-sidebar">
        <div class="sidebar-card">
          <div class="sidebar-preco">${formatarMoeda(a.valor_venda)}</div>
          <p class="sidebar-desc">Negociação direta, sem intermediários.<br>Consulte sobre condições.</p>
          <button class="btn-wpp-grande" onclick="abrirWpp(anuncioAtual)">
            💬 Quero este — falar com Kleber
          </button>
          <button class="btn-compartilhar" onclick="compartilhar(anuncioAtual)">
            ↑ Compartilhar
          </button>
          ${KJS_CONFIG?.instagram ? `
            <a class="btn-instagram" href="https://instagram.com/${KJS_CONFIG.instagram}" target="_blank">
              📷 Ver no Instagram
            </a>
          ` : ''}
        </div>
        <a href="/" class="btn-voltar">← Ver todos os anúncios</a>
      </div>
    </div>
  `;

  // Swipe mobile na galeria
  initSwipe(fotos.length);
  _fotos = fotos;
}

// ============================================================
// GALERIA
// ============================================================
let _fotos = [];

function mudarFoto(dir) {
  fotoAtiva = (fotoAtiva + dir + _fotos.length) % _fotos.length;
  atualizarGaleria();
}

function irParaFoto(i) {
  fotoAtiva = i;
  atualizarGaleria();
}

function atualizarGaleria() {
  const img = document.getElementById('foto-main');
  const counter = document.querySelector('.galeria-counter');
  const thumbs = document.querySelectorAll('.thumb');

  if (img) img.src = _fotos[fotoAtiva];
  if (counter) counter.textContent = `${fotoAtiva + 1} / ${_fotos.length}`;
  thumbs.forEach((t, i) => t.classList.toggle('ativo', i === fotoAtiva));
}

function initSwipe(total) {
  if (total <= 1) return;
  const el = document.getElementById('foto-principal');
  if (!el) return;
  let startX = 0;
  el.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) mudarFoto(diff > 0 ? 1 : -1);
  }, { passive: true });
}

// ============================================================
// SPECS DINÂMICAS POR TIPO
// ============================================================
function buildSpecs(a) {
  if (a.tipo === 'carro') {
    return [
      { label: 'Marca', valor: a.marca || '—' },
      { label: 'Modelo', valor: a.modelo || '—' },
      { label: 'Ano', valor: a.ano || '—' },
      { label: 'Quilometragem', valor: a.km ? formatarKm(a.km) : '—' },
      { label: 'Cor', valor: a.cor || '—' },
      { label: 'Câmbio', valor: a.cambio || '—' },
      { label: 'Combustível', valor: a.combustivel || '—' },
    ].filter(s => s.valor !== '—');
  }
  return [
    { label: 'Tipo', valor: a.tipo_imovel || '—' },
    { label: 'Cidade', valor: a.cidade || '—' },
    { label: 'Bairro', valor: a.bairro || '—' },
    { label: 'Área', valor: a.area_m2 ? `${a.area_m2} m²` : '—' },
    { label: 'Quartos', valor: a.quartos || '—' },
    { label: 'Vagas', valor: a.vagas || '—' },
  ].filter(s => s.valor !== '—');
}
