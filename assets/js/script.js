/**
 * TTS 애플리케이션 클래스
 */
class TTSApplication {
    constructor() {
        this.initializeServices();
        this.initializeElements();
        this.initializeEventListeners();
        this.checkApiKey();
        this.populateVoiceSelectors();

        // 녹음 관련 모달 요소들
        this.recordingModal = new bootstrap.Modal(document.getElementById('recordingModal'));
        this.directoryPath = document.getElementById('directoryPath');
        this.recordingFileName = document.getElementById('recordingFileName');
        this.browseDirectoryBtn = document.getElementById('browseDirectoryBtn');
        this.startRecordingBtn = document.getElementById('startRecordingBtn');
        
        // File System Access API 지원 확인
        this.isFileSystemSupported = 'showDirectoryPicker' in window;
        
        // 디렉토리 정보 초기화
        this.directoryHandle = null;
        this.lastDirectoryPath = localStorage.getItem('lastDirectoryPath');
        
        this.initializeRecordingEvents();

        this.textHighlighter = null;  // 텍스트 하이라이트 관리
        this.currentUtterance = null; // 현재 발화 객체
    }

    /**
     * 서비스 초기화
     */
    initializeServices() {
        this.ttsService = new TTSService();
        this.isPlaying = false;
        this.isRecording = false;
        this.directoryHandle = null;
    }

    /**
     * DOM 요소 초기화
     */
    initializeElements() {
        // 음성 선택 요소
        this.narratorVoice = document.getElementById('narratorVoice');
        this.speakerA = document.getElementById('speakerA');
        this.speakerB = document.getElementById('speakerB');
        this.speakerC = document.getElementById('speakerC');

        // 텍스트 입력 및 제어 버튼
        this.textInput = document.getElementById('textInput');
        this.speakButton = document.getElementById('speakButton');
        this.recordButton = document.getElementById('recordButton');
        this.stopButton = document.getElementById('stopButton');
        
        // 오디오 플레이어
        this.audioPlayer = document.getElementById('audioPlayer');

        // 모달 관련 요소
        this.apiKeyModal = new bootstrap.Modal(document.getElementById('apiKeyModal'));
        this.saveFileModal = new bootstrap.Modal(document.getElementById('saveFileModal'));
        this.apiKeyInput = document.getElementById('apiKeyInput');
        this.fileNameInput = document.getElementById('fileNameInput');
        this.selectedDirectory = document.getElementById('selectedDirectory');
    }

    /**
     * 이벤트 리스너 초기화
     */
    initializeEventListeners() {
        // 음성 선택 이벤트
        [this.narratorVoice, this.speakerA, this.speakerB, this.speakerC].forEach(select => {
            select.addEventListener('change', (e) => this.handleVoicePreview(e.target));
        });

        // 제어 버튼 이벤트
        this.speakButton.addEventListener('click', () => this.handleSpeak());
        this.recordButton.addEventListener('click', () => this.handleRecord());
        this.stopButton.addEventListener('click', () => this.handleStop());

        // API 키 저장
        document.getElementById('saveApiKeyBtn').addEventListener('click', () => this.saveApiKey());

        // 파일 저장 관련
        document.getElementById('selectDirectoryBtn').addEventListener('click', () => this.selectDirectory());
        document.getElementById('saveFileBtn').addEventListener('click', () => this.saveFile());
    }

    /**
     * API 키 확인 및 설정
     */
    checkApiKey() {
        if (!this.ttsService.apiKey) {
            this.apiKeyModal.show();
        }
    }

    /**
     * 음성 선택 드롭다운 초기화
     */
    populateVoiceSelectors() {
        // 내레이터 음성 (한국어)
        const koreanVoices = this.ttsService.getVoices('korean');
        this.populateSelect(this.narratorVoice, koreanVoices);

        // 화자 음성 (영어)
        const englishVoices = this.ttsService.getVoices('english');
        [this.speakerA, this.speakerB, this.speakerC].forEach(select => {
            this.populateSelect(select, englishVoices);
        });
    }

    /**
     * 셀렉트 박스 옵션 채우기
     */
    populateSelect(selectElement, voices) {
        selectElement.innerHTML = voices
            .map(voice => `<option value="${voice.value}">${voice.label}</option>`)
            .join('');
    }

    /**
     * 음성 미리듣기 처리
     */
    async handleVoicePreview(selectElement) {
        const voice = selectElement.value;
        if (!voice) return;

        try {
            Utils.showNotification('음성을 불러오는 중...', 'info');
            const audioContent = await this.ttsService.previewVoice(voice);
            await this.playAudio(audioContent);
        } catch (error) {
            Utils.showNotification('미리듣기 실패', 'danger');
        }
    }

