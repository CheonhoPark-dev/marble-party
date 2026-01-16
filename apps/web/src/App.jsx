import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import './App.css'
import { HostScreen } from './components/HostScreen'
import { GameScreen } from './components/GameScreen'
import { ControllerScreen } from './components/ControllerScreen'
import { JoinScreen } from './components/JoinScreen'
import { WaitingScreen } from './components/WaitingScreen'
import { RulesScreen } from './components/RulesScreen'
import { FeedbackModal } from './components/FeedbackModal'
import { EditorScreen } from './components/EditorScreen'

import { normalizeRoomCode, sanitizeDisplayName } from '@repo/internal-utils'

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'
const DEFAULT_MAP_ID = 'uuumToQcVnVK'
const CANDIDATE_SPLIT_REGEX = /[\n,、，;；]+/g

const CANDIDATE_COUNT_REGEX = /\*(\d+)$/
const LANGUAGE_STORAGE_KEY = 'marble-party:lang'
const SUPPORTED_LANGUAGES = ['en', 'ko', 'ja', 'zh']
const LANGUAGE_NAMES = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  zh: '中文',
}

const TRANSLATIONS = {
  en: {
    languageLabel: 'Language',
    home: {
      title: 'MARBLE PARTY',
      subtitle: 'THE RACE IS ON',
      settingsTitle: 'SETTINGS',
      joinParty: 'JOIN PARTY',
      hostParty: 'HOST PARTY',
      mapEditor: 'MAP EDITOR',
      noLogin: 'No login required. Just play.',
      seoTitle: 'What is Marble Party?',
      seoBody: 'Marble Party is a real-time marble race party game. Create a room and your friends join on mobile to race together on the big screen.',
      howToPlayTitle: 'How to play',
      howToPlayText: 'Create room -> share code -> join on mobile -> start race',
      partyOptimizedTitle: 'Built for parties',
      partyOptimizedText: 'Phones are controllers, the big screen is the arena. Great for hangouts and streams.',
    },
    host: {
      lobbyOpen: 'LOBBY OPEN',
      joinRoom: 'JOIN ROOM',
      generating: 'Generating...',
      scanToJoin: (roomCode) => `Scan the QR code, or go to www.marble-party.com, tap Join Party, and enter code ${roomCode}!`,
      racers: 'RACERS',
      joinedReady: (joined, ready) => `${joined} JOINED · ${ready} READY`,
      racerLabel: (index) => `Racer #${index + 1}`,
      waiting: 'Waiting...',
      mapSelection: 'MAP SELECTION',
      editMaps: 'EDIT MAPS',
      selectMapPreview: 'Select a map to preview',
      candidateGuide: 'Candidates (comma/newline, *number supported)',
      candidatePlaceholder: 'Alex, Jamie*2, Taylor, Morgan, Riley',
      startRace: 'START RACE',
      connecting: 'Connecting to the race server...',
      qrAlt: (roomCode) => `QR Code for room ${roomCode}`,
    },
    join: {
      title: 'JOIN PARTY',
      subtitle: 'Enter your details to jump in!',
      nicknameLabel: 'NICKNAME',
      nicknamePlaceholder: 'e.g. Lucky Star',
      roomCodeLabel: 'ROOM CODE',
      roomCodePlaceholder: '0000',
      enterRoom: 'ENTER ROOM',
      alertInvalid: 'Please enter a nickname and a 4-digit room code.',
    },
    rules: {
      title: 'HOW TO PLAY',
      subtitle: 'Everyone plays at the same time. Fairness is guaranteed.',
      steps: [
        { title: 'JOIN', body: 'Scan the QR code to enter the room.' },
        { title: 'WAIT', body: 'Wait for the host to start the race.' },
        { title: 'WIN', body: 'Watch your marble race to the finish line!' },
      ],
      ready: "I'M READY!",
    },
    waiting: {
      title: "YOU'RE IN!",
      guest: 'Guest',
      statusReady: 'STATUS: READY',
      joinedCount: (count) => `${count} JOINED`,
      waitHost: 'Wait for the host to start the game.',
      watchScreen: 'Watch the big screen!',
      feedback: 'Is this game fair? Give feedback',
      leave: 'LEAVE ROOM',
    },
    controller: {
      title: 'CONTROLLER',
      subtitle: 'DROP THE OBSTACLE!',
      recharging: 'RECHARGING',
      go: 'GO!',
      waiting: 'Waiting...',
      readyIn: (seconds) => `READY IN ${seconds}s`,
    },
    feedback: {
      thanks: 'THANKS!',
      thanksBody: 'Your feedback helps us make the race fairer.',
      title: 'FAIRNESS CHECK',
      step1: 'Did you understand the rules clearly?',
      yes: 'YES, CRYSTAL CLEAR',
      no: 'NO, IT WAS CONFUSING',
      step2: 'Any complaints or suggestions?',
      step2Caption: 'We value fairness above all. Be honest!',
      placeholder: 'e.g., The game started too fast...',
      submit: 'SUBMIT FEEDBACK',
      closeAria: 'Close',
    },
    editor: {
      title: 'MAP EDITOR',
      back: 'BACK',
      undo: 'Undo',
      redo: 'Redo',
      newMap: 'NEW MAP',
      testMap: 'TEST MAP',
      saveMap: 'SAVE MAP',
      saving: 'SAVING...',
      maps: 'MAPS',
      untitled: 'Untitled Map',
      copySuffix: 'Copy',
      clone: 'CLONE',
      delete: 'DELETE',
      mapName: 'MAP NAME',
      mapNamePlaceholder: 'Map name',
      authorName: 'AUTHOR NICKNAME',
      authorPlaceholder: 'Nickname',
      password: 'PASSWORD',
      passwordPlaceholder: 'Password',
      canvasHint: 'Click to place · Drag to move · Grid snap optional',
      testingMode: 'Testing Mode',
      stopEdit: 'STOP & EDIT',
      testCandidate: (index) => `Test ${index}`,
      snap: 'SNAP',
      snapToGrid: 'Snap to Grid',
      gridSize: 'Grid Size (0.01 = 1%)',
      tools: 'TOOLS',
      mapSettings: 'MAP SETTINGS',
      width: 'Width (px)',
      height: 'Height (px)',
      wallThickness: 'Wall Thickness (px)',
      floor: 'FLOOR',
      floorY: 'Floor Y',
      floorInset: 'Floor Inset',
      walls: 'WALLS',
      wallsHint: 'Normalized coordinates (0.0 - 1.0)',
      wallModeLabel: 'Wall mode',
      wallModes: { OFF: 'OFF', DRAW: 'DRAW', EDIT: 'EDIT' },
      left: 'LEFT',
      right: 'RIGHT',
      internal: 'INTERNAL',
      add: 'ADD',
      addLine: 'ADD LINE',
      remove: 'REMOVE',
      addPoint: 'ADD POINT',
      lineLabel: (index) => `LINE ${index + 1}`,
      deleteShort: 'DEL',
      obstacles: 'OBSTACLES',
      properties: 'PROPERTIES',
      type: 'Type',
      x: 'X',
      y: 'Y',
      radius: 'Radius',
      length: 'Length (px)',
      angle: 'Angle (rad)',
      angularVelocity: 'Angular Velocity',
      range: 'Range (px)',
      speed: 'Speed',
      widthLabel: 'Width (px)',
      heightLabel: 'Height (px)',
      minForceX: 'Min Force X',
      maxForceX: 'Max Force X',
      minForceY: 'Min Force Y',
      maxForceY: 'Max Force Y',
      interval: 'Interval (ms)',
      toolNames: {
        peg: 'Peg',
        bumper: 'Bumper',
        spinner: 'Spinner',
        hammer: 'Hammer',
        ramp: 'Ramp',
        kicker: 'Kicker',
        'kicker-once': 'Kicker (Once)',
        slider: 'Slider',
        wind: 'Wind',
      },
      toolDescriptions: {
        peg: 'Static circular bumper',
        bumper: 'Large bouncy bumper',
        spinner: 'Rotating rectangular bar',
        hammer: 'Swinging hammer arm',
        ramp: 'Angled surface to launch marbles',
        kicker: 'Reusable boost paddle',
        'kicker-once': 'One-time boost paddle',
        slider: 'Moving platform',
        wind: 'Zone that pushes marbles',
      },
      errors: {
        load: 'Unable to load map.',
        clone: 'Unable to clone map.',
        delete: 'Unable to delete map.',
        save: 'Unable to save map.',
        invalidPassword: 'Invalid password.',
        notFound: 'Map not found.',
      },
      validation: {
        obstacleRequired: (index, type, field) => `Obstacle #${index + 1} (${type}) ${field} is required.`,
        authorRequired: 'Author name is required.',
        passwordRequired: 'Password is required.',
        passwordLength: (max) => `Password must be ${max} characters or less.`,
      },
    },
    game: {
      winnerRank: '1st',
      winnerDefault: 'Marble',
      stopParty: 'STOP PARTY',
      closeWinner: 'Close winner screen',
      customBallCta: "Buy me a coffee and I'll customize your nickname's marble!",
    },
    errors: {
      createRoom: 'Unable to create a room. Please try again.',
      joinRoom: 'Unable to join the room.',
      ready: 'Unable to mark ready. Please try again.',
      connection: 'Connection not ready yet. Please try again.',
      joinValidation: 'Please enter a nickname and a 4-digit room code.',
    },
  },
  ko: {
    languageLabel: '언어',
    home: {
      title: 'MARBLE PARTY',
      subtitle: '레이스 시작',
      settingsTitle: '설정',
      joinParty: '파티 참가',
      hostParty: '파티 호스트',
      mapEditor: '맵 에디터',
      noLogin: '로그인 없이 바로 플레이.',
      seoTitle: '마블 파티란?',
      seoBody: 'Marble Party는 실시간 마블 레이스 파티 게임입니다. 방을 만들고 친구들이 모바일로 참가하면 큰 화면에서 함께 레이스를 즐길 수 있어요.',
      howToPlayTitle: '플레이 방법',
      howToPlayText: '방 만들기 -> 코드 공유 -> 모바일 참가 -> 레이스 시작',
      partyOptimizedTitle: '파티에 최적화',
      partyOptimizedText: '모바일은 컨트롤러, 큰 화면은 경기장. 모임이나 스트리밍에도 잘 어울립니다.',
    },
    host: {
      lobbyOpen: '로비 열림',
      joinRoom: '방 참가',
      generating: '생성 중...',
      scanToJoin: (roomCode) => `QR 코드로 접속하거나 www.marble-party.com에서 파티 참가자를 누르고 ${roomCode} 코드를 입력하세요!`,
      racers: '참가자',
      joinedReady: (joined, ready) => `${joined}명 참가 · ${ready}명 준비`,
      racerLabel: (index) => `참가자 #${index + 1}`,
      waiting: '대기 중...',
      mapSelection: '맵 선택',
      editMaps: '맵 편집',
      selectMapPreview: '미리 볼 맵을 선택하세요',
      candidateGuide: '추첨 대상 (쉼표/줄바꿈, *숫자 가능)',
      candidatePlaceholder: '민수, 지영*2, 현우, 서연, 준호',
      startRace: '레이스 시작',
      connecting: '레이스 서버 연결 중...',
      qrAlt: (roomCode) => `방 ${roomCode} QR 코드`,
    },
    join: {
      title: '파티 참가',
      subtitle: '정보를 입력하고 참여하세요!',
      nicknameLabel: '닉네임',
      nicknamePlaceholder: '예: 럭키 스타',
      roomCodeLabel: '방 코드',
      roomCodePlaceholder: '0000',
      enterRoom: '입장',
      alertInvalid: '닉네임과 4자리 방 코드를 입력하세요.',
    },
    rules: {
      title: '플레이 방법',
      subtitle: '모두 동시에 플레이합니다. 공정함이 보장됩니다.',
      steps: [
        { title: '참가', body: 'QR 코드를 스캔해 방에 들어가세요.' },
        { title: '대기', body: '호스트가 레이스를 시작할 때까지 기다리세요.' },
        { title: '레이스', body: '마블이 결승선까지 달리는 걸 지켜보세요!' },
      ],
      ready: '준비 완료!',
    },
    waiting: {
      title: '참가 완료!',
      guest: '게스트',
      statusReady: '상태: 준비',
      joinedCount: (count) => `${count}명 참가`,
      waitHost: '호스트가 게임을 시작할 때까지 기다리세요.',
      watchScreen: '큰 화면을 봐주세요!',
      feedback: '이 게임이 공정한가요? 피드백 남기기',
      leave: '방 나가기',
    },
    controller: {
      title: '컨트롤러',
      subtitle: '장애물을 떨어뜨려!',
      recharging: '재충전 중',
      go: '시작!',
      waiting: '대기 중...',
      readyIn: (seconds) => `${seconds}초 후 준비`,
    },
    feedback: {
      thanks: '감사합니다!',
      thanksBody: '피드백은 더 공정한 레이스에 도움이 됩니다.',
      title: '공정성 체크',
      step1: '규칙이 잘 이해되었나요?',
      yes: '네, 완벽히 이해했어요',
      no: '아니요, 헷갈렸어요',
      step2: '불만이나 제안이 있나요?',
      step2Caption: '공정함이 가장 중요해요. 솔직히 적어주세요!',
      placeholder: '예: 게임이 너무 빨리 시작됐어요...',
      submit: '피드백 보내기',
      closeAria: '닫기',
    },
    editor: {
      title: '맵 에디터',
      back: '뒤로',
      undo: '되돌리기',
      redo: '다시 실행',
      newMap: '새 맵',
      testMap: '맵 테스트',
      saveMap: '맵 저장',
      saving: '저장 중...',
      maps: '맵 목록',
      untitled: '이름 없는 맵',
      copySuffix: '복사본',
      clone: '복제',
      delete: '삭제',
      mapName: '맵 이름',
      mapNamePlaceholder: '맵 이름',
      authorName: '작성자 닉네임',
      authorPlaceholder: '닉네임',
      password: '비밀번호',
      passwordPlaceholder: '비밀번호',
      canvasHint: '클릭으로 배치 · 드래그로 이동 · 그리드 스냅 옵션',
      testingMode: '테스트 모드',
      stopEdit: '중지하고 편집',
      testCandidate: (index) => `테스트 ${index}`,
      snap: '스냅',
      snapToGrid: '그리드 스냅',
      gridSize: '그리드 크기 (0.01 = 1%)',
      tools: '도구',
      mapSettings: '맵 설정',
      width: '너비 (px)',
      height: '높이 (px)',
      wallThickness: '벽 두께 (px)',
      floor: '바닥',
      floorY: '바닥 Y',
      floorInset: '바닥 여백',
      walls: '벽',
      wallsHint: '정규화 좌표 (0.0 - 1.0)',
      wallModeLabel: '벽 모드',
      wallModes: { OFF: '끄기', DRAW: '그리기', EDIT: '편집' },
      left: '왼쪽',
      right: '오른쪽',
      internal: '내부',
      add: '추가',
      addLine: '선 추가',
      remove: '제거',
      addPoint: '점 추가',
      lineLabel: (index) => `선 ${index + 1}`,
      deleteShort: '삭제',
      obstacles: '장애물',
      properties: '속성',
      type: '종류',
      x: 'X',
      y: 'Y',
      radius: '반지름',
      length: '길이 (px)',
      angle: '각도 (라디안)',
      angularVelocity: '각속도',
      range: '범위 (px)',
      speed: '속도',
      widthLabel: '너비 (px)',
      heightLabel: '높이 (px)',
      minForceX: '최소 힘 X',
      maxForceX: '최대 힘 X',
      minForceY: '최소 힘 Y',
      maxForceY: '최대 힘 Y',
      interval: '간격 (ms)',
      toolNames: {
        peg: '핀',
        bumper: '범퍼',
        spinner: '스피너',
        hammer: '해머',
        ramp: '램프',
        kicker: '키커',
        'kicker-once': '키커(1회)',
        slider: '슬라이더',
        wind: '바람',
      },
      toolDescriptions: {
        peg: '고정 원형 범퍼',
        bumper: '큰 탄성 범퍼',
        spinner: '회전하는 막대',
        hammer: '스윙 해머 팔',
        ramp: '마블을 띄우는 경사면',
        kicker: '재사용 부스트 패들',
        'kicker-once': '1회용 부스트 패들',
        slider: '이동 플랫폼',
        wind: '마블을 미는 바람 영역',
      },
      errors: {
        load: '맵을 불러올 수 없습니다.',
        clone: '맵을 복제할 수 없습니다.',
        delete: '맵을 삭제할 수 없습니다.',
        save: '맵을 저장할 수 없습니다.',
        invalidPassword: '비밀번호가 올바르지 않습니다.',
        notFound: '맵을 찾을 수 없습니다.',
      },
      validation: {
        obstacleRequired: (index, type, field) => `장애물 #${index + 1} (${type}) ${field} 값이 필요합니다.`,
        authorRequired: '작성자 닉네임이 필요합니다.',
        passwordRequired: '비밀번호가 필요합니다.',
        passwordLength: (max) => `비밀번호는 ${max}자 이하로 입력하세요.`,
      },
    },
    game: {
      winnerRank: '1등',
      winnerDefault: '마블',
      stopParty: '파티 종료',
      closeWinner: '우승 화면 닫기',
      customBallCta: '커피를 사주시면 여러분 닉네임의 공을 커스텀 해드려요!',
    },
    errors: {
      createRoom: '방을 만들 수 없습니다. 다시 시도해주세요.',
      joinRoom: '방에 참가할 수 없습니다.',
      ready: '준비 상태를 저장할 수 없습니다. 다시 시도해주세요.',
      connection: '연결이 아직 준비되지 않았습니다. 다시 시도해주세요.',
      joinValidation: '닉네임과 4자리 방 코드를 입력하세요.',
    },
  },
  ja: {
    languageLabel: '言語',
    home: {
      title: 'MARBLE PARTY',
      subtitle: 'レース開始',
      settingsTitle: '設定',
      joinParty: 'パーティー参加',
      hostParty: 'ホストする',
      mapEditor: 'マップエディタ',
      noLogin: 'ログイン不要。すぐプレイ。',
      seoTitle: 'Marble Partyとは？',
      seoBody: 'Marble Partyはリアルタイムのマーブルレースパーティーゲームです。部屋を作り、友達がスマホで参加して大画面で一緒に楽しめます。',
      howToPlayTitle: '遊び方',
      howToPlayText: '部屋作成 -> コード共有 -> スマホ参加 -> レース開始',
      partyOptimizedTitle: 'パーティー向け',
      partyOptimizedText: 'スマホがコントローラー、大画面がレース会場。集まりや配信にも最適。',
    },
    host: {
      lobbyOpen: 'ロビー開放',
      joinRoom: '部屋に参加',
      generating: '生成中...',
      scanToJoin: (roomCode) => `QRコードで参加するか、www.marble-party.comで「パーティー参加」を選び、コード${roomCode}を入力してください！`,
      racers: '参加者',
      joinedReady: (joined, ready) => `${joined}人参加 · ${ready}人準備完了`,
      racerLabel: (index) => `参加者 #${index + 1}`,
      waiting: '待機中...',
      mapSelection: 'マップ選択',
      editMaps: 'マップ編集',
      selectMapPreview: 'プレビューするマップを選択',
      candidateGuide: '候補（カンマ/改行、*数指定可）',
      candidatePlaceholder: 'たろう、はなこ*2、ゆうと、さくら、けん',
      startRace: 'レース開始',
      connecting: 'レースサーバーに接続中...',
      qrAlt: (roomCode) => `部屋 ${roomCode} のQRコード`,
    },
    join: {
      title: 'パーティー参加',
      subtitle: '情報を入力して参加！',
      nicknameLabel: 'ニックネーム',
      nicknamePlaceholder: '例: ラッキースター',
      roomCodeLabel: 'ルームコード',
      roomCodePlaceholder: '0000',
      enterRoom: '入室',
      alertInvalid: 'ニックネームと4桁のルームコードを入力してください。',
    },
    rules: {
      title: '遊び方',
      subtitle: 'みんな同時にプレイ。公平性は保証されています。',
      steps: [
        { title: '参加', body: 'QRコードをスキャンして入室します。' },
        { title: '待機', body: 'ホストがレースを始めるのを待ちます。' },
        { title: 'レース', body: 'ゴールまでのレースを見届けよう！' },
      ],
      ready: '準備完了！',
    },
    waiting: {
      title: '参加完了！',
      guest: 'ゲスト',
      statusReady: '状態: 準備完了',
      joinedCount: (count) => `${count}人参加`,
      waitHost: 'ホストがゲームを開始するまで待ってください。',
      watchScreen: '大画面を見てね！',
      feedback: '公平でしたか？フィードバック',
      leave: '退出',
    },
    controller: {
      title: 'コントローラー',
      subtitle: '障害物を落とせ！',
      recharging: 'チャージ中',
      go: 'スタート！',
      waiting: '待機中...',
      readyIn: (seconds) => `${seconds}秒で準備完了`,
    },
    feedback: {
      thanks: 'ありがとう！',
      thanksBody: 'フィードバックはより公平なレースに役立ちます。',
      title: '公平性チェック',
      step1: 'ルールは分かりやすかったですか？',
      yes: 'はい、とても分かりやすい',
      no: 'いいえ、分かりにくかった',
      step2: '不満や提案はありますか？',
      step2Caption: '公平性を最優先にしています。正直にどうぞ。',
      placeholder: '例: ゲーム開始が早すぎた...',
      submit: 'フィードバック送信',
      closeAria: '閉じる',
    },
    editor: {
      title: 'マップエディタ',
      back: '戻る',
      undo: '元に戻す',
      redo: 'やり直し',
      newMap: '新規マップ',
      testMap: 'マップテスト',
      saveMap: 'マップ保存',
      saving: '保存中...',
      maps: 'マップ一覧',
      untitled: '無名マップ',
      copySuffix: 'コピー',
      clone: '複製',
      delete: '削除',
      mapName: 'マップ名',
      mapNamePlaceholder: 'マップ名',
      authorName: '作者ニックネーム',
      authorPlaceholder: 'ニックネーム',
      password: 'パスワード',
      passwordPlaceholder: 'パスワード',
      canvasHint: 'クリックで配置 · ドラッグで移動 · グリッドスナップ',
      testingMode: 'テストモード',
      stopEdit: '停止して編集',
      testCandidate: (index) => `テスト ${index}`,
      snap: 'スナップ',
      snapToGrid: 'グリッドにスナップ',
      gridSize: 'グリッドサイズ (0.01 = 1%)',
      tools: 'ツール',
      mapSettings: 'マップ設定',
      width: '幅 (px)',
      height: '高さ (px)',
      wallThickness: '壁の厚さ (px)',
      floor: '床',
      floorY: '床Y',
      floorInset: '床インセット',
      walls: '壁',
      wallsHint: '正規化座標 (0.0 - 1.0)',
      wallModeLabel: '壁モード',
      wallModes: { OFF: 'オフ', DRAW: '描画', EDIT: '編集' },
      left: '左',
      right: '右',
      internal: '内部',
      add: '追加',
      addLine: '線を追加',
      remove: '削除',
      addPoint: '点を追加',
      lineLabel: (index) => `線 ${index + 1}`,
      deleteShort: '削除',
      obstacles: '障害物',
      properties: 'プロパティ',
      type: '種類',
      x: 'X',
      y: 'Y',
      radius: '半径',
      length: '長さ (px)',
      angle: '角度 (rad)',
      angularVelocity: '角速度',
      range: '範囲 (px)',
      speed: '速度',
      widthLabel: '幅 (px)',
      heightLabel: '高さ (px)',
      minForceX: '最小力 X',
      maxForceX: '最大力 X',
      minForceY: '最小力 Y',
      maxForceY: '最大力 Y',
      interval: '間隔 (ms)',
      toolNames: {
        peg: 'ペグ',
        bumper: 'バンパー',
        spinner: 'スピナー',
        hammer: 'ハンマー',
        ramp: 'ランプ',
        kicker: 'キッカー',
        'kicker-once': 'キッカー(1回)',
        slider: 'スライダー',
        wind: '風',
      },
      toolDescriptions: {
        peg: '固定の円形バンパー',
        bumper: '大きいバウンシーバンパー',
        spinner: '回転するバー',
        hammer: '振り子ハンマー',
        ramp: 'マーブルを跳ばす斜面',
        kicker: '再利用ブーストパドル',
        'kicker-once': '1回ブーストパドル',
        slider: '移動プラットフォーム',
        wind: 'マーブルを押す風ゾーン',
      },
      errors: {
        load: 'マップを読み込めません。',
        clone: 'マップを複製できません。',
        delete: 'マップを削除できません。',
        save: 'マップを保存できません。',
        invalidPassword: 'パスワードが正しくありません。',
        notFound: 'マップが見つかりません。',
      },
      validation: {
        obstacleRequired: (index, type, field) => `障害物 #${index + 1} (${type}) の${field}が必要です。`,
        authorRequired: '作者ニックネームが必要です。',
        passwordRequired: 'パスワードが必要です。',
        passwordLength: (max) => `パスワードは${max}文字以内で入力してください。`,
      },
    },
    game: {
      winnerRank: '1位',
      winnerDefault: 'マーブル',
      stopParty: 'パーティー終了',
      closeWinner: '勝者画面を閉じる',
      customBallCta: 'コーヒーをご支援いただけたら、あなたのニックネームの玉をカスタムします！',
    },
    errors: {
      createRoom: '部屋を作成できません。もう一度お試しください。',
      joinRoom: '部屋に参加できません。',
      ready: '準備状態を保存できません。もう一度お試しください。',
      connection: '接続の準備ができていません。もう一度お試しください。',
      joinValidation: 'ニックネームと4桁のルームコードを入力してください。',
    },
  },
  zh: {
    languageLabel: '语言',
    home: {
      title: 'MARBLE PARTY',
      subtitle: '比赛开始',
      settingsTitle: '设置',
      joinParty: '加入派对',
      hostParty: '主持派对',
      mapEditor: '地图编辑器',
      noLogin: '无需登录，直接开玩。',
      seoTitle: '什么是 Marble Party？',
      seoBody: 'Marble Party 是实时弹珠竞赛派对游戏。创建房间，朋友用手机加入，在大屏幕上一起比赛。',
      howToPlayTitle: '玩法',
      howToPlayText: '创建房间 -> 分享代码 -> 手机加入 -> 开始比赛',
      partyOptimizedTitle: '为派对而生',
      partyOptimizedText: '手机是控制器，大屏幕是赛场。聚会或直播都很合适。',
    },
    host: {
      lobbyOpen: '大厅已开启',
      joinRoom: '加入房间',
      generating: '生成中...',
      scanToJoin: (roomCode) => `扫码进入，或访问 www.marble-party.com 点击“加入派对”，输入代码${roomCode}！`,
      racers: '参赛者',
      joinedReady: (joined, ready) => `${joined}人加入 · ${ready}人准备`,
      racerLabel: (index) => `选手 #${index + 1}`,
      waiting: '等待中...',
      mapSelection: '地图选择',
      editMaps: '编辑地图',
      selectMapPreview: '选择地图以预览',
      candidateGuide: '候选（逗号/换行，支持*数量）',
      candidatePlaceholder: '小明，小红*2，伟，婷，杰',
      startRace: '开始比赛',
      connecting: '正在连接比赛服务器...',
      qrAlt: (roomCode) => `房间 ${roomCode} 的二维码`,
    },
    join: {
      title: '加入派对',
      subtitle: '填写信息即可加入！',
      nicknameLabel: '昵称',
      nicknamePlaceholder: '例如：幸运之星',
      roomCodeLabel: '房间代码',
      roomCodePlaceholder: '0000',
      enterRoom: '进入房间',
      alertInvalid: '请输入昵称和4位房间代码。',
    },
    rules: {
      title: '玩法说明',
      subtitle: '所有人同时参与，公平可期。',
      steps: [
        { title: '加入', body: '扫描二维码进入房间。' },
        { title: '等待', body: '等待主持人开始比赛。' },
        { title: '比赛', body: '观看弹珠冲向终点！' },
      ],
      ready: '我准备好了！',
    },
    waiting: {
      title: '已加入！',
      guest: '游客',
      statusReady: '状态：准备',
      joinedCount: (count) => `${count}人加入`,
      waitHost: '等待主持人开始游戏。',
      watchScreen: '请看大屏幕！',
      feedback: '游戏公平吗？提交反馈',
      leave: '离开房间',
    },
    controller: {
      title: '控制器',
      subtitle: '投放障碍物！',
      recharging: '充能中',
      go: '开始！',
      waiting: '等待中...',
      readyIn: (seconds) => `${seconds}秒后可用`,
    },
    feedback: {
      thanks: '谢谢！',
      thanksBody: '你的反馈能让比赛更公平。',
      title: '公平性检查',
      step1: '你是否清楚理解规则？',
      yes: '是的，非常清楚',
      no: '不太清楚',
      step2: '有任何吐槽或建议吗？',
      step2Caption: '我们最看重公平，请如实反馈。',
      placeholder: '例如：游戏开始得太快了...',
      submit: '提交反馈',
      closeAria: '关闭',
    },
    editor: {
      title: '地图编辑器',
      back: '返回',
      undo: '撤销',
      redo: '重做',
      newMap: '新地图',
      testMap: '地图测试',
      saveMap: '保存地图',
      saving: '保存中...',
      maps: '地图列表',
      untitled: '未命名地图',
      copySuffix: '副本',
      clone: '复制',
      delete: '删除',
      mapName: '地图名称',
      mapNamePlaceholder: '地图名称',
      authorName: '作者昵称',
      authorPlaceholder: '昵称',
      password: '密码',
      passwordPlaceholder: '密码',
      canvasHint: '点击放置 · 拖动移动 · 网格吸附可选',
      testingMode: '测试模式',
      stopEdit: '停止并编辑',
      testCandidate: (index) => `测试 ${index}`,
      snap: '吸附',
      snapToGrid: '网格吸附',
      gridSize: '网格大小 (0.01 = 1%)',
      tools: '工具',
      mapSettings: '地图设置',
      width: '宽度 (px)',
      height: '高度 (px)',
      wallThickness: '墙厚 (px)',
      floor: '地面',
      floorY: '地面 Y',
      floorInset: '地面内缩',
      walls: '墙体',
      wallsHint: '归一化坐标 (0.0 - 1.0)',
      wallModeLabel: '墙体模式',
      wallModes: { OFF: '关闭', DRAW: '绘制', EDIT: '编辑' },
      left: '左',
      right: '右',
      internal: '内部',
      add: '添加',
      addLine: '添加线段',
      remove: '移除',
      addPoint: '添加点',
      lineLabel: (index) => `线 ${index + 1}`,
      deleteShort: '删',
      obstacles: '障碍物',
      properties: '属性',
      type: '类型',
      x: 'X',
      y: 'Y',
      radius: '半径',
      length: '长度 (px)',
      angle: '角度 (rad)',
      angularVelocity: '角速度',
      range: '范围 (px)',
      speed: '速度',
      widthLabel: '宽度 (px)',
      heightLabel: '高度 (px)',
      minForceX: '最小力 X',
      maxForceX: '最大力 X',
      minForceY: '最小力 Y',
      maxForceY: '最大力 Y',
      interval: '间隔 (ms)',
      toolNames: {
        peg: '柱钉',
        bumper: '弹垫',
        spinner: '旋转器',
        hammer: '摆锤',
        ramp: '坡道',
        kicker: '弹板',
        'kicker-once': '弹板(一次)',
        slider: '滑台',
        wind: '风区',
      },
      toolDescriptions: {
        peg: '固定圆形弹点',
        bumper: '大型弹性垫',
        spinner: '旋转长条',
        hammer: '摆动锤臂',
        ramp: '把弹珠弹起的斜坡',
        kicker: '可重复的助推板',
        'kicker-once': '一次性助推板',
        slider: '移动平台',
        wind: '推动弹珠的风区',
      },
      errors: {
        load: '无法加载地图。',
        clone: '无法复制地图。',
        delete: '无法删除地图。',
        save: '无法保存地图。',
        invalidPassword: '密码不正确。',
        notFound: '未找到地图。',
      },
      validation: {
        obstacleRequired: (index, type, field) => `障碍物 #${index + 1} (${type}) 需要 ${field}。`,
        authorRequired: '需要作者昵称。',
        passwordRequired: '需要密码。',
        passwordLength: (max) => `密码长度需不超过${max}位。`,
      },
    },
    game: {
      winnerRank: '第1名',
      winnerDefault: '弹珠',
      stopParty: '结束派对',
      closeWinner: '关闭获胜画面',
      customBallCta: '请我喝杯咖啡，我会为你的昵称定制弹珠！',
    },
    errors: {
      createRoom: '无法创建房间，请重试。',
      joinRoom: '无法加入房间。',
      ready: '无法标记准备，请重试。',
      connection: '连接尚未就绪，请稍后再试。',
      joinValidation: '请输入昵称和4位房间代码。',
    },
  },
}

