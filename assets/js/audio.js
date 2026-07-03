const players = Array.from(document.querySelectorAll(".cue audio"));

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) {
    return "0:00";
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

players.forEach((player, index) => {
  const cue = player.closest(".cue");
  const title = cue?.querySelector("span");

  if (!cue || !title) {
    return;
  }

  const playerId = `cue-player-${index + 1}`;
  const originalLabel = title.textContent.trim();

  player.id = playerId;
  player.controls = false;
  player.setAttribute("aria-label", originalLabel);

  const reel = document.createElement("div");
  reel.className = "reel-player";

  const playButton = document.createElement("button");
  playButton.className = "reel-player__button";
  playButton.type = "button";
  playButton.setAttribute("aria-label", `Play ${originalLabel}`);
  playButton.setAttribute("aria-controls", playerId);
  playButton.innerHTML = '<span aria-hidden="true">Play</span>';

  const meta = document.createElement("div");
  meta.className = "reel-player__meta";

  title.classList.add("reel-player__title");
  meta.append(title);

  const timeline = document.createElement("input");
  timeline.className = "reel-player__timeline";
  timeline.type = "range";
  timeline.min = "0";
  timeline.max = "100";
  timeline.value = "0";
  timeline.step = "0.1";
  timeline.setAttribute("aria-label", `Seek ${originalLabel}`);

  const time = document.createElement("span");
  time.className = "reel-player__time";
  time.textContent = "0:00";

  meta.append(timeline, time);
  reel.append(playButton, meta);
  cue.prepend(reel);

  const updateProgress = () => {
    const duration = player.duration || 0;
    const currentTime = player.currentTime || 0;
    const percent = duration ? (currentTime / duration) * 100 : 0;

    timeline.value = String(percent);
    timeline.style.setProperty("--progress", `${percent}%`);
    time.textContent = duration
      ? `${formatTime(currentTime)} / ${formatTime(duration)}`
      : formatTime(currentTime);
  };

  const setPlayingState = (isPlaying) => {
    cue.classList.toggle("is-playing", isPlaying);
    playButton.setAttribute("aria-label", `${isPlaying ? "Pause" : "Play"} ${originalLabel}`);
    playButton.querySelector("span").textContent = isPlaying ? "Pause" : "Play";
  };

  playButton.addEventListener("click", () => {
    if (player.paused) {
      const playRequest = player.play();

      if (playRequest) {
        playRequest.catch(() => {
          setPlayingState(false);
        });
      }
    } else {
      player.pause();
    }
  });

  timeline.addEventListener("input", () => {
    if (!player.duration) {
      return;
    }

    player.currentTime = (Number(timeline.value) / 100) * player.duration;
    updateProgress();
  });

  player.addEventListener("play", () => {
    pauseOtherPlayers(player);
    setPlayingState(true);
  });

  player.addEventListener("pause", () => {
    setPlayingState(false);
  });

  player.addEventListener("ended", () => {
    player.currentTime = 0;
    setPlayingState(false);
    updateProgress();
  });

  player.addEventListener("loadedmetadata", updateProgress);
  player.addEventListener("timeupdate", updateProgress);

  updateProgress();
});
