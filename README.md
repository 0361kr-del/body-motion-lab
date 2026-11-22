# 움직임 탐구실
초등학교 6학년 과학 수업용 3D 뼈·근육 AR 웹앱입니다.

- 전신·상반신·하반신·얼굴 관찰, 주요/상세 근육 선택
- 뇌·심장·폐 보호 관찰, 근육 길이 비교, 카메라 추적
- 웹캠과 태블릿 브라우저에서 사용하며 카메라 영상은 기기 안에서 처리합니다.
- 실제 해부학적 측정이나 의료 진단용이 아닌 교육용 근사 모형입니다.

## 전체 소스 실행
전체 소스와 모델은 전송 안정성을 위해 `.bootstrap/part-*`에 분할 압축되어 있습니다. GitHub Actions가 SHA-256 무결성을 검사한 후 `dist`를 GitHub Pages에 게시합니다. 배포 작업에는 저장소 수정 권한이 없습니다.

저장소를 내려받고 Python 3로 실행하세요:
```sh
python restore-source.py
python -m http.server 8000 --directory site-source/dist
```
PC에서 http://localhost:8000 을 열면 됩니다. 태블릿 카메라는 공개 HTTPS 사이트에서 이용하세요.

`site-source/README_KO.md`에 실행·모델 재생성 안내가 있으며, `site-source/dist/models/` 안의 ATTRIBUTION 파일에 해부학 데이터 출처와 라이선스가 있습니다. 실행 의존성, 얼굴·자세 추적 모델, 3D 모델을 모두 포함합니다.

원본 반영 버전: `de592682c09fa6743a598e25e437c6b34cb77488` (neon 개선판).
