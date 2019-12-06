import fs from 'fs-extra';
import strongDataUri from 'strong-data-uri';

function getFrameFromVideo(video, format) {
  const startTime = new Date().getTime();
  const canvas = document.createElement('canvas');
  // console.debug('createElement', new Date().getTime() - startTime);

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  canvas.getContext('2d').drawImage(video, 0, 0);
  // console.debug('drawImage', new Date().getTime() - startTime);

  const dataUri = canvas.toDataURL(`image/${format}`, 0.7);
  // console.debug('toDataURL', new Date().getTime() - startTime);

  const decoded = strongDataUri.decode(dataUri);
  console.debug('capture frame took', new Date().getTime() - startTime, 'ms');

  return decoded;
}

async function captureFrame(outPath, video) {
  const buf = getFrameFromVideo(video, 'jpeg');
  if (buf.length === 0) throw new Error('No frame captured');

  await fs.writeFile(outPath, buf);
}

export default captureFrame;
