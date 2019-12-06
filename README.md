# VideoGrader

VideoGrader is a simple graphical tool for color grading video clips with live preview using any of ffmpeg's filters. It can also be used for testing multiple ffmpeg filter commands on a video with a live preview of the result.

## Features

- Live preview of current filters on video any frame
- Sliders for contrast, brightness, saturation and gamma
- Supports 3D LUT files (color grading presets)
- Allows testing and applying any of ffmpeg's [Video Filters](https://ffmpeg.org/ffmpeg-filters.html#Video-Filters)
- Finally render to video and apply the filter to every frame

## Running

```
yarn

# In one terminal:
npm run watch

# Another terminal:
npm start
```

## TODO

- Package electron app (use electron-builder)
- Playback controls
- Parse filter into sliders
- Improve error feedback
- Show loading when transcoding
- Allow setting output file encoding options
- [colorbalance](https://ffmpeg.org/ffmpeg-filters.html#colorbalance)
- [unsharp](https://ffmpeg.org/ffmpeg-filters.html#unsharp)
- [curves](https://video.stackexchange.com/questions/13104/similar-to-levels-adjustment-brightness-improvement-with-ffmpeg)
