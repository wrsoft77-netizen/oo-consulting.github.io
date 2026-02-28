(function () {
    var mountEl = document.getElementById("react-overview-root");
    if (!mountEl || !window.React || !window.ReactDOM) {
        return;
    }

    function Overview() {
        return React.createElement("div", {
            dangerouslySetInnerHTML: {
                __html: `
<section class="section" id="overview">
        <div class="container">
            <div class="section-header">
                <span class="section-label">Why RAG?</span>
                <h2 class="section-title">왜 RAG 시스템이 필요한가요?</h2>
                <p class="section-description">
                    "문서는 쌓여가는데, 정작 필요한 정보는 찾기 어렵지 않으신가요?"<br>
                    단순 검색을 넘어, AI가 문서를 '이해'하고 '답변'해주는 새로운 업무 경험을 제안합니다.
                </p>
            </div>

            <div class="target-audience-box" style="margin-top: 2rem; margin-bottom: 3rem;">
                <div class="features-grid" style="grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <!-- Traditional Search -->
                    <div class="card"
                        style="border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05);">
                        <h3 class="card-title" style="color: #ef4444; margin-bottom: 1rem;">❌ 기존 키워드 검색의 한계</h3>
                        <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px;">
                            <li style="display: flex; gap: 10px;">
                                <span>😓</span>
                                <div>
                                    <strong>정확한 단어를 모르면 검색 불가</strong><br>
                                    <span style="font-size: 0.9em; opacity: 0.8;">"그.. 작년에 했던 프로젝트 이름이 뭐지?" (검색
                                        실패)</span>
                                </div>
                            </li>
                            <li style="display: flex; gap: 10px;">
                                <span>📄</span>
                                <div>
                                    <strong>수십 개의 문서 파일을 일일이 열람</strong><br>
                                    <span style="font-size: 0.9em; opacity: 0.8;">검색된 20개 첨부파일을 하나씩 열어서 내용 확인</span>
                                </div>
                            </li>
                            <li style="display: flex; gap: 10px;">
                                <span>🧩</span>
                                <div>
                                    <strong>정보의 파편화</strong><br>
                                    <span style="font-size: 0.9em; opacity: 0.8;">규정과 지침이 여러 문서에 흩어져 있어 종합적 판단
                                        불가능</span>
                                </div>
                            </li>
                        </ul>
                    </div>

                    <!-- RAG Search -->
                    <div class="card"
                        style="border: 1px solid rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.05);">
                        <h3 class="card-title" style="color: #10b981; margin-bottom: 1rem;">⭕ RAG 시스템의 해결책</h3>
                        <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px;">
                            <li style="display: flex; gap: 10px;">
                                <span>🗣️</span>
                                <div>
                                    <strong>사람에게 묻듯이 자연어로 질문</strong><br>
                                    <span style="font-size: 0.9em; opacity: 0.8;">"작년 금융 프로젝트 이슈 사항 요약해줘" (의도 파악
                                        성공)</span>
                                </div>
                            </li>
                            <li style="display: flex; gap: 10px;">
                                <span>💡</span>
                                <div>
                                    <strong>핵심 내용만 즉도 요약 답변</strong><br>
                                    <span style="font-size: 0.9em; opacity: 0.8;">문서를 열 필요 없이 AI가 내용을 읽고 3줄로 요약</span>
                                </div>
                            </li>
                            <li style="display: flex; gap: 10px;">
                                <span>🔗</span>
                                <div>
                                    <strong>근거 문서 자동 제시</strong><br>
                                    <span style="font-size: 0.9em; opacity: 0.8;">대답의 근거가 되는 페이지를 바로 링크로 제공하여 신뢰도
                                        확보</span>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div style="width: 100%; margin-top: 4rem;">
                <!-- margin: 0 auto removed from here to allow full width alignment -->
                <div class="architecture-info" style="width: 100%;">
                    <h3 class="section-title" style="font-size: 1.5rem; margin-bottom: 2rem; text-align: center;">어떤 조직에
                        필요한가요?</h3>
                    <div class="features-grid" style="grid-template-columns: repeat(3, 1fr); gap: 1.5rem;">
                        <!-- Row 1 -->
                        <div class="info-card"
                            style="text-align: left; height: 100%; align-items: flex-start; display: flex; flex-direction: column; justify-content: flex-start;">
                            <div class="info-icon blue" style="margin-bottom: 1rem; align-self: flex-start;">🏢</div>
                            <div class="info-content">
                                <h4 style="margin-bottom: 0.5rem;">신규 입사자가 많은 조직</h4>
                                <p style="font-size: 0.95rem; line-height: 1.6;">"회사 규정이 뭐예요?" 반복되는 단순 질문에 AI가 24시간 자동
                                    응답하여 온보딩 시간을 50% 단축합니다.</p>
                            </div>
                        </div>
                        <div class="info-card"
                            style="text-align: left; height: 100%; align-items: flex-start; display: flex; flex-direction: column; justify-content: flex-start;">
                            <div class="info-icon purple" style="margin-bottom: 1rem; align-self: flex-start;">⚖️</div>
                            <div class="info-content">
                                <h4 style="margin-bottom: 0.5rem;">규정이 복잡한 금융/공공</h4>
                                <p style="font-size: 0.95rem; line-height: 1.6;">수천 페이지의 법령과 내부 규정을 AI가 실시간으로 교차 검색하고
                                    분석하여 업무 리스크를 최소화합니다.</p>
                            </div>
                        </div>
                        <div class="info-card"
                            style="text-align: left; height: 100%; align-items: flex-start; display: flex; flex-direction: column; justify-content: flex-start;">
                            <div class="info-icon green" style="margin-bottom: 1rem; align-self: flex-start;">🛠️</div>
                            <div class="info-content">
                                <h4 style="margin-bottom: 0.5rem;">기술 문서가 방대한 연구소</h4>
                                <p style="font-size: 0.95rem; line-height: 1.6;">과거의 모든 실험 데이터와 트러블슈팅 이력을 즉시 찾아주어 중복 연구를
                                    방지하고 효율을 높입니다.</p>
                            </div>
                        </div>

                        <!-- Row 2 (Added) -->
                        <div class="info-card"
                            style="text-align: left; height: 100%; align-items: flex-start; display: flex; flex-direction: column; justify-content: flex-start;">
                            <div class="info-icon orange" style="margin-bottom: 1rem; align-self: flex-start;">🎧</div>
                            <div class="info-content">
                                <h4 style="margin-bottom: 0.5rem;">IT 헬프데스크 / 고객센터</h4>
                                <p style="font-size: 0.95rem; line-height: 1.6;">단순 반복 문의를 AI가 1차 처리하여, 상담원은 고부가가치 문제
                                    해결에만 집중할 수 있습니다.</p>
                            </div>
                        </div>
                        <div class="info-card"
                            style="text-align: left; height: 100%; align-items: flex-start; display: flex; flex-direction: column; justify-content: flex-start;">
                            <div class="info-icon blue"
                                style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; margin-bottom: 1rem; align-self: flex-start;">
                                💻</div>
                            <div class="info-content">
                                <h4 style="margin-bottom: 0.5rem;">업무 시스템 Q&A 자동화</h4>
                                <p style="font-size: 0.95rem; line-height: 1.6;">ERP, 그룹웨어 등 사내 시스템 사용법 문의를 AI 챗봇이 즉답하여
                                    IT 지원 부담을 대폭 경감합니다.</p>
                            </div>
                        </div>
                        <div class="info-card"
                            style="text-align: left; height: 100%; align-items: flex-start; display: flex; flex-direction: column; justify-content: flex-start;">
                            <div class="info-icon purple"
                                style="background: rgba(168, 85, 247, 0.2); color: #a855f7; margin-bottom: 1rem; align-self: flex-start;">
                                📚</div>
                            <div class="info-content">
                                <h4 style="margin-bottom: 0.5rem;">매뉴얼/도움말 지능화</h4>
                                <p style="font-size: 0.95rem; line-height: 1.6;">정적인 PDF 매뉴얼 대신, "이런 경우엔 어떻게 해?"라고 물으면
                                    바로 답을 주는 대화형 도움말을 제공합니다.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
`            }
        });
    }

    var root = ReactDOM.createRoot(mountEl);
    root.render(React.createElement(Overview));
})();
