# 리눅스 AI Agent 개발 계획서

> **작성일**: 2026-03-06
> **최종 수정**: 2026-03-07 (승인 프로세스 반영)
> **목적**: 웹 챗봇 인터페이스를 통해 리눅스 서버 운영 업무를 AI Agent가 수행하는 시스템 개발
> **대상 서버**: Rocky Linux 9, manager 계정 (sudo/wheel/docker 권한)

---

## 1. 개요

### 1.1 무엇을 만드는가

보안담당자 또는 OS 운영자가 **웹 브라우저에서 챗봇에게 자연어로 질문**하면,
백엔드의 **AI Agent가 리눅스 명령어를 직접 생성하고 실행**하여 결과를 분석하고 답변하는 시스템.

```
운영자: "메모리를 많이 쓰는 프로세스 상위 5개 보여줘"

AI Agent:
  1) 명령어 생성: ps aux --sort=-%mem | head -6
  2) 리눅스에서 실행
  3) 결과 분석
  4) 답변: "현재 메모리 점유 상위 5개 프로세스는..."
```

### 1.2 왜 만드는가

| 현재 (사람이 직접) | 개선 후 (AI Agent) |
|-------------------|-------------------|
| SSH 터미널 접속 필요 | 웹 브라우저만 있으면 됨 |
| 리눅스 명령어를 알아야 함 | 자연어로 질문하면 됨 |
| 결과를 사람이 해석 | AI가 분석하여 설명 |
| 여러 명령어를 순차 실행 | AI가 자동으로 연쇄 실행 |
| 보고서를 수동 작성 | AI가 종합 보고서 생성 |

### 1.3 기존 Security Console(v5)과의 관계

기존 v5는 **16개 고정 도구**만 사용하는 1단계 프로토타입이었다.
이번 개발은 **AI가 명령어를 동적으로 생성**하는 2단계 확장이다.

```
[1단계 - 기존 v5]  AI가 16개 도구 중 선택     → "who"만 가능, "w"는 불가
[2단계 - 이번]     AI가 명령어를 직접 작성     → 읽기 전용이면 뭐든 가능
[3단계 - 승인]     위험 명령어도 승인 후 실행   → 서비스 재시작, 패키지 설치 등 가능
```

---

## 2. 기술 해설: 웹 브라우저에서 리눅스 명령어까지

### 2.1 전체 아키텍처

```
[사용자 PC - 웹 브라우저]
    |
    | HTTPS 요청 (자연어 질문)
    v
[Tomcat 웹서버] ── React 정적 파일 서빙 (HTML/JS/CSS)
    |
    | WebSocket 양방향 통신
    v
[FastAPI 백엔드 - Python]
    |
    | Python 코드 내부 호출
    v
[AI Agent 엔진 - Python]
    |
    |  (A) 읽기 전용 명령어 → 자동 실행
    |  (B) 중위험 명령어 → 단순 승인 요청 → 사용자 승인 → 실행
    |  (C) 고위험 명령어 → 암호 입력 승인 요청 → 사용자 암호 확인 → 실행
    v
[리눅스 커널] ── 실제 명령어 실행
```

### 2.2 각 계층별 상세 설명

#### 계층 1: 웹 브라우저 (React)

사용자가 보는 화면이다. 챗봇 형태의 대화 인터페이스.

```
역할: 사용자 입력 수집 → 백엔드 전송 → 응답 표시 → 승인 UI 표시
기술: React 18, TypeScript, Tailwind CSS, Zustand (상태관리)
통신: WebSocket (실시간 스트리밍 + 승인 요청/응답)
```

사용자가 입력창에 "디스크 용량 확인해줘"를 입력하고 전송하면,
JavaScript가 WebSocket을 통해 백엔드에 JSON 메시지를 보낸다.

```javascript
// 브라우저에서 백엔드로 전송되는 데이터
ws.send(JSON.stringify({
    question: "디스크 용량 확인해줘",
    sessionId: "user-session-001"
}));
```

#### 계층 2: Tomcat 웹서버

React가 빌드된 정적 파일(HTML, JS, CSS)을 브라우저에 제공하고,
API 요청은 FastAPI 백엔드로 프록시(중계)한다.

```
브라우저 → https://서버/v5/          → Tomcat이 React 파일 전달
브라우저 → wss://서버/api/agent/ws   → Tomcat이 FastAPI로 중계
```

#### 계층 3: FastAPI 백엔드 (Python)

WebSocket 연결을 받아 AI Agent 엔진을 호출한다.

```python
# api.py - WebSocket 엔드포인트
@app.websocket("/agent/ws")
async def agent_websocket(ws: WebSocket):
    await ws.accept()
    data = await ws.receive_json()
    question = data["question"]

    # AI Agent 엔진 호출
    async for event in agent.investigate(question):
        await ws.send_json(event)
        # event 예시:
        # {"type": "thinking", "text": "디스크 용량을 확인하겠습니다"}
        # {"type": "command", "cmd": "df -h"}
        # {"type": "result", "output": "Filesystem  Size  Used ..."}
        # {"type": "answer", "text": "현재 디스크 사용률은..."}
```

#### 계층 4: AI Agent 엔진 (Python) - 핵심

이것이 전체 시스템의 **두뇌**이다.
AI(LLM)에게 질문을 전달하고, AI가 생성한 명령어를 실행하고,
결과를 다시 AI에게 전달하는 **반복 루프**를 수행한다.

