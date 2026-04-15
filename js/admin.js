// ============================================================
// KJS Business — admin.js
// ============================================================

const SUPABASE_URL_ADMIN  = 'https://nmdshljajpcnvnoebaqi.supabase.co';
const SUPABASE_ANON_ADMIN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZHNobGphanBjbnZub2ViYXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzA1MzYsImV4cCI6MjA5MTc0NjUzNn0.O2Ck7wif8Am1i2SY9aP5EsGNhf8iUO1h0_55L4c7Gyo';

// Supabase pode já ter sido init pelo core.js — reutiliza ou cria
const _db = (typeof _supabase !== 'undefined') ? _supabase
  : supabase.createClient(SUPABASE_URL_ADMIN, SUPABASE_ANON_ADMIN);

// Estado global
let _periodo   = 'mes';
let _anuncios  = [];
let _vendas    = [];
let _editId    = null;
let _fotosUpload = [];
let _vendaId   = null;

// ── Auth ──────────────────────────────────────────────────
const SK = 'kjs_admin_v1';

function _sessaoOk() {
  try {
    const s = JSON.parse(localStorage.getItem(SK) || 'null');
    return s && (Date.now() - s.ts) < 8 * 3600000;
  } catch { return false; }
}

function logout() {
  localStorage.removeItem(SK);
  document.getElementById('tela-painel').classList.remove('visivel');
  document.getElementById('tela-login').classList.remove('escondido');
}

async function fazerLogin(e) {
  if (e) e.preventDefault();
  const senha  = document.getElementById('senha-input').value.trim();
  const btn    = document.getElementById('btn-login');
  const erro   = document.getElementById('login-erro');
  if (!senha) return;

  btn.textContent = 'Verificando…';
  btn.disabled    = true;
  erro.style.display = 'none';

  try {
    const { data, error } = await _db.rpc('kjs_verificar_senha', { p_senha: senha });
    if (error || !data) throw new Error('senha errada');
    localStorage.setItem(SK, JSON.stringify({ ts: Date.now() }));
    mostrarPainel();
  } catch {
    erro.style.display = 'block';
    btn.textContent = 'Entrar →';
    btn.disabled    = false;
    document.getElementById('senha-input').value = '';
  }
}

function mostrarPainel() {
  document.getElementById('tela-login').classList.add('escondido');
  document.getElementById('tela-painel').classList.add('visivel');
  carregarDados();
}

// ── Dados ─────────────────────────────────────────────────
async function carregarDados() {
  const { data } = await _db.rpc('kjs_admin_get_dashboard');
  _anuncios = data?.anuncios || [];
  _vendas   = data?.vendas   || [];
  renderDashboard();
  renderListaAnuncios();
  renderListaVendas();
  renderConfig();
}

// ── Dashboard ─────────────────────────────────────────────
function setPeriodo(p) {
  _periodo = p;
  document.querySelectorAll('.periodo-btn').forEach(b => b.classList.toggle('ativo', b.dataset.periodo === p));
  renderDashboard();
}

function _vendasFiltradas() {
  const dias = { semana:7, mes:30, trimestre:90, ano:365 }[_periodo] || 30;
  const corte = Date.now() - dias * 86400000;
  return _vendas.filter(v => new Date(v.vendido_em).getTime() >= corte);
}

function _calcular(vendas) {
  return vendas.reduce((acc, v) => {
    const a = _anuncios.find(x => x.id === v.anuncio_id);
    const custo = a?.valor_pago || 0;
    const lucro = v.valor_final - custo;
    return { receita: acc.receita + v.valor_final, custo: acc.custo + custo, lucro: acc.lucro + lucro, count: acc.count + 1 };
  }, { receita:0, custo:0, lucro:0, count:0 });
}

