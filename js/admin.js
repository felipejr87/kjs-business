// ============================================================
// KJS Business — admin.js
// Painel do Kleber: login, dashboard, anúncios, vendas
// ============================================================

let anunciosAdmin = [];
let vendasAdmin = [];
let periodoAtivo = 'mes';
let abaAtiva = 'dashboard';

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  const user = await getUser();
  if (user) {
    mostrarPainel();
  } else {
    mostrarLogin();
  }
});

// ============================================================
// AUTH
// ============================================================
function mostrarLogin() {
  document.getElementById('tela-login').style.display = 'flex';
  document.getElementById('tela-painel').style.display = 'none';
}

function mostrarPainel() {
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('tela-painel').style.display = 'flex';
  carregarTudo();
}

// Formulário de login
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-login');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const btn = form.querySelector('button[type=submit]');
    btn.textContent = 'Entrando...';
    btn.disabled = true;
    try {
      await login(email, senha);
      mostrarPainel();
    } catch (err) {
      toast('Email ou senha incorretos', 'error');
      btn.textContent = 'Entrar';
      btn.disabled = false;
    }
  });
});

// ============================================================
// CARREGAMENTO GERAL
// ============================================================
async function carregarTudo() {
  const [{ data: anuncios }, { data: vendas }] = await Promise.all([
    supabase.from('anuncios').select('*').order('criado_em', { ascending: false }),
    supabase.from('vendas').select('*, anuncios(titulo, valor_pago)').order('vendido_em', { ascending: false })
  ]);
  anunciosAdmin = anuncios || [];
  vendasAdmin = vendas || [];
  renderAba('dashboard');
}

// ============================================================
// NAVEGAÇÃO ENTRE ABAS
// ============================================================
function irAba(aba) {
  abaAtiva = aba;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('ativo', el.dataset.aba === aba);
  });
  document.querySelectorAll('.aba-content').forEach(el => {
    el.style.display = el.id === `aba-${aba}` ? '' : 'none';
  });
  renderAba(aba);
}

function renderAba(aba) {
  if (aba === 'dashboard') renderDashboard();
  if (aba === 'anuncios') renderListaAnuncios();
  if (aba === 'vendas') renderListaVendas();
  if (aba === 'config') renderConfig();
}

// ============================================================
// DASHBOARD
// ============================================================
function filtrarPorPeriodo(vendas) {
  const now = new Date();
  return vendas.filter(v => {
    const d = new Date(v.vendido_em);
    if (periodoAtivo === 'semana') {
      return (now - d) <= 7 * 86400000;
    }
    if (periodoAtivo === 'mes') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (periodoAtivo === 'trimestre') {
      return (now - d) <= 90 * 86400000;
    }
    return d.getFullYear() === now.getFullYear();
  });
}

function calcularMetricas(vendas) {
  return vendas.reduce((acc, v) => {
    const custo = v.anuncios?.valor_pago || 0;
    const lucro = v.valor_final - custo;
    return {
      receita: acc.receita + v.valor_final,
      custo: acc.custo + custo,
      lucro: acc.lucro + lucro,
      count: acc.count + 1
    };
  }, { receita: 0, custo: 0, lucro: 0, count: 0 });
}

