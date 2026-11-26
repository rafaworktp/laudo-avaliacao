/* Laudo de Avaliação Imobiliária — motor v2 (NBR 14653-1:2019 / 14653-2:2011) */
(function () {
  'use strict';

  // ===================== helpers =====================
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const F = n => $('[name="d[' + n + ']"]');
  const N = n => { const e = F(n); return e && String(e.value).trim() !== '' ? num(e) : NaN; };
  const S = (n, val, d = 2) => {
    const e = F(n); if (!e) return;
    e.value = (val === null || val === undefined || !isFinite(val)) ? '' : (+val).toFixed(d);
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const num = el => {
    if (!el) return NaN;
    if (el.type === 'checkbox') return el.checked ? 1 : 0;
    const raw = String(el.value).trim().replace(/\s/g, '');
    if (!raw) return NaN;
    if (raw.includes(',')) return parseFloat(raw.replace(/\./g, '').replace(',', '.'));
    return parseFloat(raw);
  };
  const checkedVal = n => { const e = document.querySelector('input[name="d[' + n + ']"]:checked'); return e ? e.value : ''; };
  const fmtBRL = v => isFinite(v) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—';
  const fmtNum = (v, d = 2) => isFinite(v) ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v) : '—';
  const pad2 = n => String(n).padStart(2, '0');
  const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  const fmtDate = v => {
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) { const [y, m, d] = v.slice(0, 10).split('-'); return d + '/' + m + '/' + y; }
    return v;
  };
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T80 = [3.078,1.886,1.638,1.533,1.476,1.440,1.415,1.397,1.383,1.372,1.363,1.356,1.350,1.345,1.341,1.337,1.333,1.330,1.328,1.325,1.323,1.321,1.319,1.318,1.316,1.315,1.314,1.313,1.311,1.310];
  const HEIDECKE = { 1: 0, 1.5: 0.0032, 2: 0.0252, 2.5: 0.0809, 3: 0.1810, 3.5: 0.3320, 4: 0.5260, 4.5: 0.7520, 5: 1 };
  const PADRAO_FACTOR = { 1: 0.80, 2: 1.00, 3: 1.25, 4: 1.50 };

  // Inverse normal CDF (Acklam), used by Chauvenet
  function invNorm(p) {
    if (!(p > 0 && p < 1)) return NaN;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const plow = 0.02425, phigh = 1 - plow;
    let q, r;
    if (p < plow) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
    if (p <= phigh) { q = p - 0.5; r = q * q; return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); }
    q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  const chauvenetZ = n => n > 0 ? invNorm(1 - 1 / (4 * n)) : NaN;
  const gradeFromAmp = a => {
    if (!isFinite(a) || a < 0) return '';
    if (a <= 30) return 'III';
    if (a <= 40) return 'II';
    if (a <= 50) return 'I';
    return 'Sem enquadramento';
  };

  // ===================== OLS / estatística =====================
  function lgamma(z) {
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function betacf(a, b, x) {
    const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function betai(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }
  const tP = (t, df) => isFinite(t) && df > 0 ? betai(df / 2, 0.5, df / (df + t * t)) : NaN;
  const fP = (F, df1, df2) => isFinite(F) && F > 0 && df1 > 0 && df2 > 0 ? 1 - betai(df1 / 2, df2 / 2, df1 * F / (df1 * F + df2)) : NaN;
  function tQuantile80(df) {
    if (!(df > 0)) return NaN;
    if (df <= 30) return T80[Math.max(0, Math.round(df) - 1)];
    const z = 1.2815515655446004;
    return z + (z * z * z + z) / (4 * df) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df * df);
  }
  function matInv(A) {
    const n = A.length;
    const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      if (Math.abs(M[piv][col]) < 1e-12) throw new Error('matriz singular');
      if (piv !== col) { const t = M[piv]; M[piv] = M[col]; M[col] = t; }
      const div = M[col][col];
      for (let j = 0; j < 2 * n; j++) M[col][j] /= div;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col];
        if (!f) continue;
        for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j];
      }
    }
    return M.map(row => row.slice(n));
  }
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const matVec = (A, v) => A.map(row => dot(row, v));
  function olsFit(X, y, opts) {
    const n = X.length, p = X[0].length;
    if (n <= p) throw new Error('dados insuficientes para a regressão');
    const XtX = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X.reduce((s, row) => s + row[i] * row[j], 0)));
    const Xty = Array.from({ length: p }, () => 0);
    for (let i = 0; i < p; i++) Xty[i] = X.reduce((s, row, k) => s + row[i] * y[k], 0);
    const inv = matInv(XtX);
    const beta = matVec(inv, Xty);
    const fitted = X.map(row => dot(row, beta));
    const resid = y.map((v, i) => v - fitted[i]);
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    const sse = resid.reduce((a, b) => a + b * b, 0);
    const sst = y.reduce((a, b) => a + (b - meanY) ** 2, 0);
    const df = n - p;
    const mse = sse / df;
    const cov = inv.map(row => row.map(v => v * mse));
    const se = beta.map((_, j) => Math.sqrt(Math.max(0, cov[j][j])));
    const t = beta.map((b, j) => se[j] > 0 ? b / se[j] : NaN);
    const pval = t.map(v => tP(v, df));
    const r2 = sst > 0 ? 1 - sse / sst : NaN;
    const adj = sst > 0 ? 1 - (1 - r2) * (n - 1) / df : NaN;
    const f = ((sst - sse) / (p - 1)) / (sse / df);
    const pf = fP(f, p - 1, df);
    const lev = X.map(row => { const v = matVec(inv, row); return dot(row, v); });
    const cook = resid.map((e, i) => (1 - lev[i]) > 1e-12 ? (e * e) / (p * mse) * lev[i] / ((1 - lev[i]) ** 2) : NaN);
    let dw = 0;
    for (let i = 1; i < n; i++) dw += (resid[i] - resid[i - 1]) ** 2;
    dw = sse > 0 ? dw / sse : NaN;
    const vif = Array(p).fill(NaN);
    if (!opts || !opts.skipVif) {
      for (let j = 1; j < p; j++) {
        const Xo = X.map(row => [1, ...row.filter((_, k) => k !== 0 && k !== j)]);
        const yo = X.map(row => row[j]);
        try {
          const fo = olsFit(Xo, yo, { skipVif: true });
          vif[j] = isFinite(fo.r2) && fo.r2 < 1 ? 1 / (1 - fo.r2) : Infinity;
        } catch (e) { vif[j] = NaN; }
      }
    }
    return { n, p, beta, se, t, pval, r2, adj, f, pf, mse, resid, lev, cook, dw, vif, inv };
  }

  function mapPadrao(v) {
    const s = String(v || '').toLowerCase();
    if (/luxo/.test(s)) return 4;
    if (/alto/.test(s)) return 3;
    if (/normal|m[eé]dio/.test(s)) return 2;
    if (/baixo|popular|m[ií]nimo/.test(s)) return 1;
    const n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }
  function rossKd(age, life, state) {
    const c = HEIDECKE[state];
    if (!isFinite(age) || !isFinite(life) || life <= 0 || c === undefined) return null;
    const x = clamp(age / life, 0, 1);
    const a = 0.5 * (x + x * x);
    return a + c * (1 - a);
  }
  function baseVu() { return (F('base_vu') || {}).value || 'auto'; }
  function effectiveBase() {
    const b = baseVu();
    if (b !== 'auto') return b;
    const tipo = String((F('tipo_imovel') || {}).value || '');
    if (/terreno|lote|gleba/i.test(tipo)) return 'terreno';
    if (/casa|apartamento|sala|galp|comercial|sobrado|kitnet/i.test(tipo)) return 'construida';
    return 'auto';
  }
  function sampleArea(tr) {
    const at = num(tr.querySelector('[data-k=at]')), ac = num(tr.querySelector('[data-k=ac]'));
    const b = effectiveBase();
    if (b === 'construida') return ac;
    if (b === 'terreno') return at;
    return at > 0 ? at : ac;
  }
  function subjectArea() {
    let at = N('area_terreno_num'), ac = N('area_constr_num');
    if (!isFinite(at)) at = parseFloat(String((F('area_terreno') || {}).value || '').replace(',', '.'));
    if (!isFinite(ac)) ac = parseFloat(String((F('area_constr') || {}).value || '').replace(',', '.'));
    const b = effectiveBase();
    if (b === 'construida') return ac;
    if (b === 'terreno') return at;
    const tipo = String((F('tipo_imovel') || {}).value || '');
    if (/terreno/i.test(tipo)) return at;
    return ac > 0 ? ac : at;
  }
  function setAutoField(el, val, digits) {
    if (!el) return;
    const hasManual = String(el.value || '').trim() !== '' && el.dataset.auto !== '1';
    if (hasManual) return;
    if (!isFinite(val)) { if (el.dataset.auto === '1') el.value = ''; return; }
    el.value = (+val).toFixed(digits == null ? 4 : digits);
    el.dataset.auto = '1';
  }
  function ensureRows(name, count) {
    while (rowsOf(name).length < count) { if (!addRow(name, true)) break; }
  }

  function autoFactors() {
    const samples = rowsOf('amostra');
    ensureRows('detalhes', samples.length);
    ensureRows('homog', samples.length);
    const details = rowsOf('detalhes'), homog = rowsOf('homog');
    const areaA = subjectArea();
    const life = N('vida_util') || 60;
    const ageA = N('idade_efetiva');
    const stateA = parseFloat((F('heidecke') || {}).value);
    const kdA = rossKd(ageA, life, stateA);
    const padA = mapPadrao((F('padrao_constr') || {}).value);
    const fpadA = PADRAO_FACTOR[padA];
    samples.forEach((s, i) => {
      const vu = num(s.querySelector('[data-k=vu]'));
      const areaS = sampleArea(s);
      const tipo = String((s.querySelector('[data-k=tipo]') || {}).value || '');
      const h = homog[i]; if (!h) return;
      if (vu > 0) setAutoField(h.querySelector('[data-k=q]'), vu, 2);
      setAutoField(h.querySelector('[data-k=fo]'), tipo === 'Oferta' ? 0.90 : 1.00, 4);
      const exp = effectiveBase() === 'construida' ? 0.125 : 0.20;
      if (areaS > 0 && areaA > 0) setAutoField(h.querySelector('[data-k=fa]'), Math.pow(areaS / areaA, exp), 4);
      let fc = 1;
      const d = details[i];
      if (d && kdA !== null) {
        const ageS = num(d.querySelector('[data-k=idade]'));
        const stateS = parseFloat((d.querySelector('[data-k=conserv]') || {}).value);
        const kdS = rossKd(ageS, life, stateS);
        if (kdS !== null && (1 - kdS) > 1e-9) fc = (1 - kdA) / (1 - kdS);
      }
      setAutoField(h.querySelector('[data-k=fc]'), fc, 4);
      const padS = mapPadrao((s.querySelector('[data-k=padrao]') || {}).value);
      const fpadS = PADRAO_FACTOR[padS];
      if (fpadS && fpadA) setAutoField(h.querySelector('[data-k=fp]'), fpadA / fpadS, 4);
      setAutoField(h.querySelector('[data-k=fl]'), 1, 4);
      setAutoField(h.querySelector('[data-k=ft]'), 1, 4);
    });
    renumber();
  }

  function buildRegression() {
    const samples = rowsOf('amostra'), details = rowsOf('detalhes');
    const rows = [];
    samples.forEach((tr, i) => {
      const vu = num(tr.querySelector('[data-k=vu]'));
      const area = sampleArea(tr);
      if (!(vu > 0) || !(area > 0)) return;
      const d = details[i] || {};
      rows.push({
        vu, area,
        idade: d.querySelector ? num(d.querySelector('[data-k=idade]')) : NaN,
        conserv: d.querySelector ? parseFloat((d.querySelector('[data-k=conserv]') || {}).value) : NaN,
        esquina: d.querySelector ? num(d.querySelector('[data-k=esquina]')) : NaN,
        topografia: d.querySelector ? num(d.querySelector('[data-k=topografia]')) : NaN,
        distancia: d.querySelector ? num(d.querySelector('[data-k=distancia]')) : NaN,
        padrao: mapPadrao((tr.querySelector('[data-k=padrao]') || {}).value)
      });
    });
    const n = rows.length;
    if (n < 6) return { ok: false, erro: 'São necessários ao menos 6 comparáveis com VU e área para a regressão (n atual = ' + n + ').' };
    const subject = {
      area: subjectArea(),
      idade: N('idade_efetiva') || parseFloat(String((F('idade') || {}).value || '').replace(',', '.')),
      conserv: parseFloat((F('heidecke') || {}).value),
      esquina: /esquina/i.test(String((F('posicao') || {}).value || '')) ? 1 : 0,
      topografia: /declive|aclive|irregular/i.test(String((F('topografia') || {}).value || '')) ? 1 : 0,
      distancia: N('dist_centro'),
      padrao: mapPadrao((F('padrao_constr') || {}).value)
    };
    const candidates = [
      { key: 'area', name: 'Área', value: r => r.area },
      { key: 'idade', name: 'Idade', value: r => r.idade },
      { key: 'padrao', name: 'Padrão', value: r => r.padrao },
      { key: 'conserv', name: 'Conservação', value: r => r.conserv },
      { key: 'esquina', name: 'Esquina', value: r => r.esquina },
      { key: 'distancia', name: 'Distância', value: r => r.distancia }
    ];
    const maxK = Math.min(6, Math.floor(n / 3) - 1);
    if (maxK < 1) return { ok: false, erro: 'n insuficiente para regression com o grau mínimo (n = ' + n + ').' };
    const vars = [];
    for (const c of candidates) {
      const vals = rows.map(c.value);
      if (!vals.every(isFinite)) continue;
      if (new Set(vals.map(v => (+v).toFixed(6))).size < 2) continue;
      if (!isFinite(subject[c.key])) continue;
      vars.push(c);
    }
    if (!vars.length) return { ok: false, erro: 'Nenhuma variável independente completa e com variabilidade. Preencha idade, padrão, conservação, esquina ou distância nos comparáveis e no avaliando.' };
    const use = vars.slice(0, maxK);
    return { ok: true, rows, vars: use, subject, n, k: use.length };
  }

  function fillCoef(fit, vars) {
    const tb = $('table[data-name=coef] tbody'); if (!tb) return;
    const names = ['Intercepto', ...vars.map(v => v.name)];
    while (tb.children.length < names.length) addRow('coef', true);
    while (tb.children.length > Math.max(1, names.length)) tb.lastElementChild.remove();
    [...tb.children].forEach((tr, i) => {
      const set = (k, v) => { const e = tr.querySelector('[data-k=' + k + ']'); if (!e) return; e.value = v; };
      set('var', names[i]);
      set('coef', isFinite(fit.beta[i]) ? fit.beta[i].toFixed(6) : '');
      set('ep', isFinite(fit.se[i]) ? fit.se[i].toFixed(6) : '');
      set('t', isFinite(fit.t[i]) ? fit.t[i].toFixed(4) : '');
      set('p', isFinite(fit.pval[i]) ? fit.pval[i].toFixed(6) : '');
      set('vif', i === 0 ? '' : (isFinite(fit.vif[i]) ? fit.vif[i].toFixed(3) : '—'));
    });
    renumber();
  }
  function fillRegPreview(data) {
    while (rowsOf('regdata').length < data.rows.length) { if (!addRow('regdata', true)) break; }
    const all = rowsOf('regdata');
    all.forEach((tr, i) => {
      const set = (k, v) => { const e = tr.querySelector('[data-k=' + k + ']'); if (e) e.value = isFinite(v) ? v : ''; };
      set('y', data.rows[i] ? data.rows[i].vu : NaN);
      data.vars.forEach((v, j) => set('x' + (j + 1), data.rows[i] ? v.value(data.rows[i]) : NaN));
      for (let j = data.vars.length; j < 6; j++) set('x' + (j + 1), NaN);
    });
    data.vars.forEach((v, j) => { const e = F('sx' + (j + 1)); if (e) e.value = isFinite(data.subject[v.key]) ? data.subject[v.key] : ''; });
    for (let j = data.vars.length; j < 6; j++) { const e = F('sx' + (j + 1)); if (e) e.value = ''; }
  }
  function eqString(model, fit, vars) {
    const b = fit.beta;
    const parts = [b[0].toFixed(4)];
    vars.forEach((v, j) => {
      const coef = b[j + 1];
      const sinal = coef >= 0 ? ' + ' : ' - ';
      const x = model === 'loglog' ? 'ln(' + v.name + ')' : v.name;
      parts.push(sinal + Math.abs(coef).toFixed(4) + '·' + x);
    });
    return (model === 'linear' ? 'VU' : 'ln(VU)') + ' = ' + parts.join('');
  }

  function fitOLS(rows, vars, subject, model) {
    let y = rows.map(r => r.vu);
    let Xr = rows.map(r => vars.map(v => v.value(r)));
    let subj = vars.map(v => subject[v.key]);
    if (model === 'semilog' || model === 'loglog') {
      if (!y.every(v => v > 0)) return { ok: false, erro: 'Semilog/log-log exigem VU > 0 em todos os comparáveis.' };
      y = y.map(Math.log);
    }
    if (model === 'loglog') {
      if (!Xr.every(row => row.every(v => v > 0)) || !subj.every(v => v > 0)) return { ok: false, erro: 'Log-log exige todas as variáveis positivas.' };
      Xr = Xr.map(row => row.map(Math.log));
      subj = subj.map(Math.log);
    }
    const X = Xr.map(row => [1, ...row]);
    let fit;
    try { fit = olsFit(X, y); } catch (e) { return { ok: false, erro: e.message }; }
    const x0 = [1, ...subj];
    const yhat = dot(x0, fit.beta);
    const invx = matVec(fit.inv, x0);
    const sePred = Math.sqrt(Math.max(0, fit.mse * (1 + dot(x0, invx))));
    const t80 = tQuantile80(fit.n - fit.p);
    const lo = yhat - t80 * sePred, hi = yhat + t80 * sePred;
    const back = v => model === 'linear' ? v : Math.exp(v);
    return { ok: true, fit, vars, cen: back(yhat), inf: back(lo), sup: back(hi), sePred, t80 };
  }

  function runOLS(auto) {
    const data = buildRegression();
    if (!data.ok) return data;
    const model = (F('ols_modelo') || {}).value || 'semilog';
    let vars = data.vars.slice();
    const dropped = [];
    let last = null;
    // seleção backward: remove a variável menos significativa até p ≤ 10% (ou sobrar 1)
    while (vars.length) {
      const r = fitOLS(data.rows, vars, data.subject, model);
      if (!r.ok) {
        if (vars.length > 1) { dropped.push(vars.pop().name); continue; }
        return r;
      }
      last = r;
      const pvals = r.fit.pval.slice(1);
      if (vars.length <= 1) break;
      let worst = -1, wi = -1;
      pvals.forEach((p, i) => { if (isFinite(p) && p > worst) { worst = p; wi = i; } });
      if (wi < 0 || worst <= 0.10) break;
      dropped.push(vars[wi].name);
      vars.splice(wi, 1);
    }
    if (!last) return { ok: false, erro: 'não foi possível ajustar o modelo' };
    const fit = last.fit;
    const cen = last.cen, inf = last.inf, sup = last.sup;
    S('ig_n', fit.n, 0); S('ig_k', fit.p - 1, 0);
    S('ig_r2', fit.r2, 4); S('ig_r2aj', fit.adj, 4); S('ig_ep', Math.sqrt(fit.mse), 4);
    S('ig_f', fit.f, 4); S('ig_sigf', fit.pf * 100, 4); S('ig_dw', fit.dw, 4);
    S('rg_n', fit.n, 0); S('k_vars', fit.p - 1, 0);
    const pvals = fit.pval.slice(1).filter(v => isFinite(v));
    S('rg_p_t', pvals.length ? Math.max(...pvals) * 100 : NaN, 2);
    S('rg_p_f', fit.pf * 100, 2);
    fillCoef(fit, vars);
    if (F('eq_ajustada')) F('eq_ajustada').value = eqString(model, fit, vars);
    const areaSubj = subjectArea();
    const benSubj = N('c_b');
    const benOk = isFinite(benSubj) ? benSubj : 0;
    const cenTotal = isFinite(areaSubj) && areaSubj > 0 ? cen * areaSubj + benOk : NaN;
    const infTotal = isFinite(areaSubj) && areaSubj > 0 ? inf * areaSubj + benOk : NaN;
    const supTotal = isFinite(areaSubj) && areaSubj > 0 ? sup * areaSubj + benOk : NaN;
    if (F('r_vars')) F('r_vars').value = 'Y = VU (R$/m²); ' + vars.map(v => v.name + ' = ' + fmtNum(data.subject[v.key], 2)).join('; ');
    S('r_cen', cenTotal, 2); S('r_inf', infTotal, 2); S('r_sup', supTotal, 2);
    S('r_amp', cenTotal > 0 ? (supTotal - infTotal) / cenTotal * 100 : NaN, 1);
    if (F('inf_descricao')) F('inf_descricao').value = 'OLS ' + model + ' (dependente: VU em R$/m²): n = ' + fit.n + '; k = ' + (fit.p - 1) + '; R² = ' + fmtNum(fit.r2, 4) + '; R² ajustado = ' + fmtNum(fit.adj, 4) + '; F = ' + fmtNum(fit.f, 4) + '; p(F) = ' + fmtNum(fit.pf * 100, 2) + '%; Durbin-Watson = ' + fmtNum(fit.dw, 3) + '. Variáveis: ' + vars.map(v => v.name).join(', ') + (dropped.length ? '. Removidas por significância: ' + dropped.join(', ') : '') + '. Previsão para a área de ' + fmtNum(areaSubj, 2) + ' m²: ' + fmtBRL(cenTotal) + '.';
    fillRegPreview({ rows: data.rows, vars, subject: data.subject });
    // defaults de enquadramento
    if (F('rg1') && !F('rg1').value) F('rg1').value = '2';
    if (F('rg3') && !F('rg3').value) F('rg3').value = rowsOf('amostra').every(tr => String((tr.querySelector('[data-k=fonte]') || {}).value || '').trim() !== '' && String((tr.querySelector('[data-k=data]') || {}).value || '').trim() !== '') ? '2' : '1';
    if (F('pr2')) F('pr2').checked = true;
    if (F('pr3')) F('pr3').checked = rowsOf('amostra').every(tr => String((tr.querySelector('[data-k=fonte]') || {}).value || '').trim() !== '' && String((tr.querySelector('[data-k=end]') || {}).value || '').trim() !== '');
    if (F('pr4')) F('pr4').checked = true;
    if (auto) {
      const radio = document.querySelector('input[name="d[tratamento]"][value="estatistico"]');
      if (radio) radio.checked = true;
    }
    return { ok: true, cen, inf, sup, fit, model, vars, dropped, n: fit.n, k: fit.p - 1, r2: fit.r2, adj: fit.adj, f: fit.f, pf: fit.pf, dw: fit.dw, amp: cen > 0 ? (sup - inf) / cen * 100 : NaN };
  }

  function calcularTudo(forcar) {
    const samples = rowsOf('amostra').filter(tr => num(tr.querySelector('[data-k=vu]')) > 0);
    if (samples.length < 3) { alert('Preencha ao menos 3 comparáveis com preço e área (VU calculado).'); return; }
    ensureRows('detalhes', samples.length);
    ensureRows('homog', samples.length);
    autoFactors();
    let trat = forcar || checkedVal('tratamento');
    let ols = null;
    let olsErro = '';
    if (trat === 'estatistico' || (!trat && samples.length >= 12)) {
      ols = runOLS(true);
      if (!ols.ok) {
        olsErro = ols.erro;
        if (trat === 'estatistico' || forcar === 'estatistico') { alert('Regressão: ' + ols.erro); return; }
      } else {
        const radio = document.querySelector('input[name="d[tratamento]"][value="estatistico"]');
        if (radio) radio.checked = true;
        trat = 'estatistico';
      }
    }
    if (trat !== 'estatistico') {
      const radio = document.querySelector('input[name="d[tratamento]"][value="fatores"]');
      if (radio) radio.checked = true;
      trat = 'fatores';
    }
    // área, valor unitário e valor final automáticos (se o usuário não sobrescreveu)
    const cA = F('c_a');
    if (cA && (!String(cA.value || '').trim() || cA.dataset.auto === '1')) {
      const a = subjectArea();
      if (isFinite(a) && a > 0) { cA.value = a.toFixed(2); cA.dataset.auto = '1'; }
    }
    tudo();
    const cQ = F('c_q');
    if (cQ && (!String(cQ.value || '').trim() || cQ.dataset.auto === '1')) {
      if (trat === 'estatistico') {
        const ca = N('c_a'), rcen = N('r_cen');
        const desc = clamp(isFinite(N('desc_oferta')) ? N('desc_oferta') : 0, 0, 15) / 100;
        if (isFinite(ca) && ca > 0 && isFinite(rcen)) { cQ.value = (rcen * (1 - desc) / ca).toFixed(2); cQ.dataset.auto = '1'; }
      } else if (isFinite(N('st_media'))) { cQ.value = N('st_media').toFixed(2); cQ.dataset.auto = '1'; }
    }
    if (F('f1') && !F('f1').value) F('f1').value = '2';
    if (F('f3') && !F('f3').value) F('f3').value = rowsOf('amostra').every(tr => String((tr.querySelector('[data-k=fonte]') || {}).value || '').trim() !== '' && String((tr.querySelector('[data-k=end]') || {}).value || '').trim() !== '') ? '2' : '1';
    tudo();
    const adm = window.__adm || {};
    const res = N('res_num');
    const msg = 'Cálculo concluído. Valor central: ' + fmtBRL(adm.cen) + '; valor final: ' + fmtBRL(res) + '; precisão: ' + (((F('p_grau') || {}).value) || '—') + '; fundamentação: ' + ((F('e_fund') || {}).value || '—') + '.' + (olsErro ? ' Regressão não utilizada: ' + olsErro + ' Cálculo por fatores.' : '');
    if (F('ols_status')) F('ols_status').textContent = ols && ols.ok ? 'OLS concluído; ' + ols.n + ' dados, k = ' + ols.k + (ols.dropped && ols.dropped.length ? '; removidas: ' + ols.dropped.join(', ') : '') + '.' : (olsErro ? 'OLS: ' + olsErro : '');
    avisa(msg);
    alert(msg);
  }

  // ===================== state =====================
  const KEY = 'laudos_tres_pontas_v1';
  const MIN = { amostra: 5, homog: 3, coef: 3, saneamento: 1, extrap: 1, micro: 1, detalhes: 5, regdata: 5 };
  let atual = null, timer = null, dirty = false, fotos = [], docs = [];
  let DEFAULTS = {};
  const CFG = window.LAUDO_CONFIG || {};
  const CLOUD_CFG = (CFG.supabase && CFG.supabase.url && CFG.supabase.anonKey) ? CFG.supabase : null;
  const CLOUD_KEY = 'laudo_cloud_session_v1';
  const CHUNK = 700000; // caracteres por parte (fotos/PDFs vão em partes separadas)

  const safeToken = v => {
    const s = String(v == null ? '' : v).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
    return s || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  };

  const Cloud = {
    cfg: CLOUD_CFG,
    session: null,
    get enabled() { return !!this.cfg; },
    load() {
      try {
        const s = JSON.parse(localStorage.getItem(CLOUD_KEY) || 'null');
        if (s && s.access_token) this.session = s;
      } catch (e) { /* ignora */ }
      return this.session;
    },
    save(s) {
      this.session = s;
      try { localStorage.setItem(CLOUD_KEY, JSON.stringify(s)); } catch (e) { /* ignora */ }
    },
    clear() {
      this.session = null;
      try { localStorage.removeItem(CLOUD_KEY); } catch (e) { /* ignora */ }
    },
    headers(extra) {
      return Object.assign({
        apikey: this.cfg.anonKey,
        Authorization: 'Bearer ' + ((this.session && this.session.access_token) || this.cfg.anonKey),
        'Content-Type': 'application/json'
      }, extra || {});
    },
    async raw(path, opts) {
      const o = Object.assign({ cache: 'no-store' }, opts || {});
      o.headers = this.headers(o.headers);
      const r = await fetch(this.cfg.url + path, o);
      const text = await r.text();
      let j = null;
      try { j = text ? JSON.parse(text) : null; } catch (e) { j = text; }
      if (!r.ok) {
        const msg = (j && (j.message || j.erro || j.error_description || j.msg || j.hint)) || ('HTTP ' + r.status);
        const err = new Error(msg); err.status = r.status;
        if (r.status === 401) this.clear();
        throw err;
      }
      return j;
    },
    async login(email, password) {
      const j = await this.raw('/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + this.cfg.anonKey },
        body: JSON.stringify({ email, password })
      });
      if (!j || !j.access_token) throw new Error('não foi possível entrar');
      this.save({
        access_token: j.access_token,
        refresh_token: j.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600) - 30,
        email: (j.user && j.user.email) || email
      });
      return j;
    },
    async refresh() {
      if (!this.session || !this.session.refresh_token) throw new Error('sessão expirada');
      const j = await this.raw('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + this.cfg.anonKey },
        body: JSON.stringify({ refresh_token: this.session.refresh_token })
      });
      if (!j || !j.access_token) throw new Error('sessão expirada');
      this.save({
        access_token: j.access_token,
        refresh_token: j.refresh_token || this.session.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600) - 30,
        email: this.session.email
      });
    },
    async auth() {
      if (!this.session || !this.session.access_token) throw new Error('informe a senha do painel');
      if (this.session.expires_at && this.session.expires_at < Math.floor(Date.now() / 1000) + 60) {
        try { await this.refresh(); }
        catch (e) { this.clear(); throw new Error('sessão expirada; informe a senha novamente'); }
      }
    },
    async select(table, query) {
      await this.auth();
      return this.raw('/rest/v1/' + table + (query ? '?' + query : ''));
    },
    async putLaudo(id, obj) {
      await this.auth();
      const json = JSON.stringify(obj);
      const total = Math.max(1, Math.ceil(json.length / CHUNK));
      for (let i = 0; i < total; i++) {
        await this.raw('/rest/v1/laudo_partes?on_conflict=id,parte', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ id, parte: i, total, conteudo: json.slice(i * CHUNK, (i + 1) * CHUNK), atualizado: new Date().toISOString() })
        });
      }
      await this.raw('/rest/v1/laudo_partes?id=eq.' + encodeURIComponent(id) + '&parte=gte.' + total, { method: 'DELETE' });
      await this.raw('/rest/v1/laudos_meta?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          id,
          nome: obj.nome || obj.num_laudo || 'Sem número',
          status: obj.status || 'rascunho',
          atualizado: obj.atualizado || new Date().toISOString(),
          objeto: id + '.json'
        })
      });
      return { ok: true, id };
    },
    async handle(path, opts) {
      opts = opts || {};
      const method = (opts.method || 'GET').toUpperCase();
      let body = null;
      if (opts.body) {
        try { body = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body; }
        catch (e) { throw new Error('dados inválidos'); }
      }
      const u = new URL(path, location.origin);
      const p = u.pathname;

      if (p === '/api/health') return { ok: true, nuvem: true };

      const mSol = p.match(/^\/api\/solicitacoes\/([^/]+)$/);
      if (p === '/api/solicitacoes') {
        if (method === 'GET') {
          const rows = await this.select('solicitacoes_meta', 'select=token,criado_em,recebido_em,nome,contato,endereco,fotos,documentos,partes&order=recebido_em.desc');
          return {
            ok: true,
            solicitacoes: (rows || []).map(r => ({
              token: r.token, criado_em: r.criado_em, recebido_em: r.recebido_em,
              nome: r.nome, contato: r.contato, endereco: r.endereco,
              fotos: r.fotos, documentos: r.documentos, partes: r.partes
            }))
          };
        }
        throw new Error('método não suportado');
      }
      if (mSol) {
        const token = decodeURIComponent(mSol[1]);
        const cond = 'token=eq.' + encodeURIComponent(token);
        if (method === 'GET') {
          const parts = await this.select('solicitacao_partes', cond + '&select=parte,conteudo&order=parte.asc');
          const txt = (parts || []).map(x => x.conteudo).join('');
          if (!txt) throw new Error('solicitação sem dados');
          return { ok: true, solicitacao: JSON.parse(txt) };
        }
        if (method === 'DELETE') {
          await this.auth();
          await this.raw('/rest/v1/solicitacao_partes?' + cond, { method: 'DELETE' });
          await this.raw('/rest/v1/solicitacoes_meta?' + cond, { method: 'DELETE' });
          return { ok: true };
        }
      }

      const mLau = p.match(/^\/api\/laudos\/([^/]+)$/);
      if (p === '/api/laudos') {
        if (method === 'GET') {
          const rows = await this.select('laudos_meta', 'select=id,nome,status,atualizado&order=atualizado.desc.nullslast');
          return {
            ok: true,
            laudos: (rows || []).map(r => ({ id: r.id, nome: r.nome || 'Sem número', status: r.status || 'rascunho', atualizado: r.atualizado ? new Date(r.atualizado).toISOString() : '' }))
          };
        }
        if (method === 'PUT') {
          const id = safeToken((body && body.id) || '');
          return this.putLaudo(id, Object.assign({}, body, { id }));
        }
      }
      if (mLau) {
        const id = safeToken(decodeURIComponent(mLau[1]));
        if (method === 'GET') {
          const parts = await this.select('laudo_partes', 'id=eq.' + encodeURIComponent(id) + '&select=parte,conteudo&order=parte.asc');
          const txt = (parts || []).map(x => x.conteudo).join('');
          if (!txt) throw new Error('laudo não encontrado');
          return { ok: true, laudo: JSON.parse(txt) };
        }
        if (method === 'PUT') return this.putLaudo(id, Object.assign({}, body, { id }));
        if (method === 'DELETE') {
          await this.auth();
          await this.raw('/rest/v1/laudo_partes?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
          await this.raw('/rest/v1/laudos_meta?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
          return { ok: true };
        }
      }

      if (p === '/api/comparaveis') {
        await this.auth();
        if (method === 'GET') {
          const rows = await this.raw('/rest/v1/comparaveis?id=eq.1&select=lista');
          return { ok: true, comparaveis: (rows && rows[0] && Array.isArray(rows[0].lista)) ? rows[0].lista : [] };
        }
        if (method === 'PUT') {
          const arr = Array.isArray(body) ? body : (body && Array.isArray(body.comparaveis) ? body.comparaveis : null);
          if (!arr) throw new Error('lista inválida');
          await this.raw('/rest/v1/comparaveis?on_conflict=id', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify({ id: 1, lista: arr.slice(0, 5000), atualizado: new Date().toISOString() })
          });
          return { ok: true, total: arr.length };
        }
      }

      throw new Error('rota não encontrada');
    }
  };

  const Server = {
    mode: false,
    cloud: false,
    key: sessionStorage.getItem('laudo_admin_key') || '',
    headers() {
      if (this.cloud) return Cloud.headers();
      return { 'Content-Type': 'application/json', 'x-admin-key': this.key };
    },
    async init() {
      if (Cloud.enabled) {
        this.cloud = true;
        this.mode = true;
        Cloud.load();
        if (Cloud.session && Cloud.session.access_token) {
          try { await Cloud.auth(); this.key = 'cloud'; }
          catch (e) { Cloud.clear(); this.key = ''; }
        } else this.key = '';
        return true;
      }
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 2500);
        const r = await fetch('/api/health', { cache: 'no-store', signal: c.signal });
        clearTimeout(t);
        if (!r.ok) return false;
        this.mode = true;
        return true;
      } catch (e) { return false; }
    },
    async login(p) {
      if (this.cloud) {
        const email = String(Cloud.cfg.adminEmail || '').trim();
        if (!email) throw new Error('e-mail do painel não configurado em config.js');
        await Cloud.login(email, p);
        this.key = 'cloud'; this.mode = true;
        return true;
      }
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha: p }) });
      if (!r.ok) throw new Error('senha inválida');
      this.key = p; this.mode = true;
      sessionStorage.setItem('laudo_admin_key', p);
      return true;
    },
    async req(path, opts) {
      if (this.cloud) {
        try { return await Cloud.handle(path, opts); }
        catch (e) {
          if (e.status === 401) {
            this.key = '';
            updateAuthMenu();
            showLoginGate();
          }
          throw e;
        }
      }
      const r = await fetch(path, Object.assign({ cache: 'no-store', headers: this.headers() }, opts || {}));
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || ('HTTP ' + r.status));
      return j;
    }
  };

  // ===================== dynamic tables =====================
  function renumber() {
    $$('table.dyn').forEach(t => t.querySelectorAll('tbody tr').forEach((tr, i) => {
      const c = tr.querySelector('td.n'); if (c) c.textContent = i + 1;
      tr.querySelectorAll('[name]').forEach(el => el.name = el.name.replace(/\]\[\d+\]\[/, '][' + i + ']['));
    }));
  }
  function addRow(nm, silent) {
    const tb = $('table[data-name=' + nm + '] tbody');
    const tpl = $('#tpl-' + nm);
    if (!tb || !tpl) return null;
    tb.insertAdjacentHTML('beforeend', tpl.innerHTML.replace(/__I__/g, tb.children.length));
    renumber();
    if (!silent) tudo();
    return tb.lastElementChild;
  }
  function rowsOf(name) { return $$('table[data-name=' + name + '] tbody tr'); }
  function excludedSet() {
    const set = new Set();
    rowsOf('saneamento').forEach(tr => {
      const dado = parseInt(tr.querySelector('[data-k=dado]')?.value || '', 10);
      const ex = tr.querySelector('[data-k=excluir]')?.checked;
      if (dado > 0 && ex) set.add(dado);
    });
    return set;
  }

  // ===================== calculations =====================
  function calcAmostra() {
    const base = effectiveBase();
    rowsOf('amostra').forEach(tr => {
      const g = k => num(tr.querySelector('[data-k=' + k + ']'));
      const vu = tr.querySelector('[data-k=vu]');
      if (!vu) return;
      if (vu.dataset.manual === '1') return;
      const preco = g('preco'), at = g('at'), ac = g('ac');
      let area = NaN;
      if (base === 'construida') area = ac;
      else if (base === 'terreno') area = at;
      else area = at > 0 ? at : ac;
      vu.value = preco > 0 && area > 0 ? (preco / area).toFixed(2) : '';
    });
    const col = rowsOf('amostra').filter(tr => (tr.querySelector('[data-k=preco]')?.value || '') !== '' || (tr.querySelector('[data-k=vu]')?.value || '') !== '').length;
    S('st_n_col', col, 0);
  }

  function calcHomog() {
    const ex = excludedSet();
    const fat = N('fat_data');
    const fatOk = isFinite(fat) && fat > 0 ? fat : 1;
    const rows = [];
    rowsOf('homog').forEach((tr, idx) => {
      const i = idx + 1;
      const g = k => num(tr.querySelector('[data-k=' + k + ']'));
      const q = g('q'), out = tr.querySelector('[data-k=qh]');
      if (!out) return;
      if (!(q > 0)) {
        out.value = '';
        tr.classList.remove('row-excluida', 'row-outlier');
        return;
      }
      let p = q * fatOk;
      ['fo', 'fl', 'fa', 'fp', 'fc', 'ft'].forEach(k => { const f = g(k); if (isFinite(f)) p *= f; });
      out.value = p.toFixed(2);
      const excluded = ex.has(i);
      tr.classList.toggle('row-excluida', excluded);
      tr.classList.remove('row-outlier');
      rows.push({ i, tr, qh: p, excluded });
    });
    const used = rows.filter(r => !r.excluded);
    const n = used.length;
    S('st_n_uti', n, 0);
    S('st_n_excl', rows.filter(r => r.excluded).length, 0);
    if (!n) {
      ['st_media','st_s','st_cv','st_ic_min','st_ic_max','st_ca_min','st_ca_max','st_amp','st_grau','st_zcrit'].forEach(k => S(k, NaN));
      window.__homog = { rows, m: NaN, s: NaN, n: 0, zcrit: NaN, ampRaw: NaN };
      return;
    }
    const m = used.reduce((a, b) => a + b.qh, 0) / n;
    const s = n > 1 ? Math.sqrt(used.reduce((a, b) => a + (b.qh - m) ** 2, 0) / (n - 1)) : NaN;
    S('st_media', m); S('st_s', s); S('st_cv', isFinite(s) && m > 0 ? (s / m) * 100 : NaN);
    let icMin = NaN, icMax = NaN, ampRaw = NaN;
    if (n > 1) {
      const t = (n - 1) <= 30 ? T80[n - 2] : 1.282;
      const e = t * s / Math.sqrt(n);
      icMin = m - e; icMax = m + e;
      S('st_ic_min', icMin); S('st_ic_max', icMax);
      ampRaw = m > 0 ? ((icMax - icMin) / m) * 100 : NaN;
    } else {
      S('st_ic_min', NaN); S('st_ic_max', NaN);
    }
    S('st_ca_min', m * 0.85); S('st_ca_max', m * 1.15);
    S('st_amp', ampRaw, 1);
    const zcrit = n > 1 ? chauvenetZ(n) : NaN;
    S('st_zcrit', zcrit, 2);
    S('st_grau', NaN);
    if (F('st_grau')) F('st_grau').value = gradeFromAmp(ampRaw);
    if (n > 1 && s > 0) {
      used.forEach(r => {
        const z = (r.qh - m) / s;
        r.tr.dataset.z = z.toFixed(2);
        r.tr.classList.toggle('row-outlier', Math.abs(z) > zcrit);
      });
    }
    window.__homog = { rows, m, s, n, zcrit, ampRaw, icMin, icMax };
  }

  function detectChauvenet() {
    const h = window.__homog;
    if (!h || !(h.n > 1) || !(h.s > 0)) { alert('É necessário ter pelo menos 2 dados válidos com desvio-padrão maior que zero.'); return; }
    const existing = new Map();
    rowsOf('saneamento').forEach(tr => {
      const d = parseInt(tr.querySelector('[data-k=dado]')?.value || '', 10);
      if (d) existing.set(d, tr);
    });
    let added = 0;
    h.rows.forEach(r => {
      if (r.excluded || !(h.s > 0)) return;
      const z = (r.qh - h.m) / h.s;
      if (Math.abs(z) <= h.zcrit) return;
      let tr = existing.get(r.i);
      if (!tr) {
        tr = addRow('saneamento', true);
        if (!tr) return;
        tr.querySelector('[data-k=dado]').value = r.i;
        existing.set(r.i, tr);
      }
      tr.querySelector('[data-k=excluir]').checked = true;
      tr.querySelector('[data-k=criterio]').value = 'Chauvenet';
      tr.querySelector('[data-k=motivo]').value = '|z| = ' + z.toFixed(2) + ' > ' + h.zcrit.toFixed(2) + ' (n = ' + h.n + ')';
      added++;
    });
    renumber();
    tudo();
    alert(added ? added + ' dado(s) sinalizado(s) por Chauvenet. Revise as exclusões e as justificativas.' : 'Nenhum dado ultrapassou o critério de Chauvenet.');
  }

  function calcFactorGrade() {
    // item 2: n
    const nF = N('st_n_uti');
    if (F('f2') && F('f2').dataset.manual !== '1' && isFinite(nF) && nF > 0) {
      F('f2').value = String(nF >= 12 ? 3 : nF >= 5 ? 2 : nF >= 3 ? 1 : 0);
    }
    // item 4: factor product range
    const ex = excludedSet();
    const prods = [];
    rowsOf('homog').forEach((tr, idx) => {
      const q = num(tr.querySelector('[data-k=q]'));
      if (!(q > 0) || ex.has(idx + 1)) return;
      let p = 1;
      ['fo', 'fl', 'fa', 'fp', 'fc', 'ft'].forEach(k => { const v = num(tr.querySelector('[data-k=' + k + ']')); if (isFinite(v)) p *= v; });
      prods.push(p);
    });
    const min = prods.length ? Math.min(...prods) : NaN;
    const max = prods.length ? Math.max(...prods) : NaN;
    let sug = 0;
    if (prods.length) {
      if (min >= 0.8 && max <= 1.25) sug = 3;
      else if (min >= 0.5 && max <= 2) sug = 2;
      else if (min >= 0.4 && max <= 2.5) sug = 1;
    }
    if (F('f4') && F('f4').dataset.manual !== '1' && prods.length) F('f4').value = String(sug);
    window.__factor = { prods, min, max, sug };
    const f = [1, 2, 3, 4].map(i => parseInt((F('f' + i) || {}).value || '', 10));
    if (f.every(x => !isNaN(x))) {
      const pts = f.reduce((x, y) => x + y, 0), minF = Math.min(...f), m24 = Math.min(f[1], f[3]), others = [f[0], f[2]];
      let g = 'Sem enquadramento';
      if (pts >= 10 && m24 === 3 && Math.min(...others) >= 2) g = 'III';
      else if (pts >= 6 && m24 >= 2 && Math.min(...others) >= 1) g = 'II';
      else if (pts >= 4 && minF >= 1) g = 'I';
      if (F('f_grau')) F('f_grau').value = g;
      if (F('f_pts')) F('f_pts').value = String(pts);
    } else {
      if (F('f_grau')) F('f_grau').value = '';
      if (F('f_pts')) F('f_pts').value = '';
    }
  }

  function calcExtrap() {
    const rows = [];
    rowsOf('extrap').forEach(tr => {
      const g = k => num(tr.querySelector('[data-k=' + k + ']'));
      const subj = g('subj'), min = g('min'), max = g('max'), vSubj = g('v_subj'), vFront = g('v_front');
      const outDev = tr.querySelector('[data-k=desvio]'), outSit = tr.querySelector('[data-k=situacao]');
      let fora = false, medidaOk = false, desvio = NaN, sit = '';
      if (isFinite(subj) && isFinite(min) && isFinite(max)) {
        fora = subj < min || subj > max;
        medidaOk = !fora || (subj <= 2 * max && subj >= 0.5 * min);
        if (fora && isFinite(vSubj) && isFinite(vFront) && vFront !== 0) desvio = Math.abs(vSubj - vFront) / Math.abs(vFront) * 100;
        if (!fora) sit = 'Interpolação';
        else if (!medidaOk) sit = 'Extrapolação inválida (medida)';
        else if (!isFinite(desvio)) sit = 'Informar valores na fronteira';
        else if (desvio <= 15) sit = 'Admissível — Grau II';
        else if (desvio <= 20) sit = 'Admissível — Grau I';
        else sit = 'Não admissível';
      }
      if (outDev) outDev.value = isFinite(desvio) ? desvio.toFixed(1) : '';
      if (outSit) outSit.value = sit;
      rows.push({ subj, min, max, vSubj, vFront, fora, medidaOk, desvio, sit });
    });
    const foraRows = rows.filter(r => r.fora);
    let item = 3;
    if (foraRows.length) {
      const one = foraRows.length === 1;
      const allMed = foraRows.every(r => r.medidaOk);
      const devs = foraRows.map(r => r.desvio);
      if (!allMed) item = 0;
      else if (one && isFinite(devs[0]) && devs[0] <= 15) item = 2;
      else if (one && isFinite(devs[0]) && devs[0] <= 20) item = 1;
      else if (!one && devs.every(d => isFinite(d) && d <= 20)) item = 1;
      else item = 0;
    }
    const sel = F('rg_extrap_grau');
    if (sel && sel.dataset.manual !== '1') sel.value = String(item);
    window.__extrap = { item, foraCount: foraRows.length, rows };
  }

  function calcMicro() {
    const n = N('rg_n') || N('ig_n') || N('st_n_uti');
    let fails = 0;
    rowsOf('micro').forEach(tr => {
      const ni = num(tr.querySelector('[data-k=ni]'));
      const outMin = tr.querySelector('[data-k=min]'), outSit = tr.querySelector('[data-k=situacao]');
      let min = NaN;
      if (isFinite(n)) min = n <= 30 ? 3 : n <= 100 ? Math.ceil(0.10 * n) : 10;
      if (outMin) outMin.value = isFinite(min) ? String(min) : '';
      if (outSit) {
        if (!isFinite(ni) || !isFinite(min)) outSit.value = '';
        else { outSit.value = ni >= min ? 'OK' : 'Micronumerosidade'; if (ni < min) fails++; }
      }
    });
    window.__micro = { n, fails };
  }

  function calcRegressionGrade() {
    const n = N('rg_n') || N('ig_n') || N('st_n_uti');
    const k = N('k_vars');
    if (F('rg2') && F('rg2').dataset.manual !== '1' && isFinite(n) && n > 0 && isFinite(k)) {
      const q = k + 1;
      F('rg2').value = String(n >= 6 * q ? 3 : n >= 4 * q ? 2 : n >= 3 * q ? 1 : 0);
    }
    const pt = N('rg_p_t');
    if (F('rg5') && F('rg5').dataset.manual !== '1' && isFinite(pt)) F('rg5').value = String(pt <= 10 ? 3 : pt <= 20 ? 2 : pt <= 30 ? 1 : 0);
    const pf = N('rg_p_f');
    if (F('rg6') && F('rg6').dataset.manual !== '1' && isFinite(pf)) F('rg6').value = String(pf <= 1 ? 3 : pf <= 2 ? 2 : pf <= 5 ? 1 : 0);
    if (F('rg4') && F('rg4').dataset.manual !== '1' && F('rg_extrap_grau') && F('rg_extrap_grau').value !== '') F('rg4').value = F('rg_extrap_grau').value;
    const rg = [1, 2, 3, 4, 5, 6].map(i => parseInt((F('rg' + i) || {}).value || '', 10));
    if (rg.every(x => !isNaN(x))) {
      const pts = rg.reduce((a, b) => a + b, 0);
      const mand = [rg[1], rg[3], rg[4], rg[5]];
      const others = [rg[0], rg[2]];
      const prOk = ['pr1', 'pr2', 'pr3', 'pr4'].every(nm => F(nm) && F(nm).checked);
      let g = 'Sem enquadramento';
      if (pts >= 16 && mand.every(x => x === 3) && others.every(x => x >= 2) && prOk) g = 'III';
      else if (pts >= 10 && mand.every(x => x >= 2) && others.every(x => x >= 1)) g = 'II';
      else if (pts >= 6 && rg.every(x => x >= 1)) g = 'I';
      if (F('rg_grau')) F('rg_grau').value = g;
      if (F('rg_pts')) F('rg_pts').value = String(pts);
    } else {
      if (F('rg_grau')) F('rg_grau').value = '';
      if (F('rg_pts')) F('rg_pts').value = '';
    }
  }

  function rossCalc() {
    const vr = N('rh_vr'), age = N('rh_idade'), life = N('rh_vida');
    const state = parseFloat((F('rh_estado') || {}).value);
    const c = HEIDECKE[state];
    if (!isFinite(vr) || !isFinite(age) || !isFinite(life) || life <= 0 || c === undefined) return null;
    const x = age / life;
    const xc = clamp(x, 0, 1);
    const alpha = 0.5 * (xc + xc * xc);
    const kd = alpha + c * (1 - alpha);
    const dep = vr * (1 - kd);
    return { c, x, xc, alpha, kd, dep, clamped: x > 1 };
  }
  function calcRoss() {
    const r = rossCalc();
    if (!r) {
      ['rh_c','rh_x','rh_alpha','rh_kd','rh_dep'].forEach(k => { const e = F(k); if (e) e.value = ''; });
      window.__ross = null;
      return;
    }
    if (F('rh_c')) F('rh_c').value = r.c.toFixed(4);
    if (F('rh_x')) F('rh_x').value = (r.x * 100).toFixed(2) + ' %' + (r.clamped ? ' (limitado a 100%)' : '');
    if (F('rh_alpha')) F('rh_alpha').value = (r.alpha * 100).toFixed(2) + ' %';
    if (F('rh_kd')) F('rh_kd').value = (r.kd * 100).toFixed(2) + ' %';
    if (F('rh_dep')) F('rh_dep').value = fmtBRL(r.dep);
    window.__ross = r;
  }

  function calcAdm() {
    const trat = checkedVal('tratamento') || 'fatores';
    const q = N('c_q'), ar = N('c_a'), ben = N('c_b');
    const total = isFinite(q) && isFinite(ar) ? q * ar + (isFinite(ben) ? ben : 0) : NaN;
    S('c_total', total);

    let cen = NaN, icMin = NaN, icMax = NaN, caMin = NaN, caMax = NaN;
    if (trat === 'estatistico') {
      const cen0 = N('r_cen');
      const desc = clamp(isFinite(N('desc_oferta')) ? N('desc_oferta') : 0, 0, 15) / 100;
      if (isFinite(cen0)) {
        cen = cen0 * (1 - desc);
        icMin = N('r_inf') * (1 - desc);
        icMax = N('r_sup') * (1 - desc);
        caMin = cen0 * 0.85;
        caMax = cen0 * 1.15;
      }
    } else {
      const media = N('st_media');
      const ben2 = isFinite(ben) ? ben : 0;
      if (isFinite(media) && isFinite(ar)) {
        cen = media * ar + ben2;
        icMin = N('st_ic_min') * ar + ben2;
        icMax = N('st_ic_max') * ar + ben2;
        caMin = cen * 0.85;
        caMax = cen * 1.15;
      } else if (isFinite(total)) {
        cen = total;
        caMin = cen * 0.85;
        caMax = cen * 1.15;
      }
    }

    const admMin = Math.max(icMin, caMin);
    const admMax = Math.min(icMax, caMax);
    if (F('adm_cen')) F('adm_cen').value = fmtBRL(cen);
    if (F('adm_ic_min')) F('adm_ic_min').value = fmtBRL(icMin);
    if (F('adm_ic_max')) F('adm_ic_max').value = fmtBRL(icMax);
    if (F('adm_ca_min')) F('adm_ca_min').value = fmtBRL(caMin);
    if (F('adm_ca_max')) F('adm_ca_max').value = fmtBRL(caMax);
    if (F('adm_min')) F('adm_min').value = fmtBRL(admMin);
    if (F('adm_max')) F('adm_max').value = fmtBRL(admMax);

    const rnEl = F('res_num');
    if (rnEl && rnEl.dataset.manual !== '1' && isFinite(cen)) rnEl.value = cen.toFixed(2);
    const setAuto = (n, v, d = 2) => {
      const e = F(n); if (!e || e.dataset.manual === '1') return;
      e.value = isFinite(v) ? (+v).toFixed(d) : '';
    };
    setAuto('v_cen', cen);
    setAuto('v_min', admMin);
    setAuto('v_max', admMax);
    setAuto('v_unit', isFinite(cen) && isFinite(ar) && ar > 0 ? cen / ar : NaN);
    const va = F('v_adotado');
    if (va) va.value = (F('res_num') || {}).value || '';

    const adot = N('res_num');
    if (F('adm_ok')) {
      if (isFinite(adot) && isFinite(admMin) && isFinite(admMax)) {
        const inside = adot >= admMin - 0.01 && adot <= admMax + 0.01;
        F('adm_ok').value = inside ? 'Dentro do intervalo' : 'FORA do intervalo — revisar';
      } else F('adm_ok').value = '—';
    }

    // precision from the ORIGINAL 80% CI, never the field of arbitration
    const rAmpRaw = (() => {
      const inf = N('r_inf'), sup = N('r_sup'), c = N('r_cen');
      return isFinite(inf) && isFinite(sup) && isFinite(c) && c > 0 && sup >= inf ? ((sup - inf) / c) * 100 : NaN;
    })();
    S('r_amp', rAmpRaw, 1);
    const ampRaw = trat === 'estatistico' ? rAmpRaw : (window.__homog ? window.__homog.ampRaw : NaN);
    S('p_amp', ampRaw, 1);
    if (F('p_grau')) F('p_grau').value = gradeFromAmp(ampRaw);
    const pf = $('#p_fonte');
    if (pf) pf.textContent = isFinite(ampRaw) ? (trat === 'estatistico' ? '(IC 80% da regressão, original)' : '(IC 80% da média dos qh)') : '';

    const rn = N('res_num');
    const rf = $('#res_fmt');
    if (rf) rf.textContent = isFinite(rn) ? fmtNum(rn, 2) : '';
    window.__adm = { cen, icMin, icMax, caMin, caMax, admMin, admMax, ampRaw, trat };
  }

  const un = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const dz = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  const ct = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
  function a999(n) {
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100), r = n % 100, p = [];
    if (c) p.push(ct[c]);
    if (r) { if (r < 20) p.push(un[r]); else { const d = Math.floor(r / 10), u = r % 10; p.push(dz[d] + (u ? ' e ' + un[u] : '')); } }
    return p.join(' e ');
  }
  function milhar(n) {
    const parts = [];
    [[1e9, 'bilhão', 'bilhões'], [1e6, 'milhão', 'milhões'], [1e3, 'mil', 'mil']].forEach(([b, s, p]) => {
      const q = Math.floor(n / b);
      if (q) { parts.push(b === 1e3 && q === 1 ? 'mil' : a999(q) + ' ' + (q === 1 ? s : p)); n %= b; }
    });
    if (n) parts.push(a999(n));
    return parts.join(' e ');
  }
  function extenso(v) {
    const t = Math.round(v * 100), r = Math.floor(t / 100), c = t % 100;
    if (!r && !c) return '';
    let o = '';
    if (r) {
      const last = r % 1000;
      const singular = r === 1 || (r >= 1e6 && r % 1e6 === 1) || (r >= 1e3 && last === 1);
      o = milhar(r) + (singular ? ' real' : (r >= 1e6 && r % 1e6 === 0 ? ' de reais' : ' reais'));
    }
    if (c) o += (r ? ' e ' : '') + milhar(c) + (c === 1 ? ' centavo' : ' centavos');
    return o;
  }

  function calcGerais() {
    const k = N('k_vars');
    [[3, 6], [2, 4], [1, 3]].forEach(([g, m]) => { const e = $('#kmin' + g); if (e) e.textContent = isFinite(k) ? 'n ≥ ' + m * (k + 1) : '—'; });
    calcAdm();
    const trat = checkedVal('tratamento') || 'fatores';
    const grade = trat === 'estatistico' ? (F('rg_grau') || {}).value : (F('f_grau') || {}).value;
    if (F('e_fund') && F('e_fund').dataset.manual !== '1') F('e_fund').value = grade || '';
    if (F('e_prec') && F('e_prec').dataset.manual !== '1') F('e_prec').value = (F('p_grau') || {}).value || '';
    const rn = N('res_num');
    const re = F('res_ext');
    if (re && re.dataset.manual !== '1') re.value = isFinite(rn) ? extenso(rn) : '';
    // print date spans
    [['data_emissao','data_emissao_fmt'],['data_vistoria','data_vistoria_fmt'],['vist_data','vist_data_fmt'],['enc_data','enc_data_fmt'],['data_ref_date','data_ref_fmt']].forEach(([a,b]) => {
      const src = F(a), dst = document.getElementById(b);
      if (src && dst) dst.textContent = src.value ? ' ' + fmtDate(src.value) : '';
    });
    renderConferencia();
    renderMemoria();
    if (typeof syncResumo === 'function') syncResumo();
  }

  function renderConferencia() {
    const el = $('#conferencia'); if (!el) return;
    const err = [], warn = [], ok = [];
    const val = n => { const e = F(n); return e ? String(e.value || '').trim() : ''; };
    const req = (n, label) => { if (!val(n)) err.push(label); };
    req('num_laudo', 'Número/referência do laudo');
    req('solicitante', 'Solicitante');
    req('end', 'Endereço do imóvel');
    if (!val('data_base') && !val('data_ref_date')) err.push('Data de referência (data-base)');
    req('data_vistoria', 'Data da vistoria');
    req('data_emissao', 'Data de emissão');
    req('c_a', 'Área considerada');
    req('c_q', 'Valor unitário adotado');
    req('res_num', 'Valor final');
    const trat = checkedVal('tratamento') || '';
    if (!trat) err.push('Tratamento adotado (fatores ou regressão)');
    const grauSel = trat === 'estatistico' ? val('rg_grau') : val('f_grau');
    if (!grauSel) err.push('Grau de fundamentação não calculado');
    if (grauSel === 'Sem enquadramento') err.push('Grau de fundamentação sem enquadramento');
    if (!val('p_grau')) err.push('Grau de precisão não calculado');
    if (val('p_grau') === 'Sem enquadramento') err.push('Grau de precisão sem enquadramento');
    if (!val('documentos')) warn.push('Documentação utilizada não informada');
    if (!val('ass_art')) warn.push('ART/RRT não informada');
    if (!val('ass_cpf')) warn.push('CPF do responsável técnico não informado');

    const n = N('st_n_uti');
    if (isFinite(n) && n < 3) err.push('Amostra insuficiente: n = ' + n + ' (mínimo 3 no grau I)');
    if (window.__homog && window.__homog.s === 0) warn.push('Desvio-padrão zero: verificar a variabilidade da amostra');

    if (trat === 'fatores') {
      const f2 = parseInt((F('f2') || {}).value || '', 10);
      if (f2 === 3 && n < 12) err.push('Item 2: grau III exige n ≥ 12 (n atual = ' + n + ')');
      if (f2 === 2 && n < 5) err.push('Item 2: grau II exige n ≥ 5 (n atual = ' + n + ')');
      if (f2 === 1 && n < 3) err.push('Item 2: grau I exige n ≥ 3 (n atual = ' + n + ')');
      const f4 = parseInt((F('f4') || {}).value || '', 10);
      const fx = window.__factor;
      if (fx) {
        if (fx.min < 0.4 || fx.max > 2.5) err.push('Fator(es) fora do intervalo admissível mínimo (0,40 a 2,50): ' + fmtNum(fx.min, 2) + ' a ' + fmtNum(fx.max, 2));
        else if (f4 === 3 && (fx.min < 0.8 || fx.max > 1.25)) err.push('Item 4: grau III exige fatores entre 0,80 e 1,25 (atual ' + fmtNum(fx.min, 2) + ' a ' + fmtNum(fx.max, 2) + ')');
        else if (f4 === 2 && (fx.min < 0.5 || fx.max > 2)) err.push('Item 4: grau II exige fatores entre 0,50 e 2,00 (atual ' + fmtNum(fx.min, 2) + ' a ' + fmtNum(fx.max, 2) + ')');
      }
      const media = N('st_media'), qAdot = N('c_q');
      if (isFinite(media) && isFinite(qAdot) && media > 0) {
        const dif = Math.abs(qAdot - media) / media * 100;
        if (dif > 15) err.push('Valor unitário adotado difere da média em ' + fmtNum(dif, 1) + '% (campo de arbítrio ±15%)');
      }
    }

    if (trat === 'estatistico') {
      if (!val('rg_grau')) err.push('Grau de fundamentação da regressão não calculado');
      if (val('rg_grau') === 'III') {
        const prOk = ['pr1', 'pr2', 'pr3', 'pr4'].every(nm => F(nm) && F(nm).checked);
        if (!prOk) err.push('Grau III exige os 4 pré-requisitos do item 9.2.1.1');
      }
      if (!val('rg_p_t') || !val('rg_p_f')) warn.push('Informe os p-valores dos regressores e do teste F para o enquadramento');
      if (window.__extrap && window.__extrap.foraCount > 0) {
        const rg4 = parseInt((F('rg4') || {}).value || '', 10);
        if (rg4 === 3) err.push('Extrapolação presente: o item 4 não pode ser grau III');
        window.__extrap.rows.filter(r => r.fora).forEach(r => {
          if (r.sit === 'Não admissível' || r.sit === 'Extrapolação inválida (medida)' || r.sit === 'Informar valores na fronteira') warn.push('Extrapolação: ' + (r.sit || 'verificar') + ' (variável com valor ' + fmtNum(r.subj, 2) + ')');
        });
      }
      if (window.__micro && window.__micro.fails > 0) warn.push('Micronumerosidade em ' + window.__micro.fails + ' categoria(s)');
    }

    const pa = N('p_amp');
    if (!isFinite(pa)) warn.push('Amplitude de precisão não calculada');
    else if (pa < 0) err.push('Amplitude de precisão negativa: verifique os limites do IC');
    else if (pa > 50) err.push('Amplitude de precisão acima de 50%: sem enquadramento');
    if (window.__adm && isFinite(window.__adm.admMin) && isFinite(window.__adm.admMax)) {
      const adot = N('res_num');
      if (isFinite(adot) && (adot < window.__adm.admMin - 0.01 || adot > window.__adm.admMax + 0.01)) err.push('Valor final fora do intervalo admissível (' + fmtBRL(window.__adm.admMin) + ' a ' + fmtBRL(window.__adm.admMax) + ')');
    } else warn.push('Intervalo admissível não calculado (verifique IC, área e valor central)');

    const total = N('c_total'), adot = N('res_num');
    if (isFinite(total) && isFinite(adot) && adot > 0 && Math.abs(total - adot) / adot > 0.01) warn.push('Valor final difere do valor total calculado em mais de 1%');
    if (isFinite(N('v_min')) && isFinite(N('v_cen')) && isFinite(N('v_max')) && !(N('v_min') <= N('v_cen') && N('v_cen') <= N('v_max'))) err.push('Ordem inválida: mínimo ≤ central ≤ máximo');

    if (val('data_vistoria') && val('data_emissao') && val('data_emissao') < val('data_vistoria')) warn.push('Data de emissão anterior à data da vistoria');
    const fd = N('fat_data');
    if (isFinite(fd) && Math.abs(fd - 1) > 1e-9 && !val('indice')) warn.push('Fator de atualização diferente de 1 sem índice informado');
    const desc = N('desc_oferta');
    if (isFinite(desc) && (desc < 0 || desc > 15)) err.push('Desconto de oferta fora de 0 a 15%');

    const base = (F('base_vu') || {}).value;
    if (base === 'auto' && N('area_terreno_num') > 0 && N('area_constr_num') > 0) warn.push('Base automática do VU usa o terreno; se o imóvel é construído, selecione "área construída"');
    if (N('area_constr_num') > N('area_terreno_num') && N('area_terreno_num') > 0) warn.push('Área construída maior que a do terreno: conferir (pode ser unidade autônoma)');

    // sample dates vs reference
    const ref = val('data_ref_date');
    if (/^\d{4}-\d{2}-\d{2}$/.test(ref) && (!isFinite(fd) || Math.abs(fd - 1) < 1e-9)) {
      const refDate = new Date(ref + 'T12:00:00');
      rowsOf('amostra').forEach(tr => {
        const d = tr.querySelector('[data-k=data]')?.value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return;
        const dt = new Date(d + 'T12:00:00');
        const months = (refDate - dt) / (1000 * 60 * 60 * 24 * 30.44);
        if (months > 12) warn.push('Comparável com data ' + fmtDate(d) + ' há mais de 12 meses da data de referência, sem fator de atualização');
      });
    }

    if (!err.length) ok.push('Nenhum impedimento normativo identificado');
    let html = '<h4>Conferência do laudo</h4>';
    if (err.length) html += '<p><span class="badge err">' + err.length + ' impedimento(s)</span></p><ul>' + err.map(x => '<li class="e">' + esc(x) + '</li>').join('') + '</ul>';
    if (warn.length) html += '<p><span class="badge warn">' + warn.length + ' alerta(s)</span></p><ul>' + warn.map(x => '<li class="w">' + esc(x) + '</li>').join('') + '</ul>';
    if (ok.length) html += '<p><span class="badge ok">OK</span> ' + esc(ok.join(' · ')) + '</p>';
    el.innerHTML = html;
  }

  function renderMemoria() {
    const el = $('#memoria-print'); if (!el) return;
    const h = window.__homog || {}, a = window.__adm || {}, f = window.__factor || {}, x = window.__extrap || {}, mi = window.__micro || {}, r = window.__ross;
    const trat = checkedVal('tratamento') === 'estatistico' ? 'Regressão linear' : 'Tratamento por fatores';
    const lines = [];
    const row = (k, v) => lines.push('<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>');
    row('Data de referência', (F('data_ref_date') || {}).value ? fmtDate(F('data_ref_date').value) : valOf('data_base'));
    row('Tratamento', trat);
    row('Dados coletados / utilizados / excluídos', (valOf('st_n_col') || '—') + ' / ' + (isFinite(h.n) ? h.n : '—') + ' / ' + (valOf('st_n_excl') || '—'));
    if (trat === 'Tratamento por fatores') {
      row('Média dos qh (R$/m²)', fmtNum(h.m, 2));
      row('Desvio-padrão (R$/m²)', fmtNum(h.s, 2));
      row('IC 80% (R$/m²)', fmtNum(h.icMin, 2) + ' a ' + fmtNum(h.icMax, 2));
      row('Campo de arbítrio (R$/m²)', fmtNum(h.m * 0.85, 2) + ' a ' + fmtNum(h.m * 1.15, 2));
      if (isFinite(f.min)) row('Produto dos fatores (mín. a máx.)', fmtNum(f.min, 2) + ' a ' + fmtNum(f.max, 2));
    }
    row('Valor central calculado', fmtBRL(a.cen));
    row('IC 80% do valor', fmtBRL(a.icMin) + ' a ' + fmtBRL(a.icMax));
    row('Campo de arbítrio do valor', fmtBRL(a.caMin) + ' a ' + fmtBRL(a.caMax));
    row('Intervalo admissível (interseção)', fmtBRL(a.admMin) + ' a ' + fmtBRL(a.admMax));
    row('Amplitude de precisão (IC original)', isFinite(a.ampRaw) ? fmtNum(a.ampRaw, 1) + '%' : '—');
    row('Valor adotado', fmtBRL(N('res_num')));
    row('Grau de fundamentação / precisão', (valOf('e_fund') || '—') + ' / ' + (valOf('e_prec') || '—'));
    if (trat === 'Regressão linear') {
      row('n / k', (valOf('rg_n') || '—') + ' / ' + (valOf('k_vars') || '—'));
      row('Pior p-valor t / p-valor F', (valOf('rg_p_t') || '—') + '% / ' + (valOf('rg_p_f') || '—') + '%');
      row('Extrapolação', x.foraCount ? x.foraCount + ' variável(is) — item ' + x.item : 'Não');
      row('Micronumerosidade', mi.fails ? mi.fails + ' categoria(s)' : 'Não identificada');
    }
    if (r) {
      row('Ross-Heidecke (x / α / Kd)', fmtNum(r.x * 100, 2) + '% / ' + fmtNum(r.alpha * 100, 2) + '% / ' + fmtNum(r.kd * 100, 2) + '%');
      row('Valor depreciado da edificação', fmtBRL(r.dep));
    }
    el.innerHTML = '<h3>Memória de cálculo</h3><table class="t"><tbody>' + lines.join('') + '</tbody></table><p class="ajuda">Resumo gerado automaticamente. A memória completa inclui as tabelas 7.2, 7.3 e 7.4.</p>';
  }
  function valOf(n) { const e = F(n); return e ? String(e.value || '').trim() : ''; }

  function tudo() {
    calcAmostra();
    calcHomog();
    calcExtrap();
    calcMicro();
    calcFactorGrade();
    calcRegressionGrade();
    calcRoss();
    calcGerais();
  }

  // ===================== shell / layout =====================
  function setServerStatus(online) {
    const el = document.getElementById('side-server');
    if (!el) return;
    el.textContent = online ? (Server.cloud ? 'Nuvem conectada' : 'Servidor conectado') : (Server.cloud ? 'Nuvem — entre para sincronizar' : 'Modo local');
    el.classList.toggle('on', !!online);
  }
  function syncResumo() {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    const adm = window.__adm || {};
    const res = N('res_num');
    set('sum-res', isFinite(res) ? fmtBRL(res) : '—');
    set('sum-cen', fmtBRL(adm.cen));
    set('sum-prec', (F('p_grau') || {}).value || '—');
    set('sum-fund', (F('e_fund') || {}).value || '—');
    const errs = document.querySelectorAll('#conferencia .e').length;
    const warns = document.querySelectorAll('#conferencia .w').length;
    set('sum-conf', errs ? errs + ' impedimento(s)' : warns ? warns + ' alerta(s)' : 'OK');
    const ce = document.getElementById('sum-conf');
    if (ce) ce.style.color = errs ? '#fca5a5' : warns ? '#fcd34d' : '#86efac';
    const st = (document.querySelector('#status') || {}).value === 'final' ? 'Final' : 'Rascunho';
    set('sum-status', st);
    set('hero-status', st);
    const n = N('st_n_uti');
    set('sum-n', isFinite(n) ? String(n) : '—');
  }
  function buildShell() {
    document.body.classList.add('eng');
    document.documentElement.style.scrollBehavior = 'smooth';
    const form = $('#laudo');
    const barra = $('.barra'), aviso = $('#aviso'), folha = $('.folha');
    if (!form || !barra || !folha || $('.app')) return;
    const app = document.createElement('div'); app.className = 'app';
    const sidebar = document.createElement('aside'); sidebar.className = 'sidebar';
    sidebar.innerHTML = `
      <div class="brand">
        <div class="mark"><img src="logo.png" alt="Kathleen Goulart"></div>
        <div><div class="name">Kathleen Goulart</div><div class="sub">Engenharia de Avaliações</div></div>
      </div>
      <select class="nav-mobile" id="nav-mobile" aria-label="Ir para seção">
        <option value="">Ir para seção…</option>
        <option value="sec-1">1. Identificação</option><option value="sec-2">2. Imóvel</option><option value="sec-3">3. Vistoria</option><option value="sec-4">4. Região</option><option value="sec-5">5. Mercado</option><option value="sec-6">6. Metodologia</option><option value="sec-7">7. Tratamento</option><option value="sec-8">8. Graus</option><option value="sec-9">9. Resultado</option><option value="sec-10">10. Encerramento</option><option value="sec-11">Anexo A</option>
      </select>
      <nav class="nav" id="nav-secoes">
        <a href="#sec-1">1. Identificação</a>
        <a href="#sec-2">2. Imóvel</a>
        <a href="#sec-3">3. Vistoria</a>
        <a href="#sec-4">4. Região</a>
        <a href="#sec-5">5. Mercado</a>
        <a href="#sec-6">6. Metodologia</a>
        <a href="#sec-7">7. Tratamento</a>
        <a href="#sec-8">8. Graus</a>
        <a href="#sec-9">9. Resultado</a>
        <a href="#sec-10">10. Encerramento</a>
        <a href="#sec-11">Anexo A</a>
      </nav>
      <div class="side-card">
        <div class="sum-label">Valor final</div>
        <div class="sum-value" id="sum-res">—</div>
        <div class="sum-row"><span>Central</span><b id="sum-cen">—</b></div>
        <div class="sum-row"><span>Precisão</span><b id="sum-prec">—</b></div>
        <div class="sum-row"><span>Fundamentação</span><b id="sum-fund">—</b></div>
        <div class="sum-row"><span>Amostra</span><b id="sum-n">—</b></div>
        <div class="sum-row"><span>Conferência</span><b id="sum-conf">—</b></div>
      </div>
      <div class="side-status" id="side-server">Modo local</div>
      <div class="foot">NBR 14653-1:2019<br>NBR 14653-2:2011<br>Uso profissional</div>`;
    sidebar.querySelectorAll('#nav-secoes a').forEach(a => {
      const m = a.textContent.trim().match(/^(\d+)\.\s*(.*)$/);
      if (m) a.innerHTML = '<span class="nav-num">' + m[1] + '</span><span>' + m[2] + '</span>';
    });
    const main = document.createElement('div'); main.className = 'main';
    form.insertBefore(app, form.firstChild);
    app.appendChild(sidebar);
    app.appendChild(main);

    // ações secundárias em menu
    const more = document.createElement('div');
    more.className = 'more-panel'; more.id = 'more-panel';
    const moreBtn = document.createElement('button');
    moreBtn.type = 'button'; moreBtn.id = 'b-mais'; moreBtn.textContent = '⋯ Mais';
    ['b-import-cli', 'b-online-sol', 'b-sync', 'b-json', 'b-backup', 'b-import', 'b-csv', 'b-csv-amostra', 'b-del'].forEach(id => {
      const el = document.getElementById(id); if (el) more.appendChild(el);
    });
    const loginBtn = document.createElement('button');
    loginBtn.type = 'button'; loginBtn.id = 'b-login'; loginBtn.textContent = 'Entrar na nuvem';
    const senhaBtn = document.createElement('button');
    senhaBtn.type = 'button'; senhaBtn.id = 'b-senha'; senhaBtn.textContent = 'Alterar senha';
    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button'; logoutBtn.id = 'b-logout'; logoutBtn.textContent = 'Sair da nuvem';
    more.appendChild(loginBtn);
    more.appendChild(senhaBtn);
    more.appendChild(logoutBtn);
    const linkBtn = document.getElementById('b-link');
    if (linkBtn && linkBtn.parentNode) {
      linkBtn.parentNode.insertBefore(moreBtn, linkBtn.nextSibling);
      linkBtn.parentNode.insertBefore(more, moreBtn.nextSibling);
      moreBtn.addEventListener('click', e => { e.stopPropagation(); more.classList.toggle('open'); });
      document.addEventListener('click', e => { if (!more.contains(e.target) && e.target !== moreBtn) more.classList.remove('open'); });
    }

    // barra de contexto (laudo / status / mensagem)
    const context = document.createElement('div'); context.className = 'context-bar';
    const selWrap = document.createElement('label'); selWrap.className = 'ctx-field';
    selWrap.innerHTML = '<span>Laudo</span>';
    const selEl = document.getElementById('sel-laudo');
    if (selEl) selWrap.appendChild(selEl);
    context.appendChild(selWrap);
    const statusEl = document.getElementById('status');
    const statusLabel = statusEl ? statusEl.closest('label') : null;
    if (statusLabel && statusEl) {
      statusLabel.className = 'ctx-field';
      statusLabel.textContent = '';
      const stSpan = document.createElement('span');
      stSpan.textContent = 'Status';
      statusLabel.appendChild(stSpan);
      statusLabel.appendChild(statusEl);
      context.appendChild(statusLabel);
    }
    const msgEl = document.getElementById('msg');
    if (msgEl) { msgEl.className = 'msg'; context.appendChild(msgEl); }

    // topbar
    const topbar = document.createElement('header'); topbar.className = 'topbar';
    const topLeft = document.createElement('div'); topLeft.className = 'topbar-left';
    topLeft.innerHTML = '<span class="topbar-kicker">Painel do engenheiro</span><div class="topbar-title">Laudo de Avaliação</div>';
    topbar.appendChild(topLeft);
    barra.className = 'topbar-actions';
    topbar.appendChild(barra);
    main.appendChild(topbar);
    main.appendChild(context);
    if (aviso) main.appendChild(aviso);
    main.appendChild(folha);

    // hero
    const h1 = folha.querySelector(':scope > h1');
    if (h1) {
      const hero = document.createElement('div'); hero.className = 'hero';
      h1.parentNode.insertBefore(hero, h1); hero.appendChild(h1);
      const meta = document.createElement('div'); meta.className = 'hero-meta';
      meta.innerHTML = '<span class="chip">NBR 14653</span><span class="chip">Comparativo direto</span><span class="chip">Engenharia de avaliações</span><span class="chip" id="hero-status">Rascunho</span>';
      hero.appendChild(meta);
      const logo = document.createElement('img');
      logo.src = 'logo.png'; logo.alt = 'Kathleen Goulart'; logo.className = 'hero-logo';
      hero.appendChild(logo);
    }

    // cards por seção
    const hs = [...folha.querySelectorAll(':scope > h2')];
    hs.forEach((h, i) => {
      const m = h.textContent.trim().match(/^(\d+\.)\s*(.*)$/);
      if (m) h.innerHTML = '<span class="sec-num">' + m[1].replace('.', '') + '</span><span class="sec-title" data-num="' + m[1] + '">' + esc(m[2]) + '</span>';
      const sec = document.createElement('section');
      sec.className = 'card'; sec.id = 'sec-' + (i + 1);
      h.parentNode.insertBefore(sec, h);
      let n = h.nextSibling;
      sec.appendChild(h);
      while (n && !(n.nodeType === 1 && n.tagName === 'H2')) {
        const next = n.nextSibling; sec.appendChild(n); n = next;
      }
    });

    // nav ativo
    const secs = [...document.querySelectorAll('.card[id^="sec-"]')];
    const updateNav = () => {
      let cur = secs[0];
      secs.forEach(s => { if (s.getBoundingClientRect().top <= 120) cur = s; });
      document.querySelectorAll('#nav-secoes a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + cur.id));
    };
    window.addEventListener('scroll', updateNav, { passive: true });
    const navMobile = document.getElementById('nav-mobile');
    if (navMobile) navMobile.onchange = () => {
      const target = document.getElementById(navMobile.value);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      navMobile.value = '';
    };
    setTimeout(updateNav, 60);
    syncResumo();
  }
  buildShell();

  // ===================== login (nuvem) =====================
  function showLoginGate() {
    const gate = document.getElementById('login-gate');
    if (!gate) return;
    const email = document.getElementById('login-email');
    if (email) email.value = (CLOUD_CFG && CLOUD_CFG.adminEmail) || '';
    const pass = document.getElementById('login-password');
    if (pass) pass.value = '';
    const err = document.getElementById('login-error');
    if (err) err.textContent = '';
    gate.hidden = false;
    document.body.classList.add('auth-locked');
    setTimeout(() => { const p = document.getElementById('login-password'); if (p) p.focus(); }, 80);
  }
  function hideLoginGate() {
    const gate = document.getElementById('login-gate');
    if (gate) gate.hidden = true;
    document.body.classList.remove('auth-locked');
  }
  function updateAuthMenu() {
    const cloud = !!(Server && Server.cloud);
    const logged = !!(Server && Server.key);
    const login = document.getElementById('b-login');
    const logout = document.getElementById('b-logout');
    const senha = document.getElementById('b-senha');
    if (login) login.style.display = (cloud && !logged) ? '' : 'none';
    if (logout) logout.style.display = (cloud && logged) ? '' : 'none';
    if (senha) senha.style.display = (cloud && logged) ? '' : 'none';
  }
  function buildLoginGate() {
    if (document.getElementById('login-gate')) return;
    const mm = CLOUD_CFG && CLOUD_CFG.url ? CLOUD_CFG.url.match(/^https:\/\/([^.]+)\.supabase\.co/) : null;
    const ref = mm ? mm[1] : '';
    const reset = ref ? 'https://supabase.com/dashboard/project/' + ref + '/auth/users' : 'https://supabase.com/dashboard';
    const gate = document.createElement('div');
    gate.className = 'login-gate';
    gate.id = 'login-gate';
    gate.hidden = true;
    gate.innerHTML = `
      <div class="lg-brand">
        <div class="lg-brand-top"><img src="logo.png" alt="Kathleen Goulart"><div><b>Kathleen Goulart</b><span>Engenharia de Avaliações</span></div></div>
        <div class="lg-hero">
          <h2>Laudos de avaliação com rigor técnico.</h2>
          <p>Sistema de avaliação de imóveis urbanos conforme NBR 14653-1:2019 e NBR 14653-2:2011.</p>
          <ul>
            <li>Cálculo automático por fatores e regressão linear</li>
            <li>Link online para o cliente preencher e enviar</li>
            <li>Sincronização segura entre seus computadores</li>
          </ul>
        </div>
        <div class="lg-foot">CREA 226.679/D · Três Pontas/MG · Uso profissional</div>
      </div>
      <div class="lg-panel">
        <form class="lg-card" id="login-form">
          <img class="lg-logo" src="logo.png" alt="Kathleen Goulart">
          <div class="lg-mobile-brand">Kathleen Goulart · Engenharia de Avaliações</div>
          <h1>Acessar o painel</h1>
          <p>Entre com a conta da engenheira para sincronizar laudos e receber solicitações dos clientes.</p>
          <label for="login-email">E-mail</label>
          <input id="login-email" type="email" readonly autocomplete="username">
          <label for="login-password">Senha</label>
          <div class="lg-pass">
            <input id="login-password" type="password" autocomplete="current-password" placeholder="Sua senha">
            <button type="button" id="login-eye">Mostrar</button>
          </div>
          <div class="lg-error" id="login-error" role="alert"></div>
          <button type="submit" class="lg-submit" id="login-submit">Entrar</button>
          <button type="button" class="lg-skip" id="login-skip">Continuar sem sincronizar</button>
          <div class="lg-help">Esqueceu a senha? <a href="${reset}" target="_blank" rel="noopener">Redefinir no Supabase</a></div>
        </form>
      </div>`;
    document.body.appendChild(gate);
  }
  function bindLoginGate() {
    const form = document.getElementById('login-form');
    const pass = document.getElementById('login-password');
    const err = document.getElementById('login-error');
    const submit = document.getElementById('login-submit');
    const eye = document.getElementById('login-eye');
    const skip = document.getElementById('login-skip');
    if (!form) return;
    if (eye) eye.onclick = () => {
      const show = pass.type === 'password';
      pass.type = show ? 'text' : 'password';
      eye.textContent = show ? 'Ocultar' : 'Mostrar';
    };
    if (skip) skip.onclick = () => {
      try { localStorage.setItem('laudo_local_mode', '1'); } catch (e) { /* ignora */ }
      hideLoginGate();
      Server.key = '';
      setServerStatus(false);
      updateAuthMenu();
      avisa('Modo local. Entre na nuvem em ⋯ Mais → Entrar na nuvem.');
    };
    form.onsubmit = async e => {
      e.preventDefault();
      const p = String(pass.value || '').trim();
      if (!p) { err.textContent = 'Informe a senha para entrar.'; pass.focus(); return; }
      submit.disabled = true; submit.textContent = 'Entrando...'; err.textContent = '';
      try {
        await Server.login(p);
        try { localStorage.removeItem('laudo_local_mode'); } catch (e) { /* ignora */ }
        pass.value = '';
        hideLoginGate();
        setServerStatus(true);
        updateAuthMenu();
        avisa('Nuvem conectada. Use “Sincronizar” e “Solicitações online”.');
      } catch (ex) {
        const m = String(ex && ex.message || '');
        err.textContent = /invalid|credencia|senha|login/i.test(m) ? 'E-mail ou senha incorretos. Verifique e tente novamente.' : ('Não foi possível entrar: ' + m);
        pass.focus();
      } finally {
        submit.disabled = false; submit.textContent = 'Entrar';
      }
    };
    const loginBtn = document.getElementById('b-login');
    if (loginBtn) loginBtn.onclick = () => { const menu = document.getElementById('more-panel'); if (menu) menu.classList.remove('open'); showLoginGate(); };
    const logoutBtn = document.getElementById('b-logout');
    if (logoutBtn) logoutBtn.onclick = () => {
      const menu = document.getElementById('more-panel'); if (menu) menu.classList.remove('open');
      if (!confirm('Sair da nuvem neste navegador? Os laudos locais continuam salvos.')) return;
      Cloud.clear();
      Server.key = '';
      setServerStatus(false);
      updateAuthMenu();
      showLoginGate();
    };
  }
  buildLoginGate();
  bindLoginGate();

  // ===================== persistence / UI =====================
  const form = $('#laudo'), msg = $('#msg'), selL = $('#sel-laudo'), selS = $('#status');
  const ler = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const gravar = db => { try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { alert('Não foi possível salvar: espaço do navegador cheio (provavelmente por causa das fotos). Faça um backup e remova fotos ou laudos antigos.'); return false; } };
  const avisa = t => { if (msg) msg.textContent = t; };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const escA = t => esc(t);

  function coletarManual() {
    const m = {};
    $$('[name^="d["]').forEach(el => { if (el.dataset && el.dataset.manual === '1') m[el.name] = true; });
    rowsOf('amostra').forEach((tr, i) => { const vu = tr.querySelector('[data-k=vu]'); if (vu && vu.dataset.manual === '1') m['vu_' + i] = true; });
    return m;
  }
  function coletarAuto() {
    const m = {};
    $$('[name^="d["]').forEach(el => { if (el.dataset && el.dataset.auto === '1') m[el.name] = true; });
    return m;
  }

  function coletar() {
    const o = {};
    $$('[name^="d["]').forEach(el => {
      const m = el.name.match(/^d\[([^\]]+)\]$/); if (!m) return;
      if (el.type === 'radio') { if (el.checked) o[m[1]] = el.value; }
      else if (el.type === 'checkbox') o[m[1]] = el.checked ? (el.value || '1') : '';
      else o[m[1]] = el.value;
    });
    $$('table.dyn').forEach(t => {
      o[t.dataset.name] = [...t.querySelectorAll('tbody tr')].map(tr => {
        const r = {};
        tr.querySelectorAll('[data-k]').forEach(e => {
          if (e.type === 'checkbox') r[e.dataset.k] = e.checked ? (e.value || '1') : '';
          else r[e.dataset.k] = e.value;
        });
        return r;
      }).filter(r => Object.values(r).some(v => v !== ''));
    });
    o._fotos = fotos;
    o._docs = docs.map(d => ({ nome: d.nome, tipo: d.tipo }));
    o._manual = coletarManual();
    o._auto = coletarAuto();
    return o;
  }

  function restaurar(d) {
    d = d || {};
    const legacy = !d._manual;
    $$('[name^="d["]').forEach(el => {
      const m = el.name.match(/^d\[([^\]]+)\]$/); if (!m) return;
      const v = d[m[1]] !== undefined ? d[m[1]] : '';
      if (el.type === 'radio') el.checked = (el.value === v);
      else if (el.type === 'checkbox') el.checked = !!v && v !== '0';
      else el.value = v;
      const isLegacyManual = legacy && ['d[res_ext]', 'd[e_fund]', 'd[e_prec]'].includes(el.name) && String(el.value).trim() !== '';
      if ((d._manual && d._manual[el.name]) || isLegacyManual) el.dataset.manual = '1'; else delete el.dataset.manual;
      if (d._auto && d._auto[el.name]) el.dataset.auto = '1'; else delete el.dataset.auto;
    });
    $$('table.dyn').forEach(t => {
      const nome = t.dataset.name, rows = d[nome] || [], tb = t.querySelector('tbody');
      const min = MIN[nome] || 1;
      while (tb.children.length > Math.max(min, rows.length)) tb.lastElementChild.remove();
      while (tb.children.length < rows.length) { if (!addRow(nome, true)) break; }
      [...tb.children].forEach((tr, i) => {
        tr.querySelectorAll('[data-k]').forEach(e => {
          const v = rows[i] && rows[i][e.dataset.k] !== undefined ? rows[i][e.dataset.k] : '';
          if (e.type === 'checkbox') e.checked = !!v && v !== '0';
          else e.value = v;
          if (e.dataset.k === 'vu') {
            if ((d._manual && d._manual['vu_' + i]) || (legacy && String(e.value).trim() !== '')) e.dataset.manual = '1';
            else delete e.dataset.manual;
          }
          if (d._auto && d._auto[e.name]) e.dataset.auto = '1'; else delete e.dataset.auto;
        });
      });
    });
    fotos = (d._fotos || []).filter(f => f && /^data:image\//.test(f.src || ''));
    docs = d._docs || [];
    desenhaFotos();
    renumber();
    form.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function nomeDe(d) { return [d.num_laudo, (d.end || d.solicitante || '').slice(0, 40)].filter(Boolean).join(' — '); }

  function atualizaLista() {
    const db = ler(), ids = Object.keys(db).sort((a, b) => String(db[b].atualizado || '').localeCompare(String(db[a].atualizado || '')));
    selL.innerHTML = '<option value="">— laudo não salvo —</option>' + ids.map(i => {
      const l = db[i]; return '<option value="' + escA(i) + '"' + (i === atual ? ' selected' : '') + '>' + escA(l.nome || 'Sem número') + ' · ' + (l.status === 'final' ? 'Final' : 'Rascunho') + '</option>';
    }).join('');
    selL.value = atual || '';
  }

  function salvar(silencioso) {
    const d = coletar(), db = ler();
    if (!atual) atual = uid();
    db[atual] = { id: atual, nome: nomeDe(d), status: selS.value, atualizado: new Date().toISOString(), dados: d };
    if (gravar(db)) {
      atualizaLista();
      avisa((silencioso ? 'Salvo automaticamente ' : 'Salvo ') + new Date().toLocaleTimeString('pt-BR'));
      dirty = false;
      if (Server.mode && Server.key && (!Server.cloud || !silencioso)) {
        Server.req('/api/laudos/' + encodeURIComponent(atual), { method: 'PUT', body: JSON.stringify(db[atual]) }).catch(() => {});
      }
      return true;
    }
    return false;
  }

  function abrir(id) {
    if (timer) { clearTimeout(timer); timer = null; }
    if (dirty && !atual && !confirm('Há um laudo não salvo. Deseja descartar?')) return false;
    if (dirty && atual) { if (!salvar(true)) return false; }
    const db = ler();
    if (!id || !db[id]) { atual = null; restaurar(DEFAULTS); selS.value = 'rascunho'; }
    else { atual = id; restaurar(db[id].dados); selS.value = db[id].status || 'rascunho'; }
    document.body.classList.toggle('rascunho', selS.value !== 'final');
    atualizaLista(); avisa(''); dirty = false;
    return true;
  }

  // ---------- export / import ----------
  function baixa(nome, conteudo, tipo) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo || 'application/json' }));
    a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function baixaData(nome, dataUrl) {
    const a = document.createElement('a'); a.href = dataUrl; a.download = nome || 'anexo';
    document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 800);
  }
  const slug = t => (t || 'laudo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'laudo';
  const csvCel = v => {
    let s = String(v === undefined || v === null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
  };
  const csvNum = v => { const s = String(v == null ? '' : v); return s.includes('.') && !s.includes(',') ? s.replace('.', ',') : s; };

  $('#b-json').onclick = () => { const d = coletar(); baixa('laudo-' + slug(d.num_laudo) + '.json', JSON.stringify({ tipo: 'laudo', versao: 2, status: selS.value, dados: d }, null, 2), 'application/json'); };
  $('#b-backup').onclick = () => baixa('backup-laudos-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ tipo: 'backup', versao: 2, laudos: ler() }, null, 2), 'application/json');
  $('#b-import').onclick = () => $('#f-import').click();
  $('#f-import').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result), db = ler(); let n = 0, ultimo = null;
        if (j.tipo === 'backup' && j.laudos) { Object.values(j.laudos).forEach(l => { const id = uid(); db[id] = Object.assign({}, l, { id }); n++; ultimo = id; }); }
        else if (j.tipo === 'laudo' && j.dados) { const id = uid(); db[id] = { id, nome: nomeDe(j.dados), status: j.status || 'rascunho', atualizado: new Date().toISOString(), dados: j.dados }; n = 1; ultimo = id; }
        else if (j.tipo === 'solicitacao_cliente') { aplicarSolicitacao(j); return; }
        else throw new Error('formato');
        if (gravar(db)) { atualizaLista(); abrir(ultimo); avisa(n + ' laudo(s) importado(s).'); }
      } catch (err) { alert('Arquivo inválido. Use um .json exportado por este sistema.'); }
      e.target.value = '';
    };
    r.readAsText(f);
  };

  $('#b-csv').onclick = () => {
    const db = ler(), ls = Object.values(db); if (!ls.length) { alert('Nenhum laudo salvo.'); return; }
    const chaves = []; ls.forEach(l => { const dados = l.dados || {}; Object.keys(dados).forEach(k => { if (!Array.isArray(dados[k]) && !['_fotos', '_manual', '_docs'].includes(k) && !chaves.includes(k)) chaves.push(k); }); });
    const linhas = [['status', 'nome', 'atualizado', ...chaves].map(csvCel).join(';')];
    ls.forEach(l => { const dados = l.dados || {}; linhas.push([l.status, l.nome, l.atualizado, ...chaves.map(k => dados[k])].map(csvCel).join(';')); });
    baixa('laudos.csv', '\ufeff' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
  };
  $('#b-csv-amostra').onclick = () => {
    const d = coletar(), cols = ['end', 'fonte', 'tipo', 'data', 'at', 'ac', 'padrao', 'conserv', 'preco', 'vu'];
    const linhas = [cols.map(csvCel).join(';')].concat((d.amostra || []).map(r => cols.map(c => csvCel(['preco', 'vu', 'at', 'ac'].includes(c) ? csvNum(r[c]) : r[c])).join(';')));
    baixa('amostra-' + slug(d.num_laudo) + '.csv', '\ufeff' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
  };

  // ---------- client link / import ----------
  $('#b-link').onclick = () => {
    const cfg = window.LAUDO_CONFIG || {};
    const base = cfg.serverUrl
      ? new URL('cliente.html', cfg.serverUrl.endsWith('/') ? cfg.serverUrl : cfg.serverUrl + '/').href
      : new URL('cliente.html', location.href).href;
    const token = safeToken(((F('num_laudo') || {}).value || '').trim() || uid());
    const eng = ((F('ass_nome') || {}).value || (F('resp_tecnico') || {}).value || cfg.engenheiro || 'Engenharia de Avaliações').trim();
    const whats = ((F('eng_whats') || {}).value || cfg.whatsapp || '').replace(/\D/g, '');
    const params = new URLSearchParams({ t: token, e: eng, empresa: cfg.empresa || 'Avaliações Imobiliárias', c: cfg.cidade || 'Três Pontas/MG' });
    if (whats) params.set('w', whats);
    const url = base + '?' + params.toString();
    if (!cfg.serverUrl && /^(localhost|127\.0\.0\.1)$/i.test(location.hostname)) {
      alert('Atenção: você está em localhost. O cliente não consegue acessar 127.0.0.1. Use o IP da rede (ex.: http://192.168.x.x:8787) ou publique com PUBLIC_URL.');
    } else if (location.protocol === 'file:') {
      alert('Atenção: este laudo está aberto como arquivo local. Para o cliente acessar, publique a pasta em um host (Cloudflare Pages, GitHub Pages, Netlify) e use o link gerado.');
    }
    try { const cp = navigator.clipboard.writeText(url); if (cp && cp.catch) cp.catch(() => {}); } catch (e) { /* ignore */ }
    prompt('Link do cliente (copie e envie):', url);
    avisa('Link do cliente gerado.');
  };
  $('#b-online-sol').onclick = async () => {
    if (!Server.mode || !Server.key) { alert(Server.cloud ? 'Nuvem não conectada. Informe a senha do painel para importar solicitações.' : 'Servidor não conectado. Abra o painel pelo servidor e informe a senha.'); return; }
    try {
      const j = await Server.req('/api/solicitacoes');
      const list = j.solicitacoes || [];
      if (!list.length) { alert('Nenhuma solicitação online recebida.'); return; }
      const lines = list.map((s, i) => (i + 1) + ') ' + s.token + ' — ' + (s.nome || 'sem nome') + ' — ' + (s.endereco || '') + ' (' + s.fotos + ' foto(s), ' + s.documentos + ' doc(s))').join('\n');
      const n = parseInt(prompt('Solicitações online:\n\n' + lines + '\n\nDigite o número para importar:'), 10);
      if (!n || n < 1 || n > list.length) return;
      const token = list[n - 1].token;
      const full = await Server.req('/api/solicitacoes/' + encodeURIComponent(token));
      if (full.solicitacao) aplicarSolicitacao(full.solicitacao);
    } catch (e) { alert('Falha ao buscar solicitações: ' + e.message); }
  };
  $('#b-sync').onclick = async () => {
    if (!Server.mode || !Server.key) { alert(Server.cloud ? 'Nuvem não conectada. Informe a senha do painel para importar solicitações.' : 'Servidor não conectado. Abra o painel pelo servidor e informe a senha.'); return; }
    try {
      const j = await Server.req('/api/laudos');
      const serverList = j.laudos || [];
      const smap = new Map(serverList.map(x => [x.id, x]));
      const db = ler();
      let baixados = 0, enviados = 0;
      for (const s of serverList) {
        const local = db[s.id];
        if (!local || String(s.atualizado || '') > String(local.atualizado || '')) {
          const full = await Server.req('/api/laudos/' + encodeURIComponent(s.id));
          if (full.laudo) { db[s.id] = full.laudo; baixados++; }
        }
      }
      for (const id of Object.keys(db)) {
        const s = smap.get(id);
        if (!s || String(db[id].atualizado || '') > String(s.atualizado || '')) {
          await Server.req('/api/laudos/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(db[id]) });
          enviados++;
        }
      }
      gravar(db);
      atualizaLista();
      avisa('Sincronização concluída: ' + baixados + ' baixado(s), ' + enviados + ' enviado(s).');
      alert('Sincronização concluída.\nBaixados do servidor: ' + baixados + '\nEnviados ao servidor: ' + enviados);
    } catch (e) { alert('Falha na sincronização: ' + e.message); }
  };
  const bSenha = document.getElementById('b-senha');
  if (bSenha) bSenha.onclick = async () => {
    if (!Server.cloud) { alert('A troca de senha está disponível no modo nuvem.'); return; }
    if (!Server.mode || !Server.key) { alert('Informe a senha do painel primeiro.'); return; }
    const p1 = prompt('Nova senha do painel (mínimo 8 caracteres):');
    if (!p1) return;
    if (p1.length < 8) { alert('Use pelo menos 8 caracteres.'); return; }
    const p2 = prompt('Repita a nova senha:');
    if (p1 !== p2) { alert('As senhas não conferem.'); return; }
    try {
      await Cloud.auth();
      await Cloud.raw('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: p1 }) });
      alert('Senha alterada com sucesso. Guarde a nova senha com segurança.');
    } catch (e) { alert('Não foi possível alterar a senha: ' + e.message); }
  };

  $('#b-import-cli').onclick = () => $('#f-import-cli').click();
  $('#f-import-cli').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result);
        if (j.tipo !== 'solicitacao_cliente') throw new Error('formato');
        aplicarSolicitacao(j);
      } catch (err) { alert('Arquivo de solicitação inválido. Use o .json gerado pelo formulário do cliente.'); }
      e.target.value = '';
    };
    r.readAsText(f);
  };
  function aplicarSolicitacao(j) {
    const c = j.dados || {};
    const hoje = todayISO();
    const endFull = c.end || '';
    const extras = [c.bairro, c.cidade].filter(Boolean).filter(x => !endFull.toLowerCase().includes(String(x).toLowerCase()));
    const d = {
      num_laudo: j.token || c.token || ('CLI-' + uid().toUpperCase()),
      solicitante: [c.solicitante_nome, c.solicitante_doc, c.solicitante_tel, c.solicitante_email].filter(Boolean).join(' · '),
      proprietario: c.solicitante_nome || '',
      finalidade: c.finalidade || '',
      data_base: c.data_ref ? fmtDate(c.data_ref) : '',
      data_ref_date: c.data_ref || hoje,
      data_vistoria: '',
      data_emissao: hoje,
      enc_data: hoje,
      end: [endFull, ...extras].filter(Boolean).join(' — '),
      tipo_imovel: c.tipo_imovel || '',
      matricula: c.matricula || '',
      insc_mun: c.insc_mun || '',
      area_terreno: c.area_terreno || '',
      area_constr: c.area_constr || '',
      area_terreno_num: parseFloat(c.area_terreno) || '',
      area_constr_num: parseFloat(c.area_constr) || '',
      formato: c.formato || '',
      topografia: c.topografia || '',
      posicao: c.posicao || '',
      padrao_constr: c.padrao_constr || '',
      idade: c.idade || '',
      idade_efetiva: c.idade || '',
      heidecke: c.estado_heidecke || '',
      onus: c.onus || '',
      zoneamento: c.zoneamento || '',
      obs_divergencias: [
        c.observacoes,
        c.ocupacao ? 'Ocupação: ' + c.ocupacao : '',
        c.valor_ref ? 'Valor de referência: ' + c.valor_ref : '',
        c.solicitante_relacao ? 'Relação com o imóvel: ' + c.solicitante_relacao : '',
        c.lgpd ? 'Consentimento LGPD: sim (' + (j.criado_em || '') + ')' : ''
      ].filter(Boolean).join('\n'),
      documentos: (j.documentos || []).map(x => x.nome).filter(Boolean).join(', '),
      _fotos: (j.fotos || []).filter(f => f && /^data:image\//.test(f.src || '')),
      _manual: {}
    };
    const meaningful = ['num_laudo', 'solicitante', 'end', 'res_num'].some(n => valOf(n));
    if (atual && dirty) {
      if (confirm('Salvar o laudo atual antes de importar a solicitação?')) salvar(true);
    } else if (!atual && meaningful) {
      if (!confirm('Há dados não salvos. Importar a solicitação e substituir?')) return;
    }
    dirty = false;
    abrir('');
    const merged = Object.assign({}, DEFAULTS, d);
    merged._fotos = d._fotos || [];
    merged._manual = d._manual || {};
    restaurar(merged);
    fotos = d._fotos || [];
    docs = (j.documentos || []).filter(x => x && /^data:/.test(String(x.src || '')));
    desenhaFotos();
    dirty = true;
    salvar(false);
    avisa('Solicitação do cliente importada. Confira os dados e complete a vistoria.');
    if (docs.length && confirm('Baixar os ' + docs.length + ' anexo(s) enviados pelo cliente?')) {
      docs.forEach((x, i) => setTimeout(() => { if (x.src) baixaData(x.nome || ('anexo-' + i), x.src); }, i * 400));
    }
  }

  // ---------- photos ----------
  const lista = $('#foto-lista');
  function desenhaFotos() {
    lista.innerHTML = fotos.map((f, i) => '<div class="foto"><img src="' + escA(f.src) + '" alt=""><input type="text" data-i="' + i + '" value="' + escA(f.legenda || '') + '" placeholder="Legenda"><button type="button" class="fdel" data-del="' + i + '">Excluir</button></div>').join('');
  }
  function reduz(file) {
    return new Promise((ok, erro) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const e = Math.min(1, 1200 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * e); c.height = Math.round(img.height * e);
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = erro; img.src = url;
    });
  }
  $('#foto-enviar').onclick = async () => {
    const arq = $('#foto-arq'), leg = $('#foto-legenda').value;
    for (const f of arq.files) { try { fotos.push({ src: await reduz(f), legenda: leg }); } catch (e) { alert('Não foi possível ler ' + f.name); } }
    arq.value = ''; desenhaFotos(); dirty = true; if (atual) salvar(true);
  };
  lista.addEventListener('click', e => { const i = e.target.dataset.del; if (i === undefined || !confirm('Excluir esta foto?')) return; fotos.splice(+i, 1); desenhaFotos(); dirty = true; if (atual) salvar(true); });
  lista.addEventListener('input', e => { if (e.target.dataset.i !== undefined) { fotos[+e.target.dataset.i].legenda = e.target.value; dirty = true; if (atual) { clearTimeout(timer); timer = setTimeout(() => salvar(true), 1500); } } });

  // ---------- print ----------
  const TITLE0 = document.title;
  function ajustaTextareas() {
    $$('textarea').forEach(t => {
      t.classList.toggle('print-empty', !String(t.value || '').trim());
      t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px';
    });
  }
  function printMeta() {
    const num = valOf('num_laudo'), end = valOf('end'), dt = valOf('data_emissao');
    document.title = 'Laudo ' + (num || '') + (end ? ' - ' + end : '');
    const ph = $('#print-header');
    if (ph) ph.textContent = 'Laudo nº ' + (num || '—') + ' · ' + (end || '—') + ' · ' + (dt ? fmtDate(dt) : '');
    let pf = document.getElementById('print-footer');
    if (!pf) { pf = document.createElement('div'); pf.id = 'print-footer'; pf.className = 'print-only print-footer'; $('.folha').appendChild(pf); }
    pf.textContent = [valOf('ass_nome'), valOf('ass_reg'), valOf('ass_art')].filter(Boolean).join(' · ');
    [['data_emissao','data_emissao_fmt'],['data_vistoria','data_vistoria_fmt'],['vist_data','vist_data_fmt'],['enc_data','enc_data_fmt'],['data_ref_date','data_ref_fmt']].forEach(([a,b]) => {
      const src = F(a), dst = document.getElementById(b); if (src && dst) dst.textContent = src.value ? ' ' + fmtDate(src.value) : '';
    });
    $$('table[data-name=amostra] tbody tr').forEach(tr => {
      const inp = tr.querySelector('[data-k=data]');
      if (!inp) return;
      let sp = tr.querySelector('.print-date');
      if (!sp) { sp = document.createElement('span'); sp.className = 'print-date print-only'; inp.parentNode.appendChild(sp); }
      sp.textContent = inp.value ? fmtDate(inp.value) : '';
      inp.classList.add('print-hide-date');
    });
  }
  window.addEventListener('beforeprint', () => { document.body.classList.toggle('rascunho', selS.value !== 'final'); ajustaTextareas(); printMeta(); });
  window.addEventListener('afterprint', () => { document.title = TITLE0; });
  $('#b-pdf').onclick = async () => {
    if (!atual) salvar(false); else if (dirty) salvar(true);
    await atualizaHash();
    alert('Na janela de impressão, escolha "Salvar como PDF" como destino, tamanho A4 e marque "Elementos gráficos de plano de fundo" para manter as cores das tabelas.');
    printMeta();
    window.print();
  };

  // ---------- events ----------
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset && el.dataset.k === 'vu') el.dataset.manual = String(el.value || '').trim() === '' ? '' : '1';
    if (el.dataset && ['q', 'fo', 'fa', 'fc', 'fp', 'fl', 'ft'].includes(el.dataset.k)) el.dataset.auto = '';
    if (['d[c_a]', 'd[c_q]'].includes(el.name)) el.dataset.auto = '';
    if (['d[res_ext]', 'd[e_fund]', 'd[e_prec]', 'd[res_num]'].includes(el.name)) el.dataset.manual = String(el.value || '').trim() === '' ? '' : '1';
    dirty = true;
    if (atual) {
      clearTimeout(timer);
      const id = atual;
      timer = setTimeout(() => { if (atual === id && dirty) salvar(true); }, 1500);
    } else avisa('Não salvo — clique em Salvar.');
    tudo();
  });
  ['v_cen','v_min','v_max','v_unit','v_adotado'].forEach(n => {
    const e = F(n); if (!e) return;
    e.addEventListener('input', () => { e.dataset.manual = String(e.value || '').trim() === '' ? '' : '1'; });
  });
  ['f2','f4','rg2','rg3','rg4','rg5','rg6','rg_extrap_grau'].forEach(n => {
    const e = F(n); if (!e) return;
    e.addEventListener('change', () => { e.dataset.manual = '1'; });
  });
  document.addEventListener('change', () => { tudo(); });
  document.addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) { addRow(add.dataset.add); return; }
    if (e.target.classList.contains('del')) {
      const tr = e.target.closest('tr'), tb = tr.parentNode;
      if (tb.children.length > 1) { tr.remove(); renumber(); tudo(); }
    }
  });
  function sampleSnapshot() {
    const details = rowsOf('detalhes');
    return rowsOf('amostra').map((tr, i) => {
      const g = k => String((tr.querySelector('[data-k=' + k + ']') || {}).value || '');
      const d = details[i];
      const dg = k => d ? String((d.querySelector('[data-k=' + k + ']') || {}).value || '') : '';
      return {
        end: g('end'), fonte: g('fonte'), tipo: g('tipo'), data: g('data'),
        at: g('at'), ac: g('ac'), padrao: g('padrao'), conserv: g('conserv'),
        preco: g('preco'), vu: g('vu'),
        detalhes: { idade: dg('idade'), conserv: dg('conserv'), esquina: dg('esquina'), topografia: dg('topografia'), distancia: dg('distancia') }
      };
    }).filter(r => r.end || r.preco);
  }
  const compKey = r => [r.end, r.preco, r.data].join('|');
  $('#b-salvar-comp').onclick = () => {
    const arr = sampleSnapshot();
    if (!arr.length) { alert('Preencha os comparáveis antes de salvar no banco.'); return; }
    let bank = [];
    try { bank = JSON.parse(localStorage.getItem('comparaveis_v1') || '[]'); } catch (e) { bank = []; }
    const map = new Map((Array.isArray(bank) ? bank : []).map(x => [compKey(x), x]));
    arr.forEach(x => map.set(compKey(x), x));
    bank = [...map.values()];
    try { localStorage.setItem('comparaveis_v1', JSON.stringify(bank)); } catch (e) { /* quota */ }
    if (Server.mode && Server.key) {
      Server.req('/api/comparaveis', { method: 'PUT', body: JSON.stringify(bank) }).catch(() => {});
    }
    if ($('#comp-status')) $('#comp-status').textContent = bank.length + ' comparável(is) no banco.';
    avisa('Comparáveis salvos no banco.');
  };
  $('#b-carregar-comp').onclick = async () => {
    let bank = [];
    try { bank = JSON.parse(localStorage.getItem('comparaveis_v1') || '[]'); } catch (e) { bank = []; }
    if (Server.mode && Server.key) {
      try {
        const j = await Server.req('/api/comparaveis');
        if (Array.isArray(j.comparaveis) && j.comparaveis.length) {
          const map = new Map([...(Array.isArray(bank) ? bank : []), ...j.comparaveis].map(x => [compKey(x), x]));
          bank = [...map.values()];
        }
      } catch (e) { /* usa local */ }
    }
    if (!Array.isArray(bank) || !bank.length) { alert('Banco de comparáveis vazio. Salve alguns comparáveis primeiro.'); return; }
    const existing = new Set(sampleSnapshot().map(compKey));
    const add = bank.filter(r => !existing.has(compKey(r)));
    if (!add.length) { alert('Todos os comparáveis do banco já estão neste laudo.'); return; }
    const start = rowsOf('amostra').length;
    while (rowsOf('amostra').length < start + add.length) { if (!addRow('amostra', true)) break; }
    ensureRows('detalhes', start + add.length);
    const samples = rowsOf('amostra'), details = rowsOf('detalhes');
    const put = (tr, k, v) => { const e = tr && tr.querySelector('[data-k=' + k + ']'); if (e) e.value = v == null ? '' : v; };
    add.forEach((r, j) => {
      const tr = samples[start + j], d = details[start + j];
      ['end', 'fonte', 'tipo', 'data', 'at', 'ac', 'padrao', 'conserv', 'preco', 'vu'].forEach(k => put(tr, k, r[k]));
      if (d && r.detalhes) ['idade', 'conserv', 'esquina', 'topografia', 'distancia'].forEach(k => put(d, k, r.detalhes[k]));
    });
    renumber(); tudo();
    if ($('#comp-status')) $('#comp-status').textContent = add.length + ' comparável(is) carregado(s).';
    avisa(add.length + ' comparável(is) carregado(s) do banco.');
  };
  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async function atualizaHash() {
    try {
      if (!crypto || !crypto.subtle) { alert('Hash indisponível neste contexto. Use HTTPS ou localhost.'); return; }
      const d = coletar();
      delete d.hash_integridade;
      const h = await sha256Hex(JSON.stringify(d));
      if (F('hash_integridade')) F('hash_integridade').value = h;
      const el = document.getElementById('hash-print');
      if (el) el.textContent = 'Hash SHA-256 do laudo: ' + h;
    } catch (e) { alert('Não foi possível gerar o hash: ' + e.message); }
  }
  $('#b-hash').onclick = () => atualizaHash();
  $('#b-calcular').onclick = () => calcularTudo();
  $('#b-ols').onclick = () => calcularTudo('estatistico');
  $('#b-copiar-homog').onclick = () => {
    const samples = rowsOf('amostra').filter(tr => String(tr.querySelector('[data-k=vu]')?.value || '').trim() !== '');
    if (!samples.length) { alert('Preencha os valores unitários da amostra primeiro.'); return; }
    let homog = rowsOf('homog');
    if (homog.some(tr => String(tr.querySelector('[data-k=q]')?.value || '').trim() !== '') && !confirm('Substituir os valores unitários já lançados na homogeneização?')) return;
    while (homog.length < samples.length) { addRow('homog', true); homog = rowsOf('homog'); }
    samples.forEach((s, i) => {
      const tr = homog[i]; if (!tr) return;
      const q = s.querySelector('[data-k=vu]')?.value || '';
      const tipo = s.querySelector('[data-k=tipo]')?.value || '';
      tr.querySelector('[data-k=q]').value = q;
      const fo = tr.querySelector('[data-k=fo]');
      if (fo && String(fo.value).trim() === '') fo.value = tipo === 'Oferta' ? '0.90' : '1.00';
    });
    renumber(); tudo();
    avisa('Valores unitários copiados para a homogeneização. Confira os fatores.');
  };
  $('#b-chauvenet').onclick = detectChauvenet;
  $('#b-cub').onclick = () => {
    const cub = N('cub'), area = N('cub_area'), fator = isFinite(N('cub_fator')) ? N('cub_fator') : 1;
    if (!(cub > 0) || !(area > 0)) { alert('Informe o CUB e a área para calcular a reedificação.'); return; }
    if (F('rh_vr')) F('rh_vr').value = (cub * area * fator).toFixed(2);
    if (F('idade_efetiva') && F('rh_idade') && !F('rh_idade').value) F('rh_idade').value = F('idade_efetiva').value;
    if (F('vida_util') && F('rh_vida') && !F('rh_vida').value) F('rh_vida').value = F('vida_util').value;
    if (F('heidecke') && F('rh_estado') && !F('rh_estado').value) F('rh_estado').value = F('heidecke').value;
    tudo();
    alert('Valor de reedificação calculado: ' + fmtBRL(cub * area * fator));
  };
  $('#b-rh-usar').onclick = () => {
    const r = rossCalc();
    if (!r) { alert('Preencha valor de reedificação, idade, vida útil e estado Heidecke.'); return; }
    if (F('c_b')) F('c_b').value = r.dep.toFixed(2);
    if (F('c_a') && !N('c_a') && N('area_constr_num') > 0) F('c_a').value = String(N('area_constr_num'));
    tudo();
    alert('V_benfeitorias preenchido com ' + fmtBRL(r.dep) + '. Confira se o valor unitário adotado é de terreno, para não duplicar a construção.');
  };

  $('#b-novo').onclick = () => abrir('');
  selL.onchange = () => { if (!abrir(selL.value)) selL.value = atual || ''; };
  $('#b-salvar').onclick = () => salvar(false);
  selS.onchange = () => { document.body.classList.toggle('rascunho', selS.value !== 'final'); if (atual) { salvar(true); } dirty = true; if (typeof syncResumo === 'function') syncResumo(); };
  $('#b-del').onclick = () => {
    if (!atual || !confirm('Excluir este laudo do navegador? (exporte antes, se precisar)')) return;
    if (timer) { clearTimeout(timer); timer = null; }
    const id = atual;
    const db = ler(); delete db[id]; gravar(db);
    if (Server.mode && Server.key) Server.req('/api/laudos/' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {});
    atual = null; dirty = false; abrir('');
  };
  form.addEventListener('input', () => {
    dirty = true;
    if (atual) {
      clearTimeout(timer);
      const id = atual;
      timer = setTimeout(() => { if (atual === id && dirty) salvar(true); }, 1500);
    }
  });

  // ---------- init ----------
  const hoje = todayISO();
  ['data_emissao', 'enc_data', 'data_ref_date'].forEach(n => { const e = F(n); if (e && !e.value) e.value = hoje; });
  ['st_n_col','st_n_uti','st_n_excl','st_media','st_s','st_cv','st_ic_min','st_ic_max','st_ca_min','st_ca_max','st_amp','st_grau','st_zcrit','c_total','r_amp','p_amp','p_grau','f_grau','f_pts','rg_grau','rg_pts'].forEach(n => { const e = F(n); if (e) e.readOnly = true; });
  DEFAULTS = coletar();
  renumber();
  atualizaLista();
  document.body.classList.add('rascunho');
  tudo();
  avisa('');

  (async () => {
    try {
      const online = await Server.init();
      updateAuthMenu();
      if (!online) { setServerStatus(false); return; }
      if (Server.key) {
        setServerStatus(true);
        avisa((Server.cloud ? 'Nuvem conectada' : 'Servidor conectado') + '. Use “Sincronizar” e “Solicitações online”.');
        return;
      }
      setServerStatus(false);
      if (Server.cloud) {
        if (localStorage.getItem('laudo_local_mode') === '1') {
          avisa('Modo local. Entre na nuvem em ⋯ Mais → Entrar na nuvem.');
          return;
        }
        showLoginGate();
        return;
      }
      const p = prompt('Servidor conectado. Informe a senha do painel para sincronizar laudos e receber solicitações:');
      if (!p) { avisa('Servidor online; modo local. Informe a senha ao recarregar para sincronizar.'); return; }
      await Server.login(p);
      setServerStatus(true);
      updateAuthMenu();
      avisa('Servidor conectado. Use “Sincronizar” e “Solicitações online”.');
    } catch (e) {
      setServerStatus(false);
      updateAuthMenu();
      avisa((Server.cloud ? 'Nuvem online' : 'Servidor online') + ', mas sem autenticação: ' + e.message);
      if (Server.cloud) showLoginGate();
    }
  })();
})();
