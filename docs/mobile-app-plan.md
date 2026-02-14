# TEASY CRM — 모바일 앱 전환 계획

## 1. 개요

현재 TEASY CRM은 **데스크톱 전용 웹 앱**(Next.js + Chakra UI + Firebase)으로 운영 중.
모바일 사용자를 위해 **Capacitor**를 활용하여 동일 코드베이스에서 **안드로이드 앱**으로 전환한다.

### 기술 스택
| 구분 | 기술 |
|---|---|
| 프레임워크 | Next.js (Static Export) |
| UI 라이브러리 | Chakra UI (반응형 확장) |
| 네이티브 래퍼 | **Capacitor** |
| 대상 플랫폼 | Android (우선), iOS (향후) |
| 백엔드 | Firebase (기존 유지) |

---

## 2. 전환 전략: Capacitor

### 2.1 Capacitor란?
- 웹 앱을 네이티브 WebView에 감싸서 실행
- 기존 Next.js 코드를 **그대로** 사용 가능
- 카메라, 파일 시스템, 푸시 알림 등 네이티브 API 접근 가능
- Cordova 플러그인 호환

### 2.2 전환 흐름
```
Next.js App → Static Export (next export) → Capacitor → Android APK/AAB
```

### 2.3 주요 고려사항
- Next.js의 `output: 'export'` 설정 필요 (SSR → Static)
- API Routes 사용 불가 → Firebase 직접 호출 (현재 이미 이 방식)
- `next/image` → `<img>` 또는 unoptimized 설정 필요
- 인증 persistence: `browserSessionPersistence` → `browserLocalPersistence` (앱 환경)

---

## 3. 반응형 디자인 전략

### 3.1 브레이크포인트
| 구분 | 너비 | 대상 |
|---|---|---|
| `mobile` | ~767px | 스마트폰 |
| `tablet` | 768~1023px | 태블릿 (향후) |
| `desktop` | 1024px~ | PC (현재) |

### 3.2 화면 분기 방식
- `useDeviceType()` 훅으로 `isMobile` / `isDesktop` 분기
- 모바일: 하단 탭 네비게이션 + 풀스크린 레이아웃
- 데스크톱: 기존 좌측 사이드바 레이아웃 유지

### 3.3 모바일 전용 레이아웃
```
┌─────────────────────┐
│   Header (앱 바)      │
├─────────────────────┤
│                     │
│   Content Area      │
│   (스크롤 영역)       │
│                     │
├─────────────────────┤
│ 🏠  👤  💬  ⚙️      │
│ 홈  고객  채팅  설정   │
└─────────────────────┘
```

---

## 4. 페이지별 모바일 설계

### 4.1 Phase 1: 핵심 페이지 (우선)
| 페이지 | 모바일 설계 방향 |
|---|---|
| **로그인** | 풀스크린 로그인 폼 |
| **대시보드** | 카드 세로 스택, 스와이프 탭 |
| **고객 목록** | 검색 바 + 무한 스크롤 리스트 |
| **고객 상세** | 프로필 카드 + 타임라인 (세로) |
| **업무 채팅** | 전체 화면 채팅 UI |

### 4.2 Phase 2: 보고서 & 관리 (후순위)
| 페이지 | 모바일 설계 방향 |
|---|---|
| **보고서 작성** | 바텀 시트 모달 (풀스크린) |
| **업무 요청** | 목록 → 상세 네비게이션 |
| **재고 관리** | 카드형 리스트 (테이블 대체) |
| **관리자 페이지** | 데스크톱 전용 유지 |

---

## 5. 단계별 로드맵

### Phase 0: 인프라 구축 ✅ (현재)
- [x] `useDeviceType.ts` 훅 생성
- [x] `MobileLayout.tsx` Shell 컴포넌트 생성
- [x] `capacitor.config.ts` 설정 파일 생성
- [x] 모바일 앱 계획 문서 작성

### Phase 1: 반응형 레이아웃 적용
- [ ] 메인 레이아웃에 `useDeviceType` 분기 적용
- [ ] 모바일용 하단 탭 네비게이션 구현
- [ ] 로그인 페이지 모바일 대응
- [ ] 대시보드 모바일 대응

### Phase 2: 핵심 페이지 모바일 UI
- [ ] 고객 목록 모바일 UI
- [ ] 고객 상세 + 타임라인 모바일 UI
- [ ] 업무 채팅 모바일 UI
- [ ] 보고서 모달 → 모바일 풀스크린

### Phase 3: Capacitor 빌드 & 배포
- [ ] `next.config.js`에 `output: 'export'` 설정
- [ ] Capacitor 초기화 (`npx cap init`)
- [ ] Android 프로젝트 추가 (`npx cap add android`)
- [ ] 네이티브 플러그인 연동 (카메라, 파일)
- [ ] APK/AAB 빌드 & Google Play 배포

---

## 6. Capacitor 네이티브 플러그인 (예정)

| 플러그인 | 용도 |
|---|---|
| `@capacitor/camera` | 보고서 사진 촬영 |
| `@capacitor/filesystem` | 파일 다운로드/저장 |
| `@capacitor/push-notifications` | 업무 요청 알림 |
| `@capacitor/splash-screen` | 앱 시작 스플래시 |
| `@capacitor/status-bar` | 상태바 스타일링 |
| `@capacitor/keyboard` | 키보드 제어 |

---

## 7. 파일 구조

```
src/
├── components/
│   ├── layouts/
│   │   ├── MobileLayout.tsx      ← 모바일 전용 Shell
│   │   └── DesktopLayout.tsx     ← 기존 데스크톱 Shell (추출 예정)
│   └── mobile/                   ← 모바일 전용 컴포넌트 (Phase 2)
│       ├── MobileNavBar.tsx
│       ├── MobileCustomerList.tsx
│       └── ...
├── hooks/
│   └── useDeviceType.ts          ← 웹/모바일 분기 훅
capacitor.config.ts               ← Capacitor 설정
android/                          ← Phase 3에서 자동 생성
```
