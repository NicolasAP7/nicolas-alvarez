const players = Array.from(document.querySelectorAll("audio"));

players.forEach((player) => {
  player.addEventListener("play", () => {
    players.forEach((otherPlayer) => {
      if (otherPlayer !== player) {
        otherPlayer.pause();
      }
    });
  });
});
