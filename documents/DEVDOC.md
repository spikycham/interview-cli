# TypeScript 版开发文档

> 读者：负责用 TypeScript 从零实现本项目的 coding agent。目标目录为空，pnpm + Node 18+ + vitest。
>
> 产品：语音面试/英语口语练习 CLI。LM 扮演 Interviewer 提问（TTS 朗读），用户对麦克风回答（ASR 转写回喂 LLM），会话结束生成评估报告 `evaluation.md`。面试始终使用英文，无论 Seed Instruction 是什么语言。
>
> Provider 分工：**文本模型**（Interviewer 对话 + 评估）走 openai SDK chat completions，key 为 `OPENAI_API_KEY`，模型名由 `OPENAI_MODEL` 指定（非官方模型，如用兼容端点加 `baseURL`，端点也走环境变量 `OPENAI_BASE_URL`，可选）；**TTS / ASR** 走小米 mimo（openai SDK + `base_url="https://api.xiaomimimo.com/v1"`，key 为 `MIMO_API_KEY`）。

## 1. 环境变量（启动前全部校验，缺失即报错退出）

| 变量 | 用途 | 必需 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 文本模型 | 是 |
| `OPENAI_MODEL` | 文本模型名（如 `gpt-4o-mini`、`deepseek-chat` 等，实现不硬编码） | 是 |
| `OPENAI_BASE_URL` | 文本模型兼容端点（openai SDK 默认官方地址） | 否 |
| `MIMO_API_KEY` | mimo TTS + ASR | 是 |

## 2. CLI 契约

```
it start --seed "..." | --seed-file <path>
    --voice <name>          # TTS 音色，默认 Chloe
    --interviewer-name <n>  # 默认 Alex
    --output-dir <dir>      # 默认 sessions

it eval <session-id> | --last
    --output-dir <dir>
```

- `--seed` 与 `--seed-file` 互斥，必须恰好给一个；`--seed-file` 读整个文件内容
- `evaluate` 中 `<session-id>` 与 `--last` 互斥，必须恰好给一个
- `--last` 取 output-dir 下 mtime 最新的子目录；无子目录则报错

## 3. 会话循环行为规范

### 3.1 启动

1. `session_id` = uuid v4 hex（32 位无连字符）
2. 创建 `<output-dir>/<session_id>/`（已存在则报错），写入 `metadata.json`（见 §5），`ended_cleanly: false`
3. 调 `llm.next_turn(seed, history=[])` 生成开场问题 → 存 `interviewer_001.txt`，TTS 合成存 `interviewer_001.wav`，播放
4. 打印菜单

### 3.2 菜单循环

```
Commands:
  r  show the latest question as text
  t  record your answer (Enter stops the recording)
  a  replay the latest question audio
  q  end the session and generate the evaluation
```

- `r`：打印最新 `interviewer_*.txt` 内容
- `a`：播放最新 `interviewer_*.wav`
- `t`：
  1. 打印 `Recording... Press Enter to stop.`
  2. 录音，最多 2 分钟；录音期间按 Enter 即停止
  3. ASR 转写，打印 `Transcript: <text>`
  4. 确认门：打印 `Press Enter to accept or r to redo` → `r` 丢弃重录；Enter 接受
  5. 接受后落盘 `speaker_NNN.txt` + `speaker_NNN.wav`，调 `llm.next_turn(seed, history)` 生成下一问，落盘+合成+播放
- `q`：`ended_cleanly = true` 重写 metadata → 打印 `Evaluating the session... This may take a moment.` → 跑评估 → 打印 `Evaluation saved to <path>.` → 退出
- EOF（stdin 关闭）：直接退出，不跑评估
- 未知输入：打印 `Unknown command` 后重打菜单

其他流程状态行：`Session <id> started. Files will be saved to <dir>.`、`<interviewer_name> is preparing the opening question...`、`Transcribing your answer...`、`<name> is preparing the next question...`、`Replaying the latest question audio...`、`Synthesizing the question audio...`、`Playing the question...`。文案可微调，但上述流程节点必须有输出。