    /**
     * 말하 버튼 처리
     */
    async handleSpeak() {
        if (this.isPlaying) return;

        const text = this.getSelectedOrAllText();
        if (!text.trim()) {
            Utils.showNotification('텍스트를 입력하거나 선택하세요.', 'warning');
            return;
        }

        try {
            this.isPlaying = true;
            this.updateControlState();
            await this.processAndPlay(text);
        } catch (error) {
            Utils.showNotification('음성 변환 실패', 'danger');
        } finally {
            this.isPlaying = false;
            this.updateControlState();
        }
    }

    /**
     * 녹음 버튼 처리
     */
    async handleRecord() {
        if (this.isRecording) return;

        try {
            // 디렉토리 선택
            this.directoryHandle = await window.showDirectoryPicker();
            this.selectedDirectory.textContent = '선택된 경로: ' + this.directoryHandle.name;
            
            // 파일 이름 입력 모달 표시
            this.saveFileModal.show();
            
            // 파일 이름 입력 필드에 포커스
            this.fileNameInput.value = `TTS_${Utils.generateTimestamp()}`;
            this.fileNameInput.select();
        } catch (error) {
            if (error.name !== 'AbortError') {
                Utils.showNotification('디렉토리 선택 실패', 'danger');
            }
        }
    }

