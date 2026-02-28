const { useState } = React;
const {
    ConfigProvider,
    Layout,
    Typography,
    Button,
    Card,
    Row,
    Col,
    Tag,
    Space,
    Steps,
    Menu,
    Drawer,
    Grid,
    FloatButton,
    Statistic,
    Divider,
    List,
    Progress
} = antd;

const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;

const NAV_LINKS = [
    { key: "overview", label: "개요" },
    { key: "value", label: "핵심 가치" },
    { key: "features", label: "주요 기능" },
    { key: "roadmap", label: "로드맵" },
    { key: "documents", label: "문서" },
    { key: "contact", label: "문의" }
];

const KPI_ITEMS = [
    { title: "PoC 착수", value: "2", suffix: "주 내" },
    { title: "문서 검색 정확도 목표", value: "90", suffix: "%+" },
    { title: "업무 응답시간 개선", value: "60", suffix: "%+" },
    { title: "운영 표준화", value: "100", suffix: "% UI" }
];

const VALUE_CARDS = [
    {
        title: "검색을 대화로 전환",
        summary: "키워드 기반 탐색에서 질문 기반 의사결정으로 전환합니다.",
        bullets: ["자연어 질문 지원", "답변 근거 문서 링크 제시", "업무 맥락 반영 요약"]
    },
    {
        title: "문서 운영 리스크 감소",
        summary: "파편화된 규정·지침·보고서를 하나의 표준 인터페이스로 통합합니다.",
        bullets: ["중복 조회 시간 감소", "최신 문서 우선 노출 정책", "권한 기반 접근 제어 연계"]
    },
    {
        title: "엔터프라이즈 배포 친화",
        summary: "온프레미스/폐쇄망 환경까지 고려한 운영 구조를 제공합니다.",
        bullets: ["PostgreSQL + pgvector", "모델 다운로드 제어", "관측/운영 절차 포함"]
    }
];

const FEATURE_CARDS = [
    {
        title: "RAG 검색 허브",
        tag: "Core",
        desc: "문서, 코드, 정책, 매뉴얼을 단일 UI에서 통합 검색하고 응답합니다.",
        progress: 92
    },
    {
        title: "인제스트 파이프라인",
        tag: "Data",
        desc: "PDF/DOCX/HWPX/Excel/OCR 자산을 표준화해 임베딩까지 자동화합니다.",
        progress: 88
    },
    {
        title: "운영 콘솔",
        tag: "Ops",
        desc: "색인 상태, 실패 로그, 모델 상태를 실시간으로 확인하고 대응합니다.",
        progress: 84
    },
    {
        title: "Text-to-SQL 확장",
        tag: "Advanced",
        desc: "문서형 지식검색과 정형 데이터 질의를 결합해 분석형 질문을 처리합니다.",
        progress: 80
    }
];

const ROADMAP_ITEMS = [
    {
        title: "Phase 1",
        description: "PostgreSQL 마이그레이션과 기초 검색 안정화"
    },
    {
        title: "Phase 2",
        description: "하이브리드 검색(BM25 + Vector)과 품질 튜닝"
    },
    {
        title: "Phase 3",
        description: "LLM 응답 정확도/속도 최적화"
    },
    {
        title: "Phase 4",
        description: "데이터 파이프라인 자동화 및 관측 체계 확립"
    },
    {
        title: "Phase 5+",
        description: "Text-to-SQL 및 고도화 기능 확장"
    }
];

const DOCUMENTS = [
    {
        title: "시스템 아키텍처",
        desc: "전체 기술 스택, API, 데이터 플로우를 상세히 확인합니다.",
        href: "architecture.html",
        cta: "아키텍처 보기"
    },
    {
        title: "고도화 제안서",
        desc: "단계별 확장 전략과 비용 대비 효과를 정리한 문서입니다.",
        href: "tobe_proposal.html",
        cta: "제안서 보기"
    },
    {
        title: "Rocky Linux 이관 계획",
        desc: "운영 환경 이관 절차와 트러블슈팅 가이드를 제공합니다.",
        href: "rocky-linux-migration-plan.html",
        cta: "이관 계획 보기"
    },
    {
        title: "Text-to-SQL 전략",
        desc: "문서 검색과 데이터 질의를 결합하는 전략 문서입니다.",
        href: "texttoSQL.html",
        cta: "전략 문서 보기"
    }
];

function SectionTitle({ id, eyebrow, title, description }) {
    return (
        <div id={id} className="section-anchor">
            <Tag bordered={false} color="blue" className="eyebrow-tag">
                {eyebrow}
            </Tag>
            <Title level={2} className="section-title">
                {title}
            </Title>
            <Paragraph className="section-description">{description}</Paragraph>
        </div>
    );
}