function renderDashboard() {
  const vf = _vendasFiltradas();
  const { receita, custo, lucro, count } = _calcular(vf);
  const margem = receita > 0 ? (lucro / receita * 100).toFixed(1) : '0.0';
  const ticket  = count > 0 ? receita / count : 0;

  const ativos  = _anuncios.filter(a => a.status === 'disponivel').length;
  const topItem = [...vf].sort((a,b) => {
    const la = a.valor_final - (_anuncios.find(x=>x.id===a.anuncio_id)?.valor_pago||0);
    const lb = b.valor_final - (_anuncios.find(x=>x.id===b.anuncio_id)?.valor_pago||0);
    return lb - la;
  })[0];
  const topNome = topItem ? (_anuncios.find(x=>x.id===topItem.anuncio_id)?.titulo || '—') : '—';

  // Gráfico: lucro por semana (últimas 8)
  const semanas = [];
  for (let i = 7; i >= 0; i--) {
    const ini = Date.now() - (i+1)*7*86400000;
    const fim = Date.now() - i*7*86400000;
    const vs  = _vendas.filter(v => { const d = new Date(v.vendido_em).getTime(); return d >= ini && d < fim; });
    semanas.push({ label: `S${8-i}`, lucro: _calcular(vs).lucro });
  }
  const maxL = Math.max(...semanas.map(s=>s.lucro), 1);

  const el = document.getElementById('aba-dashboard');
  el.innerHTML = `
    <div class="page-header">
      <h2>Dashboard</h2>
      <div class="periodo-tabs">
        ${['semana','mes','trimestre','ano'].map(p =>
          `<button class="periodo-btn ${p===_periodo?'ativo':''}" data-periodo="${p}" onclick="setPeriodo('${p}')">${{semana:'7d',mes:'30d',trimestre:'90d',ano:'1a'}[p]}</button>`
        ).join('')}
      </div>
    </div>
    <div class="metricas-grid">
      <div class="metrica-card"><div class="metrica-label">Faturamento</div><div class="metrica-valor">${_fmt(receita)}</div></div>
      <div class="metrica-card"><div class="metrica-label">Custo total</div><div class="metrica-valor">${_fmt(custo)}</div></div>
      <div class="metrica-card destaque"><div class="metrica-label">Lucro líquido</div><div class="metrica-valor positivo">${_fmt(lucro)}</div></div>
      <div class="metrica-card"><div class="metrica-label">Margem</div><div class="metrica-valor">${margem}%</div></div>
      <div class="metrica-card"><div class="metrica-label">Anúncios ativos</div><div class="metrica-valor">${ativos}</div></div>
      <div class="metrica-card"><div class="metrica-label">Vendas no período</div><div class="metrica-valor">${count}</div></div>
      <div class="metrica-card"><div class="metrica-label">Ticket médio</div><div class="metrica-valor">${_fmt(ticket)}</div></div>
      <div class="metrica-card"><div class="metrica-label">Mais rentável</div><div class="metrica-valor" style="font-size:14px">${topNome}</div></div>
    </div>
    <div class="grafico-section">
      <div class="grafico-titulo">Lucro por semana (últimas 8)</div>
      <div class="grafico-barras">
        ${semanas.map(s => `
          <div class="barra-wrap">
            <div class="barra" style="height:${Math.round((s.lucro/maxL)*90)+10}px" title="${_fmt(s.lucro)}"></div>
            <div class="barra-label">${s.label}</div>
          </div>`).join('')}
      </div>
    </div>
  `;
}

// ── Lista Anúncios ─────────────────────────────────────────
function renderListaAnuncios() {
  const el = document.getElementById('aba-anuncios');
  const statusBadge = { disponivel:'badge-verde', reservado:'badge-amarelo', vendido:'badge-cinza' };
  const statusLabel = { disponivel:'Disponível', reservado:'Reservado', vendido:'Vendido' };

  el.innerHTML = `
    <div class="lista-header">
      <h2 style="font-family:var(--font-brand);font-size:22px;font-weight:800">Anúncios</h2>
      <button class="btn-primary" onclick="novoAnuncio()">+ Novo anúncio</button>
    </div>
    <div class="lista-anuncios">
      ${!_anuncios.length
        ? '<p style="color:var(--text-3);padding:40px;text-align:center">Nenhum anúncio ainda. Crie o primeiro!</p>'
        : _anuncios.map(a => {
            const lucro  = a.valor_venda - a.valor_pago;
            const margem = a.valor_venda > 0 ? ((lucro/a.valor_venda)*100).toFixed(0) : 0;
            const foto   = a.fotos?.[0];
            return `
              <div class="item-anuncio">
                <div class="item-thumb">
                  ${foto ? `<img src="${fotoUrl(foto)}" alt="">` : (()=>{ const tc={carro:'🚗',imovel:'🏠',moto:'🏍️',celular:'📱',outro:'✨'}; return tc[a.tipo]||'✨'; })()}
                </div>
                <div class="item-info">
                  <div class="item-titulo">${a.titulo}</div>
                  <div class="item-meta">${a.tipo} · <span class="badge ${statusBadge[a.status]||'badge-cinza'}">${statusLabel[a.status]||a.status}</span></div>
                </div>
                <div class="item-valores">
                  Venda: <strong>${_fmt(a.valor_venda)}</strong><br>
                  Lucro: <span style="color:${lucro>=0?'var(--success)':'var(--error)'}">${_fmt(lucro)} (${margem}%)</span>
                </div>
                <div class="item-acoes">
                  <button class="btn-acao" onclick="editarAnuncio(${a.id})" title="Editar">✏️</button>
                  ${a.status!=='vendido'?`<button class="btn-acao btn-venda" onclick="abrirModalVenda(${a.id})" title="Registrar venda">💰</button>`:''}
                  <button class="btn-acao" onclick="_compartilhar(${a.id})" title="Compartilhar">↗</button>
                  <button class="btn-acao btn-danger" onclick="excluirAnuncio(${a.id})" title="Excluir">🗑️</button>
                </div>
              </div>`;
          }).join('')}
    </div>`;
}

