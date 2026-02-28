(function () {
    var mountEl = document.getElementById("react-hero-root");
    if (!mountEl || !window.React || !window.ReactDOM) {
        return;
    }

    function Hero() {
        return React.createElement("section", {
            className: "hero",
            id: "hero",
            dangerouslySetInnerHTML: {
                __html: `
        <div class="container">
            <div class="hero-content">
                <span class="hero-badge">
                    System Proposal
                </span>
                <h1 class="hero-title">
                    RAG 시스템<br>
                    <span class="gradient-text">도입 제안서</span>
                </h1>
                <p class="hero-description">
                    RAG(Retrieval-Augmented Generation) 시스템으로 사내 문서와 외부 지식을 통합하여 업무 효율성을 극대화하는
                    AI 기반 지능형 검색 시스템의 도입을 제안드립니다. 하이브리드 검색, SSE 실시간 스트리밍, PaddleOCR 한국어 OCR을 지원합니다.
                </p>
                <div class="hero-buttons">
                    <a href="#overview" class="btn btn-primary">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        제안서 확인하기
                    </a>
                    <a href="architecture.html" class="btn btn-secondary">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        아키텍처 보기
                    </a>
                </div>
            </div>
        </div>
                `
            }
        });
    }

    var root = ReactDOM.createRoot(mountEl);
    root.render(React.createElement(Hero));
})();