```python
# agent.py - AI Agent 반복 루프 (개념 코드)
class LinuxAgent:
    async def investigate(self, question: str):
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question}
        ]

        for step in range(MAX_STEPS):  # 최대 10회 반복
            # (1) AI(LLM)에게 질문
            response = await self.call_llm(messages)

            # (2) AI가 명령어를 생성했는가?
            if response.has_command:
                command = response.command  # 예: "df -h"

                # (3) 권한 분류 판정
                auth_level = classify_command(command)

                if auth_level == "auto":
                    # 읽기 전용 → 자동 실행
                    result = await run_command(command)

                elif auth_level == "simple_approval":
                    # 중위험 → 단순 승인 요청
                    yield {"type": "approval_request",
                           "level": "simple",
                           "command": command,
                           "risk_info": get_risk_description(command)}
                    # 사용자 승인 대기
                    approved = await wait_for_approval()
                    if not approved:
                        yield {"type": "approval_denied"}
                        continue
                    result = await run_command(command)

                elif auth_level == "password_approval":
                    # 고위험 → 암호 입력 승인 요청
                    yield {"type": "approval_request",
                           "level": "password",
                           "command": command,
                           "risk_info": get_risk_description(command)}
                    # 사용자 암호 입력 대기
                    approved = await wait_for_password_approval()
                    if not approved:
                        yield {"type": "approval_denied"}
                        continue
                    result = await run_command(command)

                else:
                    # 절대 차단 (정의되지 않은 위험 명령)
                    yield {"type": "blocked", "cmd": command}
                    continue

                # (4) 실행 결과를 AI에게 전달
                messages.append({"role": "tool", "content": result.stdout})
                yield {"type": "result", "cmd": command, "output": result.stdout}

            # (5) AI가 최종 답변을 생성했으면 종료
            else:
                yield {"type": "answer", "text": response.text}
                break
```

**핵심 포인트**: AI는 한 번에 답하지 않는다.
"명령어 실행 → 결과 확인 → 추가 명령어 → 결과 확인 → 최종 답변"
이 과정을 **여러 번 반복**할 수 있다.

#### 계층 5: 리눅스 명령어 실행 (subprocess)

Python 표준 라이브러리 `subprocess`가 실제 리눅스 명령어를 실행한다.

```python
# Python이 리눅스 명령어를 실행하는 원리
import subprocess

result = subprocess.run(
    "ps aux --sort=-%mem | head -6",
    shell=True,           # 쉘을 통해 실행 (파이프 등 지원)
    capture_output=True,  # stdout, stderr 캡처
    text=True,            # 바이트가 아닌 문자열로 반환
    timeout=10,           # 10초 초과 시 강제 종료
    env={...},            # 환경변수 제한 (PATH만 설정)
)

# result.stdout = "USER  PID %CPU %MEM  VSZ  RSS TTY STAT ...\n..."
# result.stderr = "" (에러 없음)
# result.returncode = 0 (성공)
```

`subprocess.run()`은 Python 내부에서 리눅스 커널의 `fork() + exec()` 시스템콜을 호출한다.
즉, **새로운 프로세스를 생성하여 명령어를 실행하고, 그 출력을 문자열로 받아오는 것**이다.

```
Python 프로세스 (FastAPI)
    |
    | fork() — 자식 프로세스 생성
    v
자식 프로세스
    |
    | exec("ps aux --sort=-%mem") — ps 프로그램으로 교체
    v
ps 프로그램 실행 → 결과를 stdout 파이프로 전달
    |
    v
Python이 파이프에서 결과 읽기 → result.stdout에 저장
```

### 2.3 실행 흐름 전체 예시

사용자가 "최근 SSH 로그인 실패 분석해줘"라고 질문한 경우:

```
[1] 브라우저 → WebSocket → FastAPI
    {"question": "최근 SSH 로그인 실패 분석해줘"}

[2] FastAPI → AI Agent 엔진 시작

[3] AI Agent → LLM에게 질문 전달
    "사용자가 SSH 로그인 실패를 분석해달라고 합니다.
     사용 가능한 명령어를 생성하세요."

[4] LLM 응답:
    "journalctl -u sshd --since '24 hours ago' --no-pager | grep 'Failed'"

[5] 권한 분류: 로그 조회(읽기 전용) → 자동 허용

[6] subprocess.run() 실행:
    stdout = "Mar 06 03:22:11 sshd Failed password for admin from 10.0.0.55
              Mar 06 03:22:15 sshd Failed password for admin from 10.0.0.55
              Mar 06 03:22:18 sshd Failed password for root from 10.0.0.55
              ... (23건)"

[7] 결과를 LLM에게 전달

[8] LLM: "IP별로 집계하겠습니다"
    "journalctl -u sshd --since '24 hours ago' | grep 'Failed' | awk '{print $11}' | sort | uniq -c | sort -rn"

[9] 권한 분류: 로그 조회(읽기 전용) → 자동 허용

[10] subprocess.run() 실행:
     stdout = "23 10.0.0.55
                2 192.168.1.100"

[11] 결과를 LLM에게 전달

[12] LLM 최종 답변 생성:
     "최근 24시간 SSH 로그인 실패 분석 결과:
      - 10.0.0.55에서 23회 실패 (브루트포스 공격 의심)
      - 192.168.1.100에서 2회 실패 (단순 오입력 추정)
      권고: 10.0.0.55 IP를 방화벽에서 차단하는 것을 권장합니다."

[13] FastAPI → WebSocket → 브라우저에 답변 표시
```

이 과정에서 AI는 **2개의 명령어를 순차 실행**했다.
첫 번째 결과를 보고 "추가 분석이 필요하다"고 판단하여 두 번째 명령어를 생성한 것이다.

### 2.4 승인이 필요한 실행 흐름 예시

사용자가 "rag-api 컨테이너 재시작해줘"라고 요청한 경우:

