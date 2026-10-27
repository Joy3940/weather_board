// app.js – 화면 동작 (목록 그리기, 일정 추가)

let baseTasks = [];
let addedTasks = [];
let tasks = [];
const weatherByRegion = {};
const windTest = new URLSearchParams(window.location.search).get('test') === 'wind';

// 기본 일정은 JSON에서 먼저 읽고, 브라우저에는 화면에서 추가한 일정만 저장한다.
async function loadTasks() {
  const status = document.getElementById('taskStatus');
  const controls = [...document.getElementById('taskForm').elements];
  controls.forEach(control => { control.disabled = true; });
  status.textContent = '일정 목록을 불러오는 중…';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('data/tasks.json', { signal: controller.signal });
    if (!response.ok) throw new Error('일정 파일 오류: ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data) || !data.every(isTask)) throw new Error('잘못된 일정 데이터');
    baseTasks = data;
    status.textContent = '';
  } catch (error) {
    baseTasks = [];
    status.textContent = window.location.protocol === 'file:'
      ? '배포주소로열어주세요'
      : '일정 목록을 불러오지 못했습니다. 새로고침해 주세요.';
  } finally {
    clearTimeout(timer);
  }

  // JSON 읽기가 끝난 뒤에만 추가 일정을 읽는다. JSON 실패 시에도 추가 일정은 유지한다.
  try {
    const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
    if (!Array.isArray(saved) || !saved.every(isTask)) throw new Error('잘못된 저장 데이터');
    addedTasks = saved;
  } catch (error) {
    addedTasks = [];
    document.getElementById('msgBox').textContent = '브라우저에 저장한 추가 일정을 읽지 못했습니다.';
  }
  tasks = baseTasks.concat(addedTasks);
  renderTasks();
  controls.forEach(control => { control.disabled = false; });
}

function isTask(task) {
  return task && ['title', 'region', 'kind', 'owner'].every(key => typeof task[key] === 'string');
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
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

function addTask(e) {
  e.preventDefault();
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const nextAdded = addedTasks.concat(t);
  try {
    localStorage.setItem('wx_added', JSON.stringify(nextAdded));
  } catch (error) {
    document.getElementById('msgBox').textContent = '추가 일정을 저장하지 못했습니다. 브라우저 저장 설정을 확인해 주세요.';
    return;
  }
  addedTasks = nextAdded;
  tasks = baseTasks.concat(addedTasks);
  document.getElementById('msgBox').textContent = '';
  e.target.reset();
  renderTasks();
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

document.getElementById('taskForm').addEventListener('submit', addTask);
loadTasks();
renderTasks();
loadWeather();