// ── Lista Vendas ──────────────────────────────────────────
function renderListaVendas() {
  const el = document.getElementById('aba-vendas');
  const pgtoLabel = { pix:'PIX', debito:'Débito', credito_maquininha:'Crédito' };
  el.innerHTML = `
    <div class="page-header"><h2>Vendas realizadas</h2></div>
    <div class="lista-vendas">
      ${!_vendas.length
        ? '<p style="color:var(--text-3);padding:40px;text-align:center">Nenhuma venda registrada ainda.</p>'
        : _vendas.map(v => {
            const a = _anuncios.find(x=>x.id===v.anuncio_id);
            const lucro = v.valor_final - (a?.valor_pago||0);
            const tc = {carro:'🚗',imovel:'🏠',moto:'🏍️',celular:'📱',outro:'✨'};
            return `
              <div class="item-venda">
                <div class="venda-emoji">${tc[a?.tipo]||'✨'}</div>
                <div class="venda-info">
                  <div class="venda-titulo">${a?.titulo||'Produto vendido'}</div>
                  <div class="venda-meta">${formatarData(v.vendido_em)} · ${pgtoLabel[v.forma_pgto]||v.forma_pgto}${v.parcelas>1?' ('+v.parcelas+'x)':''}</div>
                  ${v.comprador_nome?`<div class="venda-meta">Comprador: ${v.comprador_nome}</div>`:''}
                </div>
                <div class="venda-valores">
                  <strong>${_fmt(v.valor_final)}</strong>
                  Lucro: <span style="color:var(--success)">${_fmt(lucro)}</span>
                </div>
              </div>`;
          }).join('')}
    </div>`;
}

// ── Config ────────────────────────────────────────────────
async function renderConfig() {
  const el = document.getElementById('aba-config');
  const { data: cfg } = await _db.from('config').select('*').eq('id',1).single();
  el.innerHTML = `
    <div class="page-header"><h2>Configurações</h2></div>
    <div class="config-section-title">Dados do perfil</div>
    <div class="config-form">
      <div class="campo-grupo"><label>Nome de exibição</label>
        <input type="text" id="cfg-nome" class="form-input" value="${cfg?.nome_exibicao||''}">
      </div>
      <div class="campo-grupo"><label>WhatsApp (apenas números com DDI)</label>
        <input type="text" id="cfg-wpp" class="form-input" value="${cfg?.whatsapp||''}" placeholder="5511999999999">
      </div>
      <div class="campo-grupo"><label>Instagram (sem @)</label>
        <input type="text" id="cfg-ig" class="form-input" value="${cfg?.instagram||''}" placeholder="kjs.business">
      </div>
      <div class="campo-grupo"><label>Bio (exibida na vitrine)</label>
        <textarea id="cfg-bio" class="form-textarea">${cfg?.bio||''}</textarea>
      </div>
      <button class="btn-primary" onclick="salvarConfig()" style="width:fit-content">Salvar configurações</button>
    </div>
    <div class="config-section-title">Alterar senha do painel</div>
    <div class="config-form">
      <div class="campo-grupo"><label>Nova senha</label>
        <input type="password" id="cfg-senha" class="form-input" placeholder="••••••••">
      </div>
      <div class="campo-grupo"><label>Confirmar nova senha</label>
        <input type="password" id="cfg-senha2" class="form-input" placeholder="••••••••">
      </div>
      <button class="btn-primary" onclick="alterarSenha()" style="width:fit-content">Alterar senha</button>
    </div>`;
}

