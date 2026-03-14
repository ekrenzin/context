const WORDS = [
  "amber", "atlas", "blaze", "bolt", "cedar", "cliff", "coral", "crest",
  "dusk", "echo", "ember", "fern", "flint", "frost", "gale", "grove",
  "haze", "iris", "jade", "lark", "luna", "marsh", "mist", "moss",
  "nova", "opal", "peak", "pine", "plum", "rain", "reef", "ridge",
  "sage", "shard", "slate", "spark", "steel", "stone", "storm", "swift",
  "thorn", "tide", "vale", "wave", "willow", "wren", "zephyr", "zinc",
];

export function randomWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}
