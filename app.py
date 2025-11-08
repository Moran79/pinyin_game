import csv
import random
import os
from datetime import datetime
from flask import Flask, render_template, session, jsonify, request, redirect, url_for

app = Flask(__name__)
app.secret_key = 'a_very_secret_key_for_pinyin_game_v5'

WORD_LIST = []
TARGET_SCORE = 20

# 定义不同难度的生命值
LIVES_CONFIG = {
    'easy': 12,
    'hard': 6
}


def load_words():
    global WORD_LIST
    try:
        with open('words.csv', 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            WORD_LIST = [
                {"word": row[0], "pinyin": [row[1].strip(), row[2].strip()]}
                for row in reader if len(row) == 3 and row[0] and row[1] and row[2]
            ]
            print(f"成功加载 {len(WORD_LIST)} 个词语。")
    except FileNotFoundError:
        print("错误：找不到 words.csv 文件！将使用默认词库。")
        WORD_LIST = [{"word": "你好", "pinyin": ["ni", "hao"]}]


load_words()


def get_new_word():
    used_indices = session.get('used_indices', [])
    available_indices = [i for i in range(len(WORD_LIST)) if i not in used_indices]
    if not available_indices:
        print("题库已用完，正在重置...")
        session['used_indices'] = []
        used_indices = []
        available_indices = [i for i in range(len(WORD_LIST)) if i not in used_indices]
        if not available_indices:
            return False
    word_index = random.choice(available_indices)
    word_data = WORD_LIST[word_index]
    used_indices.append(word_index)
    session['used_indices'] = used_indices
    session['current_word_info'] = {
        "word": word_data['word'], "pinyin": word_data['pinyin'],
        "char_index": 0, "mistake_made_on_char": [False, False]
    }
    session.modified = True
    return True


def save_mistakes_to_file():
    player_name = session.get('player_name', 'UnknownPlayer')
    mistakes = session.get('mistakes', [])

    reports_dir = 'reports'
    if not os.path.exists(reports_dir):
        os.makedirs(reports_dir)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(reports_dir, f"{player_name}_{timestamp}.txt")

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(f"--- {player_name}的拼音错题本 ---\n")
        f.write(f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"最终得分: {session.get('score', 0)} / {TARGET_SCORE}\n\n")
        if mistakes:
            for mistake in mistakes:
                f.write(f"汉字: {mistake['char']}\n")
                f.write(f"  - 正确拼音: {mistake['correct']}\n")
                f.write(f"  - 错误尝试: {', '.join(mistake['attempts'])}\n\n")
        else:
            f.write("本次游戏没有记录到错误拼写。\n")
    print(f"错误报告已保存至: {filename}")


@app.route('/')
def start_page():
    session.clear()
    return render_template('start.html')


@app.route('/start_game', methods=['POST'])
def start_game():
    player_name = request.form.get('player_name', '小朋友').strip()
    if not player_name:
        player_name = "小朋友"

    # --- 修改：根据选择的难度设置生命值 ---
    level = request.form.get('level', 'easy')  # 默认为简单模式
    initial_lives = LIVES_CONFIG.get(level, LIVES_CONFIG['easy'])

    session['player_name'] = player_name
    session['initial_lives'] = initial_lives  # 将总生命值存入 session
    session['lives'] = initial_lives  # 当前生命值
    session['score'] = 0
    session['mistakes'] = []
    session['used_indices'] = []

    if get_new_word():
        return redirect(url_for('game'))
    return redirect(url_for('start_page'))


@app.route('/game')
def game():
    if 'player_name' not in session:
        return redirect(url_for('start_page'))
    return render_template(
        'game.html',
        target_score=TARGET_SCORE,
        initial_lives=session.get('initial_lives', LIVES_CONFIG['easy'])  # 从session读取总生命值
    )


# submit_answer, result 等路由函数保持不变
@app.route('/submit_answer', methods=['POST'])
def submit_answer():
    data = request.json
    user_pinyin = data.get('pinyin', '').lower().strip().replace('v', 'ü')
    word_info = session.get('current_word_info')
    char_index = word_info['char_index']

    if char_index >= len(word_info['pinyin']):
        return jsonify({"status": "error", "message": "Invalid state"})

    correct_pinyin = word_info['pinyin'][char_index]

    if user_pinyin == correct_pinyin:
        word_info['char_index'] += 1
        if word_info['char_index'] >= len(word_info['pinyin']):
            session['score'] += 1
            if session['score'] >= TARGET_SCORE:
                save_mistakes_to_file()
                return jsonify({"status": "win"})
            get_new_word()
            return jsonify({
                "status": "word_completed",
                "game_state": {"score": session['score'], "word_info": session['current_word_info']}
            })
        session['current_word_info'] = word_info
        return jsonify({"status": "correct_char", "game_state": {"word_info": word_info}})
    else:
        deducted_points = 0
        current_char = word_info['word'][char_index]
        mistakes = session.get('mistakes', [])
        found_mistake_entry = False
        for m in mistakes:
            if m['char'] == current_char:
                if user_pinyin not in m['attempts']:
                    m['attempts'].append(user_pinyin)
                found_mistake_entry = True
                break
        if not found_mistake_entry:
            mistakes.append({"char": current_char, "correct": correct_pinyin, "attempts": [user_pinyin]})

        if not word_info['mistake_made_on_char'][char_index]:
            session['lives'] -= 1
            deducted_points = 1
            word_info['mistake_made_on_char'][char_index] = True

        session['mistakes'] = mistakes
        session['current_word_info'] = word_info

        if session['lives'] <= 0:
            save_mistakes_to_file()
            return jsonify({"status": "lose"})

        return jsonify({
            "status": "incorrect",
            "game_state": {"lives": session['lives'], "deducted_points": deducted_points}
        })


@app.route('/result')
def result():
    if 'player_name' not in session:
        return redirect(url_for('start_page'))
    return render_template('result.html', target_score=TARGET_SCORE)


if __name__ == '__main__':
    app.run(debug=True)