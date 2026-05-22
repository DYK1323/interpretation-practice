# 바이브코딩 강의안 PPT

_Started 2026-05-22 12:43 UTC_

---

## User

레퍼런스 이미지를 참고해서 바이브코딩 강의안 ppt를 제작해줘.

## Assistant

_[tool: update_todos]_

레퍼런스 이미지의 깔끔한 디자인 스타일(흰색 배경 + 코발트 블루 강조색 + 카드형 레이아웃 + 한국어 타이포그래피)을 참고해서 오리지널 디자인으로 제작하겠습니다. 브랜드는 직접 차용하지 않고 시각적 톤만 가져옵니다.

먼저 슬라이드 컴포넌트를 설치하고 작업을 시작합니다.

_[tool: copy_starter_component]_

_[tool: write_file]_

이제 디자인 시스템을 정하고 슬라이드를 작성합니다.

**디자인 시스템:**
- 폰트: Pretendard (한국어)
- 배경: #F5F6F8 (페이지), #FFFFFF (카드)
- 강조색: #2D4EFF (코발트 블루), #EEF2FF (연한 블루 틴트)
- 텍스트: #0F172A (다크), #475569 (미드)
- 카드: 화이트 + 부드러운 그림자, 16-20px 라운드
- 레퍼런스의 카드형 비교 레이아웃, 강조 컬럼 하이라이트, 태그형 칩 활용

먼저 base setup과 1세션을 작성합니다.

_[tool: show_html]_

_[tool: show_to_user]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: str_replace_edit]_

표지와 인트로의 디자인 시스템이 레퍼런스 톤에 잘 맞습니다. 이제 1세션 전체를 추가합니다.

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: eval_js]_

Let me check using URL hash navigation instead:

_[tool: grep]_

_[tool: grep]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: grep]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: str_replace_edit]_

The slides exist. Let me continue and add Session 2 + 3.

_[tool: show_html]_

_[tool: eval_js]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: grep]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: str_replace_edit]_

Let me fix the CLAUDE.md example slide that had overflow:

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: str_replace_edit]_

The failure-flow slide (S3.1) has 6 nodes that overflow. Let me compress:

_[tool: view_image]_

_[tool: view_image]_

_[tool: done]_

전체 디자인이 잘 나옵니다. 마지막 검증을 위해 done 호출합니다.

_[tool: str_replace_edit]_

Let me fix the real issues. The big-number decorations on dividers are clipped by overflow:hidden so they're visual, but I'll address the truly impactful ones:

_[tool: str_replace_edit]_

Now fix the "맞는 순서" slide (38) that overflows:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now fix `.stack .node small` which is 18px (too small) and shrink the bottom callout on slide 19:

_[tool: str_replace_edit]_

Now fix the checklist slide 19 (last callout extends 3px past edge):

## Assistant

_[tool: done]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: run_script]_

_[tool: grep]_

_[tool: run_script]_

_[tool: done]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: save_screenshot]_

All validators pass. Let me also take a final look at slide 38 since it was just changed:

_[tool: view_image]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

51슬라이드 강의 덱이 완성됐습니다.

**구성**
- 표지 + 인트로 4슬라이드 (강의 메시지·목표·3세션 구성)
- **세션 1** · 작업환경 구축 (15슬라이드) — VS Code, Node.js, Git/GitHub, Claude Code, Oh My ClaudeCode
- **세션 2** · AI를 제대로 쓰는 법 (15슬라이드) — CLAUDE.md, Plan Mode, Deep Interview, Skill, MCP, Hook
- **세션 3** · 데이터 설계와 시스템 개발 (14슬라이드) — 테이블 설계, .env/.gitignore, 개인정보, 검증
- 마지막 메시지

**디자인 시스템 (레퍼런스 기반, 오리지널)**
- Pretendard + JetBrains Mono · 코발트 블루 #2D4EFF + 화이트 카드 + 부드러운 그림자
- 세션 디바이더는 풀블리드 블루, 콘텐츠는 화이트 배경 + 카드/표/스키마
- "★ 추천" 비교 테이블, 태그 칩, 코드 블록, 체크리스트, 노드 플로우 등 레퍼런스 모티프 반영

화살표 키 / 클릭으로 슬라이드 이동 가능합니다. 좌측 썸네일 레일에서 슬라이드를 드래그해서 순서 바꾸거나 우클릭으로 삭제할 수도 있습니다.

## User

Address these comments from my teammates:

**다영** (on `vibe-coding-deck.html` at `[data-comment-anchor="d87e5240a8-div"]`):
요런 스타일 AI slop 같으니 바꿀 것

**다영** (on `vibe-coding-deck.html` at `[data-comment-anchor="836efd8cf4-div"]`):
여백 깨져있음

## Assistant

_[tool: grep]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: read_file]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: str_replace_edit]_

The compare table is being shrunk by flex. Fix:

_[tool: str_replace_edit]_

Now redesign the `.callout` to remove the left-border + rounded-corner AI slop pattern:

_[tool: grep]_

_[tool: grep]_

I'll apply the final padding value to the checklist on slide 19:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Update the 2 callouts that had inline color overrides (now broken with new dark callout style):

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: str_replace_edit]_

The flex callout splits inline elements into columns. Let me restructure:

_[tool: save_screenshot]_

## Assistant

_[tool: snip]_

_[tool: view_image]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: done]_

_[tool: fork_verifier_agent]_

다영님 코멘트 두 건 반영했습니다.

**바뀐 점**
- **`.callout` (AI slop 스타일)** — 연한 블루 배경 + 좌측 보더 액센트 패턴을 버리고, **다크 네이비 배경 + 화이트 텍스트 + 좌측 화살표 `→`** 스타일로 전면 교체. 강조점이 더 분명하고 강의안 톤에 어울리는 모양으로.
  - 사이드바이사이드 변형은 **브랜드 블루 / 라이트 그레이** 두 컬러로 색만 바꿔 동일 패턴 유지
- **"CLAUDE.md 작성 팁" 비교표 (여백 깨짐)** — `.compare` 박스가 flex 컨테이너 안에서 압축되면서 마지막 "주석" 행이 잘리던 문제. `flex-shrink: 0` 추가해서 세 행이 모두 보이도록 수정

User께서 직접 편집하신 체크리스트 패딩(`24px 44px`)도 그대로 유지했습니다.

