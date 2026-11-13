#!/usr/bin/env python3
"""Turn a folder of PNG frames into a README GIF and a marketplace WebP.

    python3 media/make.py <frames-dir> <name> [hold-ms] [out-dir]

Frame timing comes from each file's modification time, so the output plays
at the speed it was recorded. The last frame holds for hold-ms (default 1200).

Writes <out-dir>/<name>.gif (800px wide, for the README) and
<out-dir>/<name>.webp (1200px wide animated WebP, for the marketplace, which
accepts PNG, JPEG, and WebP but not GIF, and needs images 1200px or wider).
Needs ffmpeg and img2webp (brew install ffmpeg webp) and macOS sips.
"""
import os, subprocess, sys, tempfile

src, name = os.path.abspath(sys.argv[1]), sys.argv[2]
hold = int(sys.argv[3]) if len(sys.argv) > 3 else 1200
out = sys.argv[4] if len(sys.argv) > 4 else 'media-out'
os.makedirs(out, exist_ok=True)

frames = sorted(os.path.join(src, f) for f in os.listdir(src) if f.endswith('.png'))
if not frames:
    sys.exit(f'No PNG frames in {src}')
stamps = [os.stat(f).st_mtime_ns // 1_000_000 for f in frames]
durations = [max(20, b - a) for a, b in zip(stamps, stamps[1:])] + [hold]

with tempfile.TemporaryDirectory() as tmp:
    concat = os.path.join(tmp, 'frames.txt')
    with open(concat, 'w') as f:
        for frame, ms in zip(frames, durations):
            f.write(f"file '{frame}'\nduration {ms / 1000:.3f}\n")
        f.write(f"file '{frames[-1]}'\n")
    palette = ('[0:v]scale=800:-1:flags=lanczos,split[a][b];'
               '[a]palettegen=stats_mode=diff[p];'
               '[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
                    '-i', concat, '-filter_complex', palette, '-loop', '0',
                    os.path.join(out, f'{name}.gif')], check=True)

    args = ['img2webp', '-loop', '0', '-lossy', '-q', '72', '-m', '6']
    for frame, ms in zip(frames, durations):
        small = os.path.join(tmp, os.path.basename(frame))
        subprocess.run(['sips', '-Z', '1200', frame, '--out', small], check=True, capture_output=True)
        args += ['-d', str(ms), small]
    subprocess.run(args + ['-o', os.path.join(out, f'{name}.webp')], check=True, capture_output=True)

for ext in ('gif', 'webp'):
    path = os.path.join(out, f'{name}.{ext}')
    print(f'{path}  {os.path.getsize(path) // 1024} KB')
