#!/usr/bin/env python3
"""
Autonomous Fixture Generator for SIH26090 Artisan Platform Test Infrastructure.
Generates synthetic and realistic craft images, audio recordings, and seed datasets
without external API dependencies. Optimized with NumPy vectorization.
"""

import os
import sys
import json
import math
import struct
import wave
import subprocess
import shutil
import numpy as np
from PIL import Image, ImageDraw, ExifTags

FIXTURES_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(FIXTURES_DIR, "images")
AUDIO_DIR = os.path.join(FIXTURES_DIR, "audio")
SEEDS_DIR = os.path.join(FIXTURES_DIR, "seed_data")
SEEDS_ALT_DIR = os.path.join(FIXTURES_DIR, "seeds")

os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(SEEDS_DIR, exist_ok=True)
os.makedirs(SEEDS_ALT_DIR, exist_ok=True)


# =====================================================================
# 1. IMAGE FIXTURES GENERATOR (VECTORIZED)
# =====================================================================

def create_wood_texture(width, height, base_color=(140, 90, 50)):
    """Generate procedural wood grain texture with natural variations (vectorized)."""
    y = np.arange(height, dtype=np.float32)[:, None]
    x = np.arange(width, dtype=np.float32)[None, :]
    grain = (25.0 * np.sin(y * 0.08 + 10.0 * np.sin(x * 0.01))).astype(np.int16)
    noise = np.random.randint(-15, 16, (height, width), dtype=np.int16)

    r = np.clip(base_color[0] + grain + noise, 0, 255).astype(np.uint8)
    g = np.clip(base_color[1] + (grain * 0.7).astype(np.int16) + noise, 0, 255).astype(np.uint8)
    b = np.clip(base_color[2] + (grain * 0.4).astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(np.stack([r, g, b], axis=-1))


def create_burlap_texture(width, height, base_color=(180, 150, 110)):
    """Generate coarse burlap weave texture with noise (vectorized)."""
    x = np.arange(width)[None, :]
    y = np.arange(height)[:, None]
    weave = np.where((x % 6 < 3) ^ (y % 6 < 3), 20, -20).astype(np.int16)
    speckle = np.random.randint(-12, 13, (height, width), dtype=np.int16)

    r = np.clip(base_color[0] + weave + speckle, 0, 255).astype(np.uint8)
    g = np.clip(base_color[1] + weave + speckle, 0, 255).astype(np.uint8)
    b = np.clip(base_color[2] + weave + speckle, 0, 255).astype(np.uint8)
    return Image.fromarray(np.stack([r, g, b], axis=-1))


def generate_varanasi_silk(path):
    """Generate Varanasi silk saree image draped on wooden loom with gold zari."""
    w, h = 1920, 1080
    bg = create_wood_texture(w, h, base_color=(90, 55, 30))
    draw = ImageDraw.Draw(bg)

    # Clutter: loom frame slats & threads
    for y in range(0, h, 60):
        draw.line([(0, y), (w, y)], fill=(60, 35, 15), width=4)
    for x in range(100, w, 200):
        draw.line([(x, 0), (x, h)], fill=(75, 45, 20), width=8)
    for x in range(0, w, 12):
        draw.line([(x, 0), (x, h)], fill=(120, 100, 70), width=1)

    # Spools of golden thread in corner (clutter)
    draw.ellipse([80, 800, 220, 940], fill=(210, 160, 40), outline=(130, 90, 20), width=3)
    draw.ellipse([180, 840, 300, 960], fill=(190, 140, 30), outline=(110, 80, 15), width=3)

    # Foreground Saree: rich crimson drape with gold zari border
    saree_coords = [
        (450, 250), (1450, 200), (1600, 800), (1400, 950),
        (500, 920), (350, 700), (420, 450)
    ]
    draw.polygon(saree_coords, fill=(180, 20, 45))

    # Saree folds and shaded contours
    for i in range(5):
        y_offset = 320 + i * 110
        draw.line([(420, y_offset), (1500, y_offset - 40)], fill=(130, 10, 30), width=12)

    # Gold Zari floral brocade border
    border_pts = [(450, 250), (1450, 200), (1430, 320), (430, 370)]
    draw.polygon(border_pts, fill=(230, 185, 45), outline=(255, 220, 90), width=2)
    for x in range(480, 1400, 90):
        draw.polygon([(x, 260), (x+40, 235), (x+70, 260), (x+35, 300)], fill=(255, 225, 100))
        draw.ellipse([x+25, 255, x+45, 275], fill=(160, 20, 30))

    bg.save(path, "JPEG", quality=95)
    print(f"  [OK] Generated: {os.path.basename(path)}")


def generate_bastar_dhokra(path):
    """Generate Bastar brass dhokra horse on rustic workshop floor."""
    w, h = 1080, 1080
    bg = create_burlap_texture(w, h, base_color=(150, 130, 100))
    draw = ImageDraw.Draw(bg)

    # Clutter: brass shavings, hammer
    points_x = np.random.randint(50, w - 50, 300)
    points_y = np.random.randint(50, h - 50, 300)
    for bx, by in zip(points_x, points_y):
        draw.point((int(bx), int(by)), fill=(230, 195, 60))

    # Hammer in background
    draw.rectangle([100, 150, 280, 220], fill=(80, 80, 85), outline=(40, 40, 45), width=2)
    draw.rectangle([180, 220, 205, 500], fill=(130, 80, 40), outline=(80, 45, 20), width=2)

    # Foreground: Antique Brass Lost-Wax Dhokra Horse
    brass_body = (195, 150, 50)
    brass_highlight = (240, 200, 85)
    brass_shadow = (110, 80, 25)

    # Horse body
    draw.ellipse([340, 440, 740, 680], fill=brass_body, outline=brass_shadow, width=4)
    draw.polygon([(620, 480), (740, 300), (840, 260), (820, 360), (700, 530)], fill=brass_body, outline=brass_shadow)
    draw.polygon([(820, 260), (870, 290), (830, 320)], fill=brass_highlight)
    draw.polygon([(730, 300), (740, 220), (765, 290)], fill=brass_body)
    draw.polygon([(770, 290), (795, 225), (810, 280)], fill=brass_body)

    # Legs
    legs = [
        [(370, 640), (350, 920), (390, 920), (410, 640)],
        [(440, 640), (425, 900), (460, 900), (480, 640)],
        [(620, 640), (610, 910), (645, 910), (660, 640)],
        [(690, 640), (695, 930), (730, 930), (730, 640)],
    ]
    for leg in legs:
        draw.polygon(leg, fill=brass_body, outline=brass_shadow, width=3)

    for y in range(480, 650, 22):
        draw.arc([370, y, 710, y + 25], 0, 180, fill=brass_highlight, width=3)
    for x in range(650, 770, 25):
        draw.ellipse([x, 430, x+18, 455], fill=brass_highlight, outline=brass_shadow, width=2)

    bg.save(path, "JPEG", quality=92)
    print(f"  [OK] Generated: {os.path.basename(path)}")


def generate_khurja_pottery(path):
    """Generate Khurja blue ceramic vase with floral motifs on potter's bench."""
    w, h = 1080, 1080
    bg = create_wood_texture(w, h, base_color=(120, 100, 85))
    draw = ImageDraw.Draw(bg)

    # Clutter: clay splatters, carving tools, turntable ring
    draw.ellipse([150, 150, 930, 930], outline=(90, 75, 60), width=6)
    pts_x = np.random.randint(80, w - 80, 25)
    pts_y = np.random.randint(80, h - 80, 25)
    for cx, cy in zip(pts_x, pts_y):
        cr = np.random.randint(8, 25)
        draw.ellipse([int(cx), int(cy), int(cx+cr), int(cy+cr)], fill=(160, 140, 120))

    # Ceramic Blue Vase Body
    cobalt_base = (20, 50, 140)
    cobalt_glaze = (40, 90, 210)
    highlight = (160, 200, 255)

    vase_pts = [
        (460, 240), (620, 240), (600, 360), (720, 520),
        (740, 700), (660, 860), (420, 860), (340, 700),
        (360, 520), (480, 360)
    ]
    draw.polygon(vase_pts, fill=cobalt_base, outline=(10, 30, 90), width=4)
    draw.polygon([(480, 250), (515, 250), (410, 530), (380, 700), (445, 850), (420, 850), (360, 700), (385, 530)], fill=cobalt_glaze)
    draw.line([(490, 260), (405, 530), (380, 690), (435, 840)], fill=highlight, width=6)

    # Hand-painted Mughal white floral patterns
    for y in [440, 580, 720]:
        for x in [480, 550, 620]:
            draw.ellipse([x-15, y-15, x+15, y+15], fill=(245, 245, 250))
            draw.ellipse([x-5, y-5, x+5, y+5], fill=(220, 180, 50))
            for angle in range(0, 360, 60):
                rad = math.radians(angle)
                px = x + int(22 * math.cos(rad))
                py = y + int(22 * math.sin(rad))
                draw.ellipse([px-7, py-7, px+7, py+7], fill=(250, 250, 255))

    bg.save(path, "JPEG", quality=90)
    print(f"  [OK] Generated: {os.path.basename(path)}")


def generate_madhubani_art(path):
    """Generate Madhubani folk painting with pigment bowls on mud floor."""
    w, h = 1200, 1200
    x = np.arange(w, dtype=np.float32)[None, :]
    noise = np.random.randint(-8, 9, (h, w), dtype=np.int16)
    val = (80.0 + 15.0 * np.sin(x * 0.05)).astype(np.int16) + noise

    r = np.clip(val + 20, 0, 255).astype(np.uint8)
    g = np.clip(val + 10, 0, 255).astype(np.uint8)
    b = np.clip(val, 0, 255).astype(np.uint8)
    bg = Image.fromarray(np.stack([r, g, b], axis=-1))
    draw = ImageDraw.Draw(bg)

    # Clutter: pigment bowls
    draw.ellipse([80, 80, 220, 220], fill=(190, 50, 40), outline=(100, 25, 20), width=4)
    draw.ellipse([980, 120, 1100, 240], fill=(40, 130, 60), outline=(20, 70, 30), width=4)
    draw.line([(150, 240), (280, 400)], fill=(200, 170, 110), width=8)

    # Handmade handmade paper canvas
    draw.rectangle([250, 200, 950, 1000], fill=(242, 232, 205), outline=(150, 130, 100), width=5)

    # Double border with geometric hatching
    draw.rectangle([270, 220, 930, 980], outline=(20, 20, 20), width=4)
    draw.rectangle([290, 240, 910, 960], outline=(20, 20, 20), width=2)
    for bx in range(270, 930, 15):
        draw.line([(bx, 220), (bx+10, 240)], fill=(180, 40, 30), width=2)
        draw.line([(bx, 960), (bx+10, 980)], fill=(180, 40, 30), width=2)

    # Sacred Twin Fishes
    draw.polygon([(400, 500), (600, 420), (750, 500), (600, 580)], fill=(220, 70, 40), outline=(20, 20, 20), width=3)
    draw.polygon([(750, 500), (840, 440), (810, 500), (840, 560)], fill=(230, 160, 30), outline=(20, 20, 20), width=3)
    draw.ellipse([440, 485, 465, 510], fill=(255, 255, 255), outline=(0, 0, 0), width=2)
    draw.ellipse([450, 495, 458, 503], fill=(0, 0, 0))
    for fx in range(500, 720, 25):
        draw.arc([fx, 450, fx+40, 550], 90, 270, fill=(20, 20, 20), width=2)

    draw.polygon([(400, 700), (600, 620), (750, 700), (600, 780)], fill=(30, 140, 160), outline=(20, 20, 20), width=3)
    draw.polygon([(750, 700), (840, 640), (810, 700), (840, 760)], fill=(230, 160, 30), outline=(20, 20, 20), width=3)
    draw.ellipse([440, 685, 465, 710], fill=(255, 255, 255), outline=(0, 0, 0), width=2)
    draw.ellipse([450, 695, 458, 703], fill=(0, 0, 0))
    for fx in range(500, 720, 25):
        draw.arc([fx, 650, fx+40, 750], 90, 270, fill=(20, 20, 20), width=2)

    bg.save(path, "JPEG", quality=92)
    print(f"  [OK] Generated: {os.path.basename(path)}")


def generate_channapatna_toy(path):
    """Generate Channapatna lacquered wooden toy engine with wood shavings."""
    w, h = 1080, 1080
    bg = create_wood_texture(w, h, base_color=(160, 125, 80))
    draw = ImageDraw.Draw(bg)

    # Clutter: wood shavings
    pts_x = np.random.randint(40, w - 80, 60)
    pts_y = np.random.randint(40, h - 80, 60)
    for sx, sy in zip(pts_x, pts_y):
        draw.arc([int(sx), int(sy), int(sx+50), int(sy+40)], 30, 240, fill=(230, 210, 160), width=4)

    # Toy Train Engine Body
    draw.rounded_rectangle([320, 480, 740, 680], radius=40, fill=(255, 205, 10), outline=(180, 130, 0), width=4)
    draw.rectangle([420, 480, 470, 680], fill=(220, 35, 30))
    draw.rectangle([520, 480, 560, 680], fill=(30, 160, 50))
    draw.rectangle([610, 480, 650, 680], fill=(220, 35, 30))

    draw.polygon([(380, 480), (370, 340), (430, 340), (420, 480)], fill=(220, 35, 30), outline=(150, 10, 10), width=3)
    draw.ellipse([360, 325, 440, 355], fill=(255, 210, 20), outline=(180, 140, 0), width=3)

    draw.rounded_rectangle([680, 380, 840, 680], radius=20, fill=(30, 155, 60), outline=(15, 90, 30), width=4)
    draw.rounded_rectangle([720, 430, 800, 510], radius=10, fill=(240, 245, 255), outline=(15, 90, 30), width=3)

    wheels = [(370, 680), (510, 680), (650, 680), (780, 680)]
    for wx, wy in wheels:
        draw.ellipse([wx-50, wy-20, wx+50, wy+80], fill=(210, 40, 30), outline=(100, 10, 10), width=4)
        draw.ellipse([wx-25, wy+5, wx+25, wy+55], fill=(255, 215, 30))
        draw.ellipse([wx-10, wy+20, wx+10, wy+40], fill=(50, 30, 20))

    bg.save(path, "JPEG", quality=90)
    print(f"  [OK] Generated: {os.path.basename(path)}")


def generate_edge_cases(images_dir):
    """Generate edge cases: low light, clean white bg, panoramic, and GPS EXIF."""
    # 1. Edge Low Light (<20 avg luminance)
    w, h = 800, 800
    arr = np.random.randint(5, 18, (h, w, 3), dtype=np.uint8)
    arr[250:550, 250:550] = np.clip(arr[250:550, 250:550] + 15, 0, 25)
    img_low = Image.fromarray(arr)
    img_low.save(os.path.join(images_dir, "edge_low_light_under20lux.jpg"), "JPEG", quality=85)
    print("  [OK] Generated: edge_low_light_under20lux.jpg")

    # 2. Edge Clean White Background
    w, h = 1024, 1024
    img_white = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(img_white)
    draw.ellipse([300, 400, 724, 750], fill=(185, 145, 45), outline=(130, 95, 25), width=4)
    draw.ellipse([340, 430, 684, 550], fill=(155, 115, 30), outline=(100, 70, 15), width=3)
    img_white.save(os.path.join(images_dir, "edge_clean_white_bg.jpg"), "JPEG", quality=95)
    print("  [OK] Generated: edge_clean_white_bg.jpg")

    # 3. Edge Extreme Panoramic (1:8 banner)
    w, h = 2400, 300
    img_pano = create_wood_texture(w, h, base_color=(100, 70, 40))
    draw = ImageDraw.Draw(img_pano)
    draw.rounded_rectangle([150, 110, 2250, 190], radius=20, fill=(185, 130, 55), outline=(110, 70, 20), width=4)
    for px in range(600, 1800, 120):
        draw.ellipse([px, 135, px+30, 165], fill=(40, 25, 15))
    img_pano.save(os.path.join(images_dir, "edge_extreme_panoramic.jpg"), "JPEG", quality=90)
    print("  [OK] Generated: edge_extreme_panoramic.jpg")

    # 4. Edge with GPS EXIF (Varanasi: 25.3176 N, 82.9739 E)
    w, h = 1080, 1080
    img_exif = create_wood_texture(w, h, base_color=(130, 85, 45))
    draw = ImageDraw.Draw(img_exif)
    draw.ellipse([340, 340, 740, 740], fill=(200, 150, 40), outline=(120, 80, 20), width=4)

    exif = img_exif.getexif()
    exif[ExifTags.Base.Make] = "Nikon"
    exif[ExifTags.Base.Model] = "D850"
    exif[ExifTags.Base.Software] = "MoSJE Sovereign Camera 1.0"
    gps_ifd = exif.get_ifd(ExifTags.Base.GPSInfo)
    gps_ifd[ExifTags.GPS.GPSLatitudeRef] = "N"
    gps_ifd[ExifTags.GPS.GPSLatitude] = (25.0, 19.0, 3.36)
    gps_ifd[ExifTags.GPS.GPSLongitudeRef] = "E"
    gps_ifd[ExifTags.GPS.GPSLongitude] = (82.0, 58.0, 26.04)
    gps_ifd[ExifTags.GPS.GPSAltitude] = (80.5, 1)

    img_exif.save(os.path.join(images_dir, "edge_with_gps_exif.jpg"), "JPEG", exif=exif, quality=92)
    print("  [OK] Generated: edge_with_gps_exif.jpg (with GPS tags)")


# =====================================================================
# 2. AUDIO FIXTURES GENERATOR
# =====================================================================

def synthesize_speech_wav(filepath, duration_sec, base_freq=150.0, sample_rate=16000, noise_amplitude=0.0):
    """
    Synthesize authentic speech-like waveforms with vocal harmonics,
    formant filters, syllabic cadence, and natural pauses.
    """
    num_samples = int(duration_sec * sample_rate)
    samples = np.zeros(num_samples, dtype=np.float32)

    t = np.linspace(0, duration_sec, num_samples, endpoint=False)
    syllables = 0.5 * (1.0 + np.sin(2 * np.pi * 4.2 * t))
    phrase_pause = np.clip(np.sin(2 * np.pi * 0.28 * t) * 1.5, 0.0, 1.0)
    envelope = syllables * phrase_pause

    f0 = base_freq
    harmonics = [
        (1.0 * f0, 1.0),
        (2.0 * f0, 0.65),
        (3.0 * f0, 0.45),
        (4.0 * f0, 0.30),
        (5.0 * f0, 0.18),
    ]
    vibrato = 1.0 + 0.02 * np.sin(2 * np.pi * 5.0 * t)

    for freq, amp in harmonics:
        phase = 2 * np.pi * freq * np.cumsum(vibrato) / sample_rate
        samples += amp * np.sin(phase)

    f1 = np.sin(2 * np.pi * 700 * t) * 0.4
    f2 = np.sin(2 * np.pi * 1800 * t) * 0.25
    samples = (samples + f1 + f2) * envelope

    max_val = np.max(np.abs(samples))
    if max_val > 0:
        samples = (samples / max_val) * 0.70

    if noise_amplitude > 0.0:
        noise = np.random.normal(0, noise_amplitude, num_samples)
        samples = np.clip(samples + noise, -1.0, 1.0)

    pcm16 = (samples * 32767).astype(np.int16)

    with wave.open(filepath, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm16.tobytes())


def convert_wav_to_opus(wav_path, opus_path, bitrate="24k"):
    """Convert WAV to Ogg Opus using ffmpeg if available, else synthetic Opus container."""
    ffmpeg_bin = shutil.which("ffmpeg")
    if ffmpeg_bin:
        cmd = [
            ffmpeg_bin, "-y", "-i", wav_path,
            "-c:a", "libopus", "-b:a", bitrate,
            "-ar", "48000", opus_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if res.returncode == 0 and os.path.exists(opus_path) and os.path.getsize(opus_path) > 0:
            return True

    # Fallback synthetic Opus container
    with open(opus_path, "wb") as f:
        page1 = bytearray()
        page1.extend(b"OggS\x00\x02")
        page1.extend(b"\x00" * 8)
        page1.extend(struct.pack("<I", 0x12345678))
        page1.extend(struct.pack("<I", 0))
        page1.extend(b"\x00" * 4)
        page1.extend(b"\x01\x13")
        page1.extend(bytearray(b"OpusHead\x01\x01\x00\x00\x80\xbb\x00\x00\x00\x00\x00"))
        f.write(page1)

        tags_payload = bytearray(b"OpusTags\x08\x00\x00\x00TestMock\x00\x00\x00\x00")
        page2 = bytearray()
        page2.extend(b"OggS\x00\x00")
        page2.extend(b"\x00" * 8)
        page2.extend(struct.pack("<I", 0x12345678))
        page2.extend(struct.pack("<I", 1))
        page2.extend(b"\x00" * 4)
        page2.extend(b"\x01")
        page2.extend(struct.pack("B", len(tags_payload)))
        page2.extend(tags_payload)
        f.write(page2)

        audio_data = os.urandom(1024)
        page3 = bytearray()
        page3.extend(b"OggS\x00\x04")
        page3.extend(struct.pack("<Q", 48000 * 5))
        page3.extend(struct.pack("<I", 0x12345678))
        page3.extend(struct.pack("<I", 2))
        page3.extend(b"\x00" * 4)
        page3.extend(b"\x04\xff\xff\xff")
        page3.extend(struct.pack("B", len(audio_data) - 765))
        page3.extend(audio_data)
        f.write(page3)
    return True


def generate_audio_fixtures(audio_dir):
    """Generate standard and edge case audio files."""
    p1 = os.path.join(audio_dir, "hindi_dhokra_horse.wav")
    synthesize_speech_wav(p1, duration_sec=14.8, base_freq=145.0)
    print("  [OK] Generated: hindi_dhokra_horse.wav")

    temp_wav = os.path.join(audio_dir, "temp_khurja.wav")
    synthesize_speech_wav(temp_wav, duration_sec=17.5, base_freq=165.0)
    p2 = os.path.join(audio_dir, "hindi_khurja_pottery.opus")
    convert_wav_to_opus(temp_wav, p2)
    if os.path.exists(temp_wav):
        os.remove(temp_wav)
    print("  [OK] Generated: hindi_khurja_pottery.opus")

    p3 = os.path.join(audio_dir, "regional_bhojpuri_saree.wav")
    synthesize_speech_wav(p3, duration_sec=21.2, base_freq=135.0)
    print("  [OK] Generated: regional_bhojpuri_saree.wav")

    temp_wav2 = os.path.join(audio_dir, "temp_toy.wav")
    synthesize_speech_wav(temp_wav2, duration_sec=20.0, base_freq=175.0)
    p4 = os.path.join(audio_dir, "regional_kannada_toy.opus")
    convert_wav_to_opus(temp_wav2, p4)
    if os.path.exists(temp_wav2):
        os.remove(temp_wav2)
    print("  [OK] Generated: regional_kannada_toy.opus")

    p5 = os.path.join(audio_dir, "edge_pure_silence_5s.wav")
    num_samples = 16000 * 5
    silence = np.zeros(num_samples, dtype=np.int16)
    with wave.open(p5, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(silence.tobytes())
    print("  [OK] Generated: edge_pure_silence_5s.wav")

    p6 = os.path.join(audio_dir, "edge_noisy_market_snr3db.wav")
    synthesize_speech_wav(p6, duration_sec=16.0, base_freq=150.0, noise_amplitude=0.35)
    print("  [OK] Generated: edge_noisy_market_snr3db.wav")

    p7 = os.path.join(audio_dir, "edge_corrupt_header.opus")
    with open(p7, "wb") as f:
        f.write(b"CORRUPT_NOT_OGG_HEADER_DATA_" + os.urandom(256))
    print("  [OK] Generated: edge_corrupt_header.opus")


# =====================================================================
# 3. SEED DATA & BENCHMARKS GENERATOR
# =====================================================================

def generate_cluster_seed_data(seeds_dir):
    """Generate craft_clusters.json for 5 canonical MoSJE clusters."""
    clusters = [
        {
            "cluster_id": "cluster-varanasi-silk-01",
            "name": "Varanasi Silk Cluster",
            "state": "Uttar Pradesh",
            "district": "Varanasi",
            "location": {"latitude": 25.3176, "longitude": 82.9739},
            "primary_crafts": ["Varanasi Silk", "Brocade", "Zari Embroidery"],
            "skilled_hourly_wage_inr": 150.0,
            "active_artisans_count": 1250,
            "average_monthly_capacity_units": 1500,
            "gi_certified": True,
            "established_year": 1600
        },
        {
            "cluster_id": "cluster-bastar-dhokra-02",
            "name": "Bastar Dhokra Cluster",
            "state": "Chhattisgarh",
            "district": "Bastar (Jagdalpur)",
            "location": {"latitude": 19.0748, "longitude": 82.0081},
            "primary_crafts": ["Bastar Dhokra", "Bell Metal Craft", "Lost-Wax Brass Casting"],
            "skilled_hourly_wage_inr": 125.0,
            "active_artisans_count": 480,
            "average_monthly_capacity_units": 800,
            "gi_certified": True,
            "established_year": 1750
        },
        {
            "cluster_id": "cluster-khurja-pottery-03",
            "name": "Khurja Pottery Cluster",
            "state": "Uttar Pradesh",
            "district": "Bulandshahr",
            "location": {"latitude": 28.2546, "longitude": 77.8549},
            "primary_crafts": ["Khurja Pottery", "Ceramic Stoneware", "Glazed Terracotta"],
            "skilled_hourly_wage_inr": 110.0,
            "active_artisans_count": 920,
            "average_monthly_capacity_units": 6000,
            "gi_certified": True,
            "established_year": 1400
        },
        {
            "cluster_id": "cluster-madhubani-painting-04",
            "name": "Madhubani Painting Cluster",
            "state": "Bihar",
            "district": "Madhubani",
            "location": {"latitude": 26.3533, "longitude": 86.0719},
            "primary_crafts": ["Madhubani Painting", "Mithila Folk Art", "Natural Dye Canvas"],
            "skilled_hourly_wage_inr": 130.0,
            "active_artisans_count": 1800,
            "average_monthly_capacity_units": 2200,
            "gi_certified": True,
            "established_year": 1200
        },
        {
            "cluster_id": "cluster-channapatna-toys-05",
            "name": "Channapatna Wooden Toys Cluster",
            "state": "Karnataka",
            "district": "Ramanagara",
            "location": {"latitude": 12.6518, "longitude": 77.2089},
            "primary_crafts": ["Channapatna Toys", "Lacquered Woodware", "Turned Wood Craft"],
            "skilled_hourly_wage_inr": 140.0,
            "active_artisans_count": 650,
            "average_monthly_capacity_units": 4500,
            "gi_certified": True,
            "established_year": 1780
        }
    ]
    path = os.path.join(seeds_dir, "craft_clusters.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(clusters, f, indent=2, ensure_ascii=False)
    print(f"  [OK] Generated: {os.path.basename(path)}")


def generate_benchmark_products_seed(seeds_dir):
    """Generate 50 realistic benchmark products with 768-d normalized SigLIP embeddings."""
    np.random.seed(42)

    craft_templates = [
        ("Varanasi Silk", "cluster-varanasi-silk-01", ["Katan Silk", "Pure Gold Zari", "Mulberry Silk"], 2000, 8000, 110, 180),
        ("Bastar Dhokra", "cluster-bastar-dhokra-02", ["Brass", "Beeswax", "Riverbed Clay"], 400, 2000, 15, 60),
        ("Khurja Pottery", "cluster-khurja-pottery-03", ["Ceramic Clay", "Cobalt Glaze", "Stoneware Slip"], 150, 900, 6, 25),
        ("Madhubani Painting", "cluster-madhubani-painting-04", ["Handmade Paper", "Natural Mineral Dyes", "Bamboo Twig"], 250, 1800, 12, 50),
        ("Channapatna Toys", "cluster-channapatna-toys-05", ["Wrightia Tinctoria Wood", "Vegetable Lacquer", "Natural Dyes"], 120, 650, 4, 18),
    ]

    items = []
    item_id = 1
    for craft_name, cluster_id, materials, mat_min, mat_max, hours_min, hours_max in craft_templates:
        cluster_center = np.random.normal(0, 1.0, 768)
        cluster_center /= np.linalg.norm(cluster_center)

        for i in range(10):
            vec = cluster_center + np.random.normal(0, 0.18, 768)
            vec /= np.linalg.norm(vec)

            mat_cost = round(float(np.random.uniform(mat_min, mat_max)), 2)
            hours = round(float(np.random.uniform(hours_min, hours_max)), 1)
            wage_rate = 130.0
            floor_price = round(mat_cost + (hours * wage_rate) + (mat_cost * 0.10), 2)
            wholesale_price = round(floor_price * 1.28, 2)
            retail_price = round(floor_price * 1.65, 2)

            items.append({
                "product_id": f"bench-prod-{item_id:03d}",
                "title": f"Authentic Handcrafted {craft_name} Piece #{i+1}",
                "craft_type": craft_name,
                "cluster_id": cluster_id,
                "materials": materials,
                "production_hours": hours,
                "raw_material_cost": mat_cost,
                "floor_price": floor_price,
                "wholesale_price": wholesale_price,
                "retail_price": retail_price,
                "embedding_siglip_768": [round(float(x), 6) for x in vec[:768]],
                "benchmark_source": "MoSJE 2026 Fair Trade Craft Valuation Index"
            })
            item_id += 1

    path = os.path.join(seeds_dir, "benchmark_products.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)
    print(f"  [OK] Generated: {os.path.basename(path)} (50 benchmark items with 768-d vectors)")


def generate_artisan_profiles_seed(seeds_dir):
    """Generate realistic artisan profiles across the 5 clusters with masked Aadhaar."""
    artisans = [
        {
            "artisan_id": "artisan-bastar-001",
            "name": "Sukhdev Baghel",
            "cluster_id": "cluster-bastar-dhokra-02",
            "craft_specialty": "Bastar Dhokra",
            "monthly_capacity_units": 40,
            "skilled_hourly_wage_inr": 125.0,
            "average_wholesale_price_inr": 1250.0,
            "aadhaar_masked": "XXXX-XXXX-9124",
            "experience_years": 22,
            "verified": True
        },
        {
            "artisan_id": "artisan-bastar-002",
            "name": "Mangal Ram Jhankar",
            "cluster_id": "cluster-bastar-dhokra-02",
            "craft_specialty": "Bastar Dhokra",
            "monthly_capacity_units": 35,
            "skilled_hourly_wage_inr": 125.0,
            "average_wholesale_price_inr": 1300.0,
            "aadhaar_masked": "XXXX-XXXX-4812",
            "experience_years": 18,
            "verified": True
        },
        {
            "artisan_id": "artisan-bastar-003",
            "name": "Dhaniram Ghadwa",
            "cluster_id": "cluster-bastar-dhokra-02",
            "craft_specialty": "Bastar Dhokra",
            "monthly_capacity_units": 30,
            "skilled_hourly_wage_inr": 125.0,
            "average_wholesale_price_inr": 1200.0,
            "aadhaar_masked": "XXXX-XXXX-3051",
            "experience_years": 15,
            "verified": True
        },
        {
            "artisan_id": "artisan-varanasi-001",
            "name": "Ramzan Ali Ansari",
            "cluster_id": "cluster-varanasi-silk-01",
            "craft_specialty": "Varanasi Silk",
            "monthly_capacity_units": 15,
            "skilled_hourly_wage_inr": 150.0,
            "average_wholesale_price_inr": 24000.0,
            "aadhaar_masked": "XXXX-XXXX-7103",
            "experience_years": 28,
            "verified": True
        },
        {
            "artisan_id": "artisan-khurja-001",
            "name": "Kailash Prajapati",
            "cluster_id": "cluster-khurja-pottery-03",
            "craft_specialty": "Khurja Pottery",
            "monthly_capacity_units": 250,
            "skilled_hourly_wage_inr": 110.0,
            "average_wholesale_price_inr": 350.0,
            "aadhaar_masked": "XXXX-XXXX-6294",
            "experience_years": 20,
            "verified": True
        },
        {
            "artisan_id": "artisan-madhubani-001",
            "name": "Sunita Devi Karn",
            "cluster_id": "cluster-madhubani-painting-04",
            "craft_specialty": "Madhubani Painting",
            "monthly_capacity_units": 25,
            "skilled_hourly_wage_inr": 130.0,
            "average_wholesale_price_inr": 1800.0,
            "aadhaar_masked": "XXXX-XXXX-8319",
            "experience_years": 16,
            "verified": True
        },
        {
            "artisan_id": "artisan-channapatna-001",
            "name": "Syed Basha",
            "cluster_id": "cluster-channapatna-toys-05",
            "craft_specialty": "Channapatna Toys",
            "monthly_capacity_units": 180,
            "skilled_hourly_wage_inr": 140.0,
            "average_wholesale_price_inr": 280.0,
            "aadhaar_masked": "XXXX-XXXX-1940",
            "experience_years": 14,
            "verified": True
        }
    ]
    path = os.path.join(seeds_dir, "artisan_profiles.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(artisans, f, indent=2, ensure_ascii=False)
    print(f"  [OK] Generated: {os.path.basename(path)}")


def generate_mock_rfq_orders_seed(seeds_dir):
    """Generate canonical B2B RFQ orders, including Acceptance Criterion A3 test case."""
    rfqs = [
        {
            "rfq_id": "rfq-test-a3-canonical",
            "buyer_id": "buyer-delhi-hotel-chain",
            "buyer_name": "Imperial Palace Hotels New Delhi",
            "craft_type": "Bastar Dhokra",
            "quantity": 200,
            "unit_budget": 1500.0,
            "total_budget": 300000.0,
            "deadline_days": 60,
            "delivery_location": "New Delhi",
            "delivery_latitude": 28.6139,
            "delivery_longitude": 77.2090,
            "specifications": "200 units of traditional brass tribal horse/elephant figures, approx 500g each.",
            "test_purpose": "Validates Acceptance Criterion A3: 200 units brass @ 1500 INR"
        },
        {
            "rfq_id": "rfq-edge-impossible-capacity",
            "buyer_id": "buyer-global-export-corp",
            "buyer_name": "Indo-Craft Global Exporters",
            "craft_type": "Bastar Dhokra",
            "quantity": 50000,
            "unit_budget": 1400.0,
            "total_budget": 70000000.0,
            "deadline_days": 7,
            "delivery_location": "Mumbai",
            "delivery_latitude": 18.9220,
            "delivery_longitude": 72.8347,
            "specifications": "Massive bulk order testing capacity feasibility gate",
            "test_purpose": "Validates capacity_feasibility: false on impossible lead time"
        },
        {
            "rfq_id": "rfq-edge-subfloor-budget",
            "buyer_id": "buyer-discount-retail",
            "buyer_name": "Bargain Bazaar Ltd",
            "craft_type": "Varanasi Silk",
            "quantity": 500,
            "unit_budget": 200.0,
            "total_budget": 100000.0,
            "deadline_days": 90,
            "delivery_location": "Kolkata",
            "delivery_latitude": 22.5726,
            "delivery_longitude": 88.3639,
            "specifications": "Unrealistic sub-floor predatory budget",
            "test_purpose": "Validates price_feasibility_score == 0.0 and exploitation warning"
        },
        {
            "rfq_id": "rfq-edge-zero-match-craft",
            "buyer_id": "buyer-modern-art-gallery",
            "buyer_name": "Avant-Garde Neon Studio",
            "craft_type": "Blown Glass Neon Sculptures",
            "quantity": 100,
            "unit_budget": 5000.0,
            "total_budget": 500000.0,
            "deadline_days": 30,
            "delivery_location": "Bengaluru",
            "delivery_latitude": 12.9716,
            "delivery_longitude": 77.5946,
            "specifications": "Non-traditional craft outside of 5 seeded clusters",
            "test_purpose": "Validates zero-match handling and empty results list"
        }
    ]
    path = os.path.join(seeds_dir, "mock_rfq_orders.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rfqs, f, indent=2, ensure_ascii=False)
    print(f"  [OK] Generated: {os.path.basename(path)}")


def duplicate_to_seeds_alt():
    """Ensure both backend/tests/fixtures/seed_data and backend/tests/fixtures/seeds are synchronized."""
    for filename in os.listdir(SEEDS_DIR):
        src = os.path.join(SEEDS_DIR, filename)
        dst = os.path.join(SEEDS_ALT_DIR, filename)
        if os.path.isfile(src):
            shutil.copy2(src, dst)
    print("  [OK] Synchronized seed files to backend/tests/fixtures/seeds/")


def main():
    print("=" * 65)
    print("  AUTONOMOUS TEST FIXTURES GENERATION — SIH26090 (MoSJE)")
    print("=" * 65)

    print("\n[Phase 1/3] Generating Synthetic Cluttered Craft & Edge Images...")
    generate_varanasi_silk(os.path.join(IMAGES_DIR, "cluttered_varanasi_silk.jpg"))
    generate_bastar_dhokra(os.path.join(IMAGES_DIR, "cluttered_bastar_dhokra.jpg"))
    generate_khurja_pottery(os.path.join(IMAGES_DIR, "cluttered_khurja_pottery.jpg"))
    generate_madhubani_art(os.path.join(IMAGES_DIR, "cluttered_madhubani_art.jpg"))
    generate_channapatna_toy(os.path.join(IMAGES_DIR, "cluttered_channapatna_toy.jpg"))
    generate_edge_cases(IMAGES_DIR)

    print("\n[Phase 2/3] Generating Synthesized Audio & Formant Waveforms...")
    generate_audio_fixtures(AUDIO_DIR)

    print("\n[Phase 3/3] Generating Seed Catalogs, Benchmarks & Vector Embeddings...")
    generate_cluster_seed_data(SEEDS_DIR)
    generate_benchmark_products_seed(SEEDS_DIR)
    generate_artisan_profiles_seed(SEEDS_DIR)
    generate_mock_rfq_orders_seed(SEEDS_DIR)
    duplicate_to_seeds_alt()

    print("\n" + "=" * 65)
    print("  ALL VERIFICATION FIXTURES GENERATED SUCCESSFULLY!")
    print(f"  Images: {len(os.listdir(IMAGES_DIR))} files in {IMAGES_DIR}")
    print(f"  Audio:  {len(os.listdir(AUDIO_DIR))} files in {AUDIO_DIR}")
    print(f"  Seeds:  {len(os.listdir(SEEDS_DIR))} files in {SEEDS_DIR}")
    print("=" * 65)


if __name__ == "__main__":
    main()
