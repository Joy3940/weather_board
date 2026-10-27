// app.js – 화면 동작 (목록 그리기, 일정 추가)

let tasks = [];
const weatherByRegion = {};
const windTest = new URLSearchParams(window.location.search).get('test') === 'wind';

let taskDb = null;
let tasksLoaded = false;
let savingTask = false;
const TASK_COLUMNS = 'id,title,region,kind,owner';

function createTaskClient() {
  if (typeof SUPABASE_URL !== 'string' || !SUPABASE_URL.trim() ||
      typeof SUPABASE_PUBLIC_KEY !== 'string' || !SUPABASE_PUBLIC_KEY.trim()) {
    throw new Error('config.js에 Supabase 주소와 공개용 키를 입력해 주세요.');
  }
  const key = SUPABASE_PUBLIC_KEY.trim();
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!publicKey) {
    try {
      const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      publicKey = key.split('.').length === 3 && JSON.parse(atob(payload)).role === 'anon';
    } catch (error) {
      publicKey = false;
    }
  }
  if (!publicKey) throw new Error('공개용 publishable 또는 anon 키만 사용할 수 있습니다.');
  try {
    if (new URL(SUPABASE_URL).protocol !== 'https:') throw new Error('잘못된 주소');
  } catch (error) {
    throw new Error('config.js의 Supabase 프로젝트 HTTPS 주소를 확인해 주세요.');
  }
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error('Supabase 스크립트를 불러오지 못했습니다. 연결을 확인하고 새로고침해 주세요.');
  }
  return window.supabase.createClient(SUPABASE_URL.trim(), key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function setTaskFormDisabled(disabled) {
  [...document.getElementById('taskForm').elements].forEach(control => {
    control.disabled = disabled;
  });
}

async function loadTasks() {
  const status = document.getElementById('taskStatus');
  setTaskFormDisabled(true);
  tasksLoaded = false;
  status.textContent = '일정 목록을 불러오는 중…';
  if (!taskDb) {
    try {
      taskDb = createTaskClient();
    } catch (error) {
      status.textContent = error.message;
      return;
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const { data, error } = await taskDb.from('wx_tasks')
      .select(TASK_COLUMNS).order('id', { ascending: true }).abortSignal(controller.signal);
    if (error || !Array.isArray(data) || !data.every(isTask)) throw new Error('일정 조회 실패');
    tasks = data;
    tasksLoaded = true;
    status.textContent = data.length ? '' : '등록된 일정이 없습니다. 첫 일정을 추가해 주세요.';
    renderTasks();
  } catch (error) {
    status.textContent = '일정 목록을 불러오지 못했습니다. 연결 정보와 setup.sql 실행 여부를 확인한 뒤 새로고침해 주세요.';
  } finally {
    clearTimeout(timer);
    setTaskFormDisabled(!tasksLoaded);
  }
}

function isTask(task) {
  return task && ['title', 'region', 'kind', 'owner'].every(key => typeof task[key] === 'string') &&
    Object.hasOwn(REGIONS, task.region) && ['야외', '고소', '실내'].includes(task.kind);
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
  document.getElementById('saveMarkdown').disabled = tasks.length === 0;
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = judge(t.kind, w);
    const tr = document.createElement('tr');
    for (const v of [t.title, t.region, t.kind, t.owner, weatherText(w)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    td.textContent = r.text;
    td.className = r.level;
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

async function addTask(e) {
  e.preventDefault();
  if (!taskDb || !tasksLoaded || savingTask) return;
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner || !isTask(t)) return;
  const message = document.getElementById('msgBox');
  savingTask = true;
  setTaskFormDisabled(true);
  message.textContent = '저장 중…';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const { data, error } = await taskDb.from('wx_tasks').insert(t)
      .select(TASK_COLUMNS).single().abortSignal(controller.signal);
    if (error || !isTask(data)) throw new Error('일정 저장 실패');
    tasks.push(data);
    e.target.reset();
    message.textContent = '';
    document.getElementById('taskStatus').textContent = '';
    renderTasks();
  } catch (error) {
    message.textContent = '저장 완료를 확인하지 못했습니다. 입력은 유지했습니다. 새로고침해 목록을 확인한 뒤 다시 시도해 주세요.';
  } finally {
    clearTimeout(timer);
    savingTask = false;
    setTaskFormDisabled(false);
  }
}

function saveJudgmentMarkdown() {
  const body = document.getElementById('taskList');
  const table = body.closest('table');
  const headers = [...table.querySelectorAll('thead th')].map(cell => cell.textContent);
  const rows = [...body.rows].map(row => [...row.cells].map(cell => cell.textContent));
  const markdown = judgmentMarkdown(headers, rows, todayText);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `현장일정_판단_${todayText}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadWeather() {
  const status = document.getElementById('weatherStatus');
  const regions = Object.keys(REGIONS);
  const failed = [];
  let completed = 0;
  const testNotice = windTest ? ' · 강풍 시험: 수신한 풍속을 12m/s로 변경' : '';
  status.textContent = '오늘 날씨를 불러오는 중…' + testNotice;

  await Promise.all(regions.map(async region => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(weatherUrl(region), { signal: controller.signal });
      if (!response.ok) throw new Error('날씨 API 오류: ' + response.status);
      const weather = parseWeather(await response.json());
      if (windTest) weather.windMax = 12;
      weatherByRegion[region] = weather;
    } catch (error) {
      failed.push(region);
    } finally {
      clearTimeout(timer);
      completed += 1;
      renderTasks();
      const loaded = Object.keys(weatherByRegion).length;
      status.textContent = `오늘 날씨 ${loaded}/${regions.length}개 지역 수신` +
        (completed < regions.length ? ' · 불러오는 중…' : '') +
        (failed.length ? ` · ${failed.join(' · ')} 날씨를 받지 못했습니다. 새로고침해 주세요.` : '') +
        testNotice;
    }
  }));
}

const todayText = koreaDate();
const todayDate = document.getElementById('todayDate');
todayDate.textContent = todayText;
todayDate.dateTime = todayText;

document.getElementById('saveMarkdown').addEventListener('click', saveJudgmentMarkdown);
document.getElementById('taskForm').addEventListener('submit', addTask);
loadTasks();
renderTasks();
loadWeather();