```
[1] 브라우저 → WebSocket → FastAPI
    {"question": "rag-api 컨테이너 재시작해줘"}

[2] AI Agent → LLM 응답:
    "docker restart rag-api"

[3] 권한 분류: Docker 컨테이너 관리(중위험) → 단순 승인 필요

[4] 백엔드 → 브라우저로 승인 요청 전송:
    {
      "type": "approval_request",
      "level": "simple",
      "command": "docker restart rag-api",
      "risk_info": {
        "category": "Docker 컨테이너 관리",
        "risk_level": "중위험",
        "description": "컨테이너를 재시작합니다. 서비스가 일시적으로 중단됩니다.",
        "impact": "rag-api 서비스가 재시작되며, 진행 중인 요청이 중단될 수 있습니다."
      }
    }

[5] 브라우저에 승인 다이얼로그 표시:
    ┌───────────────────────────────────────────┐
    │  명령어 실행 승인 요청                       │
    │                                            │
    │  명령어: docker restart rag-api             │
    │  분류: Docker 컨테이너 관리 [중위험]         │
    │                                            │
    │  컨테이너를 재시작합니다.                     │
    │  서비스가 일시적으로 중단됩니다.               │
    │  진행 중인 요청이 중단될 수 있습니다.          │
    │                                            │
    │          [거부]          [승인]              │
    └───────────────────────────────────────────┘

[6] 사용자가 [승인] 클릭

[7] 브라우저 → 백엔드: {"type": "approval_response", "approved": true}

[8] 백엔드에서 명령어 실행 → 결과를 AI에게 전달

[9] AI 최종 답변: "rag-api 컨테이너가 정상적으로 재시작되었습니다."
```

### 2.5 고위험 암호 승인 실행 흐름 예시

사용자가 "방화벽에 9090 포트 열어줘"라고 요청한 경우:

```
[1] 브라우저 → WebSocket → FastAPI
    {"question": "방화벽에 9090 포트 열어줘"}

[2] AI Agent → LLM 응답:
    "firewall-cmd --add-port=9090/tcp --permanent"

[3] 권한 분류: 방화벽 설정(고위험) → 암호 입력 승인 필요

[4] 백엔드 → 브라우저로 고위험 승인 요청 전송:
    {
      "type": "approval_request",
      "level": "password",
      "command": "firewall-cmd --add-port=9090/tcp --permanent",
      "risk_info": {
        "category": "방화벽 설정 관리",
        "risk_level": "고위험",
        "description": "방화벽 포트를 영구적으로 개방합니다.",
        "impact": "외부에서 9090 포트로 접근이 가능해집니다. 보안 위험이 증가할 수 있습니다.",
        "warning": "이 작업은 서버 보안에 직접적인 영향을 미칩니다."
      }
    }

[5] 브라우저에 암호 입력 승인 다이얼로그 표시:
    ┌───────────────────────────────────────────────┐
    │  !! 고위험 명령어 - 관리자 암호 확인 필요 !!     │
    │                                                │
    │  명령어: firewall-cmd --add-port=9090/tcp       │
    │          --permanent                            │
    │  분류: 방화벽 설정 관리 [고위험]                  │
    │                                                │
    │  [!] 방화벽 포트를 영구적으로 개방합니다.         │
    │  [!] 외부에서 9090 포트로 접근이 가능해집니다.    │
    │  [!] 이 작업은 서버 보안에 직접 영향을 미칩니다.  │
    │                                                │
    │  관리자 암호: [________________]                 │
    │                                                │
    │          [거부]          [확인 및 실행]           │
    └───────────────────────────────────────────────┘

[6] 사용자가 암호 입력 후 [확인 및 실행] 클릭

[7] 브라우저 → 백엔드: {"type": "approval_response", "approved": true, "password": "***"}

[8] 백엔드에서 암호 검증 → 일치하면 명령어 실행

[9] AI: "firewall-cmd --reload" 추가 실행 (자동으로 reload 필요 판단)
    → 이것도 고위험이므로 다시 암호 승인 요청 (또는 세션 내 일괄 승인)

[10] AI 최종 답변: "방화벽에 9090/tcp 포트가 영구적으로 추가되었습니다."
```

---

## 3. AI가 명령어를 생성하는 원리: 시스템 프롬프트

AI(LLM)는 처음에 **시스템 프롬프트**를 받는다.
이것이 AI에게 "너는 리눅스 전문가이고, 명령어를 생성할 수 있다"고 알려주는 지시서이다.

```python
SYSTEM_PROMPT = """
당신은 Rocky Linux 9 서버의 운영 보조 AI Agent입니다.

## 역할
사용자의 질문에 대해 리눅스 명령어를 실행하여 정확한 정보를 제공합니다.

## 명령어 실행 규칙
1. 명령어를 실행하려면 <command>명령어</command> 형식으로 출력하세요.
2. 읽기 전용 명령어는 자동 실행됩니다.
3. 시스템 변경 명령어는 관리자 승인 후 실행됩니다. 승인이 거부되면 대안을 제시하세요.
4. 한 번에 하나의 명령어만 실행하세요.
5. 명령어 결과를 분석한 후 추가 명령어가 필요하면 실행할 수 있습니다.
6. 최종 답변은 사용자가 이해하기 쉽게 한국어로 작성하세요.

## 승인 체계
- 자동 실행: 시스템 모니터링, 로그 조회, 네트워크 진단 등 읽기 전용 명령어
- 단순 승인: 서비스 관리, 프로세스 제어, 파일 변경 등 중위험 명령어
- 암호 승인: 방화벽 변경, 계정 관리, 디스크 조작 등 고위험 명령어

## 서버 환경
- OS: Rocky Linux 9
- 사용자: manager (wheel, docker 그룹)
- Docker 컨테이너: rag-api, rag-ui, rag-vllm, rag-postgres 등 운영 중
"""
```

AI는 이 프롬프트를 기반으로 적절한 명령어를 **스스로 판단하여 생성**한다.
정형화된 16개가 아니라, 리눅스의 수천 개 명령어를 자유롭게 조합할 수 있다.

---

## 4. 권한 관리: 3단계 승인 프로세스

### 4.1 기존 방식과 변경점

```
[기존] 블랙리스트 차단 → 위험 명령어 무조건 거부 (업무 수행 불가)
[변경] 승인 프로세스   → 위험 명령어도 관리자 승인 후 실행 가능
```

| 항목 | 기존 (블랙리스트) | 변경 (승인 프로세스) |
|------|------------------|---------------------|
| 읽기 전용 | 자동 허용 | 자동 허용 (동일) |
| 서비스 재시작 | **차단** (systemctl 블랙리스트) | **단순 승인 후 실행** |
| 패키지 설치 | **차단** (dnf 블랙리스트) | **단순 승인 후 실행** |
| 방화벽 변경 | **차단** (firewall-cmd 블랙리스트) | **암호 승인 후 실행** |
| 계정 관리 | **차단** (useradd 블랙리스트) | **암호 승인 후 실행** |
| 시스템 재부팅 | **차단** (reboot 블랙리스트) | **암호 승인 후 실행** |