const resolveLanguage = (value) => {
  const normalized = String(value || '').toLowerCase()
  if (normalized.startsWith('ko')) {
    return 'ko'
  }
  if (normalized.startsWith('ja')) {
    return 'ja'
  }
  if (normalized.startsWith('zh')) {
    return 'zh'
  }
  return 'en'
}

const getInitialLanguage = () => {
  if (typeof window === 'undefined') {
    return 'en'
  }
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (SUPPORTED_LANGUAGES.includes(stored)) {
    return stored
  }
  return resolveLanguage(window.navigator?.language)
}


function parseCandidateEntries(raw) {
  return String(raw ?? '')
    .split(CANDIDATE_SPLIT_REGEX)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(CANDIDATE_COUNT_REGEX)
      if (!match) {
        return { name: entry, count: 1 }
      }
      const count = Math.max(1, Number(match[1] || 1))
      const name = entry.slice(0, match.index).trim()
      if (!name) {
        return null
      }
      return { name, count }
    })
    .filter(Boolean)
}

function normalizeCandidateText(raw) {
  const entries = parseCandidateEntries(raw)
  const counts = new Map()
  const order = []

  entries.forEach(({ name, count }) => {
    if (!counts.has(name)) {
      order.push(name)
      counts.set(name, 0)
    }
    counts.set(name, (counts.get(name) || 0) + count)
  })

  return order
    .map((name) => {
      const count = counts.get(name) || 0
      return count > 1 ? `${name}*${count}` : name
    })
    .join(', ')
}

