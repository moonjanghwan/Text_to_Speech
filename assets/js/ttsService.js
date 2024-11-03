/**
 * TTS 서비스 클래스
 * Google Cloud TTS API와의 통신을 담당
 */
class TTSService {
    constructor() {
        this.apiKey = localStorage.getItem('googleApiKey');
        this.baseUrl = 'https://texttospeech.googleapis.com/v1/text:synthesize';
        
        // 사용 가능한 음성 목록
        this.voices = {
            korean: [
                { value: 'ko-KR-Standard-A', label: '한국어 여성 A' },
                { value: 'ko-KR-Standard-B', label: '한국어 남성 B' },
                { value: 'ko-KR-Standard-C', label: '한국어 남성 C' },
                { value: 'ko-KR-Standard-D', label: '한국어 여성 D' },
                { value: '', label: 'None' }
            ],
            english: [
                { value: 'en-US-Standard-A', label: '영어 남성 A' },
                { value: 'en-US-Standard-B', label: '영어 남성 B' },
                { value: 'en-US-Standard-C', label: '영어 여성 C' },
                { value: 'en-US-Standard-D', label: '영어 남성 D' },
                { value: 'en-US-Standard-E', label: '영어 여성 E' },
                { value: '', label: 'None' }
            ]
        };
    }

    /**
     * API 키 설정
     * @param {string} apiKey - Google Cloud API 키
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        localStorage.setItem('googleApiKey', apiKey);
    }

    /**
     * 음성 목록 가져오기
     * @param {string} type - 'korean' 또는 'english'
     * @returns {Array} - 음성 목록
     */
    getVoices(type) {
        return this.voices[type] || [];
    }

    /**
     * 음성 미리듣기
     * @param {string} voice - 음성 ID
     */
    async previewVoice(voice) {
        if (!voice) return;

        const previewText = voice.startsWith('ko-') ? 
            "안녕하세요, 음성 미리듣기입니다." : 
            "Hello, this is a voice preview.";

        try {
            const audioContent = await this.synthesizeText(previewText, voice);
            return audioContent;
        } catch (error) {
            console.error('음성 미리듣기 실패:', error);
            throw error;
        }
    }

    /**
     * 텍스트를 음성으로 변환
     * @param {string} text - 변환할 텍스트
     * @param {string} voice - 사용할 음성
     * @returns {Promise<string>} - Base64 인코딩된 오디오 데이터
     */
    async synthesizeText(text, voice) {
        if (!this.apiKey) {
            throw new Error('API 키가 설정되지 않았습니다.');
        }

        const languageCode = voice.startsWith('ko-') ? 'ko-KR' : 'en-US';
        
        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    input: { text },
                    voice: {
                        languageCode,
                        name: voice
                    },
                    audioConfig: {
                        audioEncoding: 'MP3',
                        pitch: 0,
                        speakingRate: 1
                    }
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error.message || '음성 합성 실패');
            }

            const data = await response.json();
            return data.audioContent;
        } catch (error) {
            console.error('TTS API 호출 실패:', error);
            throw error;
        }
    }

    /**
     * 텍스트 처리 및 세그먼트 생성
     * @param {string} text - 처리할 텍스트
     * @param {Object} voices - 사용할 음성 설정
     * @param {string} narratorMode - 내레이터 모드
     * @returns {Promise<Array>} - 처리된 세그먼트 배열
     */
    async processText(text, voices, narratorMode) {
        const lines = text.split('\n');
        const segments = [];

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            const speakerInfo = Utils.getSpeakerInfo(trimmedLine);
            let voice, content;

            if (speakerInfo) {
                // 화자 A, B, C 처리
                voice = voices[`speaker${speakerInfo.speaker}`];
                content = speakerInfo.content;
            } else {
                // 내레이터 처리
                const isTitle = Utils.isTitle(trimmedLine);
                
                switch (narratorMode) {
                    case '전체 읽기':
                        voice = voices.narrator;
                        content = trimmedLine;
                        break;
                    case '제목만 읽기':
                        if (isTitle) {
                            voice = voices.narrator;
                            content = trimmedLine;
                        }
                        break;
                    case '건너뛰기':
                        break;
                }
            }

            if (voice && content) {
                try {
                    const audioContent = await this.synthesizeText(content, voice);
                    segments.push({
                        text: trimmedLine,
                        audioContent,
                        timestamp: Utils.generateTimestamp()
                    });
                } catch (error) {
                    console.error(`세그먼트 처리 실패: ${trimmedLine}`, error);
                    throw error;
                }
            }
        }

        return segments;
    }
}

// 전역으로 사용할 수 있도록 export
window.ttsService = new TTSService();
