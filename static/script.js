document.addEventListener('DOMContentLoaded', function() {
    const pinyinInput = document.getElementById('pinyin-input');
    if (!pinyinInput) return; // Exit if not on the game page

    // 修改：移除了 skipBtn 的相关代码
    const char1El = document.getElementById('char1');
    const char2El = document.getElementById('char2');
    const livesEl = document.getElementById('lives');
    const scoreEl = document.getElementById('score');
    const feedbackEl = document.getElementById('feedback');
    const TOTAL_LIVES = initialGameState.totalLives; // 修改：从后端获取总生命值
    const TARGET_SCORE = initialGameState.targetScore; // 修改：从后端获取目标分数
    
    // Initial UI setup
    updateLives(initialGameState.lives);
    updateScore(initialGameState.score);

    pinyinInput.addEventListener('input', function() {
        this.value = this.value.replace(/[^a-zA-Z]/g, '');
    });
    
    pinyinInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && this.value.trim() !== '') {
            event.preventDefault();
            submitPinyin(this.value.trim());
        }
    });

    function submitPinyin(pinyin) {
        fetch('/submit_answer', {
            method: 'POST',
            body: JSON.stringify({ pinyin: pinyin }),
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(handleServerResponse);
    }
    
    function handleServerResponse(data) {
        pinyinInput.value = '';
        pinyinInput.focus();

        if (data.status === 'win' || data.status === 'lose') {
            window.location.href = '/result';
            return;
        }

        switch(data.status) {
            case 'correct_char':
                handleCorrectChar();
                break;
            case 'word_completed':
                handleWordCompleted(data.game_state);
                break;
            case 'incorrect':
                handleIncorrect(data.game_state);
                break;
            // 修改：移除了 skipped case
        }
    }

    function handleCorrectChar() {
        char1El.classList.remove('highlight');
        char1El.classList.add('correct');
        char2El.classList.add('highlight');
    }

    function handleWordCompleted(state) {
        char2El.classList.remove('highlight');
        char2El.classList.add('correct');
        updateScore(state.score);
        setTimeout(() => updateWordDisplay(state.word_info), 600);
    }

    function handleIncorrect(state) {
        if (state.deducted_points > 0) {
            showFeedback(`-1 ❤️`); // 修改：动画固定为 -1
        }
        updateLives(state.lives);
        
        const currentHighlight = document.querySelector('.highlight');
        if(currentHighlight) {
            currentHighlight.classList.add('incorrect');
            setTimeout(() => currentHighlight.classList.remove('incorrect'), 500);
        }
    }
    
    function updateWordDisplay(word_info) {
        char1El.textContent = word_info.word[0];
        char2El.textContent = word_info.word[1];
        char1El.className = 'char-box highlight';
        char2El.className = 'char-box';
    }
    
    function updateLives(currentLives) {
        livesEl.innerHTML = '';
        for (let i = 0; i < TOTAL_LIVES; i++) {
            const heart = document.createElement('span');
            if (i < currentLives) {
                heart.textContent = '❤️';
                heart.className = 'full-heart';
            } else {
                heart.textContent = '♡';
                heart.className = 'empty-heart';
            }
            livesEl.appendChild(heart);
        }
        livesEl.classList.toggle('low-health', currentLives > 0 && currentLives <= 3);
    }

    function updateScore(count) {
        // 修改：使用动态目标分数
        scoreEl.textContent = `得分: ${count} / ${TARGET_SCORE}`;
    }

    function showFeedback(message) {
        feedbackEl.textContent = message;
        feedbackEl.classList.add('show');
        setTimeout(() => feedbackEl.classList.remove('show'), 1500);
    }
});