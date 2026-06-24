export const PRESET_EXERCISE_CATEGORY_IDS = [
  "daily-check-in",
  "warm-reset",
  "pitch-floor",
  "phrase-endings",
  "melody-intonation",
  "resonance-brightness",
  "flow-easy-voice",
  "volume-control",
  "conversation-carryover",
] as const;

export type PresetExerciseCategoryId = (typeof PRESET_EXERCISE_CATEGORY_IDS)[number];
export type ExerciseCategoryId = PresetExerciseCategoryId | "custom";

export interface ExerciseCategory {
  id: ExerciseCategoryId;
  label: string;
  description: string;
}

export const EXERCISE_CATEGORIES: ExerciseCategory[] = [
  {
    id: "daily-check-in",
    label: "Daily Check-In",
    description: "Same-style sentences for tracking baseline voice over time.",
  },
  {
    id: "warm-reset",
    label: "Warm Reset",
    description: "Gentle forward resonance and easy onset before harder work.",
  },
  {
    id: "pitch-floor",
    label: "Pitch Floor",
    description: "Sentences that test staying above the selected register floor.",
  },
  {
    id: "phrase-endings",
    label: "Phrase Endings",
    description: "Practice landing the last words without dropping too low.",
  },
  {
    id: "melody-intonation",
    label: "Melody / Intonation",
    description: "Questions, reactions, and contrast for natural pitch movement.",
  },
  {
    id: "resonance-brightness",
    label: "Resonance / Brightness",
    description: "Light, forward phrases with bright consonants and vowels.",
  },
  {
    id: "flow-easy-voice",
    label: "Flow / Easy Voice",
    description: "Airflow and low-strain phrases for smoother voicing.",
  },
  {
    id: "volume-control",
    label: "Volume Control",
    description: "Practice soft, clear, and conversational loudness without pressing.",
  },
  {
    id: "conversation-carryover",
    label: "Conversation Carryover",
    description: "Everyday phrases that transfer practice into real speech.",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Type your own phrase, script, phone line, or practice sentence.",
  },
];

export const EXERCISE_LIBRARY: Record<PresetExerciseCategoryId, string[]> = {
  "daily-check-in": makeDailyCheckIns(),
  "warm-reset": makeWarmResets(),
  "pitch-floor": makePitchFloor(),
  "phrase-endings": makePhraseEndings(),
  "melody-intonation": makeMelodyIntonation(),
  "resonance-brightness": makeResonanceBrightness(),
  "flow-easy-voice": makeFlowEasyVoice(),
  "volume-control": makeVolumeControl(),
  "conversation-carryover": makeConversationCarryover(),
};

function makeDailyCheckIns(): string[] {
  return build100(
    [
      "The morning light feels gentle",
      "The quiet room feels steady",
      "My voice can stay easy",
      "This little practice feels simple",
      "The window light is soft",
      "I can begin without rushing",
      "The day starts with one calm sentence",
      "My sound can stay balanced",
      "I am listening for ease",
      "This take is just a check-in",
    ],
    [
      "and I can let my voice stay easy through the whole sentence.",
      "while I keep the sound steady from start to finish.",
      "as I notice pitch, resonance, and effort.",
      "and I do not need to push to be heard.",
      "while every phrase lands with the same gentle shape.",
      "as I speak clearly and stay relaxed.",
      "and I let the final words stay lifted.",
      "while I keep the rhythm conversational.",
      "as I use this take to compare with tomorrow.",
      "and I let the sound bloom without strain.",
    ],
  );
}

function makeWarmResets(): string[] {
  return build100(
    [
      "Mmm, moon, many, morning",
      "Mmm, me, maybe, mellow",
      "Mmm, mini, motion, music",
      "Mmm, name, near, narrow",
      "Mmm, new, noon, moving",
      "Mmm, light, little, lilac",
      "Mmm, nice, nimble, nearby",
      "Mmm, easy, even, airy",
      "Mmm, hum, home, honey",
      "Mmm, sing, silver, simple",
    ],
    [
      "and I keep the buzz easy at the front.",
      "while the sound stays light and relaxed.",
      "then I speak without grabbing in my throat.",
      "and I let the onset stay gentle.",
      "while the vibration stays forward.",
      "then I carry that easy feeling into speech.",
      "and I reset before the next sentence.",
      "while my jaw and tongue stay loose.",
      "then I let the phrase start softly.",
      "and I stop if the sound feels tight.",
    ],
  );
}

function makePitchFloor(): string[] {
  return build100(
    [
      "I can keep this sentence above my floor",
      "This phrase stays lifted without squeezing",
      "I will start easy and keep the line steady",
      "My pitch can stay present through the final word",
      "I am aiming for a stable floor today",
      "This take checks whether my voice drops",
      "I can notice the low notes without judging them",
      "The sentence can stay comfortably above the line",
      "I will speak slowly enough to stay in range",
      "My voice can rise gently and stay there",
    ],
    [
      "while the ending remains light.",
      "without pressing for height.",
      "as the middle words stay connected.",
      "and the last syllable does not fall away.",
      "with a calm breath before I begin.",
      "while I keep the sound conversational.",
      "and I restart if I feel myself drop.",
      "through one smooth, even phrase.",
      "while still sounding natural.",
      "as I let effort stay low.",
    ],
  );
}