async function salvarConfig() {
  const payload = {
    nome_exibicao: document.getElementById('cfg-nome').value.trim(),
    whatsapp:      document.getElementById('cfg-wpp').value.trim().replace(/\D/g,''),
    instagram:     document.getElementById('cfg-ig').value.trim().replace('@',''),
    bio:           document.getElementById('cfg-bio').value.trim()
  };
  const { error } = await _db.from('config').update(payload).eq('id',1);
  if (error) { _toast('Erro ao salvar.','erro'); return; }
  _toast('Configurações salvas!');
}

async function alterarSenha() {
  const s1 = document.getElementById('cfg-senha').value;
  const s2 = document.getElementById('cfg-senha2').value;
  if (!s1) { _toast('Digite a nova senha.','erro'); return; }
  if (s1 !== s2) { _toast('Senhas não coincidem.','erro'); return; }
  const { error } = await _db.rpc('kjs_alterar_senha', { p_nova: s1 });
  if (error) { _toast('Erro ao alterar senha.','erro'); return; }
  _toast('Senha alterada com sucesso!');
  document.getElementById('cfg-senha').value = '';
  document.getElementById('cfg-senha2').value = '';
}

// ── Abas ──────────────────────────────────────────────────
function irAba(aba) {
  document.querySelectorAll('.aba-content').forEach(el => el.style.display = 'none');
  document.getElementById('aba-' + aba).style.display = '';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('ativo', el.dataset.aba === aba));
}

// ── Modal Anúncio ─────────────────────────────────────────
function novoAnuncio() {
  _editId = null; _fotosUpload = [];
  document.getElementById('modal-anuncio-titulo').textContent = 'Novo anúncio';
  document.getElementById('modal-anuncio').querySelector('.modal-body form, .modal-body')
  // Reset form fields
  ;['f-titulo','f-descricao','f-valor-pago','f-valor-venda','f-marca','f-modelo',
    'f-ano','f-km','f-cor','f-cidade','f-bairro','f-area','f-quartos','f-vagas']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('f-cambio').value = '';
  document.getElementById('f-combustivel').value = '';
  document.getElementById('f-status').value = 'disponivel';
  document.getElementById('f-destaque').checked = false;
  document.getElementById('f-pix').checked = true;
  document.getElementById('f-debito').checked = true;
  document.getElementById('f-credito').checked = true;
  document.getElementById('preview-fotos').innerHTML = '';
  document.getElementById('calculo-lucro').innerHTML = '';
  setTipoModal('carro');
  abrirModal('modal-anuncio');
}

function editarAnuncio(id) {
  const a = _anuncios.find(x => x.id === id);
  if (!a) return;
  _editId = id; _fotosUpload = a.fotos || [];
  document.getElementById('modal-anuncio-titulo').textContent = 'Editar anúncio';
  const sv = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v||''; };
  sv('f-titulo', a.titulo); sv('f-descricao', a.descricao);
  sv('f-valor-pago', a.valor_pago); sv('f-valor-venda', a.valor_venda);
  sv('f-status', a.status);
  document.getElementById('f-destaque').checked = !!a.destaque;
  document.getElementById('f-pix').checked    = !!a.aceita_pix;
  document.getElementById('f-debito').checked  = !!a.aceita_debito;
  document.getElementById('f-credito').checked = !!a.aceita_credito;
  setTipoModal(a.tipo || 'carro');
  if (a.tipo === 'carro' || a.tipo === 'moto') {
    sv('f-marca',a.marca); sv('f-modelo',a.modelo); sv('f-ano',a.ano);
    sv('f-km',a.km); sv('f-cor',a.cor); sv('f-cambio',a.cambio); sv('f-combustivel',a.combustivel);
  } else if (a.tipo === 'imovel') {
    sv('f-cidade',a.cidade); sv('f-bairro',a.bairro); sv('f-area',a.area_m2);
    sv('f-quartos',a.quartos); sv('f-vagas',a.vagas);
    document.getElementById('f-tipo-imovel').value = a.tipo_imovel||'';
  }
  renderPreviewFotos();
  calcularLucro();
  abrirModal('modal-anuncio');
}

function setTipoModal(tipo) {
  document.getElementById('f-tipo').value = tipo;
  const ehCarro  = tipo === 'carro' || tipo === 'moto';
  const ehImovel = tipo === 'imovel';
  document.getElementById('campos-carro').style.display  = ehCarro  ? '' : 'none';
  document.getElementById('campos-imovel').style.display = ehImovel ? '' : 'none';
  document.querySelectorAll('.btn-tipo').forEach(b => b.classList.toggle('ativo', b.dataset.tipo === tipo));
}