### 4.2 3단계 권한 구조

```
┌─────────────────────────────────────────────────────────────────────┐
│                       권한 3단계 구조                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [자동 허용]     읽기 전용 명령어 → 승인 없이 즉시 실행               │
│                  조회, 검색, 분석, 진단 명령어                        │
│                                                                     │
│  [단순 승인]     중위험 명령어 → 관리자 클릭 승인 후 실행              │
│                  위험성 안내 표시 + [거부] / [승인] 버튼               │
│                                                                     │
│  [암호 승인]     고위험 명령어 → 관리자 암호 입력 후 실행              │
│                  위험성 경고 표시 + 암호 입력 + [거부] / [확인 및 실행] │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 업무별 권한 분류표

> 기준 문서: `plans/rocky-linux-agent-tasks.html` (Linux 운영 업무 20선)

#### 자동 허용 (읽기 전용 — 승인 불필요)

| # | 업무 | 대표 명령어 | 설명 |
|---|------|-----------|------|
| 1 | 시스템 모니터링 및 리소스 확인 | `top`, `free -h`, `df -h`, `uptime`, `vmstat`, `iostat` | CPU, 메모리, 디스크 사용률 조회 |
| 3 | 로그 조회 및 분석 | `journalctl`, `tail -f`, `grep`, `less /var/log/*` | 시스템/서비스 로그 읽기 |
| 6 | 네트워크 상태 확인 및 진단 | `ip addr`, `ss -tulnp`, `ping`, `traceroute`, `curl -I` | 네트워크 상태 조회, 연결 테스트 |
| 17 | 환경 변수 및 쉘 설정 조회 | `env`, `printenv`, `echo $PATH`, `which`, `whereis` | 환경 변수 읽기, 명령어 경로 탐색 |

#### 단순 승인 (중위험 — 클릭 승인)

| # | 업무 | 위험도 | 대표 명령어 | 승인 시 안내 내용 |
|---|------|--------|-----------|-----------------|
| 2 | 서비스(데몬) 관리 | 중 | `systemctl start/stop/restart` | 서비스가 일시 중단됩니다. 의존 서비스에 영향을 줄 수 있습니다. |
| 4 | 패키지 설치/업데이트/제거 | 중 | `dnf install/update/remove` | 시스템에 패키지를 설치/변경합니다. 의존성이 함께 변경될 수 있습니다. |
| 5 | 파일/디렉토리 관리 | 중 | `cp`, `mv`, `rm`, `chmod`, `chown`, `rsync` | 파일을 변경/삭제합니다. 삭제된 파일은 복구가 어렵습니다. |
| 9 | 프로세스 관리 및 제어 | 중 | `kill`, `killall`, `renice` | 실행 중인 프로세스를 종료합니다. 서비스에 영향을 줄 수 있습니다. |
| 10 | SSH 접속 및 원격 관리 | 중 | `ssh`, `scp`, `sftp`, `ssh-keygen` | 원격 서버에 접속하거나 파일을 전송합니다. |
| 13 | 크론 스케줄 작업 관리 | 중 | `crontab -e` | 정기 실행 작업을 등록/수정합니다. 잘못 설정 시 반복 실행됩니다. |
| 14 | 백업 및 아카이브 | 중 | `tar`, `rsync` | 파일을 압축/전송합니다. 대용량 I/O가 발생할 수 있습니다. |
| 18 | SSL/TLS 인증서 관리 | 중 | `openssl`, `certbot renew` | 인증서를 갱신합니다. 실패 시 HTTPS 접속에 영향을 줍니다. |
| 19 | Docker 컨테이너 관리 | 중 | `docker start/stop/restart`, `docker exec`, `docker pull` | 컨테이너를 제어합니다. 서비스가 일시 중단될 수 있습니다. |

#### 암호 입력 승인 (고위험 — 암호 확인 필수)

| # | 업무 | 위험도 | 대표 명령어 | 승인 시 경고 내용 |
|---|------|--------|-----------|-----------------|
| 7 | 방화벽 설정 관리 | **고** | `firewall-cmd --add/remove-port`, `--reload` | 방화벽 규칙을 변경합니다. 외부 접근이 허용/차단되어 **서버 보안에 직접 영향**을 미칩니다. |
| 8 | 사용자 및 그룹 계정 관리 | **고** | `useradd`, `passwd`, `userdel`, `usermod`, `visudo` | 시스템 계정을 생성/수정/삭제합니다. **권한 에스컬레이션 위험**이 있습니다. |
| 11 | 디스크 및 파일시스템 관리 | **고** | `mount`, `umount`, `mkfs`, `fdisk`, `fsck` | 디스크 파티션/파일시스템을 변경합니다. **데이터 영구 손실 위험**이 있습니다. |
| 12 | SELinux 정책 관리 | **고** | `setenforce`, `chcon`, `setsebool` | 보안 정책을 변경합니다. **시스템 보안 수준이 변경**됩니다. |
| 15 | 커널 및 시스템 파라미터 조정 | **고** | `sysctl -w`, `sysctl -p` | 커널 파라미터를 변경합니다. **시스템 안정성에 영향**을 줄 수 있습니다. |
| 16 | LVM 논리 볼륨 관리 | **고** | `lvcreate`, `lvextend`, `lvremove`, `xfs_growfs` | 논리 볼륨을 생성/변경합니다. 잘못된 조작 시 **데이터 손실 위험**이 있습니다. |
| 20 | 시스템 재부팅 및 전원 관리 | **고** | `reboot`, `shutdown`, `poweroff`, `init 0/6` | 서버를 재부팅/종료합니다. **모든 서비스가 중단**됩니다. |

### 4.4 승인 프로세스 상세 설계

#### 단순 승인 흐름

```
AI가 중위험 명령어 생성
    │
    ▼
백엔드: classify_command() → "simple_approval"
    │
    ▼
WebSocket으로 승인 요청 전송 (위험성 안내 포함)
    │
    ▼
프론트엔드: 승인 다이얼로그 표시
  ┌─────────────────────────────────────┐
  │  [서비스 관리] 명령어 실행 승인       │
  │                                      │
  │  $ systemctl restart nginx           │
  │                                      │
  │  서비스가 일시 중단됩니다.             │
  │  의존 서비스에 영향을 줄 수 있습니다.  │
  │                                      │
  │       [거부]         [승인]           │
  └─────────────────────────────────────┘
    │                      │
    ▼                      ▼
  거부 응답 전송         승인 응답 전송
    │                      │
    ▼                      ▼
  AI에게 거부 전달       명령어 실행
  → 대안 제시            → 결과 전달
```

#### 암호 입력 승인 흐름

```
AI가 고위험 명령어 생성
    │
    ▼
백엔드: classify_command() → "password_approval"
    │
    ▼
WebSocket으로 고위험 승인 요청 전송 (경고 + 영향도 안내)
    │
    ▼
프론트엔드: 암호 입력 다이얼로그 표시
  ┌──────────────────────────────────────────┐
  │  !! 고위험 명령어 - 관리자 암호 확인 !!    │
  │                                           │
  │  $ firewall-cmd --add-port=9090/tcp       │
  │    --permanent                            │
  │                                           │
  │  [!] 방화벽 포트를 영구적으로 개방합니다.   │
  │  [!] 외부에서 접근이 가능해집니다.          │
  │  [!] 서버 보안에 직접 영향을 미칩니다.      │
  │                                           │
  │  관리자 암호: [________________]           │
  │                                           │
  │       [거부]       [확인 및 실행]           │
  └──────────────────────────────────────────┘
    │                         │
    ▼                         ▼
  거부 응답 전송            암호 + 승인 전송
    │                         │
    ▼                         ▼
  AI에게 거부 전달          백엔드에서 암호 검증
  → 대안 제시               ├─ 일치 → 명령어 실행
                            └─ 불일치 → 인증 실패 응답
```

### 4.5 WebSocket 메시지 프로토콜

#### 백엔드 → 프론트엔드 (승인 요청)

```json
{
  "type": "approval_request",
  "request_id": "req_abc123",
  "level": "simple | password",
  "command": "systemctl restart nginx",
  "risk_info": {
    "task_name": "서비스(데몬) 관리",
    "task_rank": 2,
    "category": "system",
    "risk_level": "mid | high",
    "description": "서비스를 재시작합니다.",
    "impact": "서비스가 일시적으로 중단됩니다.",
    "warning": "(고위험일 때만) 이 작업은 서버 보안에 직접적인 영향을 미칩니다."
  },
  "timeout_sec": 120
}
```

#### 프론트엔드 → 백엔드 (승인 응답)

```json
// 단순 승인
{
  "type": "approval_response",
  "request_id": "req_abc123",
  "approved": true
}

// 암호 승인
{
  "type": "approval_response",
  "request_id": "req_abc123",
  "approved": true,
  "password": "encrypted_password_hash"
}

// 거부
{
  "type": "approval_response",
  "request_id": "req_abc123",
  "approved": false
}
```

### 4.6 암호 검증 방식

```python
# 암호 검증: Linux PAM 또는 별도 설정
import crypt
import spwd  # shadow password

def verify_password(username: str, password: str) -> bool:
    """시스템 사용자 암호 검증 (PAM 기반)"""
    try:
        shadow = spwd.getspnam(username)
        stored_hash = shadow.sp_pwdp
        input_hash = crypt.crypt(password, stored_hash)
        return input_hash == stored_hash
    except (KeyError, PermissionError):
        return False
```

> **보안 참고**: 암호는 WebSocket 전송 시 해시화하여 전달하며,
> 백엔드에서 Linux PAM 또는 shadow 파일로 검증합니다.
> 암호는 메모리에서만 사용하고 즉시 폐기합니다. 로그에 기록하지 않습니다.

### 4.7 추가 안전 장치

| 장치 | 설명 |
|------|------|
| 실행 타임아웃 | 명령어 1개당 최대 15초, 초과 시 강제 종료 |
| 출력 길이 제한 | stdout 최대 500줄, 초과 시 잘라내기 |
| 반복 횟수 제한 | AI Agent 루프 최대 10회, 무한 반복 방지 |
| 감사 로그 | 실행한 모든 명령어를 타임스탬프와 함께 기록 (승인 여부 포함) |
| 동시 실행 제한 | 동시에 1개 세션만 명령어 실행 가능 |
| 승인 타임아웃 | 승인 요청 후 120초 내 응답 없으면 자동 거부 |
| 암호 시도 제한 | 고위험 승인 암호 오류 3회 시 세션 잠금 |
| 절대 차단 | 20개 업무 범위 밖의 위험 명령어는 승인 자체 불가 |

### 4.8 감사 로그 예시

모든 명령어 실행은 승인 이력과 함께 기록된다:

```
[2026-03-07 14:23:01] session=user-001 cmd="who" level=auto exit=0 duration=0.02s
[2026-03-07 14:23:03] session=user-001 cmd="last -10" level=auto exit=0 duration=0.05s
[2026-03-07 14:25:01] session=user-001 cmd="systemctl restart nginx" level=simple_approval approved=YES exit=0 duration=1.2s
[2026-03-07 14:27:15] session=user-001 cmd="firewall-cmd --add-port=9090/tcp --permanent" level=password_approval approved=YES auth_user=manager exit=0 duration=0.5s
[2026-03-07 14:28:01] session=user-002 cmd="rm -rf /tmp/old_data" level=simple_approval approved=NO reason=user_denied
[2026-03-07 14:30:01] session=user-002 cmd="dd if=/dev/zero of=/dev/sdb" level=BLOCKED reason=not_in_permitted_tasks
```

---

## 5. 허용 명령어 범위: 20개 업무 기준

> 전체 업무 정의는 `plans/rocky-linux-agent-tasks.html` 참조

### 5.1 자동 허용 업무 (4개)

```bash
# [1] 시스템 모니터링 및 리소스 확인
top / htop                        # CPU/메모리 프로세스 모니터링
free -h                           # 메모리 사용 현황
df -h                             # 디스크 사용량
iostat -x 1 5                     # 디스크 I/O 통계
vmstat 1 5                        # 가상 메모리, CPU 통계
uptime                            # 가동시간, 부하

# [3] 로그 조회 및 분석
journalctl -u [service] -f        # 서비스 로그 실시간
journalctl --since '1 hour ago'   # 시간 기반 필터링
tail -f /var/log/messages         # 시스템 메시지 로그
grep -E 'ERROR|WARN' /var/log/*   # 에러/경고 패턴 추출
less /var/log/secure              # SSH 보안 로그

# [6] 네트워크 상태 확인 및 진단
ip addr show                      # IP 주소 목록
ss -tulnp                         # 열린 포트 및 서비스
ping -c 4 [host]                  # 연결성 테스트
traceroute [host]                 # 네트워크 경로 추적
curl -I [url]                     # HTTP 헤더 확인

# [17] 환경 변수 및 쉘 설정 조회
env / printenv                    # 환경 변수 출력
echo $PATH                        # PATH 확인
which / whereis [cmd]             # 명령어 경로 탐색
```

### 5.2 단순 승인 업무 (9개)

```bash
# [2] 서비스 관리 (승인 필요)
systemctl status [service]        # 상태 확인 (자동 허용)
systemctl start/stop/restart      # 서비스 제어 (승인)
systemctl enable/disable          # 자동 시작 설정 (승인)

# [4] 패키지 관리 (승인 필요)
dnf search/info/list              # 패키지 검색 (자동 허용)
dnf install [package]             # 패키지 설치 (승인)
dnf update [package]              # 패키지 업데이트 (승인)
dnf remove [package]              # 패키지 제거 (승인)

# [5] 파일/디렉토리 관리 (승인 필요)
ls -alh / find (자동 허용)
cp -r [src] [dst]                 # 파일 복사 (승인)
mv [src] [dst]                    # 파일 이동 (승인)
rm -rf [path]                     # 파일 삭제 (승인)
chmod / chown                     # 권한 변경 (승인)

# [9] 프로세스 관리 (승인 필요)
ps aux / pgrep (자동 허용)
kill -9 [PID]                     # 프로세스 종료 (승인)
killall [name]                    # 일괄 종료 (승인)

# [10] SSH 접속 및 원격 관리 (승인 필요)
ssh user@host                     # 원격 접속 (승인)
scp / sftp                        # 파일 전송 (승인)

# [13] 크론 스케줄 관리 (승인 필요)
crontab -l (자동 허용)
crontab -e                        # 크론 편집 (승인)

# [14] 백업 및 아카이브 (승인 필요)
tar -tzvf (자동 허용)
tar -czvf / rsync                 # 백업 생성 (승인)

# [18] SSL/TLS 인증서 관리 (승인 필요)
openssl x509 -text (자동 허용)
certbot renew                     # 인증서 갱신 (승인)

# [19] Docker 컨테이너 관리 (승인 필요)
docker ps/logs/images (자동 허용)
docker start/stop/restart         # 컨테이너 제어 (승인)
docker exec                       # 컨테이너 접근 (승인)
docker pull / system prune        # 이미지 관리 (승인)
```

### 5.3 암호 입력 승인 업무 (7개)

```bash
# [7] 방화벽 설정 관리 (암호 필수)
firewall-cmd --list-all (자동 허용)
firewall-cmd --add-port/--remove-port --permanent  # (암호)
firewall-cmd --add-service --permanent              # (암호)
firewall-cmd --reload                               # (암호)

# [8] 사용자 및 그룹 계정 관리 (암호 필수)
id / groups / last / lastlog (자동 허용)
useradd -m -s /bin/bash [user]                      # (암호)
passwd [user]                                        # (암호)
userdel -r [user]                                    # (암호)
usermod -aG [group] [user]                           # (암호)

# [11] 디스크 및 파일시스템 관리 (암호 필수)
lsblk -f / df / du (자동 허용)
mount / umount                                       # (암호)
mkfs.xfs                                             # (암호)
fdisk / fsck                                         # (암호)

# [12] SELinux 정책 관리 (암호 필수)
getenforce / sestatus / ls -Z (자동 허용)
setenforce 0/1                                       # (암호)
chcon / restorecon                                   # (암호)
setsebool -P                                         # (암호)

# [15] 커널 파라미터 조정 (암호 필수)
sysctl -a / uname -r / dmesg (자동 허용)
sysctl -w [param]=value                              # (암호)
sysctl -p                                            # (암호)

# [16] LVM 논리 볼륨 관리 (암호 필수)
pvs / vgs / lvs (자동 허용)
lvextend / xfs_growfs                                # (암호)
lvcreate / lvremove                                  # (암호)

# [20] 시스템 재부팅/전원 관리 (암호 필수)
wall (자동 허용)
reboot                                               # (암호)
shutdown -r / shutdown -h                             # (암호)
poweroff / halt                                       # (암호)
```

---

## 6. AI Agent 고급 기능

### 6.1 연쇄 명령 실행 (Multi-Step)

AI가 한 번의 명령으로 부족하면 여러 번 실행한다:

```
질문: "서버 전체 건강 상태 점검해줘"

AI 실행 순서:
  (1) uptime                     → 자동 허용 → 가동시간 확인
  (2) free -h                    → 자동 허용 → 메모리 확인
  (3) df -h                      → 자동 허용 → 디스크 확인
  (4) docker ps                  → 자동 허용 → 컨테이너 확인
  (5) ss -tlnp                   → 자동 허용 → 포트 확인
  (6) journalctl --priority=err  → 자동 허용 → 최근 에러

최종 답변:
  "서버 건강 상태 종합 보고:
   - 가동시간: 15일
   - CPU 부하: 정상 (0.5)
   - 메모리: 64GB 중 45GB 사용 (70%) -- 주의
   - 디스크: /data 82% 사용 -- 주의
   - 컨테이너: 7개 모두 정상 실행 중
   - 열린 포트: 8개 (정상)
   - 최근 1시간 에러: 없음

   권고: 메모리와 디스크 사용량이 높습니다. 모니터링 필요."
```

### 6.2 승인이 포함된 연쇄 실행

```
질문: "nginx 서비스가 응답이 느린데 원인 분석하고 재시작해줘"

AI 실행 순서:
  (1) systemctl status nginx        → 자동 허용 (status는 읽기)
  (2) journalctl -u nginx --since "1h ago" | grep -E 'error|warn'
                                     → 자동 허용 (로그 읽기)
  (3) curl -o /dev/null -w '%{time_total}' http://localhost:80
                                     → 자동 허용 (네트워크 진단)

  AI 분석: "worker 프로세스에서 메모리 누수 패턴 감지, 재시작 권장"

  (4) systemctl restart nginx        → [단순 승인 요청]
      ┌──────────────────────────────────────┐
      │ 서비스 관리 [중위험]                   │
      │ $ systemctl restart nginx             │
      │                                       │
      │ nginx 서비스를 재시작합니다.            │
      │ 웹 서비스가 일시적으로 중단됩니다.      │
      │                                       │
      │       [거부]          [승인]            │
      └──────────────────────────────────────┘

  사용자 [승인] → 실행 → 성공

  (5) systemctl status nginx        → 자동 허용 (재시작 결과 확인)

최종 답변:
  "원인: nginx worker 프로세스 메모리 누수 감지
   조치: nginx 서비스 재시작 완료
   현재 상태: active (running), 응답 시간 정상 복귀 (0.02s)"
```

### 6.3 웹 UI에서 실행 과정 실시간 표시

사용자에게 AI의 사고 과정과 명령어 실행, 승인 요청을 실시간으로 보여준다:

```
[1단계] 실행: systemctl status nginx         ← 자동 허용
  결과: active (running), memory 512MB

[2단계] 실행: journalctl -u nginx...          ← 자동 허용
  결과: 3건의 worker process exit 발견

[3단계] !! 승인 필요 !!                        ← 승인 다이얼로그
  $ systemctl restart nginx
  [서비스 관리 / 중위험]
  서비스가 일시 중단됩니다.
  [거부] [승인]

  → 사용자가 [승인] 클릭

[4단계] 실행: systemctl restart nginx         ← 승인 후 실행
  결과: 성공

분석 결과:
  "nginx 서비스 재시작 완료..."
```

---

## 7. 개발 항목 (단계별)

### 7.1 단계 1: 명령어 분류 엔진 (백엔드)

기존 블랙리스트 기반 `sandbox.py`를 승인 기반 `classifier.py`로 대체한다.

| 파일 | 설명 | 상태 |
|------|------|------|
| `app/security/classifier.py` | 명령어 → 3단계 권한 분류 엔진 | **신규 개발** |
| `app/security/task_registry.py` | 20개 업무 정의 (명령어 → 업무 매핑) | **신규 개발** |
| `app/security/risk_info.py` | 업무별 위험성 안내 메시지 정의 | **신규 개발** |
| `app/security/sandbox.py` | 기존 블랙리스트 (분류 엔진으로 대체) | **대체 예정** |

**핵심 로직 개념**:
```python
# classifier.py
def classify_command(command: str) -> ClassifyResult:
    """
    명령어를 분석하여 권한 레벨을 결정한다.

    Returns:
        ClassifyResult(level, task_info, risk_info)
        - level: "auto" | "simple_approval" | "password_approval" | "blocked"
        - task_info: 해당 업무 정보 (이름, 카테고리, 위험도)
        - risk_info: 사용자에게 표시할 위험성 안내
    """
    base_cmd = extract_base_command(command)

    # 1) 20개 업무 레지스트리에서 매칭
    task = task_registry.match(base_cmd, command)
    if task is None:
        # 등록된 업무에 없는 명령어
        if is_readonly_command(base_cmd):
            return ClassifyResult(level="auto")
        return ClassifyResult(level="blocked", reason="허용된 업무 범위 밖")

    # 2) 같은 업무 내에서도 조회 vs 변경 구분
    if is_read_subcommand(command, task):
        return ClassifyResult(level="auto", task_info=task)

    # 3) 업무 위험도에 따라 승인 레벨 결정
    if task.risk == "low":
        return ClassifyResult(level="auto", task_info=task)
    elif task.risk == "mid":
        return ClassifyResult(level="simple_approval", task_info=task,
                              risk_info=task.approval_message)
    elif task.risk == "high":
        return ClassifyResult(level="password_approval", task_info=task,
                              risk_info=task.warning_message)
```

### 7.2 단계 2: 승인 WebSocket 프로토콜 (백엔드)

| 파일 | 설명 | 상태 |
|------|------|------|
| `app/security/approval.py` | 승인 요청/응답 관리 (타임아웃, 큐) | **신규 개발** |
| `app/security/auth.py` | 암호 검증 (Linux PAM) | **신규 개발** |
| `app/api.py` | WebSocket 핸들러에 승인 프로토콜 추가 | **수정** |
| `app/security/agent.py` | Agent 루프에 승인 대기 로직 추가 | **수정** |

**승인 대기 개념**:
```python
# approval.py
class ApprovalManager:
    def __init__(self):
        self._pending: dict[str, asyncio.Future] = {}

    async def request_approval(self, ws, command, level, risk_info, timeout=120):
        """승인 요청을 보내고 사용자 응답을 기다린다."""
        request_id = generate_id()
        future = asyncio.get_event_loop().create_future()
        self._pending[request_id] = future

        # 프론트엔드에 승인 요청 전송
        await ws.send_json({
            "type": "approval_request",
            "request_id": request_id,
            "level": level,
            "command": command,
            "risk_info": risk_info,
            "timeout_sec": timeout,
        })

        try:
            # 사용자 응답 대기 (타임아웃 포함)
            result = await asyncio.wait_for(future, timeout=timeout)
            return result
        except asyncio.TimeoutError:
            return {"approved": False, "reason": "timeout"}
        finally:
            self._pending.pop(request_id, None)

    def resolve(self, request_id, response):
        """프론트엔드에서 승인 응답이 왔을 때 호출"""
        if request_id in self._pending:
            self._pending[request_id].set_result(response)
```

### 7.3 단계 3: 승인 UI 컴포넌트 (프론트엔드)

| 파일 | 설명 | 상태 |
|------|------|------|
| `components/ApprovalDialog.tsx` | 단순 승인 다이얼로그 | **신규 개발** |
| `components/PasswordApprovalDialog.tsx` | 암호 입력 승인 다이얼로그 | **신규 개발** |
| `hooks/useSecurityStream.ts` | WebSocket에 승인 메시지 핸들러 추가 | **수정** |
| `store/securityStore.ts` | 승인 상태 관리 추가 | **수정** |
| `components/AgentMessage.tsx` | 승인 이벤트 렌더링 추가 | **수정** |

### 7.4 단계 4: 감사 로그 및 모니터링

| 파일 | 설명 | 상태 |
|------|------|------|
| `app/security/audit.py` | 명령어 실행 + 승인 이력 기록 | **신규 개발** |
| `components/AuditLog.tsx` | 감사 로그 뷰어 (관리자용) | **신규 개발** |

### 7.5 인프라

| 항목 | 설명 |
|------|------|
| Docker 볼륨 | 감사 로그 영구 저장, /var/log 호스트 마운트 |
| Tomcat 설정 | v5 프록시 경로 |
| 빌드 스크립트 | `./rag.sh --build`에 포함 |

---

## 8. 개발 일정 (단계별 구현)

| 단계 | 내용 | 주요 산출물 |
|------|------|------------|
| **1단계** | 명령어 분류 엔진 | `classifier.py`, `task_registry.py`, `risk_info.py` |
| **2단계** | 승인 WebSocket 프로토콜 | `approval.py`, `auth.py`, `api.py` 수정 |
| **3단계** | 프론트엔드 승인 UI | `ApprovalDialog.tsx`, `PasswordApprovalDialog.tsx` |
| **4단계** | 통합 테스트 및 감사 로그 | `audit.py`, `AuditLog.tsx` |
| **5단계** | 배포 및 검증 | 빌드, 20개 업무 전수 테스트 |

---

## 9. 사용 가능한 질문 예시 (운영자 업무별)

### 자동 실행 (승인 불필요)
```
"서버 상태 전체 점검해줘"
"CPU 많이 쓰는 프로세스 뭐야?"
"최근 SSH 로그인 실패 분석해줘"
"열린 포트 목록 보여줘"
"컨테이너 전체 상태 보여줘"
"오늘 에러 로그 있어?"
```

### 단순 승인 필요
```
"nginx 서비스 재시작해줘"           → 승인 다이얼로그
"htop 패키지 설치해줘"              → 승인 다이얼로그
"rag-api 컨테이너 재시작해줘"       → 승인 다이얼로그
"/tmp/old_backup 디렉토리 삭제해줘"  → 승인 다이얼로그
"좀비 프로세스 정리해줘"             → 승인 다이얼로그
```

### 암호 승인 필요
```
"방화벽에 9090 포트 열어줘"          → 암호 입력 다이얼로그
"새 사용자 계정 만들어줘"            → 암호 입력 다이얼로그
"서버 재부팅해줘"                    → 암호 입력 다이얼로그
"SELinux 모드 변경해줘"              → 암호 입력 다이얼로그
"/data 파티션 용량 늘려줘"           → 암호 입력 다이얼로그
```

---

## 10. 기대 효과

| 현재 | 도입 후 |
|------|--------|
| SSH 접속 → 명령어 입력 → 결과 해석 | 웹에서 질문 → 즉시 답변 |
| 리눅스 명령어 숙지 필요 | 한국어 자연어로 질문 |
| 여러 명령어 수동 조합 | AI가 자동 연쇄 실행 |
| 결과를 사람이 판단 | AI가 이상 탐지 + 권고 |
| 위험 작업은 아예 불가 | **승인 후 안전하게 실행 가능** |
| 누가 뭘 실행했는지 추적 불가 | **모든 명령어 감사 로그 기록** |
| 위험도 인지 없이 실행 | **위험성 안내 후 승인받아 실행** |

---

## 11. 요약

```
┌─────────────────────────────────────────────────────────────┐
│  사용자(웹 브라우저)                                          │
│  "방화벽에 9090 포트 열어줘"                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │ WebSocket
                   v
┌─────────────────────────────────────────────────────────────┐
│  FastAPI (Python 백엔드)                                     │
│  WebSocket 연결 관리, 승인 프로토콜 처리                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│  AI Agent 엔진 (Python)                                      │
│                                                              │
│  [반복 루프]                                                  │
│  (1) LLM에게 질문 전달                                        │
│  (2) LLM이 명령어 생성                                        │
│      "firewall-cmd --add-port=9090/tcp --permanent"          │
│  (3) 명령어 분류: 방화벽(고위험) → 암호 승인 필요               │
│  (4) 승인 요청 → 사용자에게 위험성 안내                         │
│      "방화벽 포트를 영구 개방합니다. 보안 영향 있음"              │
│  (5) 사용자 암호 입력 → 검증 통과                               │
│  (6) subprocess.run() → 리눅스 실행                            │
│  (7) 결과를 LLM에게 전달 → 최종 답변 생성                       │
│  (8) 감사 로그 기록                                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────┐
│  리눅스 커널                                                  │
│  명령어 실행 (승인된 20개 업무 범위 내)                          │
└─────────────────────────────────────────────────────────────┘
```

**핵심 변경: 기존 "차단" 방식에서 "승인 후 실행" 방식으로 전환.**
위험 명령어도 관리자가 위험성을 인지하고 승인하면 실행 가능하며,
모든 실행 이력은 감사 로그에 기록된다.
