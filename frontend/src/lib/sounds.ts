// Answer feedback sounds. Off by default — the app is used on buses and in
// classrooms — and switchable in Profile. Haptics stay independent of this.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

const KEY = "zhd_sound_enabled";

let enabled = false;
let correct: AudioPlayer | null = null;
let wrong: AudioPlayer | null = null;
let configured = false;

export async function getSoundEnabled(): Promise<boolean> {
  enabled = (await storage.getItem<boolean>(KEY, false)) ?? false;
  return enabled;
}

export async function setSoundEnabled(value: boolean) {
  enabled = value;
  await storage.setItem(KEY, value);
  if (value) ensurePlayers();
}

/** Load preference once at startup so the first answer already has the right setting. */
export function initSounds() {
  getSoundEnabled()
    .then((v) => {
      if (v) ensurePlayers();
    })
    .catch(() => {});
}

function ensurePlayers() {
  if (Platform.OS === "web") return;
  try {
    if (!configured) {
      configured = true;
      // Mix with other audio and keep playing in silent mode off — a study app
      // should not talk over someone's music or ignore their mute switch.
      setAudioModeAsync({
        playsInSilentMode: false,
        interruptionMode: "mixWithOthers",
        shouldPlayInBackground: false,
      }).catch(() => {});
    }
    if (!correct) correct = createAudioPlayer(require("../../assets/sounds/correct.wav"));
    if (!wrong) wrong = createAudioPlayer(require("../../assets/sounds/wrong.wav"));
  } catch {
    correct = null;
    wrong = null;
  }
}

function play(player: AudioPlayer | null) {
  if (!enabled || !player) return;
  try {
    player.seekTo(0);
    player.play();
  } catch {
    /* audio is a nicety; never let it break an answer */
  }
}

export function playCorrect() {
  ensurePlayers();
  play(correct);
}

export function playWrong() {
  ensurePlayers();
  play(wrong);
}

/** Plays the sound that matches an answer, if sounds are on. */
export function playAnswerSound(isCorrect: boolean) {
  if (!enabled) return;
  if (isCorrect) playCorrect();
  else playWrong();
}