function calcularLucro() {
  const pago  = parseFloat(document.getElementById('f-valor-pago')?.value) || 0;
  const venda = parseFloat(document.getElementById('f-valor-venda')?.value) || 0;
  const lucro = venda - pago;
  const m     = venda > 0 ? (lucro/venda*100).toFixed(1) : 0;
  const el    = document.getElementById('calculo-lucro');
  if (!el) return;
  el.innerHTML = pago || venda
    ? `Lucro: <strong style="color:${lucro>=0?'var(--success)':'var(--error)'}">${_fmt(lucro)}</strong> · Margem: <strong>${m}%</strong>`
    : '';
}

// ── Fotos ─────────────────────────────────────────────────
function onFotosChange(evt) {
  Array.from(evt.target.files).forEach(f => _fotosUpload.push({ file:f, url:URL.createObjectURL(f) }));
  renderPreviewFotos();
}

function renderPreviewFotos() {
  const prev = document.getElementById('preview-fotos');
  if (!prev) return;
  prev.innerHTML = _fotosUpload.map((f, i) => {
    const url = f.url || fotoUrl(f);
    return `<div class="preview-foto">
      <img src="${url}" alt="">
      ${i===0 ? '<span class="foto-capa">Capa</span>' : ''}
      <button class="foto-rm" onclick="removerFoto(${i})">×</button>
    </div>`;
  }).join('');
}

function removerFoto(idx) { _fotosUpload.splice(idx,1); renderPreviewFotos(); }

async function _uploadFotos() {
  const paths = [];
  for (const f of _fotosUpload) {
    if (f.file) {
      const ext  = f.file.name.split('.').pop().toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await _db.storage.from('fotos-kjs').upload(path, f.file, {
        upsert: true,
        contentType: f.file.type || 'image/jpeg'
      });
      if (error) {
        console.error('Erro upload foto:', error);
        _toast('Erro no upload da foto: ' + error.message, 'erro');
      } else {
        paths.push(path);
      }
    } else if (typeof f === 'string') {
      // já é um path salvo anteriormente
      paths.push(f);
    }
  }
  return paths;
}

async function salvarAnuncio() {
  const btn = document.getElementById('btn-salvar-anuncio');
  btn.textContent = 'Salvando…'; btn.disabled = true;
  try {
    const fotos = await _uploadFotos();
    const tipo  = document.getElementById('f-tipo').value;
    const payload = {
      tipo, fotos,
      titulo:        document.getElementById('f-titulo').value.trim(),
      descricao:     document.getElementById('f-descricao').value.trim(),
      valor_pago:    parseFloat(document.getElementById('f-valor-pago').value) || 0,
      valor_venda:   parseFloat(document.getElementById('f-valor-venda').value) || 0,
      status:        document.getElementById('f-status').value,
      destaque:      document.getElementById('f-destaque').checked,
      aceita_pix:    document.getElementById('f-pix').checked,
      aceita_debito: document.getElementById('f-debito').checked,
      aceita_credito:document.getElementById('f-credito').checked,
    };
    if (tipo === 'carro' || tipo === 'moto') {
      Object.assign(payload, {
        marca: document.getElementById('f-marca').value,
        modelo: document.getElementById('f-modelo').value,
        ano: parseInt(document.getElementById('f-ano').value)||null,
        km:  parseInt(document.getElementById('f-km').value)||null,
        cor: document.getElementById('f-cor').value,
        cambio: document.getElementById('f-cambio').value,
        combustivel: document.getElementById('f-combustivel').value,
      });
    } else if (tipo === 'imovel') {
      Object.assign(payload, {
        cidade: document.getElementById('f-cidade').value,
        bairro: document.getElementById('f-bairro').value,
        area_m2: parseFloat(document.getElementById('f-area').value)||null,
        quartos: parseInt(document.getElementById('f-quartos').value)||null,
        vagas:   parseInt(document.getElementById('f-vagas').value)||null,
        tipo_imovel: document.getElementById('f-tipo-imovel').value,
      });
    }
    if (_editId) payload.id = _editId;
    const { error } = await _db.rpc('kjs_admin_upsert_anuncio', { p_data: payload });
    if (error) throw error;
    _toast(_editId ? 'Anúncio atualizado!' : 'Anúncio criado!');
    fecharModal('modal-anuncio');
    await carregarDados();
  } catch(e) { _toast('Erro: ' + e.message, 'erro'); }
  finally { btn.textContent = 'Salvar anúncio'; btn.disabled = false; }
}

