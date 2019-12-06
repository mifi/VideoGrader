import React, { useState, useEffect, useRef } from 'react';

import fs from 'fs-extra';
import { join, basename } from 'path';
import Mousetrap from 'mousetrap';
import useDebounce from 'react-use/lib/useDebounce';

import captureFrame from './capture-frame';
import Ffmpeg from './ffmpeg';

const tempy = require('tempy');

// TODO use in memory and piping instead
const cacheDir = tempy.directory();

const { renderFrameFiltered, encodeVideo } = Ffmpeg({ cacheDir });


async function init() {
  console.log(cacheDir);
  await fs.emptyDir(cacheDir);
}


function getRawPath(timestamp) {
  return join(cacheDir, `frame-raw-${timestamp}.jpeg`);
}


async function renderFrameRaw(timestamp, video) {
  const rawPath = getRawPath(timestamp);
  return captureFrame(rawPath, video);
}

function getParamsForKey(key) {
  return {
    contrast: { from: 0.5, to: 2.0, default: 1.0 },
    brightness: { from: -0.2, to: 0.3, default: 0.0 },
    saturation: { from: 0.0, to: 3.0, default: 1.0 },
    gamma: { from: 0.6, to: 3, default: 1.0 },
  }[key];
}

function getSliderValue(key, value) {
  const params = getParamsForKey(key);
  return ((value - params.from) / (params.to - params.from)) * 100;
}

function getEqValue(key, value) {
  const params = getParamsForKey(key);
  return (((value / 100) * (params.to - params.from)) + params.from).toFixed(3);
}

const initialState = {
  filtersMap: {
    contrast: getSliderValue('contrast', 1),
    brightness: getSliderValue('brightness', 0),
    saturation: getSliderValue('saturation', 1.0),
    gamma: getSliderValue('gamma', 1.0),
  },

  customFilterInput: '',
  lut3dDir: '',
  lut3dDirFiles: [],
  lut3dFile: '',
};

const initialVideoState = {
  filePath: undefined,
  framePath: undefined,
  playing: false,
  duration: undefined,
  currentTime: undefined,
};