function expandCandidateList(raw) {
  const entries = parseCandidateEntries(raw)
  const expanded = []

  entries.forEach(({ name, count }) => {
    for (let i = 0; i < count; i += 1) {
      expanded.push(name)
    }
  })

  return expanded
}

function getWsBase(apiBase) {
  if (apiBase.startsWith('https://')) {
    return apiBase.replace(/^https:\/\//, 'wss://')
  }
  if (apiBase.startsWith('http://')) {
    return apiBase.replace(/^http:\/\//, 'ws://')
  }
  return apiBase
}

function safeParseJson(payload) {
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function App() {
  const [view, setView] = useState('home')
  const [language, setLanguage] = useState(() => getInitialLanguage())
  const [userName, setUserName] = useState('')

  const [roomCode, setRoomCode] = useState('')
  const [roomId, setRoomId] = useState('')
  const [hostKey, setHostKey] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [displayToken, setDisplayToken] = useState('')
  const [participantCount, setParticipantCount] = useState(0)
  const [readyCount, setReadyCount] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [joinUrl, setJoinUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [candidateText, setCandidateText] = useState('')
  const [hasEditedCandidates, setHasEditedCandidates] = useState(false)
  const [gameData, setGameData] = useState(null)
  const [assignment, setAssignment] = useState(null)
  const [lastSpawnEvent, setLastSpawnEvent] = useState(null)
  const [spawnCooldownUntil, setSpawnCooldownUntil] = useState(0)
  const [wsReady, setWsReady] = useState(false)
  const [maps, setMaps] = useState([])
  const [selectedMapId, setSelectedMapId] = useState('')
  const [selectedMapBlueprint, setSelectedMapBlueprint] = useState(null)
  const [editorReturnView, setEditorReturnView] = useState('home')




  const wsRef = useRef(null)

  const apiBase = useMemo(() => DEFAULT_API_BASE, [])
  const t = useMemo(() => TRANSLATIONS[language] || TRANSLATIONS.en, [language])
  const languageOptions = useMemo(
    () => SUPPORTED_LANGUAGES.map((code) => ({ code, label: LANGUAGE_NAMES[code] || code })),
    []
  )
  const defaultCandidateText = useMemo(
    () => (TRANSLATIONS[language] || TRANSLATIONS.en).host.candidatePlaceholder,
    [language]
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    if (!hasEditedCandidates) {
      setCandidateText(defaultCandidateText)
    }
  }, [defaultCandidateText, hasEditedCandidates])

  const handleLanguageChange = (value) => {
    const next = SUPPORTED_LANGUAGES.includes(value) ? value : resolveLanguage(value)
    setLanguage(next)
  }

  const handleCandidateChange = (value) => {
    setHasEditedCandidates(true)
    setCandidateText(value)
  }


  const loadMaps = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/api/maps`)
      if (!response.ok) {
        return
      }
      const data = await response.json()
      setMaps(Array.isArray(data.maps) ? data.maps : [])
    } catch {
      setMaps([])
    }
  }, [apiBase])


  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      setRoomCode(normalizeRoomCode(code))
      setView('join')
    }
  }, [])

  useEffect(() => {
    loadMaps()
  }, [loadMaps])

  useEffect(() => {
    if (selectedMapId || maps.length === 0) {
      return
    }
    const preferred = maps.find((map) => map.id === DEFAULT_MAP_ID)
    setSelectedMapId(preferred?.id || maps[0]?.id || '')
  }, [maps, selectedMapId])

  useEffect(() => {
    if (!selectedMapId) {
      setSelectedMapBlueprint(null)
      return
    }
    let cancelled = false
    fetch(`${apiBase}/api/maps/${selectedMapId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) {
          return
        }
        setSelectedMapBlueprint(data?.blueprint || null)
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedMapBlueprint(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [apiBase, selectedMapId])


  useEffect(() => {
    if (!roomId || (!hostKey && !displayToken)) {
      return
    }

    setWsReady(false)
    const wsBase = getWsBase(apiBase)
    const ws = new WebSocket(`${wsBase}/ws`)
    wsRef.current = ws

    ws.addEventListener('open', () => {
      setWsReady(true)
      setJoinError('')
      const role = hostKey ? 'host' : 'participant'
      const token = hostKey || displayToken
      ws.send(JSON.stringify({ type: 'join', roomId, role, token }))
    })

    ws.addEventListener('message', (event) => {
      const message = safeParseJson(event.data)
      if (!message || !message.type) {
        return
      }

      if (message.type === 'room_state') {
        setParticipantCount(message.participantCount || 0)
        setReadyCount(message.readyCount || 0)
        return
      }

       if (message.type === 'game_started') {
         const candidates = Array.isArray(message.candidates) ? message.candidates : []
         const assignments = message.assignments || {}
         const mapBlueprint = message.map || null
         setGameData({ candidates, assignments, map: mapBlueprint })
         setLastSpawnEvent(null)
         setSpawnCooldownUntil(0)
         if (!hostKey) {
           setAssignment(assignments[participantId] || null)
         }
         setView('game')
         return
       }

       if (message.type === 'assignments_updated') {
         const assignments = message.assignments || {}
         setGameData((prev) => ({
           candidates: prev?.candidates || [],
           assignments,
           map: prev?.map || null,
         }))
         if (!hostKey) {
           setAssignment(assignments[participantId] || null)
         }
         return
       }

       if (message.type === 'spawned_obstacle') {

        setLastSpawnEvent({
          participantId: message.participantId,
          obstacleType: message.obstacleType,
          receivedAt: Date.now(),
        })
        if (message.participantId === participantId && typeof message.cooldownUntil === 'number') {
          setSpawnCooldownUntil(message.cooldownUntil)
        }
        return
      }

      if (message.type === 'spawn_cooldown') {
        if (message.participantId === participantId && typeof message.cooldownUntil === 'number') {
          setSpawnCooldownUntil(message.cooldownUntil)
        }
        return
      }
    })

    ws.addEventListener('close', () => {
      setWsReady(false)
      if (wsRef.current === ws) {
        wsRef.current = null
      }
    })

    ws.addEventListener('error', () => {
      setWsReady(false)
    })

    return () => {
      ws.close()
    }
  }, [apiBase, displayToken, hostKey, participantId, roomId])

  const handleStartHost = async () => {
    setIsBusy(true)
    setJoinError('')
    try {
      const response = await fetch(`${apiBase}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error(t.errors.createRoom)
      }


      const data = await response.json()
      setRoomId(data.roomId)
      setRoomCode(data.roomCode)
      setHostKey(data.hostKey)
      setJoinUrl(data.joinUrl || '')
      setQrDataUrl(data.qrDataUrl || '')
      setParticipantCount(data.participantCount || 0)
      setView('host')
    } catch (error) {
      setJoinError(error.message || t.errors.createRoom)
    } finally {

      setIsBusy(false)
    }
  }

  const handleStartJoin = () => {
    setView('join')
  }

  const handleOpenEditor = (returnView = 'home') => {
    setEditorReturnView(returnView)
    setView('editor')
  }


  const handleJoinRoom = async (name, code) => {
    setIsBusy(true)
    setJoinError('')

    try {
      const displayName = sanitizeDisplayName(name)
      const normalizedCode = normalizeRoomCode(code)
      const response = await fetch(`${apiBase}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: normalizedCode, displayName }),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(errorPayload.error || t.errors.joinRoom)
      }


      const data = await response.json()
      setUserName(displayName)
      setRoomCode(data.roomCode)
      setRoomId(data.roomId)
      setParticipantId(data.participantId)
      setDisplayToken(data.displayToken)
      setView('rules')
    } catch (error) {
      setJoinError(error.message || t.errors.joinRoom)
    } finally {

      setIsBusy(false)
    }
  }

  const handleRulesReady = async () => {
    if (!roomId || !participantId || !displayToken) {
      setView('waiting')
      return
    }

    setIsBusy(true)
    setJoinError('')
    try {
      await fetch(`${apiBase}/api/rooms/${roomId}/participants/${participantId}/ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${displayToken}`,
        },
        body: JSON.stringify({ isReady: true }),
      })
      setView('waiting')
    } catch {
      setJoinError(t.errors.ready)
      setView('waiting')
    } finally {

      setIsBusy(false)
    }
  }

  const handleLeave = () => {
    if (roomId && participantId && displayToken) {
      fetch(`${apiBase}/api/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${displayToken}`,
        },
      }).catch(() => {})
    }

    setView('home')
    setUserName('')
    setRoomCode('')
    setRoomId('')
    setHostKey('')
    setParticipantId('')
    setDisplayToken('')
    setParticipantCount(0)
    setReadyCount(0)
    setJoinUrl('')
    setQrDataUrl('')
    setJoinError('')
    setGameData(null)
    setAssignment(null)
    setLastSpawnEvent(null)
    setSpawnCooldownUntil(0)
    setWsReady(false)
  }


  const handleCandidateBlur = () => {
    setCandidateText((current) => normalizeCandidateText(current))
  }

  const handleStartGame = () => {
    const candidates = expandCandidateList(candidateText)
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setJoinError(t.errors.connection)
      return
    }

    wsRef.current.send(
      JSON.stringify({
        type: 'start_game',
        candidates,
        mapId: selectedMapId || null,
      })
    )

  }

  const handleGameComplete = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }
    wsRef.current.send(
      JSON.stringify({
        type: 'game_completed',
      })
    )
  }


  const handleControllerAction = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }
    wsRef.current.send(
      JSON.stringify({
        type: 'obstacle_action',
        action: 'tap',
      })
    )
  }

  return (
    <div className={`app-container${(view === 'game' && hostKey) || view === 'editor' ? ' app-container--game' : ''}`}>

      {view === 'home' && (
        <div className="screen-container justify-center">
          <div className="logo-container animate-enter">
            <h1 className="marble-logo">
              MARBLE<br />PARTY
            </h1>
            <div className="logo-subtitle">{t.home.subtitle}</div>

          </div>

          <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex-col gap-16">
              <button className="btn btn-primary" onClick={handleStartJoin} disabled={isBusy}>
                {t.home.joinParty}
              </button>
              <button className="btn btn-secondary" onClick={handleStartHost} disabled={isBusy}>
                {t.home.hostParty}
              </button>
              <button className="btn btn-outline" onClick={() => handleOpenEditor('home')} disabled={isBusy}>
                {t.home.mapEditor}
              </button>
            </div>
            {joinError && (
              <p className="text-caption text-center" style={{ marginTop: 'var(--space-16)', color: 'var(--color-error)' }}>
                {joinError}
              </p>
            )}
            {!joinError && (
              <p className="text-caption text-center" style={{ marginTop: 'var(--space-16)' }}>
                {t.home.noLogin}
              </p>
            )}
          </div>

          <section className="card seo-section animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <h2>{t.home.seoTitle}</h2>
            <p>
              {t.home.seoBody}
            </p>
            <div className="seo-grid">
              <div>
                <h3>{t.home.howToPlayTitle}</h3>
                <p className="text-caption">{t.home.howToPlayText}</p>
              </div>
              <div>
                <h3>{t.home.partyOptimizedTitle}</h3>
                <p className="text-caption">
                  {t.home.partyOptimizedText}
                </p>
              </div>
            </div>
          </section>

          <div className="card animate-slide-up" style={{ 
            animationDelay: '0.2s', 
            marginTop: 'var(--space-16)',
            padding: 'var(--space-12) var(--space-16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>{t.home.settingsTitle}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
              <span className="text-caption">{t.languageLabel}</span>
              <select
                className="input-field"
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                style={{ 
                  width: 'auto', 
                  height: '40px',
                  padding: '0 var(--space-12)',
                  fontSize: '14px'
                }}
              >
                {languageOptions.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {view === 'editor' && (
        <EditorScreen
          apiBase={apiBase}
          maps={maps}
          onRefreshMaps={loadMaps}
          onBack={() => setView(editorReturnView)}
          t={t}
        />
      )}

      {view === 'host' && (
          <HostScreen
            roomCode={roomCode}
            participantCount={participantCount}
            readyCount={readyCount}
            joinUrl={joinUrl}
            qrDataUrl={qrDataUrl}
            candidateText={candidateText}
            onCandidateChange={handleCandidateChange}
            onCandidateBlur={handleCandidateBlur}
            onStart={handleStartGame}
            isWsReady={wsReady}
            error={joinError}
            maps={maps}
            selectedMapId={selectedMapId}
            selectedMapBlueprint={selectedMapBlueprint}
            onMapChange={setSelectedMapId}
            onOpenEditor={() => handleOpenEditor('host')}
            t={t}
          />

      )}


      {view === 'game' && hostKey && (
        <div className="game-stage">
          <GameScreen
            candidates={gameData?.candidates || []}
            assignments={gameData?.assignments || {}}
            lastSpawnEvent={lastSpawnEvent}
            onBack={() => setView('host')}
            onGameComplete={handleGameComplete}
            mapBlueprint={gameData?.map || null}
            t={t}
          />
        </div>
      )}

      {view === 'game' && !hostKey && (
        <ControllerScreen
          assignment={assignment}
          cooldownUntil={spawnCooldownUntil}
          onAction={handleControllerAction}
          t={t}
        />
      )}


      {view === 'join' && (
        <JoinScreen
          initialCode={roomCode}
          onJoin={handleJoinRoom}
          isBusy={isBusy}
          error={joinError}
          t={t}
        />

      )}

      {view === 'rules' && (
        <RulesScreen onReady={handleRulesReady} isBusy={isBusy} t={t} />

      )}

      {view === 'waiting' && (
        <WaitingScreen
          playerName={userName}
          participantCount={participantCount}
          onLeave={handleLeave}
          onFeedback={() => setShowFeedback(true)}
          t={t}
        />

      )}

      {showFeedback && (
        <FeedbackModal onClose={() => setShowFeedback(false)} t={t} />
      )}

    </div>
  )
}

export default App
