// Quirky D&D-flavored messaging. Centralised so quips are easy to add to.

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const WRONG_CREDS = [
  "Your password failed its saving throw. Try again.",
  "That incantation fizzles — wrong email or password.",
  "The vault stays sealed. Those credentials don't match.",
  "Natural 1 on that login. Check your spelling and retry.",
  "The gate guardian shakes its head. Not today.",
];

// Escalating taunts after repeated failures — the "should you be here?" easter egg.
const PERSISTENT = [
  "The DM raises an eyebrow… still not it.",
  "Roll for Investigation — your password might be in another castle.",
  "The tavern has gone quiet. Everyone's watching you fail this login.",
  "Are you sure this is YOUR account, friend?",
];

// Friendly nudges for wandering somewhere that doesn't exist.
export const NOT_FOUND_QUIPS = [
  "You wandered off the edge of the map.",
  "This corridor leads nowhere — the cartographer never finished it.",
  "You open the door to an empty void. Spooky.",
  "There's no quest here. Best turn back, adventurer.",
];

export function flavorAuthError(err, attempts = 1) {
  const msg = (err?.message || "").toLowerCase();

  if (msg.includes("invalid login")) {
    return attempts >= 5 ? pick(PERSISTENT) : pick(WRONG_CREDS);
  }
  if (msg.includes("already registered") || msg.includes("already been registered")) {
    return "A hero by that name is already in the chronicle — try signing in instead.";
  }
  if (msg.includes("at least") && msg.includes("character")) {
    return "That password is too frail to survive an encounter — give it 6+ characters.";
  }
  if (msg.includes("not confirmed")) {
    return "Your account awaits — check your scroll (email) to confirm before entering.";
  }
  if (msg.includes("rate") || msg.includes("too many")) {
    return "Whoa there, adventurer — too many attempts. Take a short rest and try again.";
  }
  if (msg.includes("invalid email") || msg.includes("unable to validate email")) {
    return "That email doesn't look quite right, scribe. Double-check it.";
  }

  // Fallback keeps the real reason but wraps it in a little flavor.
  return err?.message
    ? `The arcane weave resists: ${err.message}`
    : "Something went awry in the aether. Try again.";
}
