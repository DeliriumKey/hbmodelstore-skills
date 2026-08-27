export const ALPHA_WEIGHT_STEPS = Object.freeze([1, 0.75, 0.5, 0.25, 0]);

export function alphaNumeric(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function alphaCombinedScore(row, alphaWeight) {
  const score = (
    alphaWeight * alphaNumeric(row?.alpha_rank) +
    (1 - alphaWeight) * alphaNumeric(row?.recent_state_rank)
  );
  return Math.round(score * 1e12) / 1e12;
}

export function formatAlphaRank(value) {
  return `${(alphaNumeric(value) * 100).toFixed(1)}%`;
}

export function formatAlphaDuration(value) {
  return `${alphaNumeric(value).toFixed(2)} 年`;
}

export function rankAlphaRows(
  rows,
  {
    alphaWeight = 0.75,
    sortKey = 'combinedScore',
    direction = 'descending',
  } = {},
) {
  const ranked = (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    combinedScore: alphaCombinedScore(row, alphaWeight),
  }));
  ranked.sort((left, right) => {
    const difference = alphaNumeric(left[sortKey]) - alphaNumeric(right[sortKey]);
    if (difference === 0) {
      return String(left.fund_code ?? '').localeCompare(
        String(right.fund_code ?? ''),
      );
    }
    return direction === 'ascending' ? difference : -difference;
  });
  return ranked;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const COLUMNS = Object.freeze([
  Object.freeze({ key: 'fund', label: '基金' }),
  Object.freeze({ key: 'implied_macaulay_duration', label: '隐含久期' }),
  Object.freeze({ key: 'alpha_rank', label: '240 日排名' }),
  Object.freeze({ key: 'recent_state_rank', label: '60 日排名' }),
  Object.freeze({ key: 'combinedScore', label: '组合得分' }),
]);

export function renderAlphaCrossSectionTable({
  root,
  payload,
  initialAlphaWeight = 0.75,
  pageSize = 20,
}) {
  if (!root) throw new Error('an Alpha cross-section root is required');
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  let alphaWeight = ALPHA_WEIGHT_STEPS.includes(initialAlphaWeight)
    ? initialAlphaWeight
    : 0.75;
  let sortKey = 'combinedScore';
  let direction = 'descending';
  let page = 1;

  root.innerHTML = `
    <div class="alpha-ranking-controls">
      <div class="alpha-ranking-weight-head">
        <span>组合权重</span>
        <strong data-alpha-weight></strong>
      </div>
      <input data-alpha-slider type="range" min="0" max="100" step="25"
        aria-label="调整240日Alpha与60日近期状态的组合权重">
    </div>
    <div class="alpha-ranking-heading">
      <strong>Alpha 截面排行</strong>
      <span>共 ${rows.length} 只</span>
    </div>
    <nav class="alpha-ranking-pages" data-alpha-pages aria-label="Alpha 截面排行分页"></nav>
    <div class="alpha-ranking-table-wrap">
      <table class="alpha-ranking-table">
        <thead><tr>${COLUMNS.map((column) =>
          column.key === 'fund'
            ? `<th class="fund">${column.label}</th>`
            : `<th><button type="button" data-sort="${column.key}">${column.label}<span data-sort-mark="${column.key}"></span></button></th>`,
        ).join('')}</tr></thead>
        <tbody data-alpha-body></tbody>
      </table>
    </div>`;

  const slider = root.querySelector('[data-alpha-slider]');
  const weightLabel = root.querySelector('[data-alpha-weight]');
  const body = root.querySelector('[data-alpha-body]');
  const pages = root.querySelector('[data-alpha-pages]');
  if (!slider || !weightLabel || !body || !pages) {
    throw new Error('unable to initialize Alpha cross-section table');
  }

  function render() {
    slider.value = String(alphaWeight * 100);
    weightLabel.textContent = `240 日 ${Math.round(alphaWeight * 100)}% · 60 日 ${Math.round((1 - alphaWeight) * 100)}%`;
    slider.setAttribute('aria-valuetext', weightLabel.textContent);
    const ranked = rankAlphaRows(rows, { alphaWeight, sortKey, direction });
    const pageCount = Math.max(1, Math.ceil(ranked.length / pageSize));
    page = Math.min(page, pageCount);
    const visible = ranked.slice((page - 1) * pageSize, page * pageSize);
    body.innerHTML = visible.length
      ? visible
          .map(
            (row) => `<tr>
              <td class="fund"><strong>${escapeHtml(row.fund_name || row.fund_code)}</strong><small>${escapeHtml(row.fund_code)}</small></td>
              <td>${formatAlphaDuration(row.implied_macaulay_duration)}</td>
              <td>${formatAlphaRank(row.alpha_rank)}</td>
              <td>${formatAlphaRank(row.recent_state_rank)}</td>
              <td><strong>${formatAlphaRank(row.combinedScore)}</strong></td>
            </tr>`,
          )
          .join('')
      : '<tr><td colspan="5" class="empty-row">当前条件下暂无已发布结果</td></tr>';
    pages.innerHTML = pageCount > 1
      ? Array.from({ length: pageCount }, (_, index) => {
          const target = index + 1;
          return `<button type="button" data-page="${target}" ${target === page ? 'aria-current="page"' : ''}>${target}</button>`;
        }).join('')
      : '';
    root.querySelectorAll('[data-sort-mark]').forEach((mark) => {
      mark.textContent = mark.getAttribute('data-sort-mark') === sortKey
        ? direction === 'descending' ? ' ↓' : ' ↑'
        : '';
    });
  }

  slider.addEventListener('input', () => {
    alphaWeight = Number(slider.value) / 100;
    page = 1;
    render();
  });
  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const sortButton = target?.closest('[data-sort]');
    if (sortButton) {
      const nextKey = sortButton.getAttribute('data-sort');
      if (nextKey) {
        direction = sortKey === nextKey && direction === 'descending'
          ? 'ascending'
          : 'descending';
        sortKey = nextKey;
        page = 1;
        render();
      }
      return;
    }
    const pageButton = target?.closest('[data-page]');
    if (pageButton) {
      page = Number(pageButton.getAttribute('data-page')) || 1;
      render();
    }
  });
  render();
  return () => {
    root.replaceChildren();
  };
}