async function excluirAnuncio(id) {
  if (!confirm('Excluir este anúncio? Essa ação não pode ser desfeita.')) return;
  const { error } = await _db.rpc('kjs_admin_delete_anuncio', { p_id: id });
  if (error) { _toast('Erro ao excluir.','erro'); return; }
  _toast('Anúncio excluído.');
  await carregarDados();
}

function _compartilhar(id) {
  const url = `${location.origin}/anuncio.html?id=${id}`;
  if (navigator.share) { navigator.share({ url }); }
  else { navigator.clipboard.writeText(url); _toast('Link copiado!'); }
}

// ── Modal Venda ───────────────────────────────────────────
function abrirModalVenda(id) {
  _vendaId = id;
  const a = _anuncios.find(x => x.id === id);
  document.getElementById('venda-anuncio-nome').textContent = a?.titulo || '';
  document.getElementById('venda-valor').value    = a?.valor_venda || '';
  document.getElementById('venda-forma').value    = 'pix';
  document.getElementById('venda-parcelas-row').style.display = 'none';
  document.getElementById('venda-parcelas').value = '1';
  document.getElementById('venda-comprador').value = '';
  document.getElementById('venda-tel').value       = '';
  document.getElementById('venda-obs').value       = '';
  abrirModal('modal-venda');
}

function onFormaPgto(sel) {
  document.getElementById('venda-parcelas-row').style.display = sel.value === 'credito_maquininha' ? '' : 'none';
}

async function registrarVenda() {
  const btn = document.getElementById('btn-registrar-venda');
  btn.textContent = 'Registrando…'; btn.disabled = true;
  try {
    const forma = document.getElementById('venda-forma').value;
    const payload = {
      anuncio_id:     _vendaId,
      valor_final:    parseFloat(document.getElementById('venda-valor').value) || 0,
      forma_pgto:     forma,
      parcelas:       forma === 'credito_maquininha' ? parseInt(document.getElementById('venda-parcelas').value)||1 : 1,
      comprador_nome: document.getElementById('venda-comprador').value.trim(),
      comprador_tel:  document.getElementById('venda-tel').value.trim(),
      observacoes:    document.getElementById('venda-obs').value.trim()
    };
    const { error } = await _db.rpc('kjs_admin_registrar_venda', { p_data: payload });
    if (error) throw error;
    _toast('Venda registrada! 🎉');
    fecharModal('modal-venda');
    await carregarDados();
  } catch(e) { _toast('Erro: ' + e.message, 'erro'); }
  finally { btn.textContent = 'Registrar venda'; btn.disabled = false; }
}

// ── Modais ────────────────────────────────────────────────
function abrirModal(id)  { document.getElementById(id).classList.add('aberto'); }
function fecharModal(id) { document.getElementById(id).classList.remove('aberto'); }

// ── Helpers ───────────────────────────────────────────────
function _fmt(v) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:0}).format(v||0); }

function _toast(msg, tipo = 'ok') {
  if (typeof toast === 'function') { toast(msg, tipo); return; }
  let el = document.getElementById('kjs-toast');
  if (!el) {
    el = document.createElement('div'); el.id = 'kjs-toast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);background:#1A1A1A;color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,.5);z-index:9999;transition:transform .3s,opacity .3s;border-left:3px solid #D4A017;pointer-events:none;white-space:nowrap;font-family:sans-serif;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.borderLeftColor = tipo === 'erro' ? '#EF4444' : '#D4A017';
  el.style.transform = 'translateX(-50%) translateY(0)';
  el.style.opacity = '1';
  setTimeout(() => { el.style.transform = 'translateX(-50%) translateY(80px)'; el.style.opacity = '0'; }, 3000);
}

// ── fotoUrl local (caso core.js não esteja carregado antes) ──
function fotoUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${SUPABASE_URL_ADMIN}/storage/v1/object/public/fotos-kjs/${path}`;
}

// ── formatarData local ────────────────────────────────────
function formatarData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (_sessaoOk()) {
    mostrarPainel();
  }
  // form-login submit
  const form = document.getElementById('form-login');
  if (form) form.addEventListener('submit', fazerLogin);
});
