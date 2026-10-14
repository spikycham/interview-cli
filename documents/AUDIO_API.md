# Miaomi MiMo Audio Api Templates

## MiMo-V2.5-ASR

- Non-streaming

```python
import os
import base64
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("MIMO_API_KEY"),
    base_url="https://api.xiaomimimo.com/v1"
)

# 需替换为本地真实的文件路径
with open("audio_file.wav", "rb") as f:
    audio_bytes = f.read()
audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

completion = client.chat.completions.create(
    model="mimo-v2.5-asr",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "input_audio",
                    "input_audio": {
                        "data": f"data:audio/wav;base64,{audio_base64}"
                    }
                }
            ]
        }
    ],
    extra_body={
        "asr_options": {
            "language": "zh"
        }
    }
)

print(completion.model_dump_json())
```

- Streaming

```python
import os
import base64
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("MIMO_API_KEY"),
    base_url="https://api.xiaomimimo.com/v1"
)

# 需替换为本地真实的文件路径
with open("audio_file.wav", "rb") as f:
    audio_bytes = f.read()
audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

completion = client.chat.completions.create(
    model="mimo-v2.5-asr",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "input_audio",
                    "input_audio": {
                        "data": f"data:audio/wav;base64,{audio_base64}"
                    }
                }
            ]
        }
    ],
    extra_body={
        "asr_options": {
            "language": "auto"
        }
    },
    stream=True
)

for chunk in completion:
    print(chunk.model_dump_json())
```


## MiMo-V2.5-TTS

- Non-streaming

```python
import os
from openai import OpenAI
import base64

client = OpenAI(
    api_key=os.environ.get("MIMO_API_KEY"),
    base_url="https://api.xiaomimimo.com/v1"
)

completion = client.chat.completions.create(
    model="mimo-v2.5-tts",
    messages=[
        {
            "role": "user",
            "content": "Bright, bouncy, slightly sing-song tone — like you're bursting with good news you can barely hold in. Fast pace, rising pitch at the end."
        },
        {
            "role": "assistant",
            "content": "Hey boss — guess what, guess what? I just got the results back and I actually passed! Not just passed, I got a distinction! I know, I know — you told me I was cutting it close, but hey, here we are. Drinks are on me tonight, okay?"
        }
    ],
    audio={
        "format": "wav",
        "voice": "Chloe"
    }
)

message = completion.choices[0].message
audio_bytes = base64.b64decode(message.audio.data)
with open("audio_file.wav", "wb") as f:
    f.write(audio_bytes)
```

- Streaming

```python
import base64
import os
import numpy as np
import soundfile as sf
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("MIMO_API_KEY"),
    base_url="https://api.xiaomimimo.com/v1"
)

completion = client.chat.completions.create(
    model="mimo-v2.5-tts",
    messages=[
        {
            "role": "user",
            "content": "Bright, bouncy, slightly sing-song tone — like you're bursting with good news you can barely hold in. Fast pace, rising pitch at the end."
        },
        {
            "role": "assistant",
            "content": "Hey boss — guess what, guess what? I just got the results back and I actually passed! Not just passed, I got a distinction! I know, I know — you told me I was cutting it close, but hey, here we are. Drinks are on me tonight, okay?"
        }
    ],
    audio={
        "format": "pcm16",
        "voice": "Chloe"
    },
    stream=True
)

# 24kHz PCM16LE mono audio
collected_chunks: np.ndarray = np.array([], dtype=np.float32)

for chunk in completion:
    if not chunk.choices:
        continue
    delta = chunk.choices[0].delta
    audio = getattr(delta, "audio", None)

    if audio is not None:
        assert isinstance(audio, dict), f"Expected audio to be a dict, got {type(audio)}"
        pcm_bytes = base64.b64decode(audio["data"])
        np_pcm = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        collected_chunks = np.concatenate((collected_chunks, np_pcm))
        print(f"Received audio chunk of size {len(pcm_bytes)} bytes")

# Save the collected audio to a file
os.makedirs("tmp", exist_ok=True)
sf.write("tmp/output.wav", collected_chunks, samplerate=24000)
print("Audio saved to tmp/output.wav")
```