const App = () => {
  const [filtersMap, setFiltersMap] = useState(initialState.filtersMap);
  const [customFilterInput, setCustomFilterInput] = useState(initialState.customFilterInput);
  const [lut3dFile, setLut3dFile] = useState(initialState.lut3dFile);
  const [lut3dDirFiles, setLut3dDirFiles] = useState(initialState.lut3dDirFiles);
  const [lut3dDir, setLut3dDir] = useState(initialState.lut3dDir);
  const [frameError, setFrameError] = useState(initialState.frameError);

  const [filePath, setFilePath] = useState(initialVideoState.filePath);
  const [framePath, setFramePath] = useState(initialVideoState.framePath);
  const [playing, setPlaying] = useState(initialVideoState.playing);
  const [duration, setDuration] = useState(initialVideoState.duration);
  const [currentTime, setCurrentTime] = useState(initialVideoState.currentTime);

  const videoRef = useRef();


  function resetVideoState() {
    // Prevents memory leak in video player
    videoRef.current.src = '';

    setFilePath(initialVideoState.filePath);
    setFramePath(initialVideoState.framePath);
    setPlaying(initialVideoState.playing);
    setDuration(initialVideoState.duration);
    setCurrentTime(initialVideoState.currentTime);
  }

  function getAllFilters() {
    // console.log(filtersMap);

    let eqFilters;
    if (filtersMap !== initialState.filtersMap) {
      // const eqFiltersPairs = Object.keys(filtersMap).map(k => `${k}=${filtersMap[k]}`);
      const eqFiltersPairs = [
        `brightness=${getEqValue('brightness', filtersMap.brightness)}`,
        `contrast=${getEqValue('contrast', filtersMap.contrast)}`,
        `saturation=${getEqValue('saturation', filtersMap.saturation)}`,
        `gamma=${getEqValue('gamma', filtersMap.gamma)}`,
      ];
      eqFilters = `eq=${eqFiltersPairs.join(':')}`;
    }

    const lut3dFileTrimmed = lut3dFile.trim();
    const lut3dFilter = lut3dFileTrimmed.length > 0 ? `lut3d=${lut3dFileTrimmed}` : '';
    const customFilterInputTrimmed = customFilterInput.trim();

    return [
      ...(customFilterInputTrimmed.length > 0 ? [customFilterInputTrimmed] : []),
      ...(lut3dFilter ? [lut3dFilter] : []),
      ...(eqFilters ? [eqFilters] : []),

      // TODO
      // https://stackoverflow.com/questions/3937387/rotating-videos-with-ffmpeg
      // 'transpose=1',
    ];
  }

  function getFiltersArgs() {
    const allFilters = getAllFilters();
    return allFilters.length > 0 ? ['-vf', allFilters.join(', ')] : [];
  }

  useEffect(() => {
    document.ondragover = document.ondragend = ev => ev.preventDefault(); // eslint-disable-line no-multi-assign,max-len

    document.body.ondrop = async (ev) => {
      ev.preventDefault();
      try {
        if (ev.dataTransfer.files.length !== 1) {
          window.alert('Only one file can be dropped');
          return;
        }

        // TODO check if supported by ffmpeg

        resetVideoState();
        setFilePath(ev.dataTransfer.files[0].path);
      } catch (err) {
        console.error(err);
        window.alert('Failed to load this folder');
      }
    };
  }, []);

  async function togglePlay() {
    if (playing) {
      await videoRef.current.pause();
      return;
    }

    try {
      await videoRef.current.play();
    } catch (e) {
      console.error('Unpause failed', e);
    }
  }

  useEffect(() => {
    init();
  }, [filePath]);

  useEffect(() => {
    Mousetrap.bind('space', togglePlay);
    return () => Mousetrap.unbind('space');
  }, [togglePlay]);

  function getCurrentFileName() {
    return filePath ? basename(filePath) : undefined;
  }

  useDebounce(() => {
    if (playing) return undefined;
    if (currentTime == null) return undefined;

    let cancelled = false;

    async function createFrame() {
      try {
        setFrameError(undefined);
        const rawPath = getRawPath(currentTime);

        if (!(await fs.exists(rawPath))) {
          await renderFrameRaw(currentTime, videoRef.current);
        }

        const filteredPath = await renderFrameFiltered(currentTime, rawPath, getFiltersArgs());
        if (!cancelled) setFramePath(filteredPath);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setFramePath(undefined);
          setFrameError(err.stdout);
        }
      }
    }

    createFrame();

    return () => {
      console.log('cancelled');
      cancelled = true;
    };
  }, 100, [filtersMap, customFilterInput, lut3dFile, playing, currentTime]);

  function resetFilters() {
    setFiltersMap(initialState.filtersMap);
    setCustomFilterInput(initialState.customFilterInput);
    setLut3dFile(initialState.lut3dFile);
  }

  function handlePlayChange(p) {
    setPlaying(p);
    setFramePath(undefined);
  }

  function handleFilterValueChange(key, value) {
    console.debug(key, getEqValue(key, value));
    setFiltersMap({ ...filtersMap, [key]: value });
  }

  async function handleLut3dDirChange(e) {
    const newDir = e.target.value;
    setLut3dDir(newDir);
    if (await fs.pathExists(newDir)) {
      const files = await fs.readdir(newDir);
      setLut3dDirFiles(files.filter(f => /(\.cube)$/i.test(f)).map(f => ({ path: join(lut3dDir, f), name: f })));
    } else {
      setLut3dDirFiles([]);
      setLut3dFile(initialState.lut3dFile);
    }
  }

  async function tryEncodeVideo() {
    try {
      console.log('Encoding started...');
      await encodeVideo(filePath, getFiltersArgs());
      alert('Done');
    } catch (err) {
      console.error(err);
      alert('Failed to export :(');
    }
  }

  function renderRangeSlider(key) {
    return (
      <div style={{ display: 'flex' }}>
        <div style={{ width: '30%' }}>{key}</div>
        <input
          style={{ flexGrow: 1 }}
          type="range"
          value={filtersMap[key]}
          onChange={e => handleFilterValueChange(key, parseFloat(e.target.value, 10))}
        />
      </div>);
  }

  return (
    <div style={{ left: 0, right: 0, top: 0, bottom: 0, position: 'absolute', background: 'black' }}>
      <video
        src={filePath}
        ref={videoRef}
        controls
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        onDurationChange={e => setDuration(e.target.duration)}
        onTimeUpdate={e => setCurrentTime(e.target.currentTime)}
        onPlay={() => handlePlayChange(true)}
        onPause={() => handlePlayChange(false)}
      />

      {framePath && !playing &&
        <img
          style={{ width: '100%', height: '100%', objectFit: 'contain', left: 0, right: 0, top: 0, bottom: 0, position: 'absolute', background: 'black' }}
          src={framePath}
          alt=""
        />
      }

      {!filePath && <div style={{ color: 'lightgray', position: 'absolute', top: '50%', left: '50%', marginLeft: -50, marginTop: -50, fontSize: 100 }}><i className="far fa-file" /></div>}

      <div style={{ position: 'absolute', top: 0, right: 0, cursor: 'pointer', color: 'white' }}>
        <span style={{ paddingRight: 10, textShadow: '0 0 3 black' }}>{getCurrentFileName()}</span>
        <span>{currentTime} / {duration}</span>
      </div>

      <div style={{ zIndex: 1, position: 'absolute', bottom: 0, right: 0, left: 0, display: 'flex', justifyContent: 'center', background: frameError ? '#fee' : 'white' }}>
        <button onClick={togglePlay}>play</button>
        <button onClick={resetFilters}>Reset filters</button><br />
        <button onClick={tryEncodeVideo}>Save</button>

        <div>
          <div>Custom filter:</div>

          <input
            placeholder="e.g. eq=saturation=1.2"
            type="text"
            onChange={e => setCustomFilterInput(e.target.value)}
            value={customFilterInput}
          />

          <input
            placeholder="Filter preview"
            type="text"
            readOnly
            value={getAllFilters().join(',')}
          />

          {frameError && (
            <div style={{ color: 'red' }} tabIndex="0" role="button" onClick={() => alert(frameError)}>ERROR</div>
          )}
        </div>

        <div>
          <div>LUT file:</div>
          <input
            placeholder="e.g. /path/to/test.cube"
            type="text"
            onChange={handleLut3dDirChange}
            value={lut3dDir}
          />
          <select value={lut3dFile} onChange={e => setLut3dFile(e.target.value)}>
            <option key="" value="">Choose LUT</option>
            {lut3dDirFiles.map(f =>
              <option key={f.path} value={f.path}>{f.name}</option>)}
          </select>
        </div>

        <div style={{ width: 300 }}>
          {renderRangeSlider('contrast')}
          {renderRangeSlider('brightness')}
          {renderRangeSlider('saturation')}
          {renderRangeSlider('gamma')}
        </div>
      </div>
    </div>
  );
};

export default App;
