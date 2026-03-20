import wave
import numpy as np


def bytes_to_i16(raw: bytes) -> np.ndarray:
    return np.frombuffer(raw or b"", dtype=np.int16)


def resample_i16_mono(x: np.ndarray, src_sr: int, dst_sr: int) -> np.ndarray:
    if x.size == 0 or src_sr <= 0 or dst_sr <= 0 or src_sr == dst_sr:
        return x
    ratio = float(dst_sr) / float(src_sr)
    new_len = int(max(1, round(x.size * ratio)))
    xp = np.linspace(0.0, 1.0, num=x.size, endpoint=False, dtype=np.float64)
    xq = np.linspace(0.0, 1.0, num=new_len, endpoint=False, dtype=np.float64)
    y = np.interp(xq, xp, x.astype(np.float32)).astype(np.float32)
    return np.clip(y, -32768, 32767).astype(np.int16)


def write_wav_i16(path: str, i16: np.ndarray, sr: int) -> None:
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(int(sr))
        wf.writeframes(i16.tobytes())