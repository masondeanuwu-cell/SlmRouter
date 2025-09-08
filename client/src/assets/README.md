Place background assets here.

- Add your animated background as `nightsky.gif`.
- Recommended optimizations:
  - Reduce resolution (e.g., 1280x720) and compress GIF using tools like gifsicle or ImageMagick.
  - Consider converting to an MP4/WebM and use <video> for better performance.

Example optimized gif command (gifsicle):

  gifsicle --colors 128 --careful --lossy=80 input.gif -o nightsky.gif

Or to create a looping webm fallback (recommended):

  ffmpeg -i input.gif -c:v libvpx-vp9 -b:v 0 -crf 30 -an -pix_fmt yuva420p nightsky.webm

Place `nightsky.gif` and optional `nightsky.webm` next to this README, then the landing page will load `/assets/nightsky.gif` as the background.
