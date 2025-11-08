document.addEventListener('DOMContentLoaded', function() {
    const pinyinInput = document.getElementById('pinyin-input');
    if (!pinyinInput) return; // Exit if not on the game page

    const skipBtn = document.getElementById('skip-btn');
    const char1El = document.getElementById('char1');
    const char2El = document.getElementById('char2');
    const livesEl = document.getElementById('lives');
    const scoreEl = document.getElementById('score');
    const feedbackEl = document.getElementById('feedback');
    const TOTAL_LIVES = 10;
    
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

    skipBtn.addEventListener('click', function() {
        fetch('/skip_word', { method: 'POST' })
            .then(response => response.json())
            .then(handleServerResponse);
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
            case 'skipped':
                showFeedback("-1 ❤️");
                updateGameState(data.game_state);
                break;
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
            showFeedback(`-${state.deducted_points} ❤️`);
        }
        updateLives(state.lives);
        
        const currentHighlight = document.querySelector('.highlight');
        if(currentHighlight) {
            currentHighlight.classList.add('incorrect');
            setTimeout(() => currentHighlight.classList.remove('incorrect'), 500);
        }
    }
    
    function updateGameState(state) {
        updateWordDisplay(state.word_info);
        updateLives(state.lives);
        updateScore(state.score);
    }
    
    function updateWordDisplay(word_info) {
        char1El.textContent = word_info.word[0];
        char2El.textContent = word_info.word[1];
        char1El.className = 'char-box highlight';
        char2El.className = 'char-box';
    }
    
    // --- 核心修复：直接替换符号 ---
    function updateLives(currentLives) {
        livesEl.innerHTML = ''; // 清空现有的心
        for (let i = 0; i < TOTAL_LIVES; i++) {
            const heart = document.createElement('span');
            
            // 如果当前循环索引 i 小于 剩余生命值，就是红心 ❤️
            if (i < currentLives) {
                heart.textContent = '❤️';
                heart.className = 'full-heart';
            } else { // 否则就是空心 ♡
                heart.textContent = '♡';
                heart.className = 'empty-heart';
            }
            livesEl.appendChild(heart);
        }
        // 根据当前生命值决定是否添加 'low-health' 类以触发动画
        livesEl.classList.toggle('low-health', currentLives > 0 && currentLives <= 3);
    }

    function updateScore(count) {
        scoreEl.textContent = `得分: ${count} / 10`;
    }

    function showFeedback(message) {
        feedbackEl.textContent = message;
        feedbackEl.classList.add('show');
        setTimeout(() => feedbackEl.classList.remove('show'), 1500);
    }
});