function makePhraseEndings(): string[] {
  return build100(
    [
      "I am going to finish this phrase lightly",
      "The last two words can stay level",
      "I can land the ending without falling",
      "This sentence finishes with the same easy sound",
      "I will keep the final word from dropping",
      "The phrase can end gently and clearly",
      "I can slow down at the end without sinking",
      "My voice stays present through the period",
      "The ending is soft but still lifted",
      "I can complete the thought with ease",
    ],
    [
      "then begin again with the same placement.",
      "and keep my breath moving.",
      "without turning the last syllable heavy.",
      "as if the line continues forward.",
      "while my jaw stays relaxed.",
      "and the sound remains bright.",
      "without rushing the final syllable.",
      "then pause before the next phrase.",
      "while I listen for a clean landing.",
      "and keep the whole phrase connected.",
    ],
  );
}

function makeMelodyIntonation(): string[] {
  return build100(
    [
      "Really? I thought we were meeting later",
      "Could you send that to me again?",
      "Wait, that actually sounds pretty good",
      "Are we going now or after lunch?",
      "I like that idea, but maybe tomorrow",
      "You found it? That is such a relief",
      "I was wondering if you had a minute",
      "That one is cute, but this one is better",
      "Do you want coffee, tea, or water?",
      "I did not expect that, but I love it",
    ],
    [
      "and I let the question rise naturally.",
      "with contrast on the important words.",
      "while the melody stays expressive.",
      "and I avoid flattening the whole line.",
      "with a small lift before the pause.",
      "while the final word stays intentional.",
      "and each phrase has a clear shape.",
      "without overacting the pitch movement.",
      "while the rhythm feels conversational.",
      "and I let surprise sound easy.",
    ],
  );
}

function makeResonanceBrightness(): string[] {
  return build100(
    [
      "Tiny shiny keys sit near the city window",
      "Silver earrings shimmer in the evening light",
      "The little teal ticket is still on the table",
      "Jessie keeps the clean dishes near the sink",
      "Nina sees six sweet peaches in the kitchen",
      "The easy sunny street feels bright today",
      "Mimi needs a tiny yellow sticky note",
      "Celia keeps seeing city lights at night",
      "These silly seashells seem shiny and thin",
      "The kitten sneaks into the sunny linen closet",
    ],
    [
      "while I keep the sound small and forward.",
      "and let the vowels stay bright.",
      "without pulling the sound back.",
      "as the consonants stay crisp.",
      "while my tongue stays light.",
      "and the phrase feels clear, not tight.",
      "with an easy smile in the sound.",
      "while the resonance stays near the front.",
      "and I keep the words gentle.",
      "without adding extra throat effort.",
    ],
  );
}

function makeFlowEasyVoice(): string[] {
  return build100(
    [
      "Who has the softest breeze?",
      "We have the smoothest way through",
      "I can hear the air move easily",
      "The whole phrase floats on one breath",
      "Who will wait with me here?",
      "I am letting the sound ride the air",
      "The warm wind moves through the room",
      "We were walking while the weather changed",
      "I can speak with flow instead of force",
      "The voice starts after the breath begins",
    ],
    [
      "and I keep my throat open.",
      "without squeezing the start.",
      "while the airflow stays steady.",
      "and the words stay connected.",
      "without pushing for volume.",
      "as the phrase remains smooth.",
      "and I release the final sound.",
      "while my shoulders stay relaxed.",
      "and the onset stays gentle.",
      "without holding my breath.",
    ],
  );
}

function makeVolumeControl(): string[] {
  return build100(
    [
      "I can say this softly, clearly, and conversationally",
      "This sentence starts quiet and grows only a little",
      "I can be heard without pressing",
      "My voice can stay easy at a normal volume",
      "I will speak gently, then a little clearer",
      "This line stays calm even when it gets louder",
      "I can add presence without adding strain",
      "The phrase is soft but not hidden",
      "I can project with breath instead of force",
      "My sound stays steady as the volume changes",
    ],
    [
      "while the pitch stays comfortable.",
      "and the throat stays relaxed.",
      "without making the voice heavy.",
      "as the words remain bright.",
      "and the final phrase stays controlled.",
      "without shouting or whispering.",
      "while the breath supports the sound.",
      "and the resonance stays forward.",
      "without losing clarity.",
      "as I return to conversational level.",
    ],
  );
}

function makeConversationCarryover(): string[] {
  return build100(
    [
      "Hey, do you want to grab coffee later?",
      "I was thinking we could meet around three",
      "Could you remind me where we parked?",
      "Thanks, I really appreciate your help",
      "I am running a little late, but I am on my way",
      "That sounds good to me, let's do it",
      "Can I get a table for two, please?",
      "I will call you back after the meeting",
      "I have a quick question about tomorrow",
      "It was really nice talking with you today",
    ],
    [
      "and I keep it casual.",
      "while the ending stays lifted.",
      "with an easy, natural rhythm.",
      "without slipping into performance mode.",
      "and I let the phrase sound like me.",
      "while the resonance stays bright.",
      "with one calm breath first.",
      "and the pitch movement stays alive.",
      "without rushing the last words.",
      "while I listen for comfort and clarity.",
    ],
  );
}

function build100(starts: string[], endings: string[]): string[] {
  const items: string[] = [];
  for (const start of starts) {
    for (const ending of endings) {
      items.push(`${start}, ${ending}`);
    }
  }
  return items.slice(0, 100);
}
