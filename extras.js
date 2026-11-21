// Minhas Contas — módulo extra: anotar por voz, importar extrato, gastos avulsos
(function(){
  var MC = window.MC; if(!MC) return;
  var $ = function(id){ return document.getElementById(id); };
  var K_G = MC.CHAVE + '-gastos', K_I = MC.CHAVE + '-importados';
  var gastos = [], importados = {};
  try{ gastos = JSON.parse(localStorage.getItem(K_G)) || []; }catch(e){ gastos = []; }
  try{ importados = JSON.parse(localStorage.getItem(K_I)) || {}; }catch(e){ importados = {}; }
  function salvarG(){ try{ localStorage.setItem(K_G, JSON.stringify(gastos)); localStorage.setItem(K_I, JSON.stringify(importados)); }catch(e){} }

  var CATS = ['Mercado','Alimentação fora','Casa','Energia / Água / Gás','Internet / Telefone','Cartão de crédito','Compras parceladas','Saúde','Transporte','Educação','Lazer / Assinaturas','Outros'];
  var REGRAS = [
    ['Mercado', ['supermercado','mercado','feira','padaria','acougue','hortifruti','atacad','assai','carrefour','sacolao','quitanda','mercearia']],
    ['Alimentação fora', ['restaurante','lanche','lanchonete','ifood','pizza','almoco','jantar','cafe ','cafeteria','hamburg','sorvete','marmita','delivery','churrasc','bar ']],
    ['Transporte', ['uber','99pop','99 app','gasolina','combustivel','posto','etanol','estacionamento','pedagio','onibus','metro','oficina','mecanico','ipva','sem parar','conectcar']],
    ['Saúde', ['farmacia','remedio','drogaria','drogasil','droga raia','pague menos','medico','consulta','exame','dentista','hospital','plano de saude','unimed','laboratorio']],
    ['Energia / Água / Gás', ['conta de luz','luz','energia','agua','gas ','enel','cemig','copel','sabesp','celesc','cpfl','light ','coelba','celpe','equatorial','energisa','neoenergia','sanepar','copasa','embasa','casan','corsan','botijao','ultragaz','liquigas']],
    ['Internet / Telefone', ['internet','celular','telefone','vivo','claro','tim ',' oi ','recarga','net virtua','fibra']],
    ['Educação', ['escola','curso','faculdade','livro','material escolar','mensalidade','udemy','alura']],
    ['Lazer / Assinaturas', ['cinema','netflix','spotify','amazon prime','prime video','disney','hbo','max ','youtube','globoplay','viagem','show','ingresso','steam','playstation','xbox','assinatura']],
    ['Casa', ['aluguel','condominio','material de construcao','leroy','moveis','ferramenta','limpeza','reforma','iptu','eletro','magazine','casas bahia']],
    ['Cartão de crédito', ['fatura','anuidade']]
  ];

  // ---------- utilidades ----------
  function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
  function iso(d){ return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
  function hojeISO(off){ var d = new Date(); d.setDate(d.getDate()+(off||0)); return iso(d); }
  function mesDe(s){ return String(s).slice(0,7); }
  function dataBR(s){ return s.slice(8,10)+'/'+s.slice(5,7); }
  function novoId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
  function fmt(v){ return String(Math.round(v*100)/100).replace('.',','); }
  function categoria(txt){
    var t = ' '+norm(txt)+' ';
    for(var i=0;i<REGRAS.length;i++){ for(var j=0;j<REGRAS[i][1].length;j++){ if(t.indexOf(REGRAS[i][1][j])>=0) return REGRAS[i][0]; } }
    return 'Outros';
  }
  function selCat(attr, v){ return '<select '+attr+'>'+CATS.map(function(c){ return '<option'+(c===v?' selected':'')+'>'+c+'</option>'; }).join('')+'</select>'; }
  function avisar(t){
    var d = document.createElement('div'); d.textContent = t;
    d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(14px + env(safe-area-inset-top));background:#1b2420;color:#fff;padding:10px 16px;border-radius:20px;z-index:60;font-size:14px;box-shadow:0 4px 14px rgba(0,0,0,.25)';
    document.body.appendChild(d); setTimeout(function(){ d.remove(); }, 2400);
  }

  // ---------- interpretador de frases ----------
  function preparar(t){
    t = t.replace(/(\d+)\s*reais?\s*e\s*(\d{1,2})\s*centavos?/gi, function(_,a,b){ return a+','+('0'+b).slice(-2); });
    t = t.replace(/(\d+(?:,\d+)?)\s*mil\b/gi, function(_,a){ return String(Math.round(parseFloat(a.replace(',','.'))*1000)); });
    return t;
  }
  function numeros(t){
    var re = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+,\d{1,2}|\d+(?:\.\d{1,2})?)/g, m, out = [];
    while((m = re.exec(t))){
      var s = m[1], v;
      if(s.indexOf(',')>=0) v = parseFloat(s.replace(/\./g,'').replace(',','.'));
      else if(/^\d{1,3}(\.\d{3})+$/.test(s)) v = parseFloat(s.replace(/\./g,''));
      else v = parseFloat(s);
      out.push({v:v, ini:m.index, fim:m.index+s.length});
    }
    return out;
  }
  var VAZIAS = ['gastei','gasto','gastar','paguei','pagar','pago','paga','comprei','compra','comprar','foi','fui','no','na','nos','nas','num','numa','em','de','do','da','dos','das','com','um','uma','reais','real','hoje','ontem','anteontem','x','vezes','vez','parcelas','parcela','parcelado','parcelada','e','o','a','os','as','pra','para','por','conta','valor','centavos','mil','que','ja','deu','ficou','saiu','minha','meu','anota','anotar','coloca','registra'];
  function limparDesc(t){
    var p = t.replace(/r\$/gi,' ').replace(/[\d.,]+/g,' ').replace(/[“”"!?]/g,' ').split(/\s+/).filter(function(w){ return w && VAZIAS.indexOf(norm(w))<0; });
    var s = p.join(' ').trim();
    return s ? s.charAt(0).toUpperCase()+s.slice(1) : '';
  }
  function acharConta(t){
    var tn = ' '+norm(t).replace(/[^a-z0-9]+/g,' ')+' ', best = null, bestLen = 0;
    MC.contas.forEach(function(c){
      if(MC.quitada(c)) return;
      norm(c.desc).split(/[^a-z0-9]+/).forEach(function(w){
        var bate = w.length>=3 ? tn.indexOf(w)>=0 : (w.length===2 && tn.indexOf(' '+w+' ')>=0);
        if(bate && w.length>bestLen){ best = c; bestLen = w.length; }
      });
    });
    return best;
  }
  function interpretar(txt){
    var bruto = String(txt||'').trim(); if(!bruto) return null;
    var t = preparar(bruto), tn = norm(t), data = hojeISO(0);
    if(/\banteontem\b/.test(tn)) data = hojeISO(-2); else if(/\bontem\b/.test(tn)) data = hojeISO(-1);
    var mDia = tn.match(/\bdia\s+(\d{1,2})\b/);
    if(mDia){ var dd = parseInt(mDia[1],10), d = new Date(); if(dd > d.getDate()) d.setMonth(d.getMonth()-1); d.setDate(dd); data = iso(d); t = t.replace(/\bdia\s+\d{1,2}\b/i,' '); tn = norm(t); }
    var n = 0, mx = tn.match(/(\d+)\s*(x|vezes|parcelas)\b/);
    if(mx) n = parseInt(mx[1],10);
    var nums = numeros(t);
    if(mx) nums = nums.filter(function(o){ return !(o.v===n && /^\s*(x|vezes|parcelas)/i.test(t.slice(o.fim))); });
    var desc = limparDesc(t), cat = categoria(desc || t);
    if(n > 1){
      if(!nums.length) return {erro:'Não encontrei o valor da compra.'};
      var parcDe = /(x|parcelas?)\s*de\s*(r\$\s*)?\d/i.test(t), v = nums[0].v;
      return {acao:'parcelada', desc:desc||'Compra parcelada', cat:(cat==='Outros'?'Compras parceladas':cat), vp:(parcDe ? v : Math.round(v/n*100)/100), n:n};
    }
    var valor = nums.length ? nums[0].v : null;
    var pagar = /\b(paguei|pago|quitei)\b/.test(tn);
    var conta = acharConta(t);
    if(conta && (pagar || MC.rec(conta))){
      if(MC.rec(conta)) return {acao:'pagarRec', conta:conta, valor:(valor!==null ? valor : conta.valorParcela), mes:mesDe(data)};
      return {acao:'pagarParc', conta:conta};
    }
    if(valor===null) return {erro:'Não encontrei o valor. Ex.: “gastei 45 no mercado”.'};
    return {acao:'gasto', desc:desc||cat, cat:cat, valor:valor, data:data};
  }

  // ---------- janela (sheet) ----------
  function abrirSheet(titulo, html){ $('mcTitulo').textContent = titulo; $('mcCorpo').innerHTML = html; $('mcCorpo').onchange = null; $('mcSheet').classList.remove('oculto'); }
  function fechar(){ if(ouvindo){ try{ ouvindo.stop(); }catch(e){} } $('mcSheet').classList.add('oculto'); $('mcCorpo').innerHTML = ''; }

  // ---------- anotar ----------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, ouvindo = null, atual = null;
  function abrirAnotar(){
    abrirSheet('Anotar', '<div class="mc-linha"><textarea id="mcTxt" rows="2" placeholder="Fale ou digite… ex.: gastei 45 no mercado"></textarea>'+(SR?'<button class="mc-mic" id="mcMic">🎤</button>':'')+'</div>'+
      '<div class="mc-ex">Exemplos: “gastei 45 no mercado” · “uber 23,50 ontem” · “paguei a luz 247,35” · “paguei a parcela da TV” · “comprei uma TV de 3000 em 10 vezes”</div>'+
      '<div class="mc-dica">'+(SR?'Toque no 🎤 laranja para falar, ou use o 🎤 do teclado.':'Para falar, toque no 🎤 do teclado do iPhone.')+'</div><div id="mcPrev"></div>');
    var tx = $('mcTxt'), tm;
    tx.addEventListener('input', function(){ clearTimeout(tm); tm = setTimeout(prever, 250); });
    tx.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); prever(); if(atual && !atual.erro) salvarAtual(); } });
    if(SR) $('mcMic').onclick = microfone;
    setTimeout(function(){ tx.focus(); }, 80);
  }
  function microfone(){
    if(ouvindo){ try{ ouvindo.stop(); }catch(e){} return; }
    var r = new SR(), b = $('mcMic'); r.lang = 'pt-BR'; r.interimResults = true; r.continuous = false;
    b.classList.add('on');
    r.onresult = function(e){ var s = ''; for(var i=0;i<e.results.length;i++) s += e.results[i][0].transcript; $('mcTxt').value = s; prever(); };
    r.onend = function(){ ouvindo = null; if(b) b.classList.remove('on'); };
    r.onerror = function(){ ouvindo = null; if(b) b.classList.remove('on'); var p = $('mcPrev'); if(p && !$('mcTxt').value) p.innerHTML = '<div class="mc-erro">Não consegui usar o microfone aqui. Use o 🎤 do teclado.</div>'; };
    ouvindo = r; try{ r.start(); }catch(e){ r.onerror(); }
  }
  function prever(){
    var r = interpretar($('mcTxt').value), h = ''; atual = r;
    if(!r){ $('mcPrev').innerHTML = ''; return; }
    if(r.erro){ $('mcPrev').innerHTML = '<div class="mc-erro">'+r.erro+'</div>'; return; }
    if(r.acao==='gasto'){
      h = '<div class="mc-card"><h4>💸 Gasto avulso</h4><div class="mc-grid">'+
        '<div><label>Descrição</label><input id="pDesc" value="'+MC.esc(r.desc)+'"></div>'+
        '<div><label>Valor (R$)</label><input id="pVal" inputmode="decimal" value="'+fmt(r.valor)+'"></div>'+
        '<div><label>Categoria</label>'+selCat('id="pCat"', r.cat)+'</div>'+
        '<div><label>Data</label><input id="pData" type="date" value="'+r.data+'"></div></div></div>';
    } else if(r.acao==='parcelada'){
      h = '<div class="mc-card"><h4>🛍️ Nova compra parcelada</h4><div class="mc-grid">'+
        '<div><label>Descrição</label><input id="pDesc" value="'+MC.esc(r.desc)+'"></div>'+
        '<div><label>Categoria</label>'+selCat('id="pCat"', r.cat)+'</div>'+
        '<div><label>Valor da parcela</label><input id="pVal" inputmode="decimal" value="'+fmt(r.vp)+'"></div>'+
        '<div><label>Nº de parcelas</label><input id="pN" type="number" inputmode="numeric" value="'+r.n+'"></div></div>'+
        '<div class="mc-dica">Total: '+MC.brl(r.vp*r.n)+'</div></div>';
    } else if(r.acao==='pagarRec'){
      h = '<div class="mc-card"><h4>✅ Pagar conta: '+MC.esc(r.conta.desc)+'</h4><div class="mc-grid">'+
        '<div><label>Valor pago (R$)</label><input id="pVal" inputmode="decimal" value="'+fmt(r.valor)+'"></div>'+
        '<div><label>Mês</label><input id="pMes" type="month" value="'+r.mes+'"></div></div>'+
        '<div class="mc-dica">Previsto: '+MC.brl(r.conta.valorParcela)+'</div></div>';
    } else if(r.acao==='pagarParc'){
      var c = r.conta;
      h = '<div class="mc-card"><h4>✅ Pagar parcela: '+MC.esc(c.desc)+'</h4><div>Parcela '+(c.pagas+1)+' de '+c.parcelas+' · '+MC.brl(c.valorParcela)+'</div></div>';
    }
    $('mcPrev').innerHTML = h+'<button class="mc-btn" id="mcSalvar">Salvar</button>';
    $('mcSalvar').onclick = salvarAtual;
  }
  function salvarAtual(){
    var r = atual; if(!r || r.erro) return;
    if(r.acao==='gasto'){
      var v = MC.num($('pVal').value); if(!v) return;
      gastos.push({id:novoId(), data:$('pData').value||hojeISO(0), desc:$('pDesc').value.trim()||$('pCat').value, cat:$('pCat').value, valor:Math.round(v*100)/100, origem:'voz'});
      salvarG();
    } else if(r.acao==='parcelada'){
      var vp = MC.num($('pVal').value), n = Math.max(1, parseInt($('pN').value,10)||1); if(!vp) return;
      MC.contas.push({id:novoId(), desc:$('pDesc').value.trim()||'Compra parcelada', cat:$('pCat').value, valorParcela:Math.round(vp*100)/100, parcelas:n, pagas:0, dia:new Date().getDate()});
      MC.salvar();
    } else if(r.acao==='pagarRec'){
      var vr = MC.num($('pVal').value); if(!vr) return;
      MC.marcarPago(r.conta, Math.round(vr*100)/100, $('pMes').value || MC.mesAtual()); MC.salvar();
    } else if(r.acao==='pagarParc'){
      if(r.conta.pagas < r.conta.parcelas){ MC.registrar(r.conta.valorParcela); r.conta.pagas++; }
      MC.salvar();
    }
    MC.render(); fechar(); avisar('Anotado ✓');
  }

  // ---------- extrato ----------
  function lerArquivo(file){
    return file.arrayBuffer().then(function(buf){
      try{ return new TextDecoder('utf-8', {fatal:true}).decode(buf); }catch(e){ return new TextDecoder('windows-1252').decode(buf); }
    });
  }
  function parseOFX(t){
    var out = [];
    t.split(/<STMTTRN>/i).slice(1).forEach(function(b){
      b = b.split(/<\/STMTTRN>/i)[0];
      var g = function(tag){ var m = b.match(new RegExp('<'+tag+'>([^<\\r\\n]*)','i')); return m ? m[1].trim() : ''; };
      var v = parseFloat(g('TRNAMT').replace(',','.')), d = g('DTPOSTED');
      if(isNaN(v) || d.length < 8) return;
      out.push({data:d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8), valor:v, desc:(g('MEMO')||g('NAME')).replace(/\s+/g,' '), fitid:g('FITID')});
    });
    return out;
  }
  function splitCSV(l, sep){
    var r = [], cur = '', q = false;
    for(var i=0;i<l.length;i++){
      var ch = l[i];
      if(ch==='"'){ if(q && l[i+1]==='"'){ cur += '"'; i++; } else q = !q; }
      else if(ch===sep && !q){ r.push(cur); cur = ''; }
      else cur += ch;
    }
    r.push(cur); return r.map(function(s){ return s.trim(); });
  }
  function numBR(s){ s = String(s).replace(/[R$\s]/g,''); if(/,\d{1,2}$/.test(s)) s = s.replace(/\./g,'').replace(',','.'); else s = s.replace(/,/g,''); return parseFloat(s); }
  function dataISO(s){
    s = String(s||'').trim(); var m;
    if((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1]+'-'+m[2]+'-'+m[3];
    if((m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/))) return m[3]+'-'+m[2]+'-'+m[1];
    if((m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/))) return '20'+m[3]+'-'+m[2]+'-'+m[1];
    return null;
  }
  function parseCSV(t){
    var linhas = t.replace(/\r/g,'').split('\n').filter(function(l){ return l.trim(); });
    var hi = -1, sep = ',', cab = null;
    for(var i=0;i<Math.min(linhas.length,20);i++){
      var l = norm(linhas[i]);
      if(/data|date/.test(l) && /valor|amount/.test(l)){ hi = i; sep = linhas[i].split(';').length > linhas[i].split(',').length ? ';' : ','; cab = splitCSV(l, sep); break; }
    }
    if(hi < 0) return null;
    var idx = function(re){ for(var k=0;k<cab.length;k++){ if(re.test(cab[k])) return k; } return -1; };
    var iD = idx(/^data|date/), iV = idx(/valor|amount/), iT = idx(/descri|title|lancamento|historico|memo|estabelecimento/), iDet = idx(/detalhe/), iId = idx(/identificador|documento/), iTipo = idx(/tipo/);
    var cartao = cab.indexOf('title')>=0 && cab.indexOf('amount')>=0;
    var out = [];
    for(var j=hi+1;j<linhas.length;j++){
      var c = splitCSV(linhas[j], sep), d = dataISO(c[iD]), v = numBR(c[iV]||'');
      if(!d || isNaN(v)) continue;
      if(cartao) v = -v;
      if(iTipo>=0 && iTipo!==iT){ var tp = norm(c[iTipo]); if(/saida|debito/.test(tp)) v = -Math.abs(v); else if(/entrada|credito/.test(tp)) v = Math.abs(v); }
      var desc = (iT>=0 ? c[iT] : '') + (iDet>=0 && iDet!==iT && c[iDet] ? ' '+c[iDet] : '');
      out.push({data:d, valor:v, desc:desc.replace(/\s+/g,' ').trim(), fitid:(iId>=0 ? c[iId] : '')});
    }
    return out;
  }
  function sugerir(x, usadas){
    var mes = mesDe(x.data), dn = ' '+norm(x.desc)+' ', cx = categoria(x.desc), best = null;
    MC.contas.forEach(function(c){
      var pal = norm(c.desc).split(/[^a-z0-9]+/).filter(function(w){ return w.length>=3; });
      var nome = pal.some(function(w){ return dn.indexOf(w)>=0; });
      if(MC.rec(c)){
        if(MC.valorPago(c, mes)!==null || usadas[c.id+'|'+mes]) return;
        var cat = c.cat!=='Outros' && c.cat===cx;
        var perto = Math.abs(x.valor-c.valorParcela) <= Math.max(1, c.valorParcela*(MC.variavel(c) ? 0.5 : 0.03));
        var exato = !MC.variavel(c) && Math.abs(x.valor-c.valorParcela) <= Math.max(0.05, c.valorParcela*0.01);
        var sc = (nome?2:0)+(cat?1:0)+(perto?1:0)+(exato?1:0);
        if(sc>=2 && (!best || sc>best.sc)) best = {acao:'pagarRec', conta:c, sc:sc};
      } else if(!MC.quitada(c)){
        var igual = Math.abs(x.valor-c.valorParcela) <= Math.max(0.05, c.valorParcela*0.01);
        var sc2 = (igual?2:0)+(nome?1:0)+(/parcela/.test(dn)?1:0);
        if(igual && (!best || sc2>best.sc)) best = {acao:'pagarParc', conta:c, sc:sc2};
      }
    });
    return best;
  }
  var lote = [];
  function importar(file){
    lerArquivo(file).then(function(t){
      var txs = /<STMTTRN>/i.test(t) ? parseOFX(t) : parseCSV(t);
      if(!txs || !txs.length){ abrirSheet('Importar extrato', '<div class="mc-erro">Não reconheci esse arquivo. Exporte o extrato em OFX ou CSV.</div>'); return; }
      var novos = [], repetidos = 0, usadas = {};
      txs.forEach(function(x){
        if(x.valor >= 0 || /saldo/.test(norm(x.desc))) return;
        x.valor = Math.round(-x.valor*100)/100;
        x.key = x.fitid ? 'id:'+x.fitid : x.data+'|'+x.valor+'|'+norm(x.desc);
        if(importados[x.key]){ repetidos++; return; }
        novos.push(x);
      });
      novos.sort(function(a,b){ return a.data < b.data ? -1 : 1; });
      novos.forEach(function(x){
        x.cat = categoria(x.desc);
        x.on = !/pagamento de fatura|pagamento recebido|aplicacao|resgate|rdb|poupanca|transferencia entre|estorno|investimento|pagamento da fatura/.test(norm(x.desc));
        var s = x.on ? sugerir(x, usadas) : null;
        x.sel = !x.on ? 'x' : (s ? (s.acao==='pagarRec' ? 'r:' : 'p:')+s.conta.id : 'g');
        if(s && s.acao==='pagarRec') usadas[s.conta.id+'|'+mesDe(x.data)] = 1;
      });
      mostrarImport(novos, repetidos);
    }).catch(function(){ abrirSheet('Importar extrato', '<div class="mc-erro">Não consegui ler o arquivo.</div>'); });
  }
  function opcoes(x){
    var o = '<option value="g"'+(x.sel==='g'?' selected':'')+'>Gasto avulso</option>';
    MC.contas.forEach(function(c){
      if(MC.rec(c)) o += '<option value="r:'+c.id+'"'+(x.sel==='r:'+c.id?' selected':'')+'>Pagar '+MC.esc(c.desc)+'</option>';
      else if(!MC.quitada(c)) o += '<option value="p:'+c.id+'"'+(x.sel==='p:'+c.id?' selected':'')+'>Parcela de '+MC.esc(c.desc)+'</option>';
    });
    return o+'<option value="x"'+(x.sel==='x'?' selected':'')+'>Ignorar</option>';
  }
  function mostrarImport(novos, repetidos){
    lote = novos;
    if(!novos.length){ abrirSheet('Importar extrato', '<div class="mc-dica">Nenhuma saída nova nesse arquivo'+(repetidos?' ('+repetidos+' já importadas antes)':'')+'.</div>'); return; }
    var tot = novos.reduce(function(s,x){ return s+x.valor; },0);
    var h = '<div class="mc-dica">'+novos.length+' saídas · '+MC.brl(tot)+(repetidos?' · '+repetidos+' já importadas antes':'')+'. Confira para onde vai cada uma:</div>';
    h += novos.map(function(x,i){
      return '<div class="mc-tx'+(x.on?'':' off')+'" data-i="'+i+'"><div class="l1"><input type="checkbox" data-k="on"'+(x.on?' checked':'')+'><span>'+dataBR(x.data)+' · '+MC.esc(x.desc||'(sem descrição)')+'</span><b>'+MC.brl(x.valor)+'</b></div>'+
        '<div class="l2"><select data-k="sel">'+opcoes(x)+'</select>'+selCat('data-k="cat"', x.cat)+'</div></div>';
    }).join('');
    h += '<button class="mc-btn" id="mcImpOk">Importar selecionados</button>';
    abrirSheet('Importar extrato', h);
    $('mcCorpo').onchange = function(e){
      var el = e.target, box = el.closest('.mc-tx'); if(!box) return;
      var x = lote[+box.getAttribute('data-i')], k = el.getAttribute('data-k');
      if(k==='on'){ x.on = el.checked; box.classList.toggle('off', !x.on); }
      else if(k==='sel'){ x.sel = el.value; if(x.sel==='x'){ x.on = false; box.querySelector('[data-k=on]').checked = false; box.classList.add('off'); } }
      else if(k==='cat'){ x.cat = el.value; }
    };
    $('mcImpOk').onclick = aplicarImport;
  }
  function aplicarImport(){
    var n = 0;
    lote.forEach(function(x){
      importados[x.key] = 1;
      if(!x.on || x.sel==='x') return;
      n++;
      if(x.sel==='g'){ gastos.push({id:novoId(), data:x.data, desc:x.desc||x.cat, cat:x.cat, valor:x.valor, origem:'extrato'}); return; }
      var c = MC.contas.find(function(k){ return k.id===x.sel.slice(2); }); if(!c) return;
      if(x.sel.charAt(0)==='r') MC.marcarPago(c, x.valor, mesDe(x.data));
      else {
        var mp = norm(x.desc).match(/parcela\s*(\d+)\s*\/\s*(\d+)/);
        var alvo = mp ? Math.min(c.parcelas, parseInt(mp[1],10)) : c.pagas+1;
        if(alvo > c.pagas){ MC.registrar(c.valorParcela*(alvo-c.pagas), mesDe(x.data)); c.pagas = Math.min(c.parcelas, alvo); }
      }
    });
    salvarG(); MC.salvar(); MC.render(); fechar();
    avisar(n+' lançamento'+(n===1?'':'s')+' importado'+(n===1?'':'s')+' ✓');
  }

  // ---------- lista de gastos avulsos ----------
  function render(){
    var box = $('mcGastos'); if(!box) return;
    var mes = MC.mesAtual(), doMes = gastos.filter(function(g){ return mesDe(g.data)===mes; }).sort(function(a,b){ return a.data < b.data ? 1 : -1; });
    if(!doMes.length){ box.innerHTML = ''; return; }
    var tot = doMes.reduce(function(s,g){ return s+g.valor; },0);
    box.innerHTML = '<h2>Gastos avulsos do mês ('+MC.brl(tot)+')</h2><div class="conta">'+doMes.map(function(g){
      return '<div class="mc-gasto" data-g="'+g.id+'"><div><b>'+MC.esc(g.desc)+'</b><small>'+dataBR(g.data)+' · '+MC.esc(g.cat)+(g.origem==='extrato'?' · extrato':'')+'</small></div>'+
        '<div style="display:flex;gap:8px;align-items:center"><b>'+MC.brl(g.valor)+'</b><button data-del="1">✕</button></div></div>';
    }).join('')+'</div>';
  }

  // ---------- métricas ----------
  function metricas(){
    var vm = $('vMetricas'); if(!vm) return;
    var mes = MC.mesAtual(), doMes = gastos.filter(function(g){ return mesDe(g.data)===mes; });
    if(!doMes.length && !MC.contas.length) return;
    var totG = doMes.reduce(function(s,g){ return s+g.valor; },0), pagoContas = MC.hist[mes] || 0;
    var cats = {}, recPago = 0;
    doMes.forEach(function(g){ cats[g.cat] = (cats[g.cat]||0)+g.valor; });
    MC.contas.forEach(function(c){ if(MC.rec(c)){ var v = MC.valorPago(c, mes); if(v!==null){ cats[c.cat] = (cats[c.cat]||0)+v; recPago += v; } } });
    var parcPago = Math.max(0, Math.round((pagoContas-recPago)*100)/100); if(parcPago > 0) cats['Parcelas'] = (cats['Parcelas']||0)+parcPago;
    var lista = Object.keys(cats).map(function(k){ return [k,cats[k]]; }).sort(function(a,b){ return b[1]-a[1]; });
    var tot = lista.reduce(function(s,x){ return s+x[1]; },0);
    var h = '<div class="kpis">'+MC.kpi('Total gasto no mês', MC.brl(tot), 'contas pagas + gastos avulsos')+MC.kpi('Gastos avulsos no mês', MC.brl(totG), doMes.length+' lançamento'+(doMes.length===1?'':'s'))+'</div>';
    if(lista.length) h += '<div class="conta bloco"><h3>Para onde foi o dinheiro ('+MC.nomeMes(0)+')</h3>'+lista.map(function(x){
      return '<div class="hbar"><div><span>'+MC.esc(x[0])+'</span><b>'+MC.brl(x[1])+' · '+Math.round(x[1]/(tot||1)*100)+'%</b></div><p><i style="width:'+Math.round(x[1]/lista[0][1]*100)+'%"></i></p></div>';
    }).join('')+'</div>';
    var top = doMes.slice().sort(function(a,b){ return b.valor-a.valor; }).slice(0,5);
    if(top.length) h += '<div class="conta bloco"><h3>Maiores gastos avulsos do mês</h3>'+top.map(function(g){ return '<div class="venc"><span>'+dataBR(g.data)+' · '+MC.esc(g.desc)+'</span><b>'+MC.brl(g.valor)+'</b></div>'; }).join('')+'</div>';
    var meses = [];
    for(var i=-5;i<=0;i++){
      var d = new Date(); d.setDate(1); d.setMonth(d.getMonth()+i);
      var m = d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2);
      meses.push([MC.nomeMes(i), gastos.filter(function(x){ return mesDe(x.data)===m; }).reduce(function(s,x){ return s+x.valor; },0)+(MC.hist[m]||0)]);
    }
    var mx = Math.max.apply(null, meses.map(function(x){ return x[1]; }).concat([1]));
    if(meses.some(function(x){ return x[1]>0; })) h += '<div class="conta bloco"><h3>Total gasto por mês</h3><div class="colunas">'+meses.map(function(x,i){
      return '<div class="col'+(i===5?' atual':'')+'"><em>'+(x[1]?MC.abrev(x[1]):'–')+'</em><i style="height:'+Math.round(x[1]/mx*75)+'%"></i><span>'+x[0]+'</span></div>';
    }).join('')+'</div></div>';
    var vazio = vm.querySelector('.vazio'); if(vazio) vazio.remove();
    var cont = document.createElement('div'); cont.innerHTML = h;
    vm.insertBefore(cont, vm.firstChild);
  }

  // ---------- backup completo ----------
  function textoBackup(){ return JSON.stringify({app:'minhas-contas', contas:MC.contas, gastos:gastos, hist:MC.hist, importados:importados}); }
  function initBackup(){
    var det = document.querySelector('.backup');
    if(det) det.addEventListener('toggle', function(){ if(this.open) $('txtBackup').value = textoBackup(); });
    $('btnCopiar').onclick = function(){
      var t = $('txtBackup'); t.value = textoBackup(); t.select();
      (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject())
        .then(function(){ $('msgBackup').textContent = 'Copiado! Cole em um lugar seguro.'; })
        .catch(function(){ try{ document.execCommand('copy'); $('msgBackup').textContent = 'Copiado!'; }catch(e){ $('msgBackup').textContent = 'Selecione o texto e copie manualmente.'; } });
    };
    var conf = false;
    $('btnRestaurar').onclick = function(){
      var d; try{ d = JSON.parse($('txtBackup').value); }catch(e){ $('msgBackup').textContent = 'Texto de backup inválido.'; return; }
      var cs = Array.isArray(d) ? d : (d && Array.isArray(d.contas) ? d.contas : null);
      if(!cs){ $('msgBackup').textContent = 'Texto de backup inválido.'; return; }
      if(!conf){ conf = true; this.textContent = 'Confirmar?'; $('msgBackup').textContent = 'Isso substitui os dados atuais pelos do backup ('+cs.length+' contas'+(d.gastos ? ', '+d.gastos.length+' gastos' : '')+').'; return; }
      conf = false; this.textContent = 'Restaurar';
      MC.setContas(cs);
      if(!Array.isArray(d)){ gastos = d.gastos || []; importados = d.importados || {}; MC.setHist(d.hist || {}); salvarG(); }
      MC.salvar(); MC.render(); $('msgBackup').textContent = 'Restaurado ✓';
    };
  }

  // ---------- montagem da tela ----------
  var css = document.createElement('style');
  css.textContent = [
    '.mc-acoes{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}',
    '.mc-acoes button{border:0;border-radius:14px;padding:14px 8px;font-size:15px;font-weight:700}',
    '#btnVoz{background:var(--verde);color:#fff}',
    '#btnImp{background:#e6eefc;color:#2d5bb9}',
    '.mc-fundo{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:50;display:flex;align-items:flex-end}',
    '.mc-sheet{background:var(--fundo);width:100%;max-width:640px;margin:0 auto;border-radius:20px 20px 0 0;padding:16px 14px calc(18px + env(safe-area-inset-bottom));max-height:88vh;overflow:auto}',
    '.mc-topo{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}',
    '.mc-topo b{font-size:18px}',
    '.mc-topo button{border:0;background:#fff;border-radius:50%;width:34px;height:34px;font-size:16px}',
    '.mc-ex,.mc-dica{font-size:12px;color:var(--sub);margin:8px 0}',
    '.mc-linha{display:flex;gap:8px;align-items:stretch}',
    '.mc-linha textarea{flex:1;font-size:17px;font-family:inherit;padding:12px}',
    '.mc-mic{border:0;border-radius:12px;background:var(--amarelo);font-size:22px;width:58px}',
    '.mc-mic.on{background:var(--vermelho);color:#fff}',
    '.mc-card{background:#fff;border:1px solid var(--borda);border-radius:14px;padding:12px;margin-top:10px}',
    '.mc-card h4{margin:0 0 8px;font-size:15px;color:var(--verde)}',
    '.mc-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.mc-grid label{margin:6px 0 3px}',
    '.mc-btn{width:100%;border:0;border-radius:12px;padding:14px;font-size:16px;font-weight:700;background:var(--verde);color:#fff;margin-top:12px}',
    '.mc-erro{color:var(--vermelho);font-size:14px;margin-top:10px}',
    '.mc-tx{background:#fff;border:1px solid var(--borda);border-radius:12px;padding:10px;margin-top:8px}',
    '.mc-tx.off{opacity:.5}',
    '.mc-tx .l1{display:flex;gap:8px;align-items:center;font-size:14px}',
    '.mc-tx .l1 input{width:20px;height:20px;flex:none}',
    '.mc-tx .l1 span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mc-tx .l2{display:grid;grid-template-columns:1.3fr 1fr;gap:6px;margin-top:8px}',
    '.mc-tx select{padding:8px;font-size:14px}',
    '.mc-gasto{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid var(--fundo);font-size:14px}',
    '.mc-gasto:last-child{border:0}',
    '.mc-gasto small{display:block;color:var(--sub);font-size:12px}',
    '.mc-gasto button{border:0;background:#fbeceb;color:var(--vermelho);border-radius:8px;padding:6px 9px;font-size:12px}',
    '.mc-gasto button.confirma{background:var(--vermelho);color:#fff}'
  ].join('\n');
  document.head.appendChild(css);

  $('btnNovo').insertAdjacentHTML('beforebegin', '<div class="mc-acoes"><button id="btnVoz">🎤 Anotar gasto</button><button id="btnImp">📄 Importar extrato</button></div><input type="file" id="mcArq" style="display:none">');
  document.body.insertAdjacentHTML('beforeend', '<div id="mcSheet" class="mc-fundo oculto"><div class="mc-sheet"><div class="mc-topo"><b id="mcTitulo"></b><button id="mcFechar">✕</button></div><div id="mcCorpo"></div></div></div>');
  $('lista').insertAdjacentHTML('afterend', '<div id="mcGastos"></div>');
  $('mcFechar').onclick = fechar;
  $('mcSheet').addEventListener('click', function(e){ if(e.target===this) fechar(); });
  $('btnVoz').onclick = abrirAnotar;
  $('btnImp').onclick = function(){ $('mcArq').value = ''; $('mcArq').click(); };
  $('mcArq').onchange = function(){ if(this.files && this.files[0]) importar(this.files[0]); };
  $('mcGastos').addEventListener('click', function(e){
    var b = e.target.closest('button[data-del]'); if(!b) return;
    if(!b.classList.contains('confirma')){ b.classList.add('confirma'); b.textContent = 'Excluir?'; setTimeout(function(){ if(b.isConnected){ b.classList.remove('confirma'); b.textContent = '✕'; } }, 3000); return; }
    var gid = b.closest('.mc-gasto').getAttribute('data-g');
    gastos = gastos.filter(function(g){ return g.id!==gid; }); salvarG(); MC.render();
  });
  var fc = $('fCat');
  CATS.forEach(function(c){ if(![].some.call(fc.options, function(o){ return o.value===c; })){ var o = document.createElement('option'); o.textContent = c; fc.insertBefore(o, fc.lastElementChild); } });

  window.MCExtra = { render:render, metricas:metricas, interpretar:interpretar, parseOFX:parseOFX, parseCSV:parseCSV, gastos:function(){ return gastos; } };
  initBackup();
  MC.render();
})();