function App() {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.md;
    const [drawerOpen, setDrawerOpen] = useState(false);

    const navMenuItems = NAV_LINKS.map((item) => ({
        key: item.key,
        label: <a href={`#${item.key}`}>{item.label}</a>
    }));

    return (
        <ConfigProvider
            theme={{
                algorithm: antd.theme.defaultAlgorithm,
                token: {
                    colorPrimary: "#0C66E4",
                    colorSuccess: "#15803D",
                    colorWarning: "#C2410C",
                    colorInfo: "#0EA5E9",
                    colorBgBase: "#F4F8FD",
                    colorTextBase: "#0B1220",
                    borderRadius: 14,
                    fontFamily: "\"Noto Sans KR\", \"Segoe UI\", sans-serif"
                }
            }}
        >
            <Layout className="site-layout">
                <Header className="site-header">
                    <div className="header-inner">
                        <a className="brand" href="#overview">
                            <span className="brand-badge">RAG</span>
                            <span className="brand-name">Enterprise Proposal</span>
                        </a>

                        {isMobile ? (
                            <Button type="text" className="menu-button" onClick={() => setDrawerOpen(true)}>
                                메뉴
                            </Button>
                        ) : (
                            <Menu mode="horizontal" selectable={false} items={navMenuItems} className="top-menu" />
                        )}

                        <a href="#contact">
                            <Button type="primary" className="header-cta">
                                도입 상담
                            </Button>
                        </a>
                    </div>
                </Header>

                <Drawer
                    title="RAG Proposal Menu"
                    placement="right"
                    onClose={() => setDrawerOpen(false)}
                    open={drawerOpen}
                >
                    <Menu
                        mode="inline"
                        selectable={false}
                        items={navMenuItems}
                        onClick={() => setDrawerOpen(false)}
                    />
                </Drawer>

                <Content>
                    <section className="hero-section">
                        <div className="hero-backdrop" />
                        <div className="container">
                            <Row gutter={[28, 28]} align="middle">
                                <Col xs={24} lg={14}>
                                    <div className="reveal delay-1">
                                        <Tag color="gold" className="hero-kicker">
                                            React + Ant Design 표준 UI
                                        </Tag>
                                        <Title className="hero-title">
                                            전문적이고 세련된
                                            <br />
                                            RAG 제안 플랫폼
                                        </Title>
                                        <Paragraph className="hero-summary">
                                            화면 전반을 Ant Design 컴포넌트 표준으로 통일하고, 의사결정에 필요한 핵심 정보와
                                            실행 로드맵을 한 눈에 확인할 수 있도록 재설계했습니다.
                                        </Paragraph>
                                        <Space size="middle" wrap>
                                            <a href="#documents">
                                                <Button type="primary" size="large">
                                                    문서 바로가기
                                                </Button>
                                            </a>
                                            <a href="#roadmap">
                                                <Button size="large">로드맵 확인</Button>
                                            </a>
                                        </Space>
                                    </div>
                                </Col>

                                <Col xs={24} lg={10}>
                                    <Card className="hero-panel reveal delay-2" bordered={false}>
                                        <Text strong>프로젝트 목표</Text>
                                        <Divider style={{ margin: "12px 0" }} />
                                        <List
                                            size="small"
                                            dataSource={[
                                                "검색/요약/근거 제시를 단일 화면에서 처리",
                                                "폐쇄망/온프레미스 환경 운영성 확보",
                                                "문서형 + 데이터형 질의 확장 기반 마련"
                                            ]}
                                            renderItem={(item) => <List.Item>{item}</List.Item>}
                                        />
                                    </Card>
                                </Col>
                            </Row>

                            <Row gutter={[16, 16]} className="kpi-row">
                                {KPI_ITEMS.map((kpi, idx) => (
                                    <Col xs={12} md={6} key={kpi.title}>
                                        <Card className={`metric-card reveal delay-${idx + 1}`} bordered={false}>
                                            <Statistic title={kpi.title} value={kpi.value} suffix={kpi.suffix} />
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </div>
                    </section>

                    <section className="section-block">
                        <div className="container">
                            <SectionTitle
                                id="overview"
                                eyebrow="Overview"
                                title="프로젝트 개요"
                                description="본 페이지는 React 기반으로 전환되어, 관리·확장·재사용이 가능한 구조로 재정비되었습니다."
                            />
                            <Card className="overview-card reveal delay-2" bordered={false}>
                                <Paragraph>
                                    기존 정적 페이지 중심 구조를 Ant Design 표준 컴포넌트 체계로 변환했습니다. 그 결과,
                                    화면 일관성, 유지보수 생산성, 반응형 품질이 동시에 향상됩니다.
                                </Paragraph>
                                <Paragraph style={{ marginBottom: 0 }}>
                                    또한 핵심 제안 문서를 카드형 네비게이션으로 연결해, 경영진/실무진이 필요한 정보를 즉시
                                    확인할 수 있도록 UX를 개선했습니다.
                                </Paragraph>
                            </Card>
                        </div>
                    </section>

                    <section className="section-block alt">
                        <div className="container">
                            <SectionTitle
                                id="value"
                                eyebrow="Business Value"
                                title="핵심 가치"
                                description="검색 정확도뿐 아니라 운영 효율, 확장성, 의사결정 속도까지 함께 개선합니다."
                            />
                            <Row gutter={[18, 18]}>
                                {VALUE_CARDS.map((item, idx) => (
                                    <Col xs={24} lg={8} key={item.title}>
                                        <Card className={`value-card reveal delay-${idx + 1}`} bordered={false}>
                                            <Title level={4}>{item.title}</Title>
                                            <Paragraph>{item.summary}</Paragraph>
                                            <List
                                                size="small"
                                                split={false}
                                                dataSource={item.bullets}
                                                renderItem={(text) => <List.Item className="bullet-item">{text}</List.Item>}
                                            />
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </div>
                    </section>

                    <section className="section-block">
                        <div className="container">
                            <SectionTitle
                                id="features"
                                eyebrow="Features"
                                title="주요 기능 표준화"
                                description="핵심 기능을 Ant Design 컴포넌트와 일관된 인터랙션 규칙으로 구성했습니다."
                            />
                            <Row gutter={[18, 18]}>
                                {FEATURE_CARDS.map((feature, idx) => (
                                    <Col xs={24} md={12} key={feature.title}>
                                        <Card className={`feature-card reveal delay-${(idx % 3) + 1}`} bordered={false}>
                                            <Space direction="vertical" size={12} style={{ width: "100%" }}>
                                                <Space align="center" style={{ justifyContent: "space-between", width: "100%" }}>
                                                    <Title level={4} style={{ margin: 0 }}>
                                                        {feature.title}
                                                    </Title>
                                                    <Tag color="cyan">{feature.tag}</Tag>
                                                </Space>
                                                <Paragraph style={{ margin: 0 }}>{feature.desc}</Paragraph>
                                                <Progress percent={feature.progress} strokeColor="#0EA5E9" />
                                            </Space>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </div>
                    </section>

                    <section className="section-block alt">
                        <div className="container">
                            <SectionTitle
                                id="roadmap"
                                eyebrow="Roadmap"
                                title="실행 로드맵"
                                description="단계별 범위와 우선순위를 명확히 하여 빠른 PoC와 안정적인 확장을 동시에 달성합니다."
                            />
                            <Card className="roadmap-card reveal delay-2" bordered={false}>
                                <Steps
                                    direction={isMobile ? "vertical" : "horizontal"}
                                    current={2}
                                    items={ROADMAP_ITEMS}
                                />
                            </Card>
                        </div>
                    </section>

                    <section className="section-block">
                        <div className="container">
                            <SectionTitle
                                id="documents"
                                eyebrow="Documents"
                                title="상세 문서 바로가기"
                                description="기존 문서 자산은 유지하면서도, 접근성과 가독성을 강화했습니다."
                            />
                            <Row gutter={[18, 18]}>
                                {DOCUMENTS.map((doc, idx) => (
                                    <Col xs={24} md={12} key={doc.href}>
                                        <Card className={`doc-card reveal delay-${(idx % 3) + 1}`} bordered={false}>
                                            <Title level={4}>{doc.title}</Title>
                                            <Paragraph>{doc.desc}</Paragraph>
                                            <a href={doc.href}>
                                                <Button>{doc.cta}</Button>
                                            </a>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </div>
                    </section>

                    <section className="section-block contact-block" id="contact">
                        <div className="container">
                            <Card className="cta-card reveal delay-1" bordered={false}>
                                <Row gutter={[16, 16]} align="middle" justify="space-between">
                                    <Col xs={24} lg={16}>
                                        <Tag color="green" className="eyebrow-tag">
                                            Contact
                                        </Tag>
                                        <Title level={2} style={{ marginTop: 8 }}>
                                            도입 상담 및 맞춤형 제안
                                        </Title>
                                        <Paragraph style={{ marginBottom: 0 }}>
                                            현재 환경(인프라, 보안, 문서 유형)에 맞춰 현실적인 단계별 실행안을 함께 설계합니다.
                                        </Paragraph>
                                    </Col>
                                    <Col xs={24} lg={8}>
                                        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                                            <a href="mailto:oys@wrsoft.co.kr">
                                                <Button type="primary" size="large" block>
                                                    이메일 문의
                                                </Button>
                                            </a>
                                            <a href="architecture.html">
                                                <Button size="large" block>
                                                    기술 상세 확인
                                                </Button>
                                            </a>
                                        </Space>
                                    </Col>
                                </Row>
                            </Card>
                        </div>
                    </section>
                </Content>

                <Footer className="site-footer">
                    <div className="container footer-inner">
                        <Text>RAG Enterprise UI Standardized with React + Ant Design</Text>
                        <Text type="secondary">Last updated: 2026-02-28</Text>
                    </div>
                </Footer>
                <FloatButton.BackTop />
            </Layout>
        </ConfigProvider>
    );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<App />);
