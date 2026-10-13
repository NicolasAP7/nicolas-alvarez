const players = Array.from(document.querySelectorAll(".cue audio"));
const categories = Array.from(document.querySelectorAll(".cue-category"));
const playerNumbers = new Map(players.map((player, index) => [player, index + 1]));
const waveformCache = new Map();
let audioContext;
let analysisQueue = Promise.resolve();

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) {
    return "--:--";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
};

const pauseOtherPlayers = (activePlayer) => {
  players.forEach((player) => {
    if (player !== activePlayer) {
      player.pause();
    }
  });
};

const getAudioContext = () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error("Web Audio API is not available");
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  return audioContext;
};

const calculateWaveformPeaks = (audioBuffer, barCount) => {
  const channelCount = Math.min(audioBuffer.numberOfChannels, 2);
  const samplesPerBar = Math.max(1, Math.floor(audioBuffer.length / barCount));
  const peaks = [];

  for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
    const start = barIndex * samplesPerBar;
    const end = barIndex === barCount - 1
      ? audioBuffer.length
      : Math.min(audioBuffer.length, start + samplesPerBar);
    const stride = Math.max(1, Math.ceil((end - start) / 1200));
    let peak = 0;
    let squareTotal = 0;
    let sampleCount = 0;

    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const channel = audioBuffer.getChannelData(channelIndex);

      for (let sampleIndex = start; sampleIndex < end; sampleIndex += stride) {
        const amplitude = Math.abs(channel[sampleIndex]);
        peak = Math.max(peak, amplitude);
        squareTotal += amplitude * amplitude;
        sampleCount += 1;
      }
    }

    const rms = sampleCount ? Math.sqrt(squareTotal / sampleCount) : 0;
    peaks.push(Math.max(peak * 0.48, rms * 1.7));
  }

  const maximum = Math.max(...peaks, 0.001);
  return peaks.map((peak) => Math.min(1, Math.pow(peak / maximum, 0.78)));
};