function renderDashboard() {
  const vendas = filtrarPorPeriodo(vendasAdmin);
  const m = calcularMetricas(vendas);
  const margem = m.receita > 0 ? (m.lucro / m.receita * 100).toFixed(1) : 0;
  const ticket = m.count > 0 ? m.receita / m.count : 0;
  const ativos = anunciosAdmin.filter(a => a.status === 'disponivel').length;

  // Produto mais rentável
  let topProduto = '—';
  if (vendas.length) {
    const melhor = vendas.reduce((best, v) => {
      const lucro = v.valor_final - (v.anuncios?.valor_pago || 0);
      return lucro > best.lucro ? { lucro, titulo: v.anuncios?.titulo || '—' } : best;
    }, { lucro: -Infinity, titulo: '—' });
    topProduto = melhor.titulo.length > 20 ? melhor.titulo.slice(0, 20) + '…' : melhor.titulo;
  }

  document.getElementById('aba-dashboard').innerHTML = `
    <div class="dashboard-header">
      <h2>Dashboard</h2>
      <div class="periodo-tabs">
        ${['semana','mes','trimestre','ano'].map(p => `
          <button class="periodo-btn ${periodoAtivo === p ? 'ativo' : ''}"
            onclick="setPeriodo('${p}')">${{ semana:'Semana', mes:'Mês', trimestre:'Trimestre', ano:'Ano' }[p]}</button>
        `).join('')}
      </div>
    </div>

    <div class="metricas-grid">
      <div class="metrica-card destaque">
        <div class="metrica-label">Lucro</div>
        <div class="metrica-valor ${m.lucro >= 0 ? 'positivo' : 'negativo'}">${formatarMoeda(m.lucro)}</div>
        <div class="metrica-sub">Margem: ${margem}%</div>
      </div>
      <div class="metrica-card">
        <div class="metrica-label">Faturamento</div>
        <div class="metrica-valor">${formatarMoeda(m.receita)}</div>
        <div class="metrica-sub">${m.count} venda${m.count !== 1 ? 's' : ''}</div>
      </div>
      <div class="metrica-card">
        <div class="metrica-label">Custo total</div>
        <div class="metrica-valor">${formatarMoeda(m.custo)}</div>
        <div class="metrica-sub">Valor de compra</div>
      </div>
      <div class="metrica-card">
        <div class="metrica-label">Ticket médio</div>
        <div class="metrica-valor">${formatarMoeda(ticket)}</div>
        <div class="metrica-sub">${ativos} anúncio${ativos !== 1 ? 's' : ''} ativo${ativos !== 1 ? 's' : ''}</div>
      </div>
    </div>

    ${vendas.length ? renderGraficoBarras(vendas) : ''}

    <div class="dashboard-footer">
      <button class="btn-primary" onclick="irAba('anuncios')">+ Novo anúncio</button>
      <span class="top-produto">Top produto: <strong>${topProduto}</strong></span>
    </div>
  `;
}

function setPeriodo(p) {
  periodoAtivo = p;
  renderDashboard();
}

