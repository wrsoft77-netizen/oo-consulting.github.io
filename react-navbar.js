(function () {
    var mountEl = document.getElementById("react-navbar-root");
    if (!mountEl || !window.React || !window.ReactDOM) {
        return;
    }

    function Navbar() {
        return React.createElement("nav", {
            className: "navbar",
            id: "navbar",
            dangerouslySetInnerHTML: {
                __html: `
        <div class="container">
            <a href="architecture.html" class="logo">
                <span class="logo-icon">🧠</span>
                RAG System
            </a>
            <ul class="nav-menu" id="navMenu">
                <li class="nav-item">
                    <a href="index.html" class="nav-link dropdown-trigger active">제안서</a>
                    <div class="dropdown-menu">
                        <a href="index.html#overview" class="dropdown-link">프로젝트 개요</a>
                        <a href="index.html#benefits" class="dropdown-link">기대 효과</a>
                        <a href="index.html#main-features" class="dropdown-link">주요 기능 상세</a>
                        <a href="index.html#ingest-features" class="dropdown-link">인제스트 기능</a>
                        <a href="index.html#ui-features" class="dropdown-link">운영 화면 (UI)</a>
                        <a href="index.html#deployment" class="dropdown-link">배포 및 운용</a>
                        <a href="index.html#operation" class="dropdown-link">운영 프로세스</a>
                        <a href="index.html#quick-start" class="dropdown-link">빠른 PoC 실행</a>
                    </div>
                </li>
                <li class="nav-item">
                    <a href="architecture.html" class="nav-link dropdown-trigger">아키텍처</a>
                    <div class="dropdown-menu">
                        <a href="architecture.html#features" class="dropdown-link">핵심 기능</a>
                        <a href="architecture.html#architecture" class="dropdown-link">시스템 아키텍처</a>
                        <a href="architecture.html#tech-stack" class="dropdown-link">기술 스택</a>
                        <a href="architecture.html#data-flow" class="dropdown-link">데이터 흐름</a>
                        <a href="architecture.html#api" class="dropdown-link">API</a>
                        <a href="architecture.html#formats" class="dropdown-link">지원 파일 형식</a>
                    </div>
                </li>
                <li class="nav-item">
                    <a href="tobe_proposal.html" class="nav-link dropdown-trigger">고도화 모델</a>
                    <div class="dropdown-menu">
                        <a href="tobe_proposal.html#phase1" class="dropdown-link">Phase 1: PostgreSQL 마이그레이션</a>
                        <a href="tobe_proposal.html#phase2" class="dropdown-link">Phase 2: 하이브리드 검색</a>
                        <a href="tobe_proposal.html#phase3" class="dropdown-link">Phase 3: LLM 성능 최적화</a>
                        <a href="tobe_proposal.html#phase4" class="dropdown-link">Phase 4: 데이터 파이프라인</a>
                        <a href="tobe_proposal.html#phase5" class="dropdown-link">Phase 5: Text-to-SQL</a>
                        <a href="tobe_proposal.html#phase6" class="dropdown-link">Phase 6: 사용자 경험 개선</a>
                        <a href="tobe_proposal.html#phase7" class="dropdown-link">Phase 7: 엔터프라이즈 & 고급 RAG</a>
                        <a href="tobe_proposal.html#roadmap" class="dropdown-link">Phase 8: 기술 스택 로드맵</a>
                    </div>
                </li>
                <li class="nav-item">
                    <a href="rocky-linux-migration-plan.html" class="nav-link dropdown-trigger">서버구축</a>
                    <div class="dropdown-menu">
                        <a href="rocky-linux-migration-plan.html#env-info" class="dropdown-link">환경 정보</a>
                        <a href="rocky-linux-migration-plan.html#flowchart" class="dropdown-link">작업 흐름도</a>
                        <a href="rocky-linux-migration-plan.html#step1" class="dropdown-link">Step 1: 서버 기본 설정</a>
                        <a href="rocky-linux-migration-plan.html#step2" class="dropdown-link">Step 2: 소스 코드 전송</a>
                        <a href="rocky-linux-migration-plan.html#step3" class="dropdown-link">Step 3: 환경 변수 설정</a>
                        <a href="rocky-linux-migration-plan.html#step4" class="dropdown-link">Step 4: 실행 및 검증</a>
                        <a href="rocky-linux-migration-plan.html#troubleshooting" class="dropdown-link">트러블슈팅</a>
                    </div>
                </li>
                <li><a href="index.html#contact" class="nav-link nav-cta">도입 문의</a></li>
            </ul>
            <div class="menu-toggle" id="menuToggle">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
                `
            }
        });
    }

    var root = ReactDOM.createRoot(mountEl);
    root.render(React.createElement(Navbar));
})();