const analyzeWaveform = (player, barCount) => {
  const source = player.getAttribute("src");
  const url = new URL(source, document.baseURI).href;
  const cacheKey = `${url}:${barCount}`;

  if (waveformCache.has(cacheKey)) {
    return waveformCache.get(cacheKey);
  }

  const analysis = analysisQueue.then(async () => {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Unable to load waveform source: ${response.status}`);
    }

    const encodedAudio = await response.arrayBuffer();
    const decodedAudio = await getAudioContext().decodeAudioData(encodedAudio);
    return calculateWaveformPeaks(decodedAudio, barCount);
  });

  const cachedAnalysis = analysis.catch((error) => {
    waveformCache.delete(cacheKey);
    throw error;
  });

  waveformCache.set(cacheKey, cachedAnalysis);
  analysisQueue = cachedAnalysis.catch(() => undefined);
  return cachedAnalysis;
};

const createWaveform = (barCount = 64) => {
  const waveform = document.createElement("div");
  waveform.className = "playlist-player__waveform";
  waveform.setAttribute("aria-hidden", "true");

  const fallbackPeaks = [];
  const bars = Array.from({ length: barCount }, (_, index) => {
    const bar = document.createElement("span");
    const height = 22
      + Math.round((Math.sin(index * 0.61) + 1) * 18)
      + Math.round((Math.sin(index * 0.19 + 1.4) + 1) * 14);

    bar.className = "playlist-player__bar";
    bar.style.setProperty("--bar-height", `${Math.min(height, 94)}%`);
    bar.style.setProperty("--bar-index", index);
    fallbackPeaks.push(Math.min(height, 94) / 100);
    waveform.append(bar);
    return bar;
  });

  return { waveform, bars, fallbackPeaks };
};

categories.forEach((category) => {
  const cueList = category.querySelector(".cue-list");
  const items = Array.from(category.querySelectorAll(".cue")).map((cue) => ({
    cue,
    player: cue.querySelector("audio"),
    title: cue.querySelector("span")
  }));

  if (!cueList || !items.length || items.some(({ player, title }) => !player || !title)) {
    return;
  }

  const playerShell = document.createElement("div");
  playerShell.className = "playlist-player";

  const visual = document.createElement("div");
  visual.className = "playlist-player__visual";

  const playButton = document.createElement("button");
  playButton.className = "playlist-player__button";
  playButton.type = "button";
  playButton.innerHTML = '<span aria-hidden="true">Play</span>';

  const display = document.createElement("div");
  display.className = "playlist-player__display";

  const waveformShell = document.createElement("div");
  waveformShell.className = "playlist-player__waveform-shell";

  const { waveform, bars, fallbackPeaks } = createWaveform();

  const seek = document.createElement("input");
  seek.className = "playlist-player__seek";
  seek.type = "range";
  seek.min = "0";
  seek.max = "100";
  seek.value = "0";
  seek.step = "0.1";

  const nowPlaying = document.createElement("div");
  nowPlaying.className = "playlist-player__now";

  const nowTitle = document.createElement("span");
  nowTitle.className = "playlist-player__now-title";

  const nowTime = document.createElement("span");
  nowTime.className = "playlist-player__now-time";

  waveformShell.append(waveform, seek);
  nowPlaying.append(nowTitle, nowTime);
  display.append(waveformShell, nowPlaying);
  visual.append(playButton, display);
  playerShell.append(visual);
  cueList.before(playerShell);

  let activeIndex = 0;
  let waveformRequest = 0;
  const trackButtons = [];
  const durationLabels = [];

  const applyWaveform = (peaks) => {
    bars.forEach((bar, index) => {
      const peak = Number.isFinite(peaks[index]) ? peaks[index] : fallbackPeaks[index];
      bar.style.setProperty("--bar-height", `${Math.round(10 + peak * 84)}%`);
    });
  };

  const updateWaveform = () => {
    const request = waveformRequest + 1;
    const player = items[activeIndex].player;
    waveformRequest = request;
    applyWaveform(fallbackPeaks);
    playerShell.classList.add("is-loading");
    playerShell.classList.remove("is-fallback");
    playerShell.setAttribute("aria-busy", "true");

    analyzeWaveform(player, bars.length)
      .then((peaks) => {
        if (request !== waveformRequest || items[activeIndex].player !== player) {
          return;
        }

        applyWaveform(peaks);
        playerShell.classList.remove("is-loading");
        playerShell.setAttribute("aria-busy", "false");
      })
      .catch(() => {
        if (request !== waveformRequest || items[activeIndex].player !== player) {
          return;
        }

        applyWaveform(fallbackPeaks);
        playerShell.classList.remove("is-loading");
        playerShell.classList.add("is-fallback");
        playerShell.setAttribute("aria-busy", "false");
      });
  };

  const updateProgress = () => {
    const player = items[activeIndex].player;
    const storedDuration = Number(player.dataset.duration) || 0;
    const duration = Number.isFinite(player.duration) ? player.duration : storedDuration;
    const currentTime = Number.isFinite(player.currentTime) ? player.currentTime : 0;
    const percent = duration ? (currentTime / duration) * 100 : 0;

    seek.value = String(percent);
    bars.forEach((bar, index) => {
      bar.classList.toggle("is-played", ((index + 1) / bars.length) * 100 <= percent);
    });
    nowTime.textContent = duration
      ? `${formatTime(currentTime)} / ${formatTime(duration)}`
      : `${formatTime(currentTime)} / --:--`;
  };

  const updatePlayingState = () => {
    const { player, title } = items[activeIndex];
    const label = title.textContent.trim();
    const isPlaying = !player.paused && !player.ended;

    category.classList.toggle("is-playing", isPlaying);
    playButton.setAttribute("aria-label", `${isPlaying ? "Pause" : "Play"} ${label}`);
    playButton.querySelector("span").textContent = isPlaying ? "Pause" : "Play";
  };

  const selectTrack = (index, shouldAnalyze = false) => {
    const previousPlayer = items[activeIndex].player;

    if (index !== activeIndex && !previousPlayer.paused) {
      previousPlayer.pause();
    }

    activeIndex = index;
    const { player, title } = items[activeIndex];
    const label = title.textContent.trim();

    trackButtons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === activeIndex;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    nowTitle.textContent = label;
    playButton.setAttribute("aria-controls", player.id);
    seek.setAttribute("aria-label", `Seek ${label}`);
    updateProgress();
    updatePlayingState();

    if (shouldAnalyze) {
      updateWaveform();
    }
  };

  items.forEach(({ cue, player, title }, index) => {
    const label = title.textContent.trim();
    const playerNumber = playerNumbers.get(player);
    const trackButton = document.createElement("button");
    const duration = document.createElement("span");

    player.id = `cue-player-${playerNumber}`;
    player.setAttribute("aria-label", label);

    trackButton.className = "playlist-track";
    trackButton.type = "button";
    trackButton.setAttribute("aria-label", `Select and play ${label}`);
    trackButton.setAttribute("aria-pressed", "false");

    title.className = "playlist-track__title";
    duration.className = "playlist-track__duration";
    duration.textContent = formatTime(Number(player.dataset.duration));

    trackButton.append(title, duration);
    cue.prepend(trackButton);
    trackButtons.push(trackButton);
    durationLabels.push(duration);

    trackButton.addEventListener("click", () => {
      const isActive = index === activeIndex;

      if (isActive && !player.paused) {
        player.pause();
        return;
      }

      selectTrack(index, true);
      pauseOtherPlayers(player);
      const playRequest = player.play();

      if (playRequest) {
        playRequest.catch(updatePlayingState);
      }
    });

    const updateDuration = () => {
      durationLabels[index].textContent = formatTime(player.duration);

      if (index === activeIndex) {
        updateProgress();
      }
    };

    player.addEventListener("loadedmetadata", updateDuration);
    player.addEventListener("durationchange", updateDuration);
    player.addEventListener("timeupdate", () => {
      if (index === activeIndex) {
        updateProgress();
      }
    });
    player.addEventListener("play", () => {
      pauseOtherPlayers(player);

      if (index !== activeIndex) {
        selectTrack(index, true);
      }

      updatePlayingState();
    });
    player.addEventListener("pause", () => {
      if (index === activeIndex) {
        updatePlayingState();
      }
    });
    player.addEventListener("ended", () => {
      player.currentTime = 0;

      if (index === activeIndex) {
        updateProgress();
        updatePlayingState();
      }
    });
  });

  playButton.addEventListener("click", () => {
    const player = items[activeIndex].player;

    updateWaveform();

    if (!player.paused) {
      player.pause();
      return;
    }

    pauseOtherPlayers(player);
    const playRequest = player.play();

    if (playRequest) {
      playRequest.catch(updatePlayingState);
    }
  });

  seek.addEventListener("input", () => {
    const player = items[activeIndex].player;

    if (!Number.isFinite(player.duration)) {
      return;
    }

    player.currentTime = (Number(seek.value) / 100) * player.duration;
    updateProgress();
  });

  items.forEach(({ player }) => {
    player.controls = false;
  });
  category.classList.add("has-custom-player");
  selectTrack(0);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }

      updateWaveform();
      observer.unobserve(category);
    }, { rootMargin: "160px 0px" });

    observer.observe(category);
  } else {
    updateWaveform();
  }
});
