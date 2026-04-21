## 기업 데이터 흐름과 함께하는 솔루션 아키텍처

Architecture of solutions in data flow of enterprise

기업 데이터 플랫폼은 설비와 IoT 센서에서 발생하는 대량의 데이터를 체계적으로 수집하고 분석하는 플랫폼과 빅데이터를 기반으로 기업 특화용 인공지능(Artificial Intelligence)을 실현하여, 기업의 의사결정을 지원하는 통합 아키텍처입니다.

![Architecture of data lake in manufacturing industry](https://www.goodstream.co.kr/docs/solution/solution-datalake.svg)

제조 산업에서의 제조활동, 리거시시스템, 빅데이터 그리고 AI로 이어지는 생태계

### 전체 아키텍처 계층 구조 요약

| User UI/UX | Desktop, Web, Mobile, XR, Dashboard, AI Apps | 최종 사용자 접점으로 디바이스별 서비스 제공 |
| --- | --- | --- |
| API Gateway | REST API GW, SSO/OAuth, Webhook, Microservices | 내부/외부 API 통합 관리 및 인증/라우팅 |
| [Finetree AI Layer](https://www.goodstream.co.kr/docs/solution/finetree/index.html) | BOT, SQL, RAG, OCR | Data Lake 기반 로컬 LLM AI 어플리케이션 계층 |
| [Peak9 Insight](https://www.goodstream.co.kr/docs/solution/peaknine/peak9-insight.html) | AI/ML, 통계분석, 시뮬레이션 | Data Lake 데이터 기반 분석 및 인사이트 도출 |
| Data Lake | Cloud Store, TSDB, RDB, NoSQL, File Store | 정제된 데이터의 영구 저장 및 메타데이터 관리 |
| [Peak9 Edge](https://www.goodstream.co.kr/docs/solution/peaknine/peak9-edge.html) | Broker, Filter, Cleanse, Classification | 원천 데이터의 필터링, 정제, 분류, 가공 |
| [Peak9 Anchor](https://www.goodstream.co.kr/docs/solution/peaknine/peak9-anchor.html) | MES, ERP, SCADA, PLM, IoT, Sensor | 설비 및 시스템으로부터 원천 데이터 수집 |
| [Lotus Legacy](https://www.goodstream.co.kr/docs/solution/lotus/index.html) | SRM, MES, PMS | 기간계 Legacy 시스템의 데이터 공급원 |
| Central Services | GDPR, Meta관리, 품질관리, CI/CD, 모니터링 | 전체 플랫폼의 거버넌스 및 운영 관리 |

## 솔루션 선택 가이드

What we offer for manufacturing data platform

각 솔루션별 기업내 데이터 흐름에 맞추어 도입여부를 검토해 볼 수 있습니다.

### 제조 산업용 기간계 시스템

| [**Lotus:: SRM**](https://www.goodstream.co.kr/docs/solution/lotus/lotus-srm.html) | 데이터 생성 | **\[ 협력사 업무포탈 기반 통합 구매관리 시스템 \]**   \- 협력사 납품, 품질, 단가 정보를 Peak9 Anchor 수집 계층으로 공급   \- 구매 발주, 입고 실적, 검수 데이터를 자동 연동하여 실시간 파이프라인에 통합   \- 협력사 평가 이력 및 거래 데이터를 분석 파이프라인에 제공하여 SCM 인사이트 지원 |
| --- | --- | --- |
| [**Lotus:: MES**](https://www.goodstream.co.kr/docs/solution/lotus/lotus-mes.html) | 데이터 생성 | **\[ 중소/중견기업 ERP통합형 생산관리 시스템 \]**   \- 작업지시, 생산실적, 불량 이력 등 공정 핵심 데이터를 실시간으로 수집 계층에 공급   \- 설비 가동/비가동 상태 및 LOT 추적 데이터를 Data Lake 파이프라인에 자동 연계   \- 품질 검사 결과(SPC 데이터)를 포함한 생산 전 과정의 데이터를 체계적으로 수집 |
| [**Lotus:: PMS**](https://www.goodstream.co.kr/docs/solution/lotus/lotus-pms.html) | 데이터 생성 | **\[ 제조 협업형 프로젝트관리 시스템 \]**   \- 제조 프로젝트 일정, 진척율, 이슈 현황 데이터를 수집 계층으로 전달   \- 개발 단계별 산출물 및 변경 이력을 체계적으로 데이터 파이프라인에 공급   \- 원가, 공수, 자원 배분 실적 데이터를 분석 계층에 연계하여 프로젝트 인사이트 도출 지원 |

### 기업 특화형 로컬 인공지능 | LLM / AI

| [**Finetree:: OCR**](https://www.goodstream.co.kr/docs/solution/finetree/finetree-ocr.html) | 데이터 적재 | **\[ FAX/이미지 AI기반 데이터 변환 솔루션 \]**   \- PDF, 이미지, 스캔 문서 등 비정형 외부 문서에서 텍스트와 표 데이터를 자동 추출   \- FAX 수신 문서, 거래처 서류 등 다양한 채널의 문서를 인식하여 디지털 데이터로 변환   \- 비정형 데이터를 구조화된 형태로 정규화한 뒤 Data Lake에 직접 적재   \- OCR 결과의 신뢰도를 평가하고 자동/수동 검수 워크플로우를 통해 품질 보증 |
| --- | --- | --- |
| [**Finetree:: SQL**](https://www.goodstream.co.kr/docs/solution/finetree/finetree-sql.html) | 데이터 조회 | **\[ 자연어/AI 기반 내부 데이터베이스 조회 솔루션 \]**   \- 사용자의 자연어 질문을 분석하여 적절한 SQL 쿼리로 자동 변환(Text-to-SQL)   \- Data Lake 내 DB 스키마를 자동으로 인식하고 테이블/컬럼 구조를 매핑   \- 쿼리 실행 결과를 자연어로 요약하여 비개발자도 즉시 이해할 수 있는 응답 생성   \- 복잡한 조인, 집계 등 다단계 쿼리도 대화형 인터페이스로 단계적 생성 지원 |
| [**Finetree:: RAG**](https://www.goodstream.co.kr/docs/solution/finetree/finetree-rag.html) | 데이터 검색 | **\[ AI기반 기업 기술문서 통합 검색 시스템**   \- 기술 문서, 설비 매뉴얼 등 내부 문서를 벡터 임베딩하여 검색 인덱스 구축   \- 자원정보, 부품 이력, 표준작업 절차서 등을 문맥 기반 유사도 매칭으로 정확하게 검색   \- 검색된 문맥(Context)을 LLM에 전달하여 정확도 높은 답변을 생성(RAG 패턴)   \- 답변에 출처(Source) 추적 정보를 포함하여 검색 결과의 신뢰성과 추적성 확보 |
| [**Finetree:: BOT**](https://www.goodstream.co.kr/docs/solution/finetree/finetree-bot.html) | 자연어 처리 | **\[ 기업 특화형 통합 AI 솔루션 \]**   \- SQL, RAG, OCR 등 모든 Finetree 솔루션을 단일 대화 인터페이스에서 통합 호출   \- 사용자 질문의 의도를 자동 파악하여 적절한 AI 모듈로 라우팅하는 오케스트레이션 수행   \- Web Chat, Mobile, Slack/Teams, API 등 다채널 자연어 인터페이스를 통합 제공   \- 기업 AI 서비스 통합 게이트웨이로서 인증, 권한 관리, 사용 로깅을 일괄 처리 |

### 데이터 수집 · 처리 · 분석

| [**Peak9:: Anchor**](https://www.goodstream.co.kr/docs/solution/peaknine/peak9-anchor.html)   | 데이터 수집 | **\[ 설비 및 Iot장치의 데이터 수집 솔루션 \]**   \- 설비(PLC/HMI), IoT 센서, Edge 디바이스로부터 실시간 원천 데이터를 수집하는 진입점 역할 수행   \- MES, ERP, SCADA, PLM 등 제조 기간계 시스템과 연동하여 공정·품질·설비 데이터를 통합 인입   \- OPC/UA, MQTT, REST, Modbus, TCP 등 산업 표준 프로토콜을 지원하여 이기종 설비 간 데이터 호환성 확보   \- 비즈니스 이벤트 및 마이크로서비스 기반 스트림 데이터까지 포괄하는 멀티소스 수집 체계 구성             |
| --------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [**Peak9:: Edge**](https://www.goodstream.co.kr/docs/solution/peaknine/peak9-edge.html)       | 데이터 정제 | **\[ 데이터 정제, 분류, 가공, 전달용 엣지 컴퓨팅 솔루션 \]**   \- Message Broker를 통해 수집된 데이터를 실시간 스트림과 배치로 분리하여 라우팅   \- 노이즈 제거, 이상값 필터링, 결측치 보정 등 데이터 품질을 확보하는 Cleansing 처리 수행   \- 데이터 분류(Classification), 태깅, 스키마 매핑을 통해 Data Lake 적재에 적합한 정규화 형태로 가공   \- 정제 완료된 데이터를 Stream/Batch 방식으로 Data Lake에 전달하는 최종 게이트 역할                   |
| [**Peak9:: Insight**](https://www.goodstream.co.kr/docs/solution/peaknine/peak9-insight.html) | 데이터 분석 | **\[ 기업 내부 빅데이터 분석 및 시각화 솔루션 \]**   \- Data Lake에 축적된 데이터를 기반으로 AI/ML 플랫폼에서 예측 모델을 개발하고 학습 수행   \- 통계 분석 및 시뮬레이션을 통해 공정 최적화, 이상 감지, 품질 예측 등 인사이트를 도출   \- 모델 메타데이터를 체계적으로 관리하고 운영 모델(Operational Model)을 배포   \- 분석 결과를 상위 Finetree AI 계층 및 Visualization/API 서비스로 전달                                               |
| [**Peak9:: Rail**](https://www.goodstream.co.kr/docs/solution/peaknine/peak9-rail.html)       | 데이터 처리 | **\[ 열차 TCMS 시뮬레이터 \]**   \- 열차, 전철 등의 핵심 모듈인 TCMS를 데스트하기 위한 열차 시뮬레이터   \- 열차의 구성모듈인 Mascon, CCU, RIO, HMI, RMS, TCC, APU, TRS, BCD, DCU, FDU, HVAC, DI/DO에 대응   \- 열차 내부 TRDP 풀 스택, ETH, ECN/ETB, RS485, DI/DO 통신 네트워크 지원   \- 프로파일형 열차 및 모듈 구성, 가상 하드웨어 구성 및 데이터 프로토콜 링크   \- 열차 동작 시나리오 기반 시뮬레이션 동작으로 TCMS 완벽 지원 |
| [**Peak9:: RFID**](https://www.goodstream.co.kr/docs/solution/peaknine/peak9-rfid.html)       | 데이터 처리 | **\[ 이기종 리더 통합형 RFID 미들웨어 \]**   \- 리더별, 위치별 설정 프로파일 관리로 통합형 RFID시스템 운영관리   \- 원격 모니터링 대시보드 및 태그 이벤트에 대한 시나리오별 Action모델 구현   \- 생산, LOT추적, 물류, 품질분석 등 다양한 분야에서 식별자를 활용한 응용 프로그램 지원을 위한 Rest API 제공                                                                                                                  |