    /**
     * 정지 버튼 처리
     */
    handleStop() {
        this.isPlaying = false;
        this.isRecording = false;
        
        // 현재 재생 중인 모든 오디오 요소 정지
        const audios = document.getElementsByTagName('audio');
        Array.from(audios).forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });

        // 상태 업데이트 및 하이라이트 제거
        this.updateControlState();
        Utils.removeHighlight(this.textInput);
        Utils.showNotification('재생이 중지되었습니다.');
    }

    /**
     * 텍스트 강조 표시 및 스크롤 조정
     * @param {HTMLTextAreaElement} textarea - 텍스트 영역
     * @param {number} start - 시작 위치
     * @param {number} end - 끝 위치
     */
    highlightAndScroll(textarea, start, end) {
        // 텍스트 강조
        textarea.setSelectionRange(start, end);
        
        // 스크롤 위치 계산
        const text = textarea.value;
        const textBeforeSelection = text.substring(0, start);
        const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
        const lines = textBeforeSelection.split('\n').length;
        
        // 강조된 부분이 중앙에 오도록 스크롤 조정
        const scrollPosition = (lines * lineHeight) - (textarea.clientHeight / 2);
        textarea.scrollTop = Math.max(0, scrollPosition);
    }

    /**
     * 텍스트 처리 및 재생
     */
    async processAndPlay(text) {
        const voices = {
            narrator: this.narratorVoice.value,
            speakerA: this.speakerA.value,
            speakerB: this.speakerB.value,
            speakerC: this.speakerC.value
        };

        const narratorMode = document.querySelector('input[name="narratorMode"]:checked').value;
        const segments = await this.ttsService.processText(text, voices, narratorMode);

        for (const segment of segments) {
            if (!this.isPlaying) break;
            
            const startIndex = text.indexOf(segment.text);
            const endIndex = startIndex + segment.text.length;
            
            // 텍스트 강조 및 스크롤 조정
            this.highlightAndScroll(this.textInput, startIndex, endIndex);
            
            try {
                await this.playAudio(segment.audioContent);
            } catch (error) {
                console.error('오디오 재생 실패:', error);
                break;
            }
        }

        Utils.removeHighlight(this.textInput);
    }

    /**
     * 오디오 생
     */
    playAudio(audioContent) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
            
            audio.onended = () => {
                audio.remove(); // 재생 완료 후 오디오 요소 제거
                resolve();
            };
            
            audio.onerror = (error) => {
                audio.remove();
                reject(error);
            };

            // 정지 버튼 동작을 위한 이벤트 리스너
            const stopListener = () => {
                if (!this.isPlaying) {
                    audio.pause();
                    audio.remove();
                    resolve();
                }
            };
            
            audio.addEventListener('timeupdate', stopListener);
            audio.play().catch(reject);
        });
    }

    /**
     * 선택된 텍스트 또는 전체 텍스트 가져오기
     */
    getSelectedOrAllText() {
        const selection = window.getSelection().toString();
        return selection || this.textInput.value;
    }

    /**
     * 제어 버튼 상태 업데이트
     */
    updateControlState() {
        this.speakButton.disabled = this.isPlaying || this.isRecording;
        this.recordButton.disabled = this.isPlaying || this.isRecording;
        this.stopButton.disabled = !this.isPlaying && !this.isRecording;
    }

    /**
     * API 키 저장
     */
    saveApiKey() {
        const apiKey = this.apiKeyInput.value.trim();
        if (!Utils.validateApiKey(apiKey)) {
            Utils.showNotification('유효한 API 키를 입력하세요.', 'warning');
            return;
        }

        this.ttsService.setApiKey(apiKey);
        this.apiKeyModal.hide();
        Utils.showNotification('API 키가 저장되었습니다.');
    }

    /**
     * 저장 디렉토리 선택
     */
    async selectDirectory() {
        if (!this.isFileSystemSupported) {
            Utils.showNotification('이 브라우저는 디렉토리 선택을 지원하지 않습니다.', 'warning');
            return;
        }

        try {
            // 디렉토리 선택기 옵션
            const options = {
                mode: 'readwrite',
                startIn: 'downloads'  // 다운로드 폴더에서 시작
            };

            // 디렉토리 선택
            const dirHandle = await window.showDirectoryPicker(options);
            
            // 권한 확인
            const permissionStatus = await dirHandle.queryPermission({ mode: 'readwrite' });
            if (permissionStatus !== 'granted') {
                const newPermission = await dirHandle.requestPermission({ mode: 'readwrite' });
                if (newPermission !== 'granted') {
                    throw new Error('디렉토리 접근 권한이 거부되었습니다.');
                }
            }

            // 디렉토리 핸들 저장
            this.directoryHandle = dirHandle;
            
            // 디렉토리 경로 표시 및 저장
            const dirName = dirHandle.name;
            this.directoryPath.value = dirName;
            localStorage.setItem('lastDirectoryPath', dirName);

            // 파일명 입력 필드에 포커스
            this.recordingFileName.focus();

        } catch (error) {
            console.error('디렉토리 선택 오류:', error);
            
            // 사용자가 취소한 경우는 에러 메시지를 표시하지 않음
            if (error.name === 'AbortError') {
                return;
            }

            // 구체적인 에러 메시지 표시
            let errorMessage = '디렉토리 선택에 실패했습니다.';
            if (error.name === 'SecurityError') {
                errorMessage = '디렉토리 접근 권한이 없습니다.';
            } else if (error.name === 'NotAllowedError') {
                errorMessage = '디렉토리 접근이 거부되었습니다.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            Utils.showNotification(errorMessage, 'warning');
        }
    }

    /**
     * 파일 저장
     */
    async saveFile() {
        const fileName = this.fileNameInput.value.trim();
        if (!Utils.validateFileName(fileName)) {
            Utils.showNotification('유효한 파일 이름을 입력하세요.', 'warning');
            return;
        }

        if (!this.directoryHandle) {
            Utils.showNotification('저장 위치를 선택하세요.', 'warning');
            return;
        }

        try {
            this.isRecording = true;
            this.updateControlState();
            this.saveFileModal.hide();

            const text = this.getSelectedOrAllText();
            const voices = {
                narrator: this.narratorVoice.value,
                speakerA: this.speakerA.value,
                speakerB: this.speakerB.value,
                speakerC: this.speakerC.value
            };

            const narratorMode = document.querySelector('input[name="narratorMode"]:checked').value;
            const segments = await this.ttsService.processText(text, voices, narratorMode);

            if (segments.length > 0) {
                const audioBlobs = segments.map(segment => Utils.base64ToBlob(segment.audioContent));
                const finalBlob = new Blob(audioBlobs, { type: 'audio/mp3' });

                const fileHandle = await this.directoryHandle.getFileHandle(`${fileName}.mp3`, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(finalBlob);
                await writable.close();

                Utils.showNotification('파일 저장되었습니.');
            }
        } catch (error) {
            console.error('파일 저장 실패:', error);
            Utils.showNotification('파일 저장 실패', 'danger');
        } finally {
            this.isRecording = false;
            this.updateControlState();
        }
    }

    /**
     * 녹음 관련 이벤트 초기화
     */
    initializeRecordingEvents() {
        // 선택 버튼 클릭 이벤트 (파일 저장 윈도우 대신 바로 녹음 설정 모달 표시)
        const selectButton = document.querySelector('button.select-button'); // 실제 선택 버튼의 선택자로 수정 필요
        if (selectButton) {
            selectButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showRecordingModal();
            });
        }

        // 찾아보기 버튼 클릭 이벤트
        this.browseDirectoryBtn.addEventListener('click', async () => {
            await this.selectDirectory();
        });

        // 파일명 입력 이벤트
        this.recordingFileName.addEventListener('input', (e) => {
            const fileName = e.target.value.trim();
            const isValid = this.validateFileName(fileName);
            this.startRecordingBtn.disabled = !isValid;
        });

        // 녹음 시작 버튼 이벤트
        this.startRecordingBtn.addEventListener('click', async () => {
            const fileName = this.recordingFileName.value.trim();
            if (!fileName) {
                Utils.showNotification('파일 이름을 입력해주세요.', 'warning');
                return;
            }

            this.recordingModal.hide();
            await this.startRecording(fileName);
        });
    }

    /**
     * 녹음 설정 모달 표시
     */
    showRecordingModal() {
        // 파일명 입력 필드 초기화
        this.recordingFileName.value = '';
        this.recordingFileName.focus();
        
        // 모달 표시
        this.recordingModal.show();
    }

    /**
     * 파일명 유효성 검사
     */
    validateFileName(fileName) {
        if (!fileName) return false;
        const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
        return fileName.length > 0 && !invalidChars.test(fileName);
    }

    /**
     * 녹음 시작
     */
    async startRecording(fileName) {
        try {
            this.isRecording = true;
            this.updateControlState();
            Utils.showNotification('녹음을 시작합니다...', 'info');

            // ... 녹음 로직 ...
            
        } catch (error) {
            console.error('녹음 실패:', error);
            Utils.showNotification('녹음 실패: ' + error.message, 'danger');
        } finally {
            this.isRecording = false;
            this.updateControlState();
        }
    }

    /**
     * 텍스트 읽기 시작
     */
    async startSpeaking() {
        const text = this.textInput.value.trim();
        if (!text) {
            Utils.showNotification('텍스트를 입력해주세요.', 'warning');
            return;
        }

        try {
            this.isSpeaking = true;
            this.updateControlState();

            // 이전 발화 취소
            if (this.currentUtterance) {
                window.speechSynthesis.cancel();
            }

            const utterance = new SpeechSynthesisUtterance(text);
            this.currentUtterance = utterance;

            // 음성 설정
            utterance.lang = 'ko-KR';
            utterance.rate = this.speedControl.value;
            utterance.pitch = 1.0;

            // 단어 단위 하이라이트를 위한 이벤트 핸들러
            utterance.onboundary = (event) => {
                if (event.name === 'word') {
                    this.highlightText(event.charIndex, event.charLength);
                }
            };

            // 읽기 종료 이벤트
            utterance.onend = () => {
                this.isSpeaking = false;
                this.updateControlState();
                this.removeHighlight();
                this.currentUtterance = null;
            };

            // 에러 처리
            utterance.onerror = (event) => {
                console.error('음성 합성 오류:', event.error);
                this.isSpeaking = false;
                this.updateControlState();
                this.removeHighlight();
                this.currentUtterance = null;
                Utils.showNotification('음성 합성 중 오류가 발생했습니다.', 'danger');
            };

            // 음성 합성 시작
            window.speechSynthesis.speak(utterance);

        } catch (error) {
            console.error('음성 합성 오류:', error);
            this.isSpeaking = false;
            this.updateControlState();
            Utils.showNotification('음성 합성을 시작할 수 없습니다.', 'danger');
        }
    }

    /**
     * 텍스트 하이라이트 처리
     */
    highlightText(startIndex, length) {
        try {
            // 이전 하이라이트 제거
            this.removeHighlight();

            // 텍스트 범위 선택
            const range = document.createRange();
            const textNode = this.textInput.firstChild;
            
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                range.setStart(textNode, startIndex);
                range.setEnd(textNode, startIndex + length);

                // 선택 영역 생성 및 스타일 적용
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);

                // 하이라이트 스타일 적용
                this.textHighlighter = document.createElement('span');
                this.textHighlighter.className = 'highlight';
                range.surroundContents(this.textHighlighter);
            }
        } catch (error) {
            console.warn('텍스트 하이라이트 오류:', error);
        }
    }

    /**
     * 하이라이트 제거
     */
    removeHighlight() {
        if (this.textHighlighter) {
            const parent = this.textHighlighter.parentNode;
            if (parent) {
                const text = this.textHighlighter.textContent;
                parent.replaceChild(document.createTextNode(text), this.textHighlighter);
            }
            this.textHighlighter = null;
        }
    }

    /**
     * 말하기 중지
     */
    stopSpeaking() {
        if (this.isSpeaking) {
            window.speechSynthesis.cancel();
            this.isSpeaking = false;
            this.updateControlState();
            this.removeHighlight();
            this.currentUtterance = null;
        }
    }
}

// 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('앱 초기화');
    window.ttsApp = new TTSApplication();
});



