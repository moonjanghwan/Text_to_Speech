/**
 * 유틸리티 클래스
 * 공통으로 사용되는 헬퍼 함수들을 포함
 */
class Utils {
    /**
     * 알림 메시지 표시
     * @param {string} message - 표시할 메시지
     * @param {string} type - 알림 타입 (success, warning, danger)
     */
    static showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification alert alert-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        // 3초 후 알림 제거
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    /**
     * Base64 문자열을 Blob으로 변환
     * @param {string} base64 - Base64 인코딩된 문자열
     * @returns {Blob} - 변환된 Blob 객체
     */
    static base64ToBlob(base64) {
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        return new Blob([bytes], { type: 'audio/mp3' });
    }

    /**
     * 현재 시간을 기반으로 타임스탬프 생성
     * @returns {string} - YYYYMMDDHHMMSS 형식의 타임스탬프
     */
    static generateTimestamp() {
        const now = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        
        return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
               `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    }

    /**
     * API 키 유효성 검사
     * @param {string} apiKey - 검사할 API 키
     * @returns {boolean} - 유효성 여부
     */
    static validateApiKey(apiKey) {
        return apiKey && apiKey.length > 20;
    }

    /**
     * 파일 이름 유효성 검사
     * @param {string} fileName - 검사할 파일 이름
     * @returns {boolean} - 유효성 여부
     */
    static validateFileName(fileName) {
        const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;
        return fileName && fileName.length > 0 && !invalidChars.test(fileName);
    }

    /**
     * 텍스트가 제목(숫자로 시작)인지 확인
     * @param {string} text - 검사할 텍스트
     * @returns {boolean} - 제목 여부
     */
    static isTitle(text) {
        return /^\d+\./.test(text.trim());
    }

    /**
     * 화자 패턴 확인 (A:, B:, C:)
     * @param {string} text - 검사할 텍스트
     * @returns {Object|null} - 화자 정보 또는 null
     */
    static getSpeakerInfo(text) {
        const match = text.match(/^([ABC]):\s*(.+)/);
        if (match) {
            return {
                speaker: match[1],
                content: match[2].trim()
            };
        }
        return null;
    }

    /**
     * 텍스트에서 선택된 부분의 시작과 끝 위치 가져오기
     * @param {HTMLTextAreaElement} textarea - 텍스트 영역 요소
     * @returns {Object} - 선택 범위 정보
     */
    static getSelectionRange(textarea) {
        return {
            start: textarea.selectionStart,
            end: textarea.selectionEnd
        };
    }

    /**
     * 텍스트 강조 표시
     * @param {HTMLTextAreaElement} textarea - 텍스트 영역 요소
     * @param {number} start - 시작 위치
     * @param {number} end - 끝 위치
     */
    static highlightText(textarea, start, end) {
        textarea.focus();
        textarea.setSelectionRange(start, end);
    }

    /**
     * 강조 표시 제거
     * @param {HTMLTextAreaElement} textarea - 텍스트 영역 요소
     */
    static removeHighlight(textarea) {
        textarea.setSelectionRange(0, 0);
    }

    /**
     * 디렉토리 핸들 유효성 검사
     * @param {FileSystemDirectoryHandle} handle - 검사할 디렉토리 핸들
     * @returns {Promise<boolean>} - 유효성 여부
     */
    static async validateDirectoryHandle(handle) {
        try {
            await handle.requestPermission({ mode: 'readwrite' });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 파일 시스템 접근 권한 요청
     * @param {FileSystemDirectoryHandle} handle - 디렉토리 핸들
     * @returns {Promise<boolean>} - 권한 부여 여부
     */
    static async requestFileSystemPermission(handle) {
        try {
            const permission = await handle.requestPermission({ mode: 'readwrite' });
            return permission === 'granted';
        } catch {
            return false;
        }
    }
}
