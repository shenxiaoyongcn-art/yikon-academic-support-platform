const tauri = window.__TAURI__;
const invoke = tauri?.core?.invoke;
const dialog = tauri?.dialog;

let datasets = [];
let activeDataset = null;
let lastQuery = '';
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
const showToast = (message, error = false) => {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3200);
};

document.querySelectorAll('.nav-button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.nav-button').forEach((item) => item.classList.toggle('active', item === button));
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
    $(`#${button.dataset.view}-view`).classList.add('active');
    if (button.dataset.view === 'analytics') refreshDatasets();
  });
});

async function pickImportFile() {
  if (!invoke || !dialog) return showToast('请在Yikon桌面客户端中使用本地导入功能。', true);
  try {
    const path = await dialog.open({ multiple: false, title: '导入业务数据', filters: [{ name: 'Excel或CSV', extensions: ['xlsx', 'xls', 'csv'] }] });
    if (!path) return;
    showToast('正在导入并建立本地索引…');
    const imported = await invoke('import_dataset', { path });
    await refreshDatasets(imported.id);
    showToast(`导入完成：${imported.rowCount.toLocaleString()}行`);
  } catch (error) { showToast(String(error), true); }
}

async function refreshDatasets(selectId) {
  if (!invoke) return;
  try {
    datasets = await invoke('list_datasets');
    renderDatasetList();
    const target = datasets.find((item) => item.id === selectId) || datasets.find((item) => item.id === activeDataset?.id) || datasets[0];
    if (target) await selectDataset(target);
    else showEmpty();
  } catch (error) { showToast(String(error), true); }
}

function renderDatasetList() {
  $('#dataset-list').innerHTML = datasets.map((dataset) => `<button class="dataset-item${dataset.id === activeDataset?.id ? ' active' : ''}" data-id="${dataset.id}"><span>${dataset.extension.toUpperCase()}</span><span><strong>${escapeHtml(dataset.name)}</strong><small>${dataset.rowCount.toLocaleString()}行 · ${escapeHtml(dataset.importedAt)}</small></span></button>`).join('');
  document.querySelectorAll('.dataset-item').forEach((button) => button.addEventListener('click', () => selectDataset(datasets.find((item) => item.id === Number(button.dataset.id)))));
}

function showEmpty() { activeDataset = null; $('#empty-state').classList.remove('hidden'); $('#dataset-workspace').classList.add('hidden'); }

async function selectDataset(dataset) {
  activeDataset = dataset;
  renderDatasetList();
  $('#empty-state').classList.add('hidden');
  $('#dataset-workspace').classList.remove('hidden');
  $('#dataset-name').textContent = dataset.name;
  $('#dataset-meta').textContent = `${dataset.sourceFile} · ${dataset.importedAt}`;
  $('#total-rows').textContent = dataset.rowCount.toLocaleString();
  $('#column-count').textContent = dataset.columns.length;
  const options = dataset.columns.map((column, index) => `<option value="${index}">${escapeHtml(column)}</option>`).join('');
  $('#dimension-select').innerHTML = options;
  $('#metric-select').innerHTML = `<option value="">不选择（记录数）</option>${options}`;
  $('#search-input').value = '';
  lastQuery = '';
  $('#aggregate-results').innerHTML = '';
  await runQuery();
}

async function runQuery() {
  if (!activeDataset) return;
  lastQuery = $('#search-input').value.trim();
  try {
    const result = await invoke('query_dataset', { datasetId: activeDataset.id, search: lastQuery, limit: 500 });
    $('#returned-rows').textContent = result.rows.length.toLocaleString();
    $('#table-head').innerHTML = `<tr>${result.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>`;
    $('#table-body').innerHTML = result.rows.map((row) => `<tr>${row.map((value) => `<td title="${escapeHtml(value)}">${escapeHtml(value)}</td>`).join('')}</tr>`).join('');
    if (!result.rows.length) $('#table-body').innerHTML = `<tr><td colspan="${Math.max(result.columns.length, 1)}">没有匹配记录</td></tr>`;
  } catch (error) { showToast(String(error), true); }
}

async function runAggregate() {
  if (!activeDataset) return;
  try {
    const rows = await invoke('aggregate_dataset', {
      datasetId: activeDataset.id,
      dimensionIndex: Number($('#dimension-select').value),
      metricIndex: $('#metric-select').value === '' ? null : Number($('#metric-select').value),
      operation: $('#operation-select').value,
      search: lastQuery,
    });
    const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
    $('#aggregate-results').innerHTML = rows.slice(0, 30).map((row) => `<div class="aggregate-row"><strong title="${escapeHtml(row.key)}">${escapeHtml(row.key || '未填写')}</strong><span class="aggregate-bar"><i style="width:${Math.max(2, Math.abs(row.value) / max * 100)}%"></i></span><b>${Number(row.value.toFixed(2)).toLocaleString()}</b></div>`).join('') || '<p>没有可汇总的数据。</p>';
  } catch (error) { showToast(String(error), true); }
}

async function exportCurrent() {
  if (!activeDataset || !dialog) return;
  try {
    const path = await dialog.save({ title: '导出查询结果', defaultPath: `${activeDataset.name}-查询结果.csv`, filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (!path) return;
    const count = await invoke('export_dataset_csv', { datasetId: activeDataset.id, search: lastQuery, path });
    showToast(`已导出${count.toLocaleString()}行`);
  } catch (error) { showToast(String(error), true); }
}

async function deleteCurrent() {
  if (!activeDataset || !confirm(`确认删除本机数据集“${activeDataset.name}”？源文件不会被删除。`)) return;
  try { await invoke('delete_dataset', { datasetId: activeDataset.id }); activeDataset = null; await refreshDatasets(); showToast('本地数据集已删除'); } catch (error) { showToast(String(error), true); }
}

$('#import-button').addEventListener('click', pickImportFile);
$('.import-shortcut').addEventListener('click', pickImportFile);
$('#search-button').addEventListener('click', runQuery);
$('#search-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') runQuery(); });
$('#aggregate-button').addEventListener('click', runAggregate);
$('#export-button').addEventListener('click', exportCurrent);
$('#delete-button').addEventListener('click', deleteCurrent);

if (!invoke) showToast('当前为浏览器预览，本地数据功能需安装桌面客户端。', true);
