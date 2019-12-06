import { promisify } from 'util';
import { join, dirname, basename } from 'path';

import which from 'which';
import execa from 'execa';

const whichp = promisify(which);

export default ({ cacheDir }) => {
  function getFfmpegPath() {
    return whichp('ffmpeg');
  }

  async function runFfmpeg(args) {
    console.debug('ffmpeg', args.join(' '));

    const startTime = new Date().getTime();

    const ffmpegPath = await getFfmpegPath();
    const process = execa(ffmpegPath, args);
    const result = await process;
    console.debug('ffmpeg took', new Date().getTime() - startTime, 'ms');
    console.debug(result.stdout);
  }

  async function renderFrameFiltered(timestamp, inputImagePath, filterOpts = []) {
    const filteredPath = join(cacheDir, `frame-filtered-${new Date().getTime()}.jpeg`);

    const args = [
      '-i', inputImagePath,
      ...filterOpts,
      '-hide_banner',
      '-f', 'image2',
      '-y', filteredPath,
    ];

    await runFfmpeg(args);

    return filteredPath;
  }

  async function encodeVideo(inPath, filterOpts = []) {
    const outPath = join(dirname(inPath), `${basename(inPath)}-encoded.mp4`);

    const crf = 16;

    const args = [
      '-i', inPath,
      // '-async', '1', '-acodec', 'aac', '-b:a', `${audioBitrate}k`, '-ar', '44100', '-ac', '2',
      '-acodec', 'copy',
      ...filterOpts,

      // https://trac.ffmpeg.org/wiki/Encode/H.264
      '-crf', crf, '-vcodec', 'libx264', '-profile:v', 'baseline', '-x264opts', 'level=3.0',

      '-threads', '0', '-map', '0',
      // '-map', '0:v:0', '-map', '0:a:1'
      // '-flags', '-global_header'
      '-y',
      outPath,
    ];

    await runFfmpeg(args);
  }

  return {
    runFfmpeg,
    renderFrameFiltered,
    encodeVideo,
  };
};
