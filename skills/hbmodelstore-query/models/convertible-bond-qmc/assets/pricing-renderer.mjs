// Shared website/Skill preview. Callers own data access; this module never fetches.
export const columns = [
  ['bond_code', '代码'], ['bond_name', '名称'], ['market_price', '市场价'],
  ['conversion_value', '转股价值'], ['pure_bond_value', '纯债价值'],
  ['theoretical_price', '理论价'], ['market_vs_theoretical_pct', '理论溢价率'],
  ['call_rate', '强赎终止'], ['reset_rate', '下修'],
];
export function formatValue(key, value, row) {
  if (value === null || value === undefined) return '—';
  if (key.endsWith('_rate')) {
    if (row.pricing_method === 'announced-redemption-bs') return '—';
    return `${(value * 100).toFixed(1)}%`;
  }
  if (key === 'market_vs_theoretical_pct') return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  if (typeof value === 'number') return value.toFixed(2);
  return String(value);
}
export function offlineSource(payload) {
  if (!Array.isArray(payload.rows) || payload.total !== payload.rows.length || !payload.model_date) {
    throw new Error('请导出同一模型日的完整截面，合并分页后再生成网页。');
  }
  const ids = payload.rows.map(row => row.bond_code);
  if (new Set(ids).size !== ids.length || payload.rows.some(row => row.model_date !== payload.model_date)) {
    throw new Error('截面有重复券或混入了其他模型日。');
  }
  return {
    dates: async () => ({ rows: [{ model_date: payload.model_date, bond_count: payload.total }] }),
    query: async ({ q, bond_type, sort, order, limit, offset }) => {
      const needle = q.trim().toLowerCase();
      const rows = payload.rows.filter(row => (!bond_type || row.bond_type === bond_type)
        && [row.bond_code, row.bond_name].some(text => text.toLowerCase().includes(needle)));
      const compare = (a, b) => typeof a[sort] === 'number' ? a[sort] - b[sort]
        : String(a[sort]).localeCompare(String(b[sort]));
      rows.sort((a, b) => (order === 'desc' ? -1 : 1) * compare(a, b)
        || a.bond_code.localeCompare(b.bond_code));
      return { ...payload, rows: rows.slice(offset, offset + limit), total: rows.length, offset, limit };
    },
  };
}
const style = `
.qmc-preview {font:14px/1.6 Arial,"Microsoft YaHei","PingFang SC",sans-serif;color:inherit;min-width:0}
.qmc-preview .controls {display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.qmc-preview input,.qmc-preview select,.qmc-preview button {font:inherit;color:inherit;border:1px solid #8884;border-radius:6px;padding:7px 10px;background:transparent}
.qmc-preview button {cursor:pointer}.qmc-preview button:disabled {opacity:.4;cursor:default}
.qmc-preview .scroll {overflow-x:auto}.qmc-preview table {width:100%;border-collapse:collapse;white-space:nowrap;font-variant-numeric:tabular-nums}
.qmc-preview th {background:#7f7f7f0c;font-weight:600;text-align:center}.qmc-preview th,.qmc-preview td {padding:10px 12px;border-bottom:1px solid #8883}
.qmc-preview td {text-align:right}.qmc-preview td:first-child,.qmc-preview td:nth-child(2) {text-align:left}
.qmc-preview th button {padding:0;border:0;border-radius:0;font-weight:600;white-space:nowrap}
.qmc-preview .pager {display:flex;justify-content:flex-end;align-items:center;gap:4px;margin:0 0 12px}
.qmc-preview .pager[hidden] {display:none}
.qmc-preview .note {font-size:12px;opacity:.65;margin-top:12px}.qmc-preview .error {color:#d80012}
.qmc-preview .positive {color:#d80012}.qmc-preview .negative {color:#15806b}
`;
export function mountPricingPreview({ root, source }) {
  let alive = true, request = 0, controller;
  const state = { date: '', q: '', bond_type: '', sort: 'bond_code', order: 'asc', limit: 20, offset: 0 };
  root.classList.add('qmc-preview');
  root.innerHTML = `<style>${style}</style><form class="controls">
    <select aria-label="模型日期"></select><select aria-label="券类型"><option value="">全部券</option><option value="cb">可转债</option><option value="eb">可交债</option></select>
    <input aria-label="搜索转债" placeholder="代码或名称"><button type="submit">查询</button></form>
    <p role="status"></p>
    <div class="pager"><span></span><button type="button">上一页</button><button type="button">下一页</button></div>
    <div class="scroll"><table><thead></thead><tbody></tbody></table></div>
    <p class="note">价格与价值均为每100元面值的元数值；理论溢价率＝市场价／理论价−1，越高表示相对越贵。</p>
    <p class="note exclusions"></p><p class="note source-note">数据来源：好买基金研究中心</p>`;
  const [day, type] = root.querySelectorAll('select');
  const search = root.querySelector('input'), form = root.querySelector('form');
  const head = root.querySelector('thead'), body = root.querySelector('tbody');
  const status = root.querySelector('[role="status"]'), page = root.querySelector('.pager span');
  const [prev, next] = root.querySelectorAll('.pager button');
  function paint(payload) {
    head.replaceChildren(); body.replaceChildren();
    const heading = document.createElement('tr');
    columns.forEach(([key, name]) => {
      const cell = document.createElement('th');
      if (['bond_code', 'market_price', 'theoretical_price', 'market_vs_theoretical_pct', 'call_rate', 'reset_rate'].includes(key)) {
        const button = document.createElement('button'); button.type = 'button';
        button.textContent = name + (state.sort === key ? (state.order === 'asc' ? ' ↑' : ' ↓') : ' ↕');
        button.onclick = () => { state.order = state.sort === key && state.order === 'desc' ? 'asc' : 'desc';
          state.sort = key; state.offset = 0; void reload(); };
        cell.append(button);
      } else cell.textContent = name;
      heading.append(cell);
    });
    head.append(heading);
    payload.rows.forEach(row => {
      const line = document.createElement('tr');
      columns.forEach(([key]) => {
        const cell = document.createElement('td'); cell.textContent = formatValue(key, row[key], row);
        if (key === 'market_vs_theoretical_pct') cell.className = row[key] > 0 ? 'positive' : row[key] < 0 ? 'negative' : '';
        if (key === 'bond_name' && row.pricing_method === 'announced-redemption-bs') {
          cell.title = '已公告强赎：现金加短期期权公式';
          cell.textContent += ' · 已公告强赎';
        }
        line.append(cell);
      });
      body.append(line);
    });
    status.textContent = payload.rows.length ? '' : '没有符合查询条件的结果。';
    page.textContent = `${Math.floor(state.offset / state.limit) + 1} / ${Math.max(1, Math.ceil(payload.total / state.limit))}`;
    prev.disabled = state.offset === 0; next.disabled = state.offset + state.limit >= payload.total;
    root.querySelector('.pager').hidden = payload.total <= state.limit;
    root.querySelector('.source-note').textContent = '数据来源：好买基金研究中心，截止日期：' + state.date.replaceAll('-', '/');
    root.querySelector('.exclusions').textContent = payload.exclusions?.length
      ? `缺少历史输入，暂未定价：${payload.exclusions.map(row => `${row.bond_name}（${row.bond_code}）`).join('、')}` : '';
  }
  async function reload() {
    const key = ++request;
    controller?.abort(); controller = new AbortController();
    status.textContent = '正在读取模型结果…'; status.className = '';
    body.replaceChildren(); prev.disabled = next.disabled = true;
    try {
      const payload = await source.query({ ...state }, controller.signal);
      if (alive && key === request) paint(payload);
    } catch (error) {
      if (alive && key === request && error.name !== 'AbortError') {
        status.textContent = error.message; status.className = 'error';
      }
    }
  }
  form.onsubmit = event => { event.preventDefault(); state.q = search.value; state.offset = 0; void reload(); };
  day.onchange = () => { state.date = day.value; state.offset = 0; void reload(); };
  type.onchange = () => { state.bond_type = type.value; state.offset = 0; void reload(); };
  prev.onclick = () => { state.offset = Math.max(0, state.offset - state.limit); void reload(); };
  next.onclick = () => { state.offset += state.limit; void reload(); };
  const initial = new AbortController();
  source.dates(initial.signal).then(payload => {
    if (!alive) return;
    if (!payload.rows.length) throw new Error('暂无已计算的模型日。');
    payload.rows.forEach(row => { const option = document.createElement('option');
      option.value = row.model_date; option.textContent = row.model_date.replaceAll('-', '/'); day.append(option); });
    state.date = day.value; return reload();
  }).catch(error => { if (alive && error.name !== 'AbortError') { status.textContent = error.message; status.className = 'error'; } });
  return () => { alive = false; controller?.abort(); initial.abort(); root.replaceChildren(); };
}