// Gráfico de barras simples em CSS
function renderGraficoBarras(vendas) {
  // Agrupar por dia (últimos 10 negócios)
  const grupos = {};
  vendas.slice(-10).forEach(v => {
    const d = formatarData(v.vendido_em);
    const lucro = v.valor_final - (v.anuncios?.valor_pago || 0);
    grupos[d] = (grupos[d] || 0) + lucro;
  });
  const entries = Object.entries(grupos);
  const maxVal = Math.max(...entries.map(e => e[1]), 1);

  return `
    <div class="grafico-section">
      <div class="grafico-titulo">Lucro por negócio</div>
      <div class="grafico-barras">
        ${entries.map(([data, lucro]) => `
          <div class="barra-wrap">
            <div class="barra" style="height:${Math.max((lucro/maxVal)*100,4)}%" title="${formatarMoeda(lucro)}">
              <span class="barra-val">${formatarMoeda(lucro)}</span>
            </div>
            <div class="barra-label">${data.slice(0,5)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ============================================================
// LISTA DE ANÚNCIOS
// ============================================================
function renderListaAnuncios() {
  const el = document.getElementById('aba-anuncios');
  if (!el) return;

  el.innerHTML = `
    <div class="lista-header">
      <h2>Anúncios (${anunciosAdmin.length})</h2>
      <button class="btn-primary" onclick="abrirModalAnuncio()">+ Novo anúncio</button>
    </div>
    <div class="filtros-status">
      ${['todos','disponivel','reservado','vendido'].map(s => `
        <button class="filtro-btn" data-status="${s}"
          onclick="filtrarStatus('${s}', this)">${{ todos:'Todos', disponivel:'Disponíveis', reservado:'Reservados', vendido:'Vendidos' }[s]}</button>
      `).join('')}
    </div>
    <div class="lista-anuncios" id="lista-anuncios-inner">
      ${renderItemsAnuncios(anunciosAdmin)}
    </div>
  `;
  document.querySelector('[data-status="todos"]').classList.add('ativo');
}

function filtrarStatus(status, btn) {
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  const lista = status === 'todos' ? anunciosAdmin : anunciosAdmin.filter(a => a.status === status);
  document.getElementById('lista-anuncios-inner').innerHTML = renderItemsAnuncios(lista);
}

function renderItemsAnuncios(lista) {
  if (!lista.length) return '<div class="empty-lista">Nenhum anúncio nesta categoria</div>';
  return lista.map(a => {
    const lucro = a.valor_venda - a.valor_pago;
    const margem = a.valor_venda > 0 ? (lucro / a.valor_venda * 100).toFixed(1) : 0;
    return `
      <div class="item-anuncio">
        <div class="item-foto">
          <img src="${fotoPrincipal(a.fotos)}" alt="${a.titulo}">
        </div>
        <div class="item-info">
          <div class="item-titulo">${a.titulo}</div>
          <div class="item-tipo">${a.tipo === 'carro' ? '🚗' : '🏠'} ${a.tipo}</div>
          <div class="item-financeiro">
            <span class="fin-label">Pago: <strong>${formatarMoeda(a.valor_pago)}</strong></span>
            <span class="fin-label">Venda: <strong>${formatarMoeda(a.valor_venda)}</strong></span>
            <span class="fin-lucro">Lucro: <strong>${formatarMoeda(lucro)}</strong> (${margem}%)</span>
          </div>
        </div>
        <div class="item-status">
          <span class="status-badge status-${a.status}">${{ disponivel:'Disponível', reservado:'Reservado', vendido:'Vendido' }[a.status]}</span>
          ${a.destaque ? '<span class="destaque-badge">⭐ Destaque</span>' : ''}
        </div>
        <div class="item-acoes">
          <button onclick="abrirModalAnuncio(${a.id})" title="Editar">✏️</button>
          ${a.status !== 'vendido' ? `<button onclick="abrirModalVenda(${a.id})" title="Registrar venda" class="btn-venda">💰</button>` : ''}
          <button onclick="compartilharAdmin(${a.id})" title="Compartilhar">↑</button>
          <button onclick="confirmarExcluir(${a.id})" title="Excluir" class="btn-danger">🗑</button>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// MODAL DE ANÚNCIO (criar / editar)
// ============================================================
function abrirModalAnuncio(id = null) {
  const anuncio = id ? anunciosAdmin.find(a => a.id === id) : null;
  const titulo = anuncio ? 'Editar anúncio' : 'Novo anúncio';
  const tipo = anuncio?.tipo || 'carro';

  const modal = criarModal(`
    <div class="modal-header">
      <h3>${titulo}</h3>
      <button class="modal-fechar" onclick="fecharModal()">✕</button>
    </div>
    <div class="modal-body">
      <!-- Tipo -->
      <div class="campo-grupo">
        <label>Tipo</label>
        <div class="tipo-toggle">
          <button id="btn-carro" class="tipo-btn ${tipo === 'carro' ? 'ativo' : ''}" onclick="setTipo('carro')">🚗 Carro</button>
          <button id="btn-imovel" class="tipo-btn ${tipo === 'imovel' ? 'ativo' : ''}" onclick="setTipo('imovel')">🏠 Imóvel</button>
        </div>
      </div>

      <!-- Comum -->
      <div class="campos-comuns">
        <div class="campo-grupo">
          <label>Título *</label>
          <input id="f-titulo" type="text" value="${anuncio?.titulo || ''}" placeholder="Ex: Honda Civic 2020 ou Apto 2 quartos Bairro X">
        </div>
        <div class="campo-row">
          <div class="campo-grupo">
            <label>Valor pago (privado) *</label>
            <input id="f-valor-pago" type="number" step="0.01" value="${anuncio?.valor_pago || ''}" placeholder="0,00" oninput="calcularLucroModal()">
          </div>
          <div class="campo-grupo">
            <label>Valor de venda *</label>
            <input id="f-valor-venda" type="number" step="0.01" value="${anuncio?.valor_venda || ''}" placeholder="0,00" oninput="calcularLucroModal()">
          </div>
        </div>
        <div id="calculo-lucro" class="calculo-lucro"></div>

        <div class="campo-grupo">
          <label>Status</label>
          <select id="f-status">
            <option value="disponivel" ${anuncio?.status === 'disponivel' ? 'selected' : ''}>Disponível</option>
            <option value="reservado"  ${anuncio?.status === 'reservado'  ? 'selected' : ''}>Reservado</option>
            <option value="vendido"    ${anuncio?.status === 'vendido'    ? 'selected' : ''}>Vendido</option>
          </select>
        </div>

        <div class="campo-grupo campo-check">
          <label><input id="f-destaque" type="checkbox" ${anuncio?.destaque ? 'checked' : ''}> ⭐ Destacar anúncio (aparece no carrossel)</label>
        </div>
      </div>

      <!-- Campos carro -->
      <div id="campos-carro" style="display:${tipo === 'carro' ? '' : 'none'}">
        <div class="secao-label">Dados do veículo</div>
        <div class="campo-row">
          <div class="campo-grupo"><label>Marca</label><input id="f-marca" value="${anuncio?.marca || ''}" placeholder="Honda"></div>
          <div class="campo-grupo"><label>Modelo</label><input id="f-modelo" value="${anuncio?.modelo || ''}" placeholder="Civic"></div>
        </div>
        <div class="campo-row">
          <div class="campo-grupo"><label>Ano</label><input id="f-ano" type="number" value="${anuncio?.ano || ''}" placeholder="2020"></div>
          <div class="campo-grupo"><label>KM</label><input id="f-km" type="number" value="${anuncio?.km || ''}" placeholder="45000"></div>
        </div>
        <div class="campo-row">
          <div class="campo-grupo"><label>Cor</label><input id="f-cor" value="${anuncio?.cor || ''}" placeholder="Preto"></div>
          <div class="campo-grupo">
            <label>Câmbio</label>
            <select id="f-cambio">
              <option value="">—</option>
              ${['Manual','Automático','CVT','Semi-automático'].map(c => `<option ${anuncio?.cambio === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="campo-grupo">
          <label>Combustível</label>
          <select id="f-combustivel">
            <option value="">—</option>
            ${['Flex','Gasolina','Diesel','Elétrico','Híbrido'].map(c => `<option ${anuncio?.combustivel === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Campos imóvel -->
      <div id="campos-imovel" style="display:${tipo === 'imovel' ? '' : 'none'}">
        <div class="secao-label">Dados do imóvel</div>
        <div class="campo-row">
          <div class="campo-grupo"><label>Cidade</label><input id="f-cidade" value="${anuncio?.cidade || ''}"></div>
          <div class="campo-grupo"><label>Bairro</label><input id="f-bairro" value="${anuncio?.bairro || ''}"></div>
        </div>
        <div class="campo-row">
          <div class="campo-grupo"><label>Área (m²)</label><input id="f-area" type="number" step="0.1" value="${anuncio?.area_m2 || ''}"></div>
          <div class="campo-grupo"><label>Quartos</label><input id="f-quartos" type="number" value="${anuncio?.quartos || ''}"></div>
        </div>
        <div class="campo-row">
          <div class="campo-grupo"><label>Vagas</label><input id="f-vagas" type="number" value="${anuncio?.vagas || ''}"></div>
          <div class="campo-grupo">
            <label>Tipo</label>
            <select id="f-tipo-imovel">
              <option value="">—</option>
              ${['Casa','Apartamento','Terreno','Comercial'].map(t => `<option ${anuncio?.tipo_imovel === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Descrição -->
      <div class="campo-grupo">
        <label>Descrição</label>
        <textarea id="f-descricao" rows="4" placeholder="Detalhes extras, estado de conservação, diferenciais...">${anuncio?.descricao || ''}</textarea>
      </div>

      <!-- Upload de fotos -->
      <div class="campo-grupo">
        <label>Fotos</label>
        <div class="upload-area" id="upload-area" onclick="document.getElementById('input-fotos').click()">
          <input type="file" id="input-fotos" accept="image/*" multiple style="display:none" onchange="handleFotos(event)">
          <div class="upload-icon">📷</div>
          <div>Clique para adicionar fotos</div>
          <div style="font-size:12px;color:var(--text-3)">JPG, PNG, WebP · Primeira = capa</div>
        </div>
        <div class="fotos-preview" id="fotos-preview">
          ${(anuncio?.fotos || []).map((f, i) => `
            <div class="foto-thumb">
              <img src="${f}">
              ${i === 0 ? '<span class="foto-capa">Capa</span>' : ''}
              <button class="foto-remove" onclick="removerFoto(${i})">✕</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primary" onclick="salvarAnuncio(${id || 'null'})">
        ${anuncio ? 'Salvar alterações' : 'Publicar anúncio'}
      </button>
    </div>
  `);

  // Estado de fotos no modal
  modal._fotos = anuncio?.fotos ? [...anuncio.fotos] : [];
  modal._tipo = tipo;
  calcularLucroModal();
}

let _fotosPendentes = [];
let _fotosExistentes = [];

function setTipo(tipo) {
  document.getElementById('btn-carro').classList.toggle('ativo', tipo === 'carro');
  document.getElementById('btn-imovel').classList.toggle('ativo', tipo === 'imovel');
  document.getElementById('campos-carro').style.display = tipo === 'carro' ? '' : 'none';
  document.getElementById('campos-imovel').style.display = tipo === 'imovel' ? '' : 'none';
  document.querySelector('.kjs-modal')._tipo = tipo;
}

function calcularLucroModal() {
  const pago = parseFloat(document.getElementById('f-valor-pago')?.value) || 0;
  const venda = parseFloat(document.getElementById('f-valor-venda')?.value) || 0;
  const lucro = venda - pago;
  const margem = venda > 0 ? (lucro / venda * 100).toFixed(1) : 0;
  const el = document.getElementById('calculo-lucro');
  if (!el) return;
  const cor = lucro >= 0 ? 'var(--success)' : 'var(--error)';
  el.innerHTML = `<span style="color:${cor}">Lucro: <strong>${formatarMoeda(lucro)}</strong> · Margem: <strong>${margem}%</strong></span>`;
}

async function handleFotos(event) {
  const files = Array.from(event.target.files);
  const preview = document.getElementById('fotos-preview');
  preview.innerHTML += files.map((_, i) => `<div class="foto-thumb loading" id="thumb-loading-${i}"><div class="skeleton" style="width:100%;height:100%"></div></div>`).join('');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from('kjs-fotos').upload(path, file, { upsert: false });
    if (error) { toast(`Erro ao enviar foto: ${error.message}`, 'error'); continue; }
    const { data: { publicUrl } } = supabase.storage.from('kjs-fotos').getPublicUrl(data.path);
    _fotosExistentes.push(publicUrl);
    document.getElementById(`thumb-loading-${i}`)?.remove();
    adicionarThumb(publicUrl, _fotosExistentes.length - 1);
  }
}

function adicionarThumb(url, idx) {
  const preview = document.getElementById('fotos-preview');
  const div = document.createElement('div');
  div.className = 'foto-thumb';
  div.innerHTML = `<img src="${url}">${idx === 0 ? '<span class="foto-capa">Capa</span>' : ''}<button class="foto-remove" onclick="removerFoto(${idx})">✕</button>`;
  preview.appendChild(div);
}

function removerFoto(idx) {
  _fotosExistentes.splice(idx, 1);
  // Re-render thumbs
  const preview = document.getElementById('fotos-preview');
  preview.innerHTML = _fotosExistentes.map((f, i) => `
    <div class="foto-thumb">
      <img src="${f}">
      ${i === 0 ? '<span class="foto-capa">Capa</span>' : ''}
      <button class="foto-remove" onclick="removerFoto(${i})">✕</button>
    </div>
  `).join('');
}

async function salvarAnuncio(id) {
  const modal = document.querySelector('.kjs-modal');
  const tipo = modal?._tipo || 'carro';

  const payload = {
    tipo,
    titulo: document.getElementById('f-titulo').value.trim(),
    valor_pago: parseFloat(document.getElementById('f-valor-pago').value) || 0,
    valor_venda: parseFloat(document.getElementById('f-valor-venda').value) || 0,
    status: document.getElementById('f-status').value,
    destaque: document.getElementById('f-destaque').checked,
    descricao: document.getElementById('f-descricao').value.trim(),
    fotos: _fotosExistentes,
    ...(tipo === 'carro' ? {
      marca: document.getElementById('f-marca').value.trim(),
      modelo: document.getElementById('f-modelo').value.trim(),
      ano: parseInt(document.getElementById('f-ano').value) || null,
      km: parseInt(document.getElementById('f-km').value) || null,
      cor: document.getElementById('f-cor').value.trim(),
      cambio: document.getElementById('f-cambio').value,
      combustivel: document.getElementById('f-combustivel').value
    } : {
      cidade: document.getElementById('f-cidade').value.trim(),
      bairro: document.getElementById('f-bairro').value.trim(),
      area_m2: parseFloat(document.getElementById('f-area').value) || null,
      quartos: parseInt(document.getElementById('f-quartos').value) || null,
      vagas: parseInt(document.getElementById('f-vagas').value) || null,
      tipo_imovel: document.getElementById('f-tipo-imovel').value
    })
  };

  if (!payload.titulo) { toast('Título é obrigatório', 'error'); return; }
  if (!payload.valor_venda) { toast('Valor de venda é obrigatório', 'error'); return; }

  const btn = document.querySelector('.modal-footer .btn-primary');
  btn.textContent = 'Salvando...'; btn.disabled = true;

  let error;
  if (id) {
    ({ error } = await supabase.from('anuncios').update(payload).eq('id', id));
  } else {
    ({ error } = await supabase.from('anuncios').insert(payload));
  }

  if (error) { toast('Erro ao salvar: ' + error.message, 'error'); btn.textContent = 'Salvar'; btn.disabled = false; return; }
  toast(id ? 'Anúncio atualizado!' : 'Anúncio publicado!');
  fecharModal();
  _fotosExistentes = [];
  await carregarTudo();
  irAba('anuncios');
}

// ============================================================
// MODAL DE VENDA
// ============================================================
function abrirModalVenda(anuncioId) {
  const anuncio = anunciosAdmin.find(a => a.id === anuncioId);
  if (!anuncio) return;

  criarModal(`
    <div class="modal-header">
      <h3>Registrar venda</h3>
      <button class="modal-fechar" onclick="fecharModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="venda-anuncio-info">
        <strong>${anuncio.titulo}</strong>
        <span>Valor anunciado: ${formatarMoeda(anuncio.valor_venda)}</span>
      </div>

      <div class="campo-grupo">
        <label>Valor final negociado *</label>
        <input id="v-valor" type="number" step="0.01" value="${anuncio.valor_venda}" placeholder="0,00">
      </div>

      <div class="campo-grupo">
        <label>Forma de pagamento *</label>
        <div class="forma-pgto-options">
          ${[['pix','PIX'],['debito','Débito'],['credito_maquininha','Crédito parcelado']].map(([val, label]) => `
            <label class="forma-option">
              <input type="radio" name="forma-pgto" value="${val}" ${val === 'pix' ? 'checked' : ''} onchange="toggleParcelas()">
              ${label}
            </label>
          `).join('')}
        </div>
      </div>

      <div id="campo-parcelas" style="display:none" class="campo-grupo">
        <label>Número de parcelas</label>
        <select id="v-parcelas">
          ${[2,3,4,5,6,10,12,18,24].map(n => `<option value="${n}">${n}x</option>`).join('')}
        </select>
      </div>

      <div class="campo-grupo">
        <label>Nome do comprador (opcional)</label>
        <input id="v-nome" type="text" placeholder="João Silva">
      </div>
      <div class="campo-grupo">
        <label>WhatsApp do comprador (opcional)</label>
        <input id="v-tel" type="tel" placeholder="11999999999">
      </div>
      <div class="campo-grupo">
        <label>Observações</label>
        <textarea id="v-obs" rows="3" placeholder="Anotações sobre a negociação..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primary" onclick="confirmarVenda(${anuncioId})">✅ Registrar venda</button>
    </div>
  `);
}

function toggleParcelas() {
  const forma = document.querySelector('input[name="forma-pgto"]:checked')?.value;
  document.getElementById('campo-parcelas').style.display = forma === 'credito_maquininha' ? '' : 'none';
}

async function confirmarVenda(anuncioId) {
  const valor = parseFloat(document.getElementById('v-valor').value);
  const forma = document.querySelector('input[name="forma-pgto"]:checked')?.value;
  const parcelas = forma === 'credito_maquininha'
    ? parseInt(document.getElementById('v-parcelas').value)
    : 1;

  if (!valor || !forma) { toast('Preencha valor e forma de pagamento', 'error'); return; }

  const btn = document.querySelector('.modal-footer .btn-primary');
  btn.textContent = 'Salvando...'; btn.disabled = true;

  const { error: eVenda } = await supabase.from('vendas').insert({
    anuncio_id: anuncioId,
    valor_final: valor,
    forma_pgto: forma,
    parcelas,
    comprador_nome: document.getElementById('v-nome').value.trim() || null,
    comprador_tel: document.getElementById('v-tel').value.trim() || null,
    observacoes: document.getElementById('v-obs').value.trim() || null
  });

  if (eVenda) { toast('Erro: ' + eVenda.message, 'error'); return; }

  await supabase.from('anuncios').update({ status: 'vendido' }).eq('id', anuncioId);
  toast('Venda registrada! 🎉');
  fecharModal();
  await carregarTudo();
  renderDashboard();
}

// ============================================================
// LISTA DE VENDAS
// ============================================================
function renderListaVendas() {
  const el = document.getElementById('aba-vendas');
  if (!el) return;
  el.innerHTML = `
    <h2>Histórico de vendas</h2>
    <div class="lista-vendas">
      ${!vendasAdmin.length ? '<div class="empty-lista">Nenhuma venda registrada ainda</div>' :
        vendasAdmin.map(v => {
          const custo = v.anuncios?.valor_pago || 0;
          const lucro = v.valor_final - custo;
          return `
            <div class="item-venda">
              <div class="venda-info">
                <div class="venda-titulo">${v.anuncios?.titulo || 'Anúncio removido'}</div>
                <div class="venda-data">${formatarData(v.vendido_em)}</div>
                ${v.comprador_nome ? `<div class="venda-comprador">👤 ${v.comprador_nome}${v.comprador_tel ? ` · ${v.comprador_tel}` : ''}</div>` : ''}
              </div>
              <div class="venda-pgto">
                <span class="pgto-badge">${FORMAS_LABEL[v.forma_pgto] || v.forma_pgto}</span>
                ${v.parcelas > 1 ? `<span class="pgto-badge">${v.parcelas}x</span>` : ''}
              </div>
              <div class="venda-valores">
                <div>Venda: <strong>${formatarMoeda(v.valor_final)}</strong></div>
                <div class="${lucro >= 0 ? 'text-success' : 'text-error'}">Lucro: <strong>${formatarMoeda(lucro)}</strong></div>
              </div>
            </div>
          `;
        }).join('')
      }
    </div>
  `;
}

// ============================================================
// CONFIG
// ============================================================
function renderConfig() {
  const c = KJS_CONFIG || {};
  document.getElementById('aba-config').innerHTML = `
    <h2>Configurações</h2>
    <div class="config-form">
      <div class="campo-grupo"><label>Nome de exibição</label><input id="c-nome" value="${c.nome_exibicao || ''}"></div>
      <div class="campo-grupo"><label>WhatsApp (com DDD, sem +55)</label><input id="c-wpp" type="tel" value="${c.whatsapp || ''}" placeholder="11999999999"></div>
      <div class="campo-grupo"><label>Instagram (sem @)</label><input id="c-ig" value="${c.instagram || ''}" placeholder="kjsbusiness"></div>
      <div class="campo-grupo"><label>Bio / apresentação</label><textarea id="c-bio" rows="3">${c.bio || ''}</textarea></div>
      <div class="campo-grupo"><label>Total de negócios realizados (exibido na vitrine)</label><input id="c-negocios" type="number" value="${c.total_negocios || 0}"></div>
      <button class="btn-primary" onclick="salvarConfig()">Salvar configurações</button>
    </div>
    <div class="config-section">
      <button class="btn-danger-full" onclick="logout()">Sair do painel</button>
    </div>
  `;
}

async function salvarConfig() {
  const { error } = await supabase.from('config').update({
    nome_exibicao: document.getElementById('c-nome').value.trim(),
    whatsapp: document.getElementById('c-wpp').value.trim(),
    instagram: document.getElementById('c-ig').value.trim(),
    bio: document.getElementById('c-bio').value.trim(),
    total_negocios: parseInt(document.getElementById('c-negocios').value) || 0
  }).eq('id', 1);

  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  toast('Configurações salvas!');
  await loadConfig();
}

// ============================================================
// HELPERS: MODAL, EXCLUIR, COMPARTILHAR
// ============================================================
function criarModal(html) {
  fecharModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = e => { if (e.target === overlay) fecharModal(); };
  const modal = document.createElement('div');
  modal.className = 'kjs-modal';
  modal.innerHTML = html;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  _fotosExistentes = [];
  return modal;
}

function fecharModal() {
  document.querySelector('.modal-overlay')?.remove();
  _fotosExistentes = [];
}

async function confirmarExcluir(id) {
  if (!confirm('Excluir este anúncio? Esta ação não pode ser desfeita.')) return;
  const { error } = await supabase.from('anuncios').delete().eq('id', id);
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  toast('Anúncio excluído');
  await carregarTudo();
  irAba('anuncios');
}

function compartilharAdmin(id) {
  const url = `${location.origin}/anuncio.html?id=${id}`;
  navigator.clipboard.writeText(url).then(() => toast('Link copiado!'));
}