### 3.3 turn history 排序（重要细节）

`next_turn` 的 history 从磁盘重建：读会话目录所有 `*.txt`（排除 `evaluation.md`），按 `(turn_number, speaker 序)` 排序——**同一 turn_number 内 interviewer 在 speaker 之前**。不能纯字典序排（否则 interviewer 全排前面）。奇偶映射：history[0] 是 interviewer（assistant 角色），交替 user/assistant。

### 3.4 LLM 消息构造（next_turn）

- system prompt（`{}` 为插值）：

```
You are {interviewer_name}, the Interviewer in an English-language mock interview.
Use the Seed Instruction below as the scenario and constraints for the interview.
Conduct the interview in English even if the Seed Instruction is written in another language.
Stay in character as the interviewer.
Never correct the speaker's English during the interview.
Save all feedback for the evaluation phase after the session.

Seed Instruction:
{seed_instruction}
```

- messages：第一条固定 `{"role":"user","content":"Begin the interview now with your opening question."}`（API 要求首条为 user），之后按 §3.3 顺序、奇偶交替 assistant/user
- `max_tokens: 512`
- 空回复视为错误（抛异常）
- 取 `completion.choices[0].message.content`

## 4. 音频 I/O

- 全程 WAV。录音：16kHz、mono、16-bit PCM（mimo ASR 如对采样率有要求，实现时实测调整）
- 录音期间停止条件检测需非阻塞（Node 里 `readline` + `process.stdin` 事件即可）
- 播放：读 WAV → 播放 → 等播完再继续
- TS 实现建议：`child_process` 调 `sox`/`ffmpeg` 录放最简单可靠；或 `mic` + `wav` 编码、`speaker` 播放

## 5. 会话目录文件格式（磁盘契约）

```
<output-dir>/<session-id>/
  metadata.json
  interviewer_001.txt   # 问题文本，带尾换行
  interviewer_001.wav   # TTS 音频
  speaker_001.txt
  speaker_001.wav
  ...
  evaluation.md
```

文件名格式：`{interviewer|speaker}_{NNN:03d}.txt/.wav`

`metadata.json`：

```json
{
  "id": "<hex>",
  "created_at": "<ISO8601 UTC>",
  "seed_instruction": "...",
  "interviewer_name": "Alex",
  "voice": "...",
  "providers": { "llm": "...", "tts": "...", "stt": "...", "recorder": "...", "player": "..." },
  "ended_cleanly": false
}
```

## 6. 评估（evaluation.md）

- system：`You are an English coach evaluating a completed mock interview. Follow the user's requested markdown structure exactly and keep the feedback qualitative.`
- user prompt（逐字使用）：

```
You are evaluating an English-language mock interview after the session has ended.
The transcript below came from speech recognition, so minor STT artifacts such as punctuation errors
or homophone mistakes should not be nitpicked unless they materially affect meaning.
Use the persisted Seed Instruction as the scenario for judging content quality.
Return qualitative feedback only. Do not include numeric scores.
Write markdown with these sections:
1. Language
- CEFR grade (A1-C2)
- Incorrect word usage as what you said -> what a native speaker would say -> why
- Filler-word count plus the actual fillers used
- Recurring grammar patterns only
2. Content
- Short per-question assessment
- Strongest answer
- Weakest answer
3. Overall
- A 2-3 sentence summary
- Top 3 things to practice next

Seed Instruction:
{seed}

Transcript:
Interviewer 1: ...
Speaker 1: ...
```

- transcript 行格式：`Interviewer {n}: {text}` / `Speaker {n}: {text}`，按 §3.3 顺序
- 结果 trim 尾部空白后加一个 `\n` 写入 `evaluation.md`
- `evaluate` 子命令独立可用（对崩溃过的会话补评估），打印 `Evaluating session <id>... This may take a moment.` 开始、`Evaluation saved to <path>.` 结束
- `max_tokens` 同为 512（评估较长，如截断可酌情增大）

