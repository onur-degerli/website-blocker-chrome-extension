function playAlarmMusic() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const now = audioContext.currentTime;
  const notes = [
    { frequency: 880, start: 0, duration: 0.16 },
    { frequency: 1174.66, start: 0.18, duration: 0.16 },
    { frequency: 1318.51, start: 0.36, duration: 0.2 },
    { frequency: 1174.66, start: 0.62, duration: 0.16 },
    { frequency: 1318.51, start: 0.8, duration: 0.28 }
  ];

  notes.forEach((note) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startTime = now + note.start;
    const endTime = startTime + note.duration;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(note.frequency, startTime);
    gainNode.gain.setValueAtTime(0.001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.18, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, endTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.03);
  });

  setTimeout(() => audioContext.close(), 1400);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "play-pomodoro-alarm") {
    playAlarmMusic();
  }
});
