# 현장 일정 날씨판

오늘 현장 일정과 지역별 날씨를 한 화면에서 보고, 날씨 때문에 주의·중지를 검토할 일정을 표시합니다. 교육용 가상 데이터만 사용합니다.

## Supabase 연결
1. Supabase 프로젝트의 SQL Editor에서 [setup.sql](setup.sql) 전체를 실행합니다. wx_tasks 표, 지역·구분 제약조건, RLS, 조회·추가 권한과 초기 가상 일정 6건을 만듭니다. 같은 파일을 다시 실행해도 초기 일정은 중복되지 않습니다.
2. [config.js](config.js)의 두 줄에 프로젝트 URL과 공개용 publishable 키(또는 기존 anon 키)를 직접 입력합니다.

```js
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_PUBLIC_KEY = 'YOUR_PUBLISHABLE_OR_ANON_KEY';
```

secret·service_role 키는 사용하지 않습니다. 공개용 키는 브라우저에 전달되며 권한은 DB의 RLS와 GRANT로 제한합니다. 이 교육용 공유 표는 로그인 없이 누구나 조회·추가할 수 있고, 수정·삭제는 허용하지 않습니다.

3. 정적 파일을 배포한 HTTP/HTTPS 주소로 엽니다. DB에서 읽고, 일정 추가도 DB에 저장합니다. 새로고침하면 다른 기기에서 추가한 일정도 보입니다. 실시간 자동 갱신은 하지 않습니다.

기존 data/tasks.json과 브라우저의 wx_added 데이터는 앱에서 읽거나 자동 이전하지 않습니다. JSON은 이전 단계 참고 자료로 남깁니다. 연결 설정이 비어 있거나 조회가 실패하면 화면에 안내하고 추가를 막습니다. 저장 실패 시 입력과 기존 목록을 유지합니다. 저장 완료 여부가 불확실하면 먼저 새로고침해 중복 여부를 확인하세요.

## 확인 방법
- T-01: SQL 실행과 설정 입력 후 배포 주소에서 초기 일정 6건이 나타나는지 확인합니다.
- T-02: 가상 일정을 추가한 뒤 새로고침하거나 다른 브라우저에서 열어 DB 저장을 확인합니다. 네트워크를 끊고 추가하면 입력이 유지되고 성공한 것처럼 행이 늘지 않아야 합니다.
- T-03: 지역별 날씨와 판단을 확인합니다. 날씨 API가 실패해도 DB 일정은 남아야 합니다.
- T-04: 주소 끝에 ?test=wind를 붙이면 고소 일정이 중지 검토로 표시됩니다.
- Markdown: 오늘 판단 md로 저장을 누르면 현재 표와 판단 기준이 현장일정_판단_YYYY-MM-DD.md로 내려받아집니다.
- DB 제약: SQL Editor에서 region='서울' 또는 kind='기타'인 가상 행을 넣으면 CHECK 오류가 나야 합니다. 정상 지역·구분은 각각 세종·대전·태안·보령과 야외·고소·실내입니다.

## 파일
| 파일 | 역할 |
|---|---|
| index.html · style.css | 화면과 디자인 |
| logic.js | 날씨 URL·응답 해석, 판단 규칙, Markdown 생성 |
| app.js | Supabase 조회·추가, 날씨 호출, 화면 갱신과 다운로드 |
| config.js | 프로젝트 URL과 공개용 키 두 줄 |
| setup.sql | 사용자가 직접 실행할 DB 초기 설정 |
| data/tasks.json | 이전 단계 참고용 가상 일정 |
| PRD.md · CLAUDE.md | 요구사항과 작업 규칙 |

Supabase SDK는 https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 에서 읽습니다. 외부 스크립트는 이 SDK 하나만 사용합니다. 날씨 제공: [Open-Meteo](https://open-meteo.com/).