## 7. API 接入

两个独立 client：

```ts
// 文本模型：openai SDK，模型名走 OPENAI_MODEL（非官方模型；兼容端点经 OPENAI_BASE_URL）
const llmClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});
const llmModel = process.env.OPENAI_MODEL!;

// 语音模型：mimo（OpenAI SDK 兼容）
const voiceClient = new OpenAI({ apiKey: process.env.MIMO_API_KEY, baseURL: "https://api.xiaomimimo.com/v1" });
```

### 7.1 文本模型 — `llmClient`

标准 `chat.completions.create`，`model: llmModel`，`max_tokens: 512`，取 `message.content`。

### 7.2 TTS — `voiceClient`，模型 `mimo-v2.5-tts`

**非标准端点**：走 `chat.completions`，不走 `audio/speech`：

```ts
const completion = await voiceClient.chat.completions.create({
  model: "mimo-v2.5-tts",
  messages: [
    { role: "user", content: "<语气描述，见下方默认值>" },
    { role: "assistant", content: "<要合成的问题文本>" }
  ],
  audio: { format: "wav", voice },   // voice 默认 "Chloe"
});
const wav = Buffer.from(completion.choices[0].message.audio.data, "base64");
```

- 要合成的文本放 **assistant** 消息，user 消息是语气/风格描述
- 默认语气描述（常量，可后续做成 CLI 参数）：`Clear, professional, and friendly interviewer tone. Moderate pace, natural pauses between sentences.`
- openai SDK 类型里没有 `audio` 字段，需 `as any` 或 `extra_body`

### 7.3 ASR — `voiceClient`，模型 `mimo-v2.5-asr`

同样走 `chat.completions`，不走 `audio/transcriptions`：

```ts
const audioBase64 = recording.toString("base64");
const completion = await voiceClient.chat.completions.create({
  model: "mimo-v2.5-asr",
  messages: [{
    role: "user",
    content: [{ type: "input_audio", input_audio: { data: `data:audio/wav;base64,${audioBase64}` } }]
  }],
  extra_body: { asr_options: { language: "auto" } }
});
const text = completion.choices[0].message.content;
```

- `extra_body` 作为末参数传入
- 转写结果为空时视为错误（抛异常）

## 8. 模块划分建议

```
src/
  cli.ts               # commander/yargs，契约见 §2
  environment.ts       # Provider 装配 + 类型（LLM/TTS/STT/Recorder/Player 接口）
  providers/
    openai-llm.ts      # §7.1
    mimo-tts.ts        # §7.2
    mimo-stt.ts        # §7.3
    audio-recorder.ts  # §4
    audio-player.ts
    fake-*.ts          # 测试用
  session-runner.ts    # §3 状态机
  session-evaluator.ts # §6
  session-metadata.ts  # §5
```

- 用 TS interface 定义五个 Provider（LLM 有 `next_turn` / `evaluate_session` 两个方法），保持装配模式，便于 fake 测试 + 未来换本地后端
- 测试中注入 fake provider 验证状态机，不发真实请求

## 9. 验收清单

1. `--seed`/`--seed-file`、`<id>`/`--last` 互斥校验及报错
2. 会话目录/文件命名与 history 排序（§3.3、§5）
3. LLM 消息构造：opening prompt 固定首条 user，history 奇偶交替（§3.4）
4. 文本模型名/端点/key 全部来自环境变量，不硬编码模型名
5. 录音确认门：`r` 重录不落盘，接受才落盘
6. `q` 才置 `ended_cleanly: true` 并跑评估；EOF 直接退出不评估
7. `evaluate --last` 取 mtime 最新目录；对崩溃会话可补评估
8. 评估 prompt 与 transcript 行格式（§6）
9. 流程节点（录音中/转写中/合成中/评估中）必须有状态输